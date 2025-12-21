/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    // Create base tables if they don't exist (for production databases that missed the initial migration)
    pgm.sql(`
        CREATE TABLE IF NOT EXISTS sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            start_time TIMESTAMP WITH TIME ZONE NOT NULL,
            end_time TIMESTAMP WITH TIME ZONE,
            duration BIGINT,
            total_observations INTEGER DEFAULT 0,
            notes TEXT,
            location_latitude DECIMAL(10, 8),
            location_longitude DECIMAL(11, 8),
            location_accuracy DECIMAL(10, 2),
            location_privacy VARCHAR(20) DEFAULT 'full',
            user_id VARCHAR(255),
            device_id VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS observations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            duration BIGINT NOT NULL,
            intensity INTEGER NOT NULL,
            location_latitude DECIMAL(10, 8),
            location_longitude DECIMAL(11, 8),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);

    // Create indexes if they don't exist
    pgm.sql('CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC);');
    pgm.sql('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);');
    pgm.sql('CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);');
    pgm.sql('CREATE INDEX IF NOT EXISTS idx_observations_session_id ON observations(session_id);');
    pgm.sql('CREATE INDEX IF NOT EXISTS idx_observations_timestamp ON observations(timestamp);');

    // Create trigger if it doesn't exist
    pgm.sql(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'update_sessions_updated_at'
            ) THEN
                CREATE TRIGGER update_sessions_updated_at
                BEFORE UPDATE ON sessions
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END
        $$;
    `);

    // Create view if it doesn't exist
    pgm.sql(`
        CREATE OR REPLACE VIEW session_stats AS
        SELECT
            s.id,
            s.start_time,
            s.end_time,
            s.duration,
            s.total_observations,
            s.location_latitude,
            s.location_longitude,
            s.location_privacy,
            COUNT(o.id) as observation_count,
            AVG(o.duration) as avg_observation_duration,
            AVG(o.intensity) as avg_observation_intensity
        FROM sessions s
        LEFT JOIN observations o ON s.id = o.session_id
        GROUP BY s.id, s.start_time, s.end_time, s.duration, s.total_observations,
                 s.location_latitude, s.location_longitude, s.location_privacy;
    `);

    // Add is_practice field to sessions table
    pgm.addColumn('sessions', {
        is_practice: {
            type: 'boolean',
            default: false,
            notNull: true
        }
    });

    // Add practice-specific fields to sessions for storing overall accuracy
    pgm.addColumn('sessions', {
        practice_total_meteors: {
            type: 'integer',
            default: null
        },
        practice_avg_accuracy: {
            type: 'decimal(5, 2)', // e.g., 87.50
            default: null
        }
    });

    // Add practice-specific fields to observations for individual accuracy
    pgm.addColumn('observations', {
        actual_duration: {
            type: 'bigint',
            default: null,
            comment: 'Actual meteor duration in ms (for practice mode)'
        },
        actual_intensity: {
            type: 'integer',
            default: null,
            comment: 'Actual meteor intensity (for practice mode)'
        },
        duration_accuracy: {
            type: 'decimal(5, 2)',
            default: null,
            comment: 'Duration accuracy percentage (for practice mode)'
        },
        intensity_accuracy: {
            type: 'decimal(5, 2)',
            default: null,
            comment: 'Intensity accuracy percentage (for practice mode)'
        },
        overall_accuracy: {
            type: 'decimal(5, 2)',
            default: null,
            comment: 'Overall accuracy percentage (for practice mode)'
        }
    });

    // Add index for filtering practice sessions
    pgm.createIndex('sessions', 'is_practice');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    // Remove index
    pgm.dropIndex('sessions', 'is_practice');

    // Remove observation accuracy fields
    pgm.dropColumn('observations', ['actual_duration', 'actual_intensity', 'duration_accuracy', 'intensity_accuracy', 'overall_accuracy']);

    // Remove session practice fields
    pgm.dropColumn('sessions', ['is_practice', 'practice_total_meteors', 'practice_avg_accuracy']);
};
