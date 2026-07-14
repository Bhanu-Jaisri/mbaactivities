-- Database creation
-- Uncomment the following line if you want the script to also create the database
-- CREATE DATABASE amirtha;

-- Connect to the database (psql specific command)
-- \c amirtha;

-- 1. Create Custom Enum Types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('Admin', 'Staff', 'Student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE student_subrole AS ENUM ('Regular', 'Secretary', 'Executive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE form_status AS ENUM ('Pending', 'Approved', 'Rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    sub_role student_subrole,
    roll_number VARCHAR(255) UNIQUE,
    section VARCHAR(10)
);

-- 3. Create Event Forms Table
CREATE TABLE IF NOT EXISTS event_forms (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(255) NOT NULL,
    created_by INTEGER REFERENCES users(id),
    organizer_1 INTEGER REFERENCES users(id) NOT NULL,
    organizer_2 INTEGER REFERENCES users(id),
    organizer_3 INTEGER REFERENCES users(id),
    status form_status DEFAULT 'Pending',
    approved_by INTEGER REFERENCES users(id),
    round_1_details TEXT,
    round_2_details TEXT,
    round_3_details TEXT,
    ppt_filename VARCHAR(255),
    ppt_original_name VARCHAR(255),
    rejection_queries TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Form Participants Table
CREATE TABLE IF NOT EXISTS form_participants (
    form_id INTEGER REFERENCES event_forms(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (form_id, student_id)
);

-- 5. Seed Initial Admin User
-- Note: The password_hash here is the bcrypt hash for 'admin' (with 10 salt rounds)
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2b$10$qwwVfcnAB1KULuAyDFtX3.mpLbPzi0n5FKyt/oUHt67ghsjlImENa', 'Admin')
ON CONFLICT (username) DO NOTHING;
