-- Meteor Observer Remote Database Schema
-- This schema is designed for Neon PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration BIGINT, -- milliseconds
    total_observations INTEGER DEFAULT 0,
    notes TEXT,
    -- Location with privacy support
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    location_accuracy DECIMAL(10, 2),
    location_privacy VARCHAR(20) DEFAULT 'full', -- 'full', 'obfuscated', 'hidden'
    -- User identification (for future auth support)
    user_id VARCHAR(255), -- NULL for anonymous
    device_id VARCHAR(255), -- For tracking same device
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Observations table
CREATE TABLE IF NOT EXISTS observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    duration BIGINT NOT NULL, -- milliseconds
    intensity INTEGER NOT NULL, -- 0-100
    -- Location (can differ from session location)
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_observations_session_id ON observations(session_id);
CREATE INDEX IF NOT EXISTS idx_observations_timestamp ON observations(timestamp);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for session statistics (useful for analytics)
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
