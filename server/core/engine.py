import threading
import time
import cv2
import queue
import datetime
import numpy as np
import imutils
import traceback
import json
import os
import csv
from collections import deque

# Local imports
try:
    from config import VIDEO_CONFIG, YOLO_CONFIG, SOCIAL_DISTANCE, DETECT_CONFIG, ALERT_CONFIG
    from tracking import detect_human
    from util import rect_distance, kinetic_energy
    from colors import RGB_COLORS
    from whatsapp_alert import send_whatsapp_alert
    
    # DeepSort imports
    from deep_sort import nn_matching
    from deep_sort.detection import Detection
    from deep_sort.tracker import Tracker
    from deep_sort import generate_detections as gdet
except ImportError:
    # Handle relative imports if running from different context
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import VIDEO_CONFIG, YOLO_CONFIG, SOCIAL_DISTANCE, DETECT_CONFIG, ALERT_CONFIG
    from tracking import detect_human
    from util import rect_distance, kinetic_energy
    from colors import RGB_COLORS
    from whatsapp_alert import send_whatsapp_alert
    
    from deep_sort import nn_matching
    from deep_sort.detection import Detection
    from deep_sort.tracker import Tracker
    from deep_sort import generate_detections as gdet


class VideoEngine:
    def __init__(self):
        self.lock = threading.Lock()
        self.output_frame = None
        self.frame_queue = queue.Queue(maxsize=1)  # Only keep latest frame
        
        self.is_running = False
        self.thread = None
        
        # Config state
        self.source = VIDEO_CONFIG["VIDEO_CAP"]
        self.is_cam = VIDEO_CONFIG["IS_CAM"]
        self.conf_thresh = DETECT_CONFIG["MIN_CONF"]
        self.nms_thresh = DETECT_CONFIG["NMS_THRESH"]
        
        # Alerts
        self.alert_config = ALERT_CONFIG.copy()

        # Models
        self.net = None
        self.ln = None
        self.encoder = None
        self.tracker = None
        
        # Data
        self.crowd_data = {
            "time": "-",
            "human_count": 0,
            "violation_count": 0,
            "restricted_entry": False,
            "abnormal_activity": False
        }
        self.movement_tracks = []
        self.heatmap_accumulator = None # Will init with frame size
        self.recent_energy = deque(maxlen=50) # For graph
        
        self.load_models()
    
    def get_heatmap(self):
        """Return the latest Heatmap JPEG"""
        with self.lock:
             if self.heatmap_accumulator is None:
                 return None
             
             # Normalize and Color
             norm = cv2.normalize(self.heatmap_accumulator, None, 0, 255, cv2.NORM_MINMAX)
             norm = np.asarray(norm, dtype=np.uint8)
             color_map = cv2.applyColorMap(norm, cv2.COLORMAP_JET)
             
             ret, buffer = cv2.imencode('.jpg', color_map)
             if ret:
                 return buffer.tobytes()
             return None

    def load_models(self):

        print("[Engine] Loading models...")
        # YOLO
        self.net = cv2.dnn.readNetFromDarknet(YOLO_CONFIG["CONFIG_PATH"], YOLO_CONFIG["WEIGHTS_PATH"])
        self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        ln = self.net.getLayerNames()
        self.ln = [ln[i - 1] for i in self.net.getUnconnectedOutLayers()]
        
        # DeepSort
        max_cosine_distance = 0.7
        nn_budget = None
        model_filename = 'model_data/mars-small128.pb'
        self.encoder = gdet.create_box_encoder(model_filename, batch_size=1)
        metric = nn_matching.NearestNeighborDistanceMetric("cosine", max_cosine_distance, nn_budget)
        self.tracker = Tracker(metric, max_age=30)
        print("[Engine] Models loaded.")

    def update_source(self, source_input):
        """Update video source (0, '1', 'http://...', 'file.mp4')"""
        with self.lock:
            # Try to cast to int for webcam index
            try:
                self.source = int(source_input)
                self.is_cam = True
            except ValueError:
                self.source = source_input
                self.is_cam = "http" in source_input or "rtsp" in source_input or len(source_input) < 3
            
            print(f"[Engine] Source updated to: {self.source}")
            self.stop()
            time.sleep(0.5)
            self.start()

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self.process_loop, daemon=True)
        self.thread.start()
        print("[Engine] Thread started.")

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        print("[Engine] Thread stopped.")

    def create_no_signal_frame(self):
        """Push a 'No Signal' placeholder frame"""
        frame = np.zeros((600, 800, 3), dtype=np.uint8)
        cv2.putText(frame, "NO SIGNAL / CHECK SOURCE", (200, 300), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        ret, buffer = cv2.imencode('.jpg', frame)
        if ret:
             if not self.frame_queue.empty():
                 try: self.frame_queue.get_nowait()
                 except: pass
             self.frame_queue.put(buffer.tobytes())

    def get_frame(self):
        """Return the latest JPEG frame details"""
        try:
            # Non-blocking get
            return self.frame_queue.get_nowait()
        except queue.Empty:
            return None

    def process_loop(self):
        # On Windows, cv2.CAP_DSHOW is often required for webcams to start fast/correctly
        if self.is_cam and isinstance(self.source, int) and os.name == 'nt':
            print(f"[Engine] Opening Webcam {self.source} with CAP_DSHOW...")
            cap = cv2.VideoCapture(self.source, cv2.CAP_DSHOW)
        else:
            print(f"[Engine] Opening Source {self.source}...")
            cap = cv2.VideoCapture(self.source)

        if not cap.isOpened():
            print(f"[Engine] Error: Could not open source {self.source}")
            self.is_running = False
            return
            
        # Try to set resolution to 1280x720 
        if self.is_cam:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

        frame_size = 1080 
        
        while self.is_running:
            ret, frame = cap.read()
            if not ret:
                print(f"[Engine] WARN: Failed to read frame from source {self.source}")
                print(f"[Engine] Stream ended/failed. Retrying in 2s...")
                time.sleep(2)
                cap = cv2.VideoCapture(self.source)
                
                if not cap.isOpened():
                     self.create_no_signal_frame()
                continue
            else:
                # Debug print (throttle it)
                if self.crowd_data["human_count"] == 0 and int(time.time()) % 5 == 0:
                     print(f"[Engine] Frame read success. Shape: {frame.shape}")

            # DIAGNOSTIC: Check if frame is black
            if np.mean(frame) < 5:
                cv2.putText(frame, "WARNING: CAMERA IS SENDING BLACK FRAMES", (50, 50), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                cv2.putText(frame, "CHECK LENS COVER OR PRIVACY SETTINGS", (50, 100), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            
            # Resize for speed
            width = 800
            frame = imutils.resize(frame, width=width)
            (h, w) = frame.shape[:2]
            
            # Init heatmap if needed
            if self.heatmap_accumulator is None or self.heatmap_accumulator.shape[:2] != (h, w):
                self.heatmap_accumulator = np.zeros((h, w), dtype=np.float32)

            current_time = datetime.datetime.now()
            
            # --- Detection Logic ---
            humans_detected, expired = detect_human(self.net, self.ln, frame, self.encoder, self.tracker, current_time)
            
            # --- Analysis ---
            violate_set = set()
            abnormal_individual = []
            
            # Update Heatmap & Social Distance
            for i, track in enumerate(humans_detected):
                x1, y1, x2, y2 = map(int, track.to_tlbr().tolist())
                # Visualization color
                color = RGB_COLORS["green"]
                
                # Heatmap: Add value to centroid
                cx, cy = int((x1+x2)/2), int((y1+y2)/2)
                if 0 <= cx < w and 0 <= cy < h:
                     try:
                        cv2.circle(self.heatmap_accumulator, (int(cx), int(cy)), 5, (1.0), -1)
                     except Exception as e:
                        print(f"[Engine] Heatmap error: {e}")
                
                # Abnormal Energy Check (Placeholder)
                if len(track.mean) >= 4: 
                     pass

                # Check distance with others
                for j, t2 in enumerate(humans_detected[i+1:], start=i+1):
                    x21, y21, x22, y22 = map(int, t2.to_tlbr().tolist())
                    d = rect_distance((x1, y1, x2, y2), (x21, y21, x22, y22))
                    if d < SOCIAL_DISTANCE:
                        violate_set.update({i, j})
                
                if i in violate_set:
                    color = RGB_COLORS["red"]

            # Global Abnormal Check
            is_abnormal = len(violate_set) > 3 or len(humans_detected) > 20

            # --- ALERT SYSTEM LOGIC ---
            # Checking alert_config directly. Thread spawning limited to once every 2 seconds locally to save resources.
            if self.alert_config.get("ENABLED", False):
                now = time.time()
                # Local debounce: don't even check/spawn if we just tried 2s ago
                if not hasattr(self, '_last_alert_check'): self._last_alert_check = 0
                
                if now - self._last_alert_check > 2.0:
                    self._last_alert_check = now
                    
                    msg = None
                    crowd_thresh = int(self.alert_config.get("MAX_CROWD", 10))
                    viol_thresh = int(self.alert_config.get("MAX_VIOLATIONS", 5))
                    
                    # Stampede/Abnormal has highest priority
                    if self.alert_config.get("ABNORMAL_TRIGGER", False) and is_abnormal:
                        msg = (f"🚨 *CRITICAL ALERT: STAMPEDE DETECTED* 🚨\n"
                               f"Potential panic or stampede activity observed.\n"
                               f"Camera Limit: {crowd_thresh}\n"
                               f"Current Crowd: {len(humans_detected)}\n"
                               f"Time: {datetime.datetime.now().strftime('%H:%M:%S')}")
                    
                    # High Crowd
                    elif len(humans_detected) > crowd_thresh:
                        msg = (f"⚠️ *CROWD WARNING* ⚠️\n"
                               f"Crowd density exceeded threshold.\n"
                               f"Limit: {crowd_thresh} | Current: {len(humans_detected)}\n"
                               f"Time: {datetime.datetime.now().strftime('%H:%M:%S')}")
                    
                    # Social Distancing
                    elif len(violate_set) > viol_thresh:
                        msg = (f"⚠️ *VIOLATION ALERT* ⚠️\n"
                               f"High number of social distance violations.\n"
                               f"Violations: {len(violate_set)}\n"
                               f"Time: {datetime.datetime.now().strftime('%H:%M:%S')}")

                    if msg:
                        # Use get() for safety
                        phone = self.alert_config.get("PHONE_NUMBER", "")
                        token = self.alert_config.get("TWILIO_AUTH_TOKEN", "")
                        # The send_whatsapp_alert function has its own 30s cooldown
                        threading.Thread(target=send_whatsapp_alert, args=(msg, phone, token)).start()

            # Update State
            with self.lock:
                self.crowd_data = {
                    "time": current_time.strftime("%H:%M:%S"),
                    "human_count": len(humans_detected),
                    "violation_count": len(violate_set),
                    "restricted_entry": False, 
                    "abnormal_activity": is_abnormal
                }
                
                # Draw all tracks
                for i, track in enumerate(humans_detected):
                    try:
                        x1, y1, x2, y2 = map(int, track.to_tlbr().tolist())
                        color = RGB_COLORS["red"] if i in violate_set else RGB_COLORS["green"]
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                        cv2.putText(frame, str(track.track_id), (x1, y1-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                    except Exception as e:
                        pass

            # JPEG Encode for streaming
            ret, buffer = cv2.imencode('.jpg', frame)
            if ret:
                # Remove old frame if exists
                if not self.frame_queue.empty():
                    try:
                        self.frame_queue.get_nowait()
                    except queue.Empty:
                        pass
                self.frame_queue.put(buffer.tobytes())

        cap.release()
