# Three targets:
#   runtime (default)  web server and background worker, production dependencies only
#   release            migrations and role provisioning, run once per deploy
#   build              intermediate
#
# The runtime image holds the schema but not the migrations, and nothing in
# it runs migrations. The Prisma CLI is still installed there (the client
# needs it), so the real control is the credentials: give the release step the
# migration ones and the runtime containers the runtime ones.
#
# Before the first deploy, pin node:22-alpine by digest for the chosen host.

FROM node:22-alpine AS base
# package.json pins npm with engine-strict, and the image ships an older one.
RUN apk add --no-cache openssl && npm install -g npm@11.5.2
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npx prisma generate && NODE_ENV=production npm run build

FROM build AS release
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate
COPY tsconfig.json env.d.ts ./
COPY app ./app
COPY public ./public
COPY server ./server
COPY --from=build /app/build ./build
USER node
EXPOSE 3000
# Web: the default command. Worker: the same image with `npm run worker`.
CMD ["npm", "run", "start"]
