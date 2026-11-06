FROM caddy:2-alpine AS caddy
COPY Caddyfile /etc/caddy/Caddyfile

FROM node:26-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
# npm ci checks every workspace against the lockfile, so the web package.json is needed too.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev -w @railradar/api -w @railradar/shared
COPY packages/shared/src packages/shared/src
COPY apps/api/src apps/api/src
COPY apps/api/migrations apps/api/migrations
USER node
WORKDIR /app/apps/api
# Runs node directly, without npm in between, so that it receives SIGTERM.
CMD ["node", "--import", "tsx", "src/index.ts"]
