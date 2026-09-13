FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
RUN npm run build
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm install
COPY --from=build /app/dist ./dist
COPY public ./public
EXPOSE 8000
CMD ["node", "dist/server.js"]
