# SmartBin Connect

An ESP32 smart bin prototype with Bluetooth provisioning, Wi-Fi telemetry, a Fastify and TypeScript API, PostgreSQL with Drizzle ORM, Better Auth customer accounts, a Python AI service, and Hugging Face model hosting.

The current production structure is `api/`, `ai-service/`, `firmware/`, and the root `docker-compose.yml`. See `DEPLOYMENT.md` for VPS setup.

## Live product flow

1. Power the ESP32.
2. Connect to its Bluetooth service and write Wi-Fi settings in this format:
   `SSID|PASSWORD|BIN-01|https://smartbin.maxkabechani.dev`
3. A superadmin registers the device in the administration screen.
4. The ESP32 measures the bin fill level and posts telemetry to the VPS.
5. The customer creates an account and links the bin with its claim code.
6. The customer sees their own readings and collection requests; collectors see fleet operations.

## Roles

- `customer`: links owned bins and views their telemetry and collection requests.
- `collector`: views fleet telemetry and closes collection tasks after pickup.
- `superadmin`: manages users, roles, and device registration.

New accounts are customers by default. Set `SUPERADMIN_EMAILS` and `COLLECTOR_EMAILS` in the API environment to bootstrap staff roles.

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

## Deployment

See `DEPLOYMENT.md` for Dokploy and VPS setup. The platform uses Fastify with TypeScript, PostgreSQL 18 Alpine, Drizzle, Better Auth, and a separate Python AI service.

The VPS runs the prediction service locally. Hugging Face is used as the model registry. A Hugging Face token belongs on the VPS only, never in the ESP32 firmware.
