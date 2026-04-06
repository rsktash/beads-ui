FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

ARG BD_VERSION=1.0.0
RUN curl -fsSL https://github.com/gastownhall/beads/releases/download/v${BD_VERSION}/beads_${BD_VERSION}_linux_amd64.tar.gz \
    | tar -xz -C /usr/local/bin bd

WORKDIR /app
RUN npm install -g @rsktash/beads-ui@latest

WORKDIR /workspace
EXPOSE 3333
CMD ["bd-ui", "start", "--host", "0.0.0.0"]
