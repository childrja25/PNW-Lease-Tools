FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY src/ ./src/
COPY public/ ./public/

# Create required runtime directories
RUN mkdir -p uploads data

# Use Railway's PORT env var, fallback to 3000
ENV PORT=3000
EXPOSE ${PORT}

CMD ["node", "src/server.js"]
