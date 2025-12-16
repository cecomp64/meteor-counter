#!/bin/bash
# Run database migrations

set -e

echo "Running database migrations..."

# Set default DATABASE_URL if not set
export DATABASE_URL=${DATABASE_URL:-"postgresql://meteor:meteor_dev_password@localhost:5432/meteor_counter?sslmode=disable"}

# Run migrations
npm run migrate:up

echo "Migrations completed successfully!"
