FROM node:20.20.1-alpine AS base
RUN npm install pnpm -g

FROM base AS builder
WORKDIR /app
COPY . .
# Frozen lockfile to ensure reproducibility
RUN pnpm install --frozen-lockfile
# Build only the API
RUN pnpm turbo run build --filter=api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built assets

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nest

COPY --from=builder --chown=nest:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nest:nodejs /app/node_modules ./node_modules

USER nest

CMD ["node", "dist/main"]

