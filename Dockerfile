# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies and Bun
RUN apk add --no-cache \
    curl \
    unzip \
    bash \
    && curl -fsSL https://bun.sh/install | bash

# Add Bun to PATH
ENV PATH="/root/.bun/bin:${PATH}"

# Copy package files
COPY package*.json ./
COPY packages/mcp-server-supabase/package*.json ./packages/mcp-server-supabase/
COPY packages/mcp-utils/package*.json ./packages/mcp-utils/

# Install dependencies
RUN bun install --yarn

# Copy source code
COPY . .

# Build the project using Yarn
RUN yarn build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install Bun and Yarn in production image
RUN apk add --no-cache \
    curl \
    unzip \
    bash \
    && curl -fsSL https://bun.sh/install | bash

# Add Bun to PATH
ENV PATH="/root/.bun/bin:${PATH}"

# Copy built artifacts and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/mcp-server-supabase/dist ./packages/mcp-server-supabase/dist
COPY --from=builder /app/packages/mcp-utils/dist ./packages/mcp-utils/dist
COPY --from=builder /app/packages/mcp-utils/package.json ./packages/mcp-utils/package.json
COPY --from=builder /app/packages/mcp-server-supabase/package.json ./packages/mcp-server-supabase/package.json
COPY --from=builder /app/package.json ./package.json

# Set environment variables
ENV NODE_ENV=production
ENV SUPABASE_PORT=3000
ENV SUPABASE_HOST=0.0.0.0

# Expose port (adjust if needed)
EXPOSE 3000

# Start the application
CMD ["bun", "packages/mcp-server-supabase/dist/sse.js"]
