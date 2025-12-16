/**
 * Migration: Add users table for authentication
 *
 * This migration adds the users table to support email/password authentication.
 * The table includes fields for email, password hash, email verification, and login tracking.
 */

exports.up = (pgm) => {
  // Create users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'varchar(255)',
      notNull: true,
    },
    email_verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    last_login: {
      type: 'timestamp with time zone',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create index on email for fast lookups
  pgm.createIndex('users', 'email', { name: 'idx_users_email' });

  // Create trigger to automatically update updated_at timestamp
  pgm.sql(`
    CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);

  // Add comment to table
  pgm.sql(`
    COMMENT ON TABLE users IS 'User accounts for authentication and cross-device sync';
  `);
};

exports.down = (pgm) => {
  // Drop trigger first
  pgm.sql('DROP TRIGGER IF EXISTS update_users_updated_at ON users;');

  // Drop index
  pgm.dropIndex('users', 'email', { name: 'idx_users_email', ifExists: true });

  // Drop table
  pgm.dropTable('users', { ifExists: true });
};
