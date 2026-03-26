FROM node:20-alpine

WORKDIR /app

# Copy API dependencies
COPY api/package*.json api/
RUN cd api && npm ci --production

# Copy everything
COPY . .

# Expose API port
EXPOSE 3001

# Start the API server
CMD ["node", "api/server.js"]
