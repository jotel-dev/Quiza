# apps/api/Dockerfile
# Multi-stage production Docker build for Quiza Fastify API

FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies for build
COPY package*.json ./
RUN npm ci

# Copy source code and assets
COPY tsconfig.json ./
COPY src/ ./src/
COPY data/ ./data/

# Compile TypeScript and copy migration SQL files to dist
RUN npm run build
RUN mkdir -p dist/db/migrations && cp src/db/migrations/*.sql dist/db/migrations/

# Production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled artifacts and runtime data
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

EXPOSE 3001

USER node

CMD ["node", "dist/index.js"]
