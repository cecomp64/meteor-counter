FROM node:20-alpine

# Install dependencies for better terminal experience
RUN apk add --no-cache \
    bash \
    git \
    postgresql-client \
    python3

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose ports
# 8888 - Netlify Dev server
# 3000 - Static file server
# 9999 - Netlify Dev functions (optional)
EXPOSE 8888 3000 9999

# Default command
CMD ["sh", "-c", "./start-dev.sh"]
