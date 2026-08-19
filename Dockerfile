FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY . .
RUN node scripts/restore-skill-links.mjs
RUN npm run build -- --webpack

FROM builder AS test
RUN npm test -- --maxWorkers=2
RUN npx tsc --noEmit
RUN node scripts/verify-semrush-schema-reference.mjs
RUN touch /release-verified

FROM node:22-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=test --chown=app:app /release-verified ./.release-verified
COPY --from=builder --chown=app:app /app/.next ./.next
COPY --from=builder --chown=app:app /app/jobs ./jobs
COPY --from=builder --chown=app:app /app/lib ./lib
COPY --from=builder --chown=app:app /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=app:app /app/tsconfig.json ./tsconfig.json
USER app
EXPOSE 3000
CMD ["npm", "start"]
