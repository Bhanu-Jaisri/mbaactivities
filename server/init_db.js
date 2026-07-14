require('dotenv').config();
const { Client } = require('pg');

const DB_CONFIG = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } } : {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
};

async function initDb() {
  // 1. Connect to check database existence (only if not using connection string)
  if (!process.env.DATABASE_URL) {
    const client = new Client({ ...DB_CONFIG, database: 'postgres' });
    try {
      await client.connect();
      console.log('Connected to default postgres database.');
      const res = await client.query("SELECT datname FROM pg_database WHERE datname = 'amirtha'");
      if (res.rowCount === 0) {
        console.log('Database "amirtha" not found. Creating...');
        await client.query('CREATE DATABASE amirtha');
        console.log('Database "amirtha" created.');
      } else {
        console.log('Database "amirtha" already exists.');
      }
    } catch (err) {
      console.error('Error checking/creating database:', err);
      process.exit(1);
    } finally {
      await client.end();
    }
  }

  // 2. Connect to the target database to create tables
  const amirthaClient = new Client(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } } : { ...DB_CONFIG, database: 'amirtha' });
  try {
    await amirthaClient.connect();
    console.log('Connected to amirtha database.');

    // Create ENUMs
    await amirthaClient.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('Admin', 'Staff', 'Student');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await amirthaClient.query(`
      DO $$ BEGIN
        CREATE TYPE student_subrole AS ENUM ('Regular', 'Secretary', 'Executive');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await amirthaClient.query(`
      DO $$ BEGIN
        CREATE TYPE form_status AS ENUM ('Pending', 'Approved', 'Rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create Tables
    await amirthaClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role user_role NOT NULL,
        sub_role student_subrole,
        roll_number VARCHAR(255) UNIQUE,
        section VARCHAR(10)
      );
    `);

    // Migrate existing table just in case it was already created without roll_number or section
    await amirthaClient.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS roll_number VARCHAR(255) UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS section VARCHAR(10);
    `);

    await amirthaClient.query(`
      CREATE TABLE IF NOT EXISTS event_forms (
        id SERIAL PRIMARY KEY,
        event_name VARCHAR(255) NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        organizer_1 INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        organizer_2 INTEGER REFERENCES users(id) ON DELETE SET NULL,
        organizer_3 INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status form_status DEFAULT 'Pending',
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        round_1_details TEXT,
        round_2_details TEXT,
        round_3_details TEXT,
        ppt_filename VARCHAR(255),
        ppt_original_name VARCHAR(255),
        rejection_queries TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migrate existing table
    await amirthaClient.query(`
      ALTER TABLE event_forms ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE event_forms ADD COLUMN IF NOT EXISTS ppt_filename VARCHAR(255);
      ALTER TABLE event_forms ADD COLUMN IF NOT EXISTS ppt_original_name VARCHAR(255);
      ALTER TABLE event_forms ADD COLUMN IF NOT EXISTS rejection_queries TEXT;
    `);

    // Migrate constraints to add ON DELETE behavior if not already set
    await amirthaClient.query(`
      ALTER TABLE event_forms DROP CONSTRAINT IF EXISTS event_forms_created_by_fkey;
      ALTER TABLE event_forms ADD CONSTRAINT event_forms_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

      ALTER TABLE event_forms DROP CONSTRAINT IF EXISTS event_forms_organizer_1_fkey;
      ALTER TABLE event_forms ADD CONSTRAINT event_forms_organizer_1_fkey 
        FOREIGN KEY (organizer_1) REFERENCES users(id) ON DELETE CASCADE;

      ALTER TABLE event_forms DROP CONSTRAINT IF EXISTS event_forms_organizer_2_fkey;
      ALTER TABLE event_forms ADD CONSTRAINT event_forms_organizer_2_fkey 
        FOREIGN KEY (organizer_2) REFERENCES users(id) ON DELETE SET NULL;

      ALTER TABLE event_forms DROP CONSTRAINT IF EXISTS event_forms_organizer_3_fkey;
      ALTER TABLE event_forms ADD CONSTRAINT event_forms_organizer_3_fkey 
        FOREIGN KEY (organizer_3) REFERENCES users(id) ON DELETE SET NULL;

      ALTER TABLE event_forms DROP CONSTRAINT IF EXISTS event_forms_approved_by_fkey;
      ALTER TABLE event_forms ADD CONSTRAINT event_forms_approved_by_fkey 
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
    `);

    await amirthaClient.query(`
      CREATE TABLE IF NOT EXISTS form_participants (
        form_id INTEGER REFERENCES event_forms(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (form_id, student_id)
      );
    `);

    console.log('Tables created successfully.');

    // Seed Admin User
    const adminCheck = await amirthaClient.query("SELECT * FROM users WHERE username = 'admin'");
    if (adminCheck.rowCount === 0) {
      console.log('Admin user not found. Seeding admin user...');
      await amirthaClient.query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'Admin')",
        ['admin', 'admin']
      );
      console.log('Admin user created (username: admin, password: admin)');
    } else {
      console.log('Admin user already exists. Updating password to plain text...');
      await amirthaClient.query(
        "UPDATE users SET password_hash = 'admin' WHERE username = 'admin'"
      );
      console.log('Admin user password updated to plain text.');
    }

  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    await amirthaClient.end();
  }
}

initDb();
