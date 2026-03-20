FROM node:20-slim

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm install

# Build frontend
COPY frontend/ ./frontend/
RUN cd frontend && npm install && npm run build

COPY src/ ./src/

# Create required runtime directories
RUN mkdir -p uploads data

# Use Railway's PORT env var, fallback to 3000
ENV PORT=3000
EXPOSE ${PORT}

CMD ["node", "src/server.js"]
