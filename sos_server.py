from flask import Flask, request, jsonify
from twilio.rest import Client

app = Flask(__name__)

# Twilio credentials (replace with your values)
ACCOUNT_SID = "your_twilio_sid"
AUTH_TOKEN = "your_twilio_auth_token"
TWILIO_NUMBER = "+1234567890"  # Your Twilio phone number

# Relatives phone numbers
RELATIVES = ["+911234567890", "+919876543210"]

client = Client(ACCOUNT_SID, AUTH_TOKEN)

@app.route("/send-sos", methods=["POST"])
def send_sos():
    data = request.json
    message = data.get("message")
    lat = data.get("lat")
    lng = data.get("lng")

    if not message or not lat or not lng:
        return jsonify({"status": "error", "msg": "Invalid request"}), 400

    body = f"🚨 SOS ALERT 🚨\n{message}\nLocation: https://maps.google.com/?q={lat},{lng}"

    try:
        for number in RELATIVES:
            client.messages.create(
                body=body,
                from_=TWILIO_NUMBER,
                to=number
            )
        return jsonify({"status": "success", "msg": "SOS SMS sent successfully"})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
