# SmartBin ESP32 firmware

## Upload

1. Install Arduino IDE, the **esp32 by Espressif Systems** board package, and the **ESP32Servo** library.
2. Open `SmartBin.ino` and replace the Wi-Fi name, Wi-Fi password, and Dokploy API key in the quoted string values near the top. Use a 2.4 GHz Wi-Fi network. The API key must match the `API_KEY` value in Dokploy.
3. Register `BIN-01` in the dashboard, choose **ESP32 Dev Module** (or the matching ESP32 board) and its USB port, then upload.
4. Open Serial Monitor at **115200 baud**. It prints the Wi-Fi connection state, IP address, HTTP response, and request errors.

The sketch sends an initial reading after Wi-Fi connects, then sends telemetry every 30 seconds. Pressing the button toggles the flap and sends a reading. Keep real credentials local; do not commit the edited sketch to the public repository.

## Pins

- Ultrasonic TRIG: GPIO 5
- Ultrasonic ECHO: GPIO 18 (use a voltage divider if ECHO is 5 V)
- Green/yellow/red LEDs: GPIO 25/26/27, each with a resistor
- Button: GPIO 13 to GND
- Servo signal: GPIO 19; power the servo from 5 V and connect supply GND to ESP32 GND
