FROM node:20-slim

# Install dependencies for better terminal experience, PostgreSQL client, Deno, and socat
RUN apt-get update && apt-get install -y \
    bash \
    git \
    postgresql-client \
    curl \
    unzip \
    ca-certificates \
    socat \
    && rm -rf /var/lib/apt/lists/*

# Install Deno (required for Netlify Edge Functions)
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

# Set working directory
WORKDIR /workspace

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose ports
# 8888 - Netlify Dev server
# 9999 - Netlify Dev functions (optional)
EXPOSE 8888 9999

# Default command
CMD ["npm", "run", "dev"]
