/**
 * Migration: Initialize database extensions and functions
 *
 * This migration sets up the required PostgreSQL extensions and utility functions
 * that other migrations and the application depend on.
 */

exports.up = (pgm) => {
  // Enable UUID extension for generating UUIDs
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // Create function to automatically update the updated_at timestamp
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);
};

exports.down = (pgm) => {
  // Drop the function
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column();');

  // Note: We don't drop the uuid-ossp extension as it might be used by other databases
  // and dropping extensions can be risky in a shared environment
};
