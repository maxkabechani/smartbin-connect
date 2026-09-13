FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
RUN bun run build
FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=build /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
COPY public ./public
EXPOSE 8000
CMD ["bun", "dist/server.js"]
