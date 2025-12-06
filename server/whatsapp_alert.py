from twilio.rest import Client
import time
from config import ALERT_CONFIG

# Global cooldown to prevent spamming
last_alert_time = 0
ALERT_COOLDOWN = 30  # seconds

def send_whatsapp_alert(message, phone_number=None, auth_token=None):
    """
    Sends an SMS/WhatsApp alert using Twilio.
    
    Args:
        message (str): The alert message body.
        phone_number (str, optional): Destination number. Defaults to config if None.
        auth_token (str, optional): Twilio Auth Token. Defaults to config if None.
    """
    global last_alert_time
    
    # Check cooldown
    if time.time() - last_alert_time < ALERT_COOLDOWN:
        print("[Alert] Cooldown is active. Skipping alert.")
        return

    try:
        # Use provided args or fallback to config
        dest_number = phone_number if phone_number else ALERT_CONFIG["PHONE_NUMBER"]
        token = auth_token if auth_token else ALERT_CONFIG["TWILIO_AUTH_TOKEN"]
        
        # Hardcoded from config as user didn't request dynamic SIDs for these
        account_sid = ALERT_CONFIG["TWILIO_SID"]
        service_sid = ALERT_CONFIG["TWILIO_SERVICE_SID"]

        if not token:
            print("[Alert] Error: Missing Twilio Auth Token.")
            return

        client = Client(account_sid, token)
        
        print(f"[Alert] Sending Twilio Message to {dest_number}...")
        msg_obj = client.messages.create(
            messaging_service_sid=service_sid,
            body=message,
            to=dest_number
        )
        
        print(f"[Alert] Sent successfully! SID: {msg_obj.sid}")
        last_alert_time = time.time()
        
    except Exception as e:
        print(f"[Alert] Failed to send Twilio alert: {e}")
