FROM node:20-slim

# Install dependencies for better terminal experience and PostgreSQL client
RUN apt-get update && apt-get install -y \
    bash \
    git \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install
RUN npm install -g deno

# Copy application files
COPY . .

# Expose ports
# 8888 - Netlify Dev server
# 9999 - Netlify Dev functions (optional)
EXPOSE 8888 9999

# Default command
CMD ["npm", "run", "dev"]
