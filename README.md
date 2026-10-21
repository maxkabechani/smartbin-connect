# SmartBin Connect

An ESP32 smart bin prototype with Wi-Fi telemetry, a Fastify and TypeScript API, PostgreSQL with Drizzle ORM, Better Auth customer accounts, a Python AI service, and Hugging Face model hosting.

The current production structure is `api/`, `ai-service/`, `firmware/`, and the root `docker-compose.yml`. See `DEPLOYMENT.md` for VPS setup.

## Live product flow

1. An administrator registers `BIN-01` in the dashboard.
2. Flash `firmware/SmartBin/SmartBin.ino` to the ESP32 over USB using Arduino IDE.
3. The ESP32 connects to the configured Wi-Fi, measures fill level, and posts telemetry to the VPS.
4. An administrator gives the owner the one-time claim code shown when registering the bin; the customer creates an account and links it.
5. The customer sees their own readings and collection requests; collectors see fleet operations.

## Roles

- `customer`: links a registered bin with its one-time claim code and requests collection for owned bins.
- `collector`: views fleet telemetry, starts collection routes, and closes tasks after pickup. Collectors cannot register or link bins.
- `superadmin` (Administrator in the dashboard): registers devices and manages user roles.

New accounts are customers by default. `SUPERADMIN_EMAILS` and `COLLECTOR_EMAILS` assign initial staff roles at signup; after that, administrators manage persistent roles from Administration.

## Wiring assumptions

| Part | ESP32 pin | Note |
|---|---:|---|
| Ultrasonic TRIG | GPIO 5 | Output |
| Ultrasonic ECHO | GPIO 18 | Use a voltage divider if the module outputs 5 V |
| Green LED | GPIO 25 | Use a resistor |
| Yellow LED | GPIO 26 | Use a resistor |
| Red LED | GPIO 27 | Use a resistor |
| Push button | GPIO 13 to GND | Uses the ESP32 internal pull-up |
| Servo signal | GPIO 19 | Power the servo from 5 V with a shared GND |

The LEDs indicate fill levels: green below 50%, yellow from 50% to below 80%, and red at 80% or above. The button toggles the servo flap open or closed at any fill level; it stays where it is until pressed again, so it can be left open while emptying. The servo needs a 5 V supply with its ground connected to ESP32 GND. Adjust its closed and open angles to fit the flap.

## Firmware API setup

The ESP32 sends `POST https://smartbin.maxkabechani.dev/api/telemetry`. The website's `/api` route forwards the request to the backend inside Dokploy's private network; the ESP32 cannot reach the private Docker address directly. A matching `API_KEY` is required for the deployed backend to accept readings.

Install the Espressif ESP32 board package and `ESP32Servo`, then open `firmware/SmartBin/SmartBin.ino`. Enter the Wi-Fi name, Wi-Fi password, and API key in the quoted string values near the top. Use a 2.4 GHz Wi-Fi network. The API key must match the value in Dokploy, and `BIN-01` must be registered in the dashboard. Open Serial Monitor at 115200 baud to see Wi-Fi connection and telemetry status. Keep your real credentials local; do not commit them to the public repository.

## Deployment

See `DEPLOYMENT.md` for Dokploy and VPS setup. The platform uses Fastify with TypeScript, PostgreSQL 18 Alpine, Drizzle, Better Auth, and a separate Python AI service.

The VPS runs the prediction service locally. Hugging Face is used as the model registry. A Hugging Face token belongs on the VPS only, never in the ESP32 firmware.
