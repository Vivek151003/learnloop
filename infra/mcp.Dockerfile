# syntax=docker/dockerfile:1
# Placeholder image for the Week 3 MCP server.
FROM node:20-alpine
WORKDIR /app
COPY apps/mcp-server/package.json ./
COPY apps/mcp-server/src ./src
USER node
CMD ["node", "src/index.js"]
