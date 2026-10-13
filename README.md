# SmartBin Connect

An ESP32 smart bin prototype with Bluetooth provisioning, Wi-Fi telemetry, a Fastify and TypeScript API, PostgreSQL with Drizzle ORM, Better Auth customer accounts, a Python AI service, and Hugging Face model hosting.

The current production structure is `api/`, `ai-service/`, `firmware/`, and the root `docker-compose.yml`. See `DEPLOYMENT.md` for VPS setup.

## Live product flow

1. Power the ESP32.
2. Connect to its Bluetooth service and write Wi-Fi settings in this format:
   `SSID|PASSWORD|BIN-01|https://smartbin.maxkabechani.dev`
3. A superadmin registers the device in the administration screen.
4. The ESP32 measures the bin fill level and posts telemetry to the VPS.
5. An administrator gives the owner the one-time claim code shown when registering the bin; the customer creates an account and links it.
6. The customer sees their own readings and collection requests; collectors see fleet operations.

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

The LEDs indicate fill levels: green below 50%, yellow from 50% to below 80%, and red at 80% or above. This build has no lid actuator or buzzer. If your kit has different parts, change the constants at the top of `firmware/SmartBin.ino`.

## Deployment

See `DEPLOYMENT.md` for Dokploy and VPS setup. The platform uses Fastify with TypeScript, PostgreSQL 18 Alpine, Drizzle, Better Auth, and a separate Python AI service.

The VPS runs the prediction service locally. Hugging Face is used as the model registry. A Hugging Face token belongs on the VPS only, never in the ESP32 firmware.
