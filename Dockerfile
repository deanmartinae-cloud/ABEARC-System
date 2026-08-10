# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app

# sqlite3 may need to compile a native module when a matching prebuilt binary
# is unavailable for the Synology CPU/Node combination.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Manila

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json server.js psabe.png ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public
COPY docs ./docs

# Rebuild the generated browser bundle and verify the modular compatibility
# contract while the image is being built.
RUN node scripts/build-frontend.js \
    && node scripts/check-structure.js \
    && node scripts/check-runtime-wiring.js \
    && mkdir -p \
        /data/temp \
        /data/uploads \
        /data/calendar-attachments \
        /data/avatars \
        /data/downloads-forms \
        /data/project-closure-attachments \
        /data/project-documentation \
        /data/monitoring-attachments \
        /data/map-media/originals \
        /data/map-media/thumbnails \
        /data/map-media/temp \
        /data/user-drive \
        /data/backups

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=4 \
  CMD node -e "const http=require('http');const r=http.get({host:'127.0.0.1',port:Number(process.env.PORT||3000),path:'/',timeout:4000},res=>{res.resume();process.exit(res.statusCode>=200&&res.statusCode<500?0:1)});r.on('timeout',()=>{r.destroy();process.exit(1)});r.on('error',()=>process.exit(1));"

CMD ["node", "server.js"]
