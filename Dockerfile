FROM node:24.13.1-alpine3.23

WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY . .
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
RUN pnpm install --frozen-lockfile && pnpm --filter @ekms/api db:generate && pnpm build && chown -R node:node /app
USER node

CMD ["pnpm", "--filter", "@ekms/api", "start"]
