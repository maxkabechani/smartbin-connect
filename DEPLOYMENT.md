# SmartBin Connect deployment

## Services

- `api`: Fastify + TypeScript + Better Auth + Drizzle
- `postgres`: PostgreSQL database
- `ai-service`: Python prediction service

## First VPS setup

Clone the repository on the VPS, then create the environment files:

```bash
cp api/.env.example api/.env
cp ai-service/.env.example ai-service/.env
```

Set a long `BETTER_AUTH_SECRET`, a private `API_KEY`, the public `AUTH_URL`, and optional Hugging Face values. Do not commit either `.env` file.

Set `SUPERADMIN_EMAILS` to the email address that should receive platform control and `COLLECTOR_EMAILS` to the addresses used by field staff. All other new accounts are customers. Keep `SEED_INITIAL_DATA=false` in production; the seed is only for a fresh classroom installation.

Create the containers:

```bash
docker compose up -d postgres
docker compose run --rm api bun run auth:generate
docker compose run --rm api bun run db:generate
docker compose run --rm api bun run db:migrate
docker compose up -d --build api ai-service
```

Dokploy should expose the Next.js frontend at `https://smartbin.maxkabechani.dev` on container port `3000`. Set the frontend `API_INTERNAL_URL` to the private backend service URL. Keep PostgreSQL and the AI service private to the Docker network.

## Role flows

### Customer

1. Customer creates an account at `https://smartbin.maxkabechani.dev`.
2. The customer signs in through Better Auth.
3. The customer enters the bin ID and the claim code supplied with the bin.
4. The API links that bin to the authenticated Better Auth user.
5. The customer sees only linked bins and their collection requests.

### Collector

1. A superadmin assigns the `collector` role to the staff account.
2. The collector sees the full registered fleet and open dispatch queue.
3. The collector marks a task collected after the truck completes the pickup.

### Superadmin

1. The superadmin signs in with an address listed in `SUPERADMIN_EMAILS`.
2. The administration screen manages customer, collector, and superadmin roles.
3. The administration screen registers bins and issues their claim codes before devices connect.

## Register bins and manage collections

1. A superadmin opens **Bins** and selects **Register device**. Enter the device ID, a claim code to share with its owner, a display name, and the bin's street address. Latitude and longitude are optional, but improve route distance estimates.
2. Give the owner the bin ID and claim code. They sign in, open **Bins**, select **Link a bin**, and enter both values. The bin then appears in their dashboard.
3. A customer can select **Request collection** on a linked bin. High fill readings also create collection tasks automatically.
4. Collectors and superadmins open **Dispatch**, review the recommended stop order, and select **Start route in Google Maps** to navigate the run. After pickup, select **Mark collected** on that task. New device readings continue to update the bin's actual fill level.

The API repeats every permission check server-side. The frontend only changes the navigation and actions shown to each role; it is not a security boundary.

## ESP32 configuration

Use the Bluetooth configuration characteristic with:

```text
WIFI_NAME|WIFI_PASSWORD|BIN-01|https://smartbin.maxkabechani.dev
```

The firmware sends telemetry to `/api/telemetry` using the device API key. Devices must be registered before telemetry is accepted. Customer sessions are never stored on the ESP32.

## Hugging Face model

Train the small model from the separate training environment using `server/train_model.py`, upload `model.joblib` to a private Hugging Face model repository, and set `HF_MODEL_REPO` and `HF_TOKEN` only in `ai-service/.env`. The Python service falls back to an explainable prediction if the model is unavailable.
