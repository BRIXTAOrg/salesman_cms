# Stage 1: Dependencies
FROM node:25 AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:25 AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PRIVATE_STANDALONE=true

RUN --mount=type=secret,id=DATABASE_URL,env=DATABASE_URL \
    npm run build

# Stage 3: Runner (Ultra minimal)
FROM gcr.io/distroless/nodejs24-debian12 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
#COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["server.js"]