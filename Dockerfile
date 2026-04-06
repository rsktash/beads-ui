FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY client/ client/
RUN npm run build

FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

ARG BD_VERSION=1.0.0
RUN curl -fsSL https://github.com/gastownhall/beads/releases/download/v${BD_VERSION}/beads_${BD_VERSION}_linux_amd64.tar.gz \
    | tar -xz -C /usr/local/bin bd

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY bin/ bin/
COPY server/ server/
COPY --from=build /app/dist/ dist/

WORKDIR /workspace
EXPOSE 3333
CMD ["node", "/app/bin/bd-ui", "start", "--host", "0.0.0.0"]
