# SmartBin ESP32 firmware

## Upload

1. Install Arduino IDE, the **esp32 by Espressif Systems** board package, and the **ESP32Servo** library on the computer.
2. Copy `secrets.example.h` to `secrets.h` in this folder and fill in the Wi-Fi name, Wi-Fi password, and backend API key. Open `SmartBin.ino`, choose **ESP32 Dev Module** (or the matching ESP32 board) and USB port, then click **Upload**.
3. The sketch connects to the configured 2.4 GHz Wi-Fi and sends readings to `/api/telemetry`. The API key in `secrets.h` must match the value in Dokploy. Register `BIN-01` in the dashboard before using the device.

The push button toggles the flap open or closed at any fill level. The local `secrets.h` contains Wi-Fi credentials and an API key; do not upload or commit that file. The example file contains placeholders and is safe to share.

## Pins

- Ultrasonic TRIG: GPIO 5
- Ultrasonic ECHO: GPIO 18 (use a voltage divider if ECHO is 5 V)
- Green/yellow/red LEDs: GPIO 25/26/27, each with a resistor
- Button: GPIO 13 to GND
- Servo signal: GPIO 19; power the servo from 5 V and connect supply GND to ESP32 GND
