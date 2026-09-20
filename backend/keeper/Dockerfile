# The keeper, for Railway.
#
# `shared/` is copied in beside the build because the market table and the ABIs
# are generated once for the whole backend; see backend/tools/.
FROM node:22-slim AS build

WORKDIR /app/keeper
COPY keeper/package*.json ./
RUN npm ci

COPY keeper/tsconfig.json ./
COPY keeper/src ./src
RUN npm run build

FROM node:22-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app/keeper

COPY keeper/package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/keeper/dist ./dist
COPY shared /app/shared

# Railway injects the environment, so there is no --env-file here.
CMD ["node", "dist/index.js"]
