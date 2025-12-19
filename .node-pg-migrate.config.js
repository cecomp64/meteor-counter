// node-pg-migrate configuration
// This file configures database migrations for the Meteor Observer app

module.exports = {
  // Database connection - uses DATABASE_URL or NETLIFY_DATABASE_URL environment variable
  databaseUrl: process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || 'postgresql://meteor:meteor_dev_password@localhost:5432/meteor_counter?sslmode=disable',

  // Directory where migration files are stored
  dir: 'migrations',

  // Migration table name (tracks which migrations have been run)
  migrationsTable: 'pgmigrations',

  // Direction: up or down (default: up)
  direction: 'up',

  // Number of migrations to run (default: all)
  count: Infinity,

  // Create migration files with TypeScript
  typescript: false,

  // Use transactions for each migration (recommended)
  singleTransaction: true,

  // Check order of migrations
  checkOrder: true,

  // Verbose output
  verbose: true,

  // Ignore pattern for migration files (regex to match files to ignore)
  ignorePattern: '.*\\.(map|md)$',

  // Migration file extension
  migrationFileExtension: '.js'
};
