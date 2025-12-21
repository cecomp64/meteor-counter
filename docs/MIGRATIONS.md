# Database Migrations

This directory contains database migrations for the Meteor Observer application.

## What are migrations?

Migrations are version-controlled changes to your database schema. They allow you to:
- Track database schema changes over time
- Roll back changes if needed
- Keep development, staging, and production databases in sync
- Share schema changes with your team

## Tools

We use [node-pg-migrate](https://github.com/salsita/node-pg-migrate) for managing PostgreSQL migrations.

## Usage

### Running Migrations

**Automatically (recommended):**
Migrations run automatically when you start the dev server:
```bash
npm run dev
```

**Manually:**
```bash
# Run all pending migrations
npm run migrate:up

# Run with specific database URL
DATABASE_URL="postgresql://user:pass@host:5432/db" npm run migrate:up
```

### Creating New Migrations

```bash
# Create a new migration file
npm run migrate:create my-migration-name

# This creates: migrations/{timestamp}_my-migration-name.js
```

### Rolling Back Migrations

```bash
# Roll back the last migration
npm run migrate:down

# Roll back multiple migrations
DATABASE_URL="..." node-pg-migrate down 2
```

### Checking Migration Status

```bash
# Show migration status
npm run migrate -- list
```

## Migration File Structure

Each migration file has two functions:

```javascript
exports.up = (pgm) => {
  // Code to apply the migration
  pgm.createTable('my_table', {
    id: 'id',
    name: { type: 'varchar(100)', notNull: true }
  });
};

exports.down = (pgm) => {
  // Code to reverse the migration
  pgm.dropTable('my_table');
};
```

## Best Practices

1. **Never edit existing migrations** - Create a new migration instead
2. **Always provide a `down` migration** - Makes rollbacks possible
3. **Test migrations** - Run up and down before committing
4. **Use transactions** - Enabled by default in our config
5. **Keep migrations small** - One logical change per migration

## Migration Tracking

Migrations are tracked in the `pgmigrations` table in your database. This table records which migrations have been applied.

## Existing Migrations

- `1734242000000_add-users-table.js` - Adds users table for authentication

## Configuration

Migration configuration is in `.node-pg-migrate.config.js`:
- Database URL from `DATABASE_URL` environment variable
- Transaction-based migrations (safer)
- Migration order checking enabled

## Troubleshooting

**Migration fails to run:**
- Check DATABASE_URL is correct
- Ensure PostgreSQL is running
- Check migration syntax

**Migration applied but failed:**
```bash
# Manually mark migration as rolled back
psql $DATABASE_URL -c "DELETE FROM pgmigrations WHERE name='migration-name';"
```

**Start fresh (development only):**
```bash
# WARNING: Destroys all data!
docker compose down -v
docker compose up
```
