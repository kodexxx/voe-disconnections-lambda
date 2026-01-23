# VOE Proxy Service Dockerfile
# Lightweight Node.js microservice for FlareSolverr integration

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev for build)
RUN npm ci

# Copy source code (voe-proxy-app + dependencies)
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy all built files from builder (including dependencies)
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
#HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
#  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if(r.statusCode !== 200) throw new Error('Health check failed')})"

# Start server
CMD ["node", "dist/voe-proxy-app/server.js"]
