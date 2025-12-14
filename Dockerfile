FROM node:20-alpine

# Install dependencies for better terminal experience
RUN apk add --no-cache \
    bash \
    git \
    postgresql-client

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
