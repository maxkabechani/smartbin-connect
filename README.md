# SmartBin Connect MVP

An ESP32 smart bin prototype with Bluetooth provisioning, Wi-Fi telemetry, a Fastify and TypeScript API, PostgreSQL with Drizzle ORM, Better Auth customer accounts, a Python AI service, and Hugging Face model hosting.

The current production structure is `api/`, `ai-service/`, `firmware/`, and the root `docker-compose.yml`. See `DEPLOYMENT.md` for VPS setup.

## MVP demonstration

1. Power the ESP32.
2. Connect to its Bluetooth service and write Wi-Fi settings in this format:
   `SSID|PASSWORD|BIN-01|http://YOUR_VPS_IP:8000`
3. The ESP32 measures the bin fill level and posts telemetry to the VPS.
4. Open `http://YOUR_VPS_IP:8000` to view the bin.
5. Add readings over time, then train the optional Hugging Face model with `server/train_model.py`.

## Wiring assumptions

| Part | ESP32 pin | Note |
|---|---:|---|
| Ultrasonic TRIG | GPIO 5 | Output |
| Ultrasonic ECHO | GPIO 18 | Use a voltage divider if the module outputs 5 V |
| Lid servo signal | GPIO 19 | Power the servo from a separate 5 V rail and share ground |
| Green LED | GPIO 25 | Use a resistor |
| Yellow LED | GPIO 26 | Use a resistor |
| Red LED | GPIO 27 | Use a resistor |
| Buzzer | GPIO 14 | Use a transistor driver for a larger buzzer |
| Manual lid button | GPIO 13 | Button to ground, internal pull-up enabled |

If your kit has different parts, change the constants at the top of `firmware/SmartBin.ino`.

## VPS quick start

```text
cd server
python -m venv .venv
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

For deployment, copy `server/.env.example` to `.env`, set an API key, and run `docker compose up -d --build`.

The VPS runs the small prediction logic locally. Hugging Face is used as the model and dataset registry. A Hugging Face token belongs on the VPS only, never in the ESP32 firmware.
