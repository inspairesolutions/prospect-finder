# syntax=docker/dockerfile:1
# Next.js (Node) + web-analyzer (Python + Playwright Chromium)
# Build: docker build -t prospect-finder .
# Run:   docker run --rm -p 3000:3000 --env-file .env prospect-finder

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# En el repo puede no existir public/ (solo archivos ignorados). Next y COPY --from=builder la necesitan.
RUN mkdir -p public/sites public/uploads
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv python3-pip \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

COPY web-analyzer/requirements.txt ./web-analyzer/requirements.txt
RUN python3 -m venv ./web-analyzer/venv \
  && ./web-analyzer/venv/bin/pip install --no-cache-dir --upgrade pip \
  && ./web-analyzer/venv/bin/pip install --no-cache-dir -r ./web-analyzer/requirements.txt \
  && ./web-analyzer/venv/bin/python -m playwright install-deps \
  && ./web-analyzer/venv/bin/python -m playwright install chromium

COPY web-analyzer ./web-analyzer

EXPOSE 3000
CMD ["node", "server.js"]
