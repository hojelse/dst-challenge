FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# Install dependencies with the pnpm version pinned in package.json.
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# The data scripts (db:push, harvest, load, index), with dev dependencies.
# Used by the one-shot `seed` service in docker-compose.yml.
FROM base AS tools
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["sh", "-c", "pnpm db:push --force && pnpm harvest && pnpm load && pnpm run index"]

# Build the standalone Next.js server.
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build imports the database module but never queries it; the real
# URLs are set at run time.
RUN DATABASE_URL=postgres://build:build@localhost/build pnpm build

# Run only the standalone output: no pnpm, no dev dependencies.
FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
