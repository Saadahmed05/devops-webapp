# ---------- Stage 1: install production dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY app/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# ---------- Stage 2: minimal runtime image ----------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY app/package.json ./
COPY app/src ./src
COPY app/public ./public

# Run as the non-root "node" user that ships with the image.
# Numeric UID so Kubernetes' runAsNonRoot check can verify it.
USER 1000:1000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
