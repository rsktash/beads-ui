FROM node:20-slim
WORKDIR /app
RUN npm install -g @rsktash/beads-ui@latest
WORKDIR /workspace
EXPOSE 3333
CMD ["bd-ui", "start", "--host", "0.0.0.0"]
