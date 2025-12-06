from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import threading
import time
import json
import os

# Local imports
from core.engine import VideoEngine

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Initialize Video Engine
engine = VideoEngine()

@app.route('/video_feed')
def video_feed():
    """Video stream endpoint (MJPEG)."""
    def generate():
        while True:
            frame_bytes = engine.get_frame()
            if frame_bytes:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            else:
                time.sleep(0.01)
    
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/heatmap_feed')
def heatmap_feed():
    """Heatmap stream endpoint (MJPEG)."""
    def generate():
        while True:
            frame_bytes = engine.get_heatmap()
            if frame_bytes:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            else:
                time.sleep(0.1)
    
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/stats')
def get_stats():
    """Return current crowd stats."""
    return jsonify(engine.crowd_data)

@app.route('/api/config/source', methods=['POST'])
def update_source():
    """Update video source."""
    data = request.json
    source = data.get('source', 0)
    engine.update_source(source)
    return jsonify({"status": "success", "source": source})

@app.route('/api/start', methods=['POST'])
def start_engine():
    engine.start()
    return jsonify({"status": "started"})

@app.route('/api/stop', methods=['POST'])
def stop_engine():
    engine.stop()
    return jsonify({"status": "stopped"})

@app.route('/api/config/alerts', methods=['GET', 'POST'])
def config_alerts():
    if request.method == 'POST':
        data = request.json
        # update the engine's config
        if data:
            # We iterate and update to allow partial updates
            for key, val in data.items():
                if key in engine.alert_config:
                    engine.alert_config[key] = val
            print(f"[API] Alert Config Updated: {engine.alert_config}")
        return jsonify(engine.alert_config)
    else:
        return jsonify(engine.alert_config)

@app.route('/api/test_alert', methods=['POST'])
def test_alert():
    data = request.json
    phone = data.get("phone")
    token = data.get("auth_token")
    if not phone or not token:
        return jsonify({"error": "Missing phone or auth_token"}), 400
    
    msg = "✅ CrowdShield Test Alert: System is connected via Twilio!"
    # Import locally to avoid circular imports usually, but here is fine
    from whatsapp_alert import send_whatsapp_alert
    threading.Thread(target=send_whatsapp_alert, args=(msg, phone, token)).start()
    return jsonify({"status": "Test message queued"})

if __name__ == '__main__':
    # Start engine on app launch (optional, or wait for frontend)
    print("[Flask] Starting Video Engine...")
    engine.start()
    
    # Run Flask
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
