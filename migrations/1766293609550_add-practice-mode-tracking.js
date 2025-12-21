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
