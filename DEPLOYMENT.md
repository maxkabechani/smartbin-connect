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

Create the containers:

```bash
docker compose up -d postgres
docker compose run --rm api bun run auth:generate
docker compose run --rm api bun run db:generate
docker compose run --rm api bun run db:migrate
docker compose run --rm api bun run db:seed
docker compose up -d --build api ai-service
```

Dokploy should expose the Next.js frontend at `https://smartbin.maxkabechani.dev` on container port `3000`. Set the frontend `API_INTERNAL_URL` to the private backend service URL. Keep PostgreSQL and the AI service private to the Docker network.

## Customer flow

1. Customer creates an account at `https://smartbin.maxkabechani.dev`.
2. The customer signs in through Better Auth.
3. The customer enters the bin ID and the claim code printed on the bin.
4. The API links that bin to the authenticated Better Auth user.
5. The customer sees only linked bins and their collection requests.

## ESP32 configuration

Use the Bluetooth configuration characteristic with:

```text
WIFI_NAME|WIFI_PASSWORD|BIN-01|https://smartbin.maxkabechani.dev
```

The firmware sends telemetry to `/api/telemetry` using the device API key. Customer sessions are never stored on the ESP32.

## Hugging Face model

Train the small model from the separate training environment using `server/train_model.py`, upload `model.joblib` to a private Hugging Face model repository, and set `HF_MODEL_REPO` and `HF_TOKEN` only in `ai-service/.env`. The Python service falls back to an explainable prediction if the model is unavailable.
