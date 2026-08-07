require('dotenv').config();
require('./init_db');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');

const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-amirtha';

// --- HELPERS ---
const isAssociationAligned = (creatorSubRole, userSubRole) => {
  const creator = (creatorSubRole || 'Regular').toUpperCase();
  const usr = (userSubRole || 'Regular').toUpperCase();

  const isNismCreator = creator.includes('NISM');
  const isNipmCreator = creator.includes('NIPM') || creator.includes('SIPM');
  const isAdCreator = creator.includes('AD CLUB');
  const isNormalCreator = !isNismCreator && !isNipmCreator && !isAdCreator;

  const isNismUser = usr.includes('NISM');
  const isNipmUser = usr.includes('NIPM') || usr.includes('SIPM');
  const isAdUser = usr.includes('AD CLUB');
  const isNormalUser = !isNismUser && !isNipmUser && !isAdUser;

  if (isNismCreator && isNismUser) return true;
  if (isNipmCreator && isNipmUser) return true;
  if (isAdCreator && isAdUser) return true;
  if (isNormalCreator && isNormalUser) return true;

  return false;
};

const normalizeDate = (dateStr) => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();

  // Handle ISO string or Date string like 2026-08-09T00:00:00.000Z
  if (str.includes('T')) {
    return str.split('T')[0];
  }

  // YYYY-MM-DD or YYYY-M-D
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }

  // MM/DD/YYYY or M/D/YYYY or DD/MM/YYYY
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        let p1 = parseInt(parts[0], 10);
        let p2 = parseInt(parts[1], 10);
        if (p1 > 12) {
          return `${parts[2]}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
        } else {
          return `${parts[2]}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
        }
      }
    }
  }

  return str;
};

const checkStudentConflict = async (eventDate, studentIds, ignoreFormId = null) => {
  if (!eventDate || !studentIds || studentIds.length === 0) return null;

  const validIds = studentIds.filter(id => id != null);
  if (validIds.length === 0) return null;

  const targetDate = normalizeDate(eventDate);

  const query = `
    SELECT f.id, f.event_name, f.event_date, u.username, u.id as student_id, 'Organizer' as role_type
    FROM event_forms f
    JOIN users u ON u.id IN (f.organizer_1, f.organizer_2, f.organizer_3)
    WHERE (f.is_completed IS FALSE OR f.is_completed IS NULL) ${ignoreFormId ? 'AND f.id <> $1' : ''}
    
    UNION ALL
    
    SELECT f.id, f.event_name, f.event_date, u.username, u.id as student_id, 'Participant' as role_type
    FROM event_forms f
    JOIN form_participants fp ON f.id = fp.form_id
    JOIN users u ON fp.student_id = u.id
    WHERE (f.is_completed IS FALSE OR f.is_completed IS NULL) ${ignoreFormId ? 'AND f.id <> $1' : ''}
  `;

  const params = ignoreFormId ? [ignoreFormId] : [];
  const result = await db.query(query, params);

  for (const row of result.rows) {
    if (validIds.includes(row.student_id) && normalizeDate(row.event_date) === targetDate) {
      return row;
    }
  }

  return null;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const str = timeStr.trim().toUpperCase();
  const isPM = str.includes('PM');
  const isAM = str.includes('AM');
  if (!isPM && !isAM) return null;

  const clean = str.replace('AM', '').replace('PM', '').trim();
  let hour = 0;
  let minute = 0;

  if (clean.includes(':')) {
    const p = clean.split(':');
    hour = parseInt(p[0], 10);
    minute = parseInt(p[1], 10) || 0;
  } else if (clean.includes('.')) {
    const p = clean.split('.');
    hour = parseInt(p[0], 10);
    minute = parseInt(p[1], 10) || 0;
  } else {
    hour = parseInt(clean, 10);
  }

  if (isNaN(hour) || isNaN(minute)) return null;

  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;

  return hour * 60 + minute;
};

const parseEventTimeRange = (eventTimeStr) => {
  if (!eventTimeStr) return null;
  let str = eventTimeStr.trim();
  let parts = [];
  if (str.includes(' - ')) {
    parts = str.split(' - ');
  } else if (str.includes('-')) {
    parts = str.split('-');
  } else if (str.toLowerCase().includes(' to ')) {
    parts = str.toLowerCase().split(' to ');
  }

  if (parts.length >= 2) {
    const start = parseTimeToMinutes(parts[0]);
    const end = parseTimeToMinutes(parts[1]);
    if (start !== null && end !== null) {
      return { start, end };
    }
  }
  const single = parseTimeToMinutes(str);
  if (single !== null) {
    return { start: single, end: single + 60 };
  }
  return null;
};

const checkEventTimeConflict = async (eventDate, eventTime, ignoreFormId = null) => {
  if (!eventDate || !eventTime) return null;

  const targetDate = normalizeDate(eventDate);
  const newRange = parseEventTimeRange(eventTime);

  const query = `
    SELECT id, event_name, event_date, event_time
    FROM event_forms
    WHERE (is_completed IS FALSE OR is_completed IS NULL)
    ${ignoreFormId ? 'AND id <> $1' : ''}
  `;
  const params = ignoreFormId ? [ignoreFormId] : [];
  const result = await db.query(query, params);

  for (const row of result.rows) {
    if (!row.event_date || !row.event_time) continue;

    const rowDate = normalizeDate(row.event_date);
    if (rowDate !== targetDate) continue;

    const existingRange = parseEventTimeRange(row.event_time);
    if (newRange && existingRange) {
      if (newRange.start < existingRange.end && existingRange.start < newRange.end) {
        return row;
      }
    } else {
      if (row.event_time.trim().toLowerCase() === eventTime.trim().toLowerCase()) {
        return row;
      }
    }
  }

  return null;
};

// --- MIDDLEWARES ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized role' });
    }
    next();
  };
};

const authorizeSubRole = (...allowedSubRoles) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'Student') {
      return res.status(403).json({ error: 'Unauthorized sub-role' });
    }
    const hasMatch = allowedSubRoles.some(allowed => {
      if (!req.user.sub_role) return false;
      const userSub = req.user.sub_role.toLowerCase();
      const allow = allowed.toLowerCase();

      // Dynamic support for spelling variations of secretary/executive
      if (allow.includes('secret') && (userSub.includes('secret') || userSub.includes('secert'))) return true;
      if (allow.includes('exec') && userSub.includes('exec')) return true;

      if (userSub === allow) return true;
      return userSub.includes(allow);
    });
    if (!hasMatch) {
      return res.status(403).json({ error: 'Unauthorized sub-role' });
    }
    next();
  };
};

// --- AUTH ROUTES ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt for identifier: ${username}`);
  try {
    // Query by username OR roll_number
    const result = await db.query('SELECT * FROM users WHERE username = $1 OR roll_number = $1', [username]);
    if (result.rows.length === 0) {
      console.log('User not found in database');
      return res.status(400).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    console.log(`User found: ${user.username}, Role: ${user.role}`);

    // If user is a student, they must login with their roll number, not username
    if (user.role === 'Student' && user.roll_number !== username) {
      console.log('Student tried to log in using username instead of roll number');
      return res.status(400).json({ error: 'Students must log in using their Roll Number' });
    }

    // Direct plain-text password comparison
    const validPassword = password === user.password_hash;
    if (!validPassword) {
      console.log('Invalid password provided');
      return res.status(400).json({ error: 'Invalid password' });
    }

    console.log('Login successful, generating token...');

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, sub_role: user.sub_role, section: user.section, year: user.year },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, sub_role: user.sub_role, section: user.section, year: user.year } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- USER ROUTES ---
app.get('/api/users', authenticateToken, async (req, res) => {
  // Only Admin or Staff can view all users, or maybe we need Students to be viewed by Staff/Secretary/Executive
  try {
    const result = await db.query('SELECT id, username, role, sub_role, roll_number, section, year FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  const { username, password, role, sub_role, roll_number, section, year } = req.body;

  // Logic for creation permissions:
  // Admin can create Staff
  // Staff can create Students (including Secretary & Executive)
  if (role === 'Staff' && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Admin can create Staff' });
  }
  if (role === 'Student' && req.user.role !== 'Staff') {
    return res.status(403).json({ error: 'Only Staff can create Students' });
  }
  if (role === 'Admin') {
    return res.status(403).json({ error: 'Cannot create Admin accounts' });
  }
  if (role === 'Student' && (!roll_number || roll_number.trim() === '')) {
    return res.status(400).json({ error: 'Roll number is required for students' });
  }
  if (role === 'Student' && (!section || !['A', 'B', 'C', 'D'].includes(section))) {
    return res.status(400).json({ error: 'Section (A, B, C, or D) is required for students' });
  }
  if (role === 'Student' && (!year || !['1st Year', '2nd Year'].includes(year))) {
    return res.status(400).json({ error: 'Year (1st Year or 2nd Year) is required for students' });
  }

  try {
    // Saving password directly in plain text
    const result = await db.query(
      'INSERT INTO users (username, password_hash, role, sub_role, roll_number, section, year) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, role, sub_role, roll_number, section, year',
      [username, password, role, sub_role || null, roll_number || null, section || null, year || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'users_username_key') {
        return res.status(400).json({ error: 'Username is already taken' });
      }
      if (err.constraint === 'users_roll_number_key') {
        return res.status(400).json({ error: 'Roll Number is already registered' });
      }
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/bulk', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Staff' && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Staff and Admins can import students' });
  }

  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'No students provided for import' });
  }

  let importedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const s of students) {
    const username = (s.username || '').trim();
    const roll_number = (s.roll_number || '').trim();
    const section = (s.section || 'A').trim();
    const year = (s.year || '1st Year').trim();
    const sub_role = s.sub_role || 'Regular';
    const role = 'Student';
    const password = s.password || roll_number;

    if (!username || !roll_number) {
      skippedCount++;
      errors.push(`Skipped row with missing roll number or name`);
      continue;
    }

    try {
      await db.query(
        `INSERT INTO users (username, password_hash, role, sub_role, roll_number, section, year)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (roll_number) DO UPDATE SET
           username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash,
           section = EXCLUDED.section,
           year = EXCLUDED.year,
           sub_role = EXCLUDED.sub_role`,
        [username, password, role, sub_role, roll_number, section, year]
      );
      importedCount++;
    } catch (err) {
      skippedCount++;
      errors.push(`Error adding ${roll_number} (${username}): ${err.message}`);
    }
  }

  res.json({
    message: `Successfully imported ${importedCount} student(s). ${skippedCount > 0 ? `Skipped ${skippedCount}.` : ''}`,
    importedCount,
    skippedCount,
    errors
  });
});

app.put('/api/users/promote-first-year', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Staff' && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Staff/Admin can promote students' });
  }
  try {
    const result = await db.query(
      "UPDATE users SET year = '2nd Year' WHERE role = 'Student' AND year = '1st Year' RETURNING id"
    );
    res.json({ message: `${result.rowCount} student(s) promoted to 2nd Year` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/remove-second-year', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Staff' && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Staff/Admin can delete students' });
  }
  try {
    const result = await db.query(
      "DELETE FROM users WHERE role = 'Student' AND year = '2nd Year' RETURNING id"
    );
    res.json({ message: `${result.rowCount} student(s) removed` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const targetUserRes = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (targetUserRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetRole = targetUserRes.rows[0].role;

    // Admin can delete Staff
    // Staff can delete Students
    if (targetRole === 'Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admin can delete Staff' });
    }
    if (targetRole === 'Student' && req.user.role !== 'Staff') {
      return res.status(403).json({ error: 'Only Staff can delete Students' });
    }
    if (targetRole === 'Admin') {
      return res.status(403).json({ error: 'Cannot delete Admin accounts' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update individual user details (e.g. username, sub_role, section, year)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { username, sub_role, section, year } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const targetUserRes = await db.query('SELECT role, sub_role, section, year FROM users WHERE id = $1', [id]);
    if (targetUserRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetUser = targetUserRes.rows[0];

    // Admin can edit Staff/Students. Staff can edit Students.
    if (targetUser.role === 'Student' && req.user.role !== 'Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Staff and Admin can edit Student accounts' });
    }
    if (targetUser.role === 'Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admin can edit Staff accounts' });
    }
    if (targetUser.role === 'Admin') {
      return res.status(403).json({ error: 'Cannot edit Admin accounts' });
    }

    // Check if the username is already taken by another user
    const checkUser = await db.query('SELECT id FROM users WHERE username = $1 AND id <> $2', [username.trim(), id]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const updatedSubRole = sub_role !== undefined ? sub_role : targetUser.sub_role;
    const updatedSection = section !== undefined ? section : targetUser.section;
    const updatedYear = year !== undefined ? year : targetUser.year;

    const result = await db.query(
      'UPDATE users SET username = $1, sub_role = $2, section = $3, year = $4 WHERE id = $5 RETURNING *',
      [username.trim(), updatedSubRole, updatedSection, updatedYear, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/bulk-delete', authenticateToken, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No user IDs provided' });
  }
  try {
    const usersRes = await db.query('SELECT id, role FROM users WHERE id = ANY($1)', [ids]);
    for (let u of usersRes.rows) {
      if (u.role === 'Admin') {
        return res.status(403).json({ error: 'Cannot delete Admin accounts' });
      }
      if (u.role === 'Staff' && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Only Admin can delete Staff' });
      }
      if (u.role === 'Student' && req.user.role !== 'Staff') {
        return res.status(403).json({ error: 'Only Staff can delete Students' });
      }
    }
    await db.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
    res.json({ message: `${ids.length} user(s) deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- EVENT FORM ROUTES ---

// Create Form (Secretary only)
app.post('/api/forms', authenticateToken, authorizeSubRole('Secretary'), async (req, res) => {
  const { event_name, organizer_1, organizer_2, organizer_3, event_date, event_time, created_date } = req.body;
  try {
    const timeConflict = await checkEventTimeConflict(event_date, event_time);
    if (timeConflict) {
      return res.status(400).json({
        error: `Another event "${timeConflict.event_name}" is already scheduled on ${event_date} at ${timeConflict.event_time}. An event cannot be scheduled at the same date and time.`
      });
    }

    const conflict = await checkStudentConflict(event_date, [organizer_1, organizer_2, organizer_3]);
    if (conflict) {
      return res.status(400).json({
        error: `Student ${conflict.username} is already an ${conflict.role_type.toLowerCase()} in event "${conflict.event_name}" on ${event_date}.`
      });
    }

    const result = await db.query(
      'INSERT INTO event_forms (event_name, created_by, organizer_1, organizer_2, organizer_3, event_date, event_time, created_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [event_name, req.user.id, organizer_1, organizer_2 || null, organizer_3 || null, event_date || null, event_time || null, created_date || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Form (Creator Secretary or Staff/Admin)
app.delete('/api/forms/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const formCheck = await db.query('SELECT created_by, status, is_completed, ppt_filename FROM event_forms WHERE id = $1', [id]);
    if (formCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formCheck.rows[0];
    const isStaffOrAdmin = (req.user.role === 'Admin' || req.user.role === 'Staff');

    if (form.is_completed) {
      // Completed forms can only be deleted by Staff or Admin
      if (!isStaffOrAdmin) {
        return res.status(403).json({ error: 'Only Staff/Admin can delete completed forms' });
      }
    } else {
      // For active non-completed forms, approved forms cannot be deleted
      if (form.status === 'Approved') {
        return res.status(400).json({ error: 'Cannot delete an approved active event form' });
      }
      const userSubRoleLower = (req.user.sub_role || '').toLowerCase();
      const isCreatorSecretary = (req.user.role === 'Student' && (userSubRoleLower.includes('secret') || userSubRoleLower.includes('secert')) && form.created_by === req.user.id);
      if (!isCreatorSecretary && !isStaffOrAdmin) {
        return res.status(403).json({ error: 'Only the creator Secretary or Staff/Admin can delete this form' });
      }
    }

    // Clean up associated PPT file if exists
    if (form.ppt_filename) {
      const filePath = path.join(__dirname, 'uploads', form.ppt_filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error(`Failed to delete PPT file on form deletion:`, e);
        }
      }
    }

    await db.query('DELETE FROM event_forms WHERE id = $1', [id]);
    res.json({ message: 'Form deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Forms
app.get('/api/forms', authenticateToken, async (req, res) => {
  try {
    // Basic query, fetching form details and organizers' names
    const query = `
      SELECT f.*, 
        u1.username as created_by_name,
        u1.sub_role as created_by_sub_role,
        o1.username as org1_name, o1.section as org1_section, o1.sub_role as org1_sub_role, o1.roll_number as org1_roll, o1.year as org1_year,
        o2.username as org2_name, o2.section as org2_section, o2.sub_role as org2_sub_role, o2.roll_number as org2_roll, o2.year as org2_year,
        o3.username as org3_name, o3.section as org3_section, o3.sub_role as org3_sub_role, o3.roll_number as org3_roll, o3.year as org3_year,
        a.username as approved_by_name,
        a.section as approved_by_section
      FROM event_forms f
      LEFT JOIN users u1 ON f.created_by = u1.id
      LEFT JOIN users o1 ON f.organizer_1 = o1.id
      LEFT JOIN users o2 ON f.organizer_2 = o2.id
      LEFT JOIN users o3 ON f.organizer_3 = o3.id
      LEFT JOIN users a ON f.approved_by = a.id
      ORDER BY f.event_date ASC, f.event_time ASC, f.created_at ASC
    `;
    const formsResult = await db.query(query);

    // Fetch participants for all forms
    const partsResult = await db.query(`
      SELECT fp.form_id, u.id, u.username, u.section, u.sub_role, u.roll_number, u.year
      FROM form_participants fp 
      JOIN users u ON fp.student_id = u.id
    `);

    // Group participants by form
    const forms = formsResult.rows.map(form => {
      form.participants = partsResult.rows.filter(p => p.form_id === form.id);
      return form;
    });

    res.json(forms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit Participants (Executive, Secretary, Organizers, Staff/Admin)
app.put('/api/forms/:id/participants', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { student_ids } = req.body; // Array of student IDs
  try {
    const formCheck = await db.query(
      'SELECT f.status, f.is_completed, f.created_by, f.event_date, f.organizer_1, f.organizer_2, f.organizer_3, u.sub_role as creator_sub_role FROM event_forms f LEFT JOIN users u ON f.created_by = u.id WHERE f.id = $1',
      [id]
    );
    if (formCheck.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    const form = formCheck.rows[0];
    if (form.is_completed) {
      return res.status(403).json({ error: 'Cannot edit participants on a completed form' });
    }

    const userSubRoleLower = (req.user.sub_role || '').toLowerCase();
    const isExecutiveOrSecretary = (req.user.role === 'Student' && (userSubRoleLower.includes('exec') || userSubRoleLower.includes('secret') || userSubRoleLower.includes('secert')) && isAssociationAligned(form.creator_sub_role, req.user.sub_role));
    const isCreatorSecretary = (req.user.role === 'Student' && (userSubRoleLower.includes('secret') || userSubRoleLower.includes('secert')) && form.created_by === req.user.id);
    const isStaffOrAdmin = (req.user.role === 'Admin' || req.user.role === 'Staff');

    if (!isExecutiveOrSecretary && !isCreatorSecretary && !isStaffOrAdmin) {
      return res.status(403).json({ error: 'Unauthorized to edit participants. Only Executives, Secretaries, and Staff/Admin can edit participants.' });
    }

    // 1. Check if any participant is already an organizer of this form
    const organizers = [form.organizer_1, form.organizer_2, form.organizer_3].filter(oid => oid != null);
    for (let sid of student_ids) {
      if (organizers.includes(sid)) {
        const uRes = await db.query('SELECT username FROM users WHERE id = $1', [sid]);
        const uname = uRes.rows[0]?.username || 'Student';
        return res.status(400).json({ error: `Student ${uname} is already an organizer of this event.` });
      }
    }

    // 2. Check if any participant has a conflict in another event on the same date
    const conflict = await checkStudentConflict(form.event_date, student_ids, id);
    if (conflict) {
      return res.status(400).json({
        error: `Student ${conflict.username} is already an ${conflict.role_type.toLowerCase()} in event "${conflict.event_name}" on ${form.event_date}.`
      });
    }

    await db.query('BEGIN');
    await db.query('DELETE FROM form_participants WHERE form_id = $1', [id]);
    for (let sid of student_ids) {
      await db.query('INSERT INTO form_participants (form_id, student_id) VALUES ($1, $2)', [id, sid]);
    }
    await db.query('COMMIT');
    res.json({ message: 'Participants updated successfully' });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// Edit Event Date & Time (Executive, Secretary, Organizers, Staff/Admin)
app.put('/api/forms/:id/datetime', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { event_date, event_time } = req.body;
  try {
    const formCheck = await db.query(
      'SELECT f.created_by, f.is_completed, f.status, f.organizer_1, f.organizer_2, f.organizer_3, u.sub_role as creator_sub_role FROM event_forms f LEFT JOIN users u ON f.created_by = u.id WHERE f.id = $1',
      [id]
    );
    if (formCheck.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    const form = formCheck.rows[0];
    if (form.is_completed) {
      return res.status(403).json({ error: 'Cannot edit date/time on a completed form' });
    }

    const userSubRoleLower = (req.user.sub_role || '').toLowerCase();
    const isCreatorSecretary = (req.user.role === 'Student' && (userSubRoleLower.includes('secret') || userSubRoleLower.includes('secert')) && form.created_by === req.user.id);
    const isExecutiveOrSecretary = (req.user.role === 'Student' && (userSubRoleLower.includes('exec') || userSubRoleLower.includes('secret') || userSubRoleLower.includes('secert')) && isAssociationAligned(form.creator_sub_role, req.user.sub_role));
    const isOrganizer = [form.organizer_1, form.organizer_2, form.organizer_3].includes(req.user.id);
    const isStaffOrAdmin = (req.user.role === 'Admin' || req.user.role === 'Staff');

    if (!isCreatorSecretary && !isExecutiveOrSecretary && !isOrganizer && !isStaffOrAdmin) {
      return res.status(403).json({ error: 'Unauthorized to edit date and time' });
    }

    // Check conflict on the new event_date for organizers and participants
    const partsRes = await db.query('SELECT student_id FROM form_participants WHERE form_id = $1', [id]);
    const participantIds = partsRes.rows.map(r => r.student_id);
    const allStudentIds = [form.organizer_1, form.organizer_2, form.organizer_3, ...participantIds].filter(oid => oid != null);

    const timeConflict = await checkEventTimeConflict(event_date, event_time, id);
    if (timeConflict) {
      return res.status(400).json({
        error: `Another event "${timeConflict.event_name}" is already scheduled on ${event_date} at ${timeConflict.event_time}. An event cannot be scheduled at the same date and time.`
      });
    }

    const conflict = await checkStudentConflict(event_date, allStudentIds, id);
    if (conflict) {
      return res.status(400).json({
        error: `Student ${conflict.username} is already an ${conflict.role_type.toLowerCase()} in event "${conflict.event_name}" on ${event_date}.`
      });
    }

    await db.query(
      'UPDATE event_forms SET event_date = $1, event_time = $2 WHERE id = $3',
      [event_date || null, event_time || null, id]
    );
    res.json({ message: 'Event date and time updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit Rounds (Organizers only)
app.put('/api/forms/:id/rounds', authenticateToken, authorizeRole('Student'), async (req, res) => {
  const { id } = req.params;
  const { round_1_details, round_2_details, round_3_details } = req.body;
  try {
    const formCheck = await db.query('SELECT status, organizer_1, organizer_2, organizer_3 FROM event_forms WHERE id = $1', [id]);
    if (formCheck.rows.length === 0) return res.status(404).json({ error: 'Form not found' });

    const form = formCheck.rows[0];
    if (form.status === 'Approved') {
      return res.status(403).json({ error: 'Cannot edit rounds on an approved form' });
    }

    // Check if the current user is one of the organizers
    const orgs = [form.organizer_1, form.organizer_2, form.organizer_3].filter(Boolean).map(String);
    const isOrganizer = orgs.includes(String(req.user.id));
    if (!isOrganizer) {
      return res.status(403).json({ error: 'Only organizers can edit rounds' });
    }

    const result = await db.query(
      'UPDATE event_forms SET round_1_details = COALESCE($1, round_1_details), round_2_details = COALESCE($2, round_2_details), round_3_details = COALESCE($3, round_3_details) WHERE id = $4 RETURNING *',
      [round_1_details, round_2_details, round_3_details, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const multer = require('multer');

// Configure storage for PPT files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.ppt' || ext === '.pptx') {
      cb(null, true);
    } else {
      cb(new Error('Only .ppt and .pptx files are allowed!'), false);
    }
  },
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Upload PPT (Organizers, Creator Secretary, Aligned Executive, Staff/Admin)
app.put('/api/forms/:id/ppt', authenticateToken, upload.single('ppt'), async (req, res) => {
  const { id } = req.params;
  try {
    const formCheck = await db.query('SELECT f.status, f.is_completed, f.organizer_1, f.organizer_2, f.organizer_3, f.created_by, f.ppt_filename, u.sub_role as creator_sub_role FROM event_forms f LEFT JOIN users u ON f.created_by = u.id WHERE f.id = $1', [id]);
    if (formCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formCheck.rows[0];
    if (form.is_completed) {
      return res.status(403).json({ error: 'Cannot upload PPT to a completed form' });
    }

    const orgs = [form.organizer_1, form.organizer_2, form.organizer_3].filter(Boolean).map(String);
    const isOrganizer = orgs.includes(String(req.user.id));
    if (!isOrganizer) {
      return res.status(403).json({ error: 'Only assigned organizers of this event can upload or update the PPT.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded or file format is incorrect' });
    }

    const ppt_filename = req.file.filename;
    const original_name = req.file.originalname;

    // Delete old file if exists
    if (form.ppt_filename) {
      const oldPath = path.join(__dirname, 'uploads', form.ppt_filename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.error('Failed to delete old PPT file:', e);
        }
      }
    }

    const result = await db.query(
      'UPDATE event_forms SET ppt_filename = $1, ppt_original_name = $2 WHERE id = $3 RETURNING *',
      [ppt_filename, original_name, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve/Reject (Secretary/Executive Student only)
app.put('/api/forms/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, queries } = req.body; // 'Approved' or 'Rejected', queries is optional/required for rejection

  // Check role: must be Student and sub_role is Secretary or Executive (including club-specific ones)
  const userSubRoleLower = (req.user.sub_role || '').toLowerCase();
  const isSecOrExec = userSubRoleLower.includes('secret') || userSubRoleLower.includes('secert') || userSubRoleLower.includes('exec');
  if (req.user.role !== 'Student' || !isSecOrExec) {
    return res.status(403).json({ error: 'Only Secretary or Executive can approve or reject event forms' });
  }

  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // Check if form is complete (has event_name, all 3 rounds details, ppt_filename, and at least 1 participant)
    const formCheck = await db.query(`
      SELECT f.*,
        u.sub_role as creator_sub_role,
        (SELECT COUNT(*) FROM form_participants WHERE form_id = f.id) as participant_count
      FROM event_forms f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = $1
    `, [id]);

    if (formCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    if (!isAssociationAligned(formCheck.rows[0].creator_sub_role, req.user.sub_role)) {
      return res.status(403).json({ error: 'Unauthorized: Association alignment mismatch' });
    }

    const form = formCheck.rows[0];
    const participantCount = parseInt(form.participant_count, 10) || 0;
    const hasPpt = Boolean(form.ppt_filename && form.ppt_filename.trim() !== '');

    if (
      !form.event_name || form.event_name.trim() === '' ||
      !form.organizer_1 ||
      !form.round_1_details || form.round_1_details.trim() === ''
    ) {
      return res.status(400).json({
        error: 'Cannot approve or reject: Basic event details (Event name, Organizer 1, and Round 1 details) must be filled out.'
      });
    }

    if (status === 'Approved' && participantCount > 0 && !hasPpt) {
      return res.status(400).json({
        error: 'PPT is required to approve this event form because participants are added.'
      });
    }

    const result = await db.query(
      'UPDATE event_forms SET status = $1, approved_by = $2, rejection_queries = $3 WHERE id = $4 RETURNING *',
      [status, req.user.id, status === 'Rejected' ? (queries || null) : null, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete/Reopen Event Form
app.put('/api/forms/:id/complete', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { is_completed } = req.body;

  if (typeof is_completed !== 'boolean') {
    return res.status(400).json({ error: 'is_completed must be a boolean' });
  }

  try {
    const formCheck = await db.query('SELECT f.*, u.sub_role as creator_sub_role FROM event_forms f LEFT JOIN users u ON f.created_by = u.id WHERE f.id = $1', [id]);
    if (formCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formCheck.rows[0];
    if (form.status !== 'Approved') {
      return res.status(400).json({ error: 'Only approved event forms can be marked as completed' });
    }

    // Check authorization: must be Student and sub_role is Secretary or Executive
    const userSubRoleLower = (req.user.sub_role || '').toLowerCase();
    const isSecOrExec = req.user.role === 'Student' && (userSubRoleLower.includes('secret') || userSubRoleLower.includes('secert') || userSubRoleLower.includes('exec')) && isAssociationAligned(form.creator_sub_role, req.user.sub_role);

    if (!isSecOrExec) {
      return res.status(403).json({ error: 'Only student Secretary or Executive can change the completion status of this event' });
    }

    const result = await db.query(
      `UPDATE event_forms SET is_completed = $1, completed_at = ${is_completed ? 'NOW()' : 'NULL'} WHERE id = $2 RETURNING *`,
      [is_completed, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resubmit Form (Organizers only)
app.put('/api/forms/:id/resubmit', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const formCheck = await db.query('SELECT status, organizer_1, organizer_2, organizer_3 FROM event_forms WHERE id = $1', [id]);
    if (formCheck.rows.length === 0) return res.status(404).json({ error: 'Form not found' });

    const form = formCheck.rows[0];
    if (form.status !== 'Rejected') {
      return res.status(400).json({ error: 'Only rejected forms can be resubmitted' });
    }

    const isOrganizer = [form.organizer_1, form.organizer_2, form.organizer_3].includes(req.user.id);
    if (!isOrganizer) {
      return res.status(403).json({ error: 'Only organizers can resubmit the form' });
    }

    const result = await db.query(
      "UPDATE event_forms SET status = 'Pending' WHERE id = $1 RETURNING *",
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Agenda Details (All users)
app.get('/api/agenda', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM agenda_details ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Agenda Detail (Staff/Admin only, supports single and bulk insert)
app.post('/api/agenda', authenticateToken, async (req, res) => {
  const isStaffOrAdmin = (req.user.role === 'Admin' || req.user.role === 'Staff');
  if (!isStaffOrAdmin) {
    return res.status(403).json({ error: 'Only Staff and Admins can create agenda details' });
  }

  const body = req.body;
  if (Array.isArray(body)) {
    // Validate all items
    for (const item of body) {
      if (!item.category || !item.name) {
        return res.status(400).json({ error: 'Category and name are required for all members' });
      }
    }
    try {
      await db.query('BEGIN');
      const inserted = [];
      for (const item of body) {
        const result = await db.query(
          'INSERT INTO agenda_details (category, name, designation) VALUES ($1, $2, $3) RETURNING *',
          [item.category, item.name, item.designation || null]
        );
        inserted.push(result.rows[0]);
      }
      await db.query('COMMIT');
      res.json(inserted);
    } catch (err) {
      await db.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    }
  } else {
    // Single insert
    const { category, name, designation } = body;
    if (!category || !name) {
      return res.status(400).json({ error: 'Category and name are required' });
    }
    try {
      const result = await db.query(
        'INSERT INTO agenda_details (category, name, designation) VALUES ($1, $2, $3) RETURNING *',
        [category, name, designation || null]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Bulk Edit Agenda Details (Staff/Admin only)
app.put('/api/agenda/bulk', authenticateToken, async (req, res) => {
  const isStaffOrAdmin = (req.user.role === 'Admin' || req.user.role === 'Staff');
  if (!isStaffOrAdmin) {
    return res.status(403).json({ error: 'Only Staff and Admins can edit agenda details' });
  }
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Items must be an array' });
  }
  for (const item of items) {
    if (!item.id || !item.category || !item.name) {
      return res.status(400).json({ error: 'ID, Category and name are required for all members' });
    }
  }
  try {
    await db.query('BEGIN');
    const updated = [];
    for (const item of items) {
      const result = await db.query(
        'UPDATE agenda_details SET category = $1, name = $2, designation = $3 WHERE id = $4 RETURNING *',
        [item.category, item.name, item.designation || null, item.id]
      );
      if (result.rows.length > 0) {
        updated.push(result.rows[0]);
      }
    }
    await db.query('COMMIT');
    res.json(updated);
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// Edit Agenda Detail (Staff/Admin only)
app.put('/api/agenda/:id', authenticateToken, async (req, res) => {
  const isStaffOrAdmin = (req.user.role === 'Admin' || req.user.role === 'Staff');
  if (!isStaffOrAdmin) {
    return res.status(403).json({ error: 'Only Staff and Admins can edit agenda details' });
  }
  const { id } = req.params;
  const { category, name, designation } = req.body;
  if (!category || !name) {
    return res.status(400).json({ error: 'Category and name are required' });
  }
  try {
    const result = await db.query(
      'UPDATE agenda_details SET category = $1, name = $2, designation = $3 WHERE id = $4 RETURNING *',
      [category, name, designation || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agenda detail not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Agenda Detail (Staff/Admin only)
app.delete('/api/agenda/:id', authenticateToken, async (req, res) => {
  const isStaffOrAdmin = (req.user.role === 'Admin' || req.user.role === 'Staff');
  if (!isStaffOrAdmin) {
    return res.status(403).json({ error: 'Only Staff and Admins can delete agenda details' });
  }
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM agenda_details WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agenda detail not found' });
    }
    res.json({ message: 'Agenda detail deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk Delete Agenda Details (Staff/Admin only)
app.post('/api/agenda/bulk-delete', authenticateToken, async (req, res) => {
  const isStaffOrAdmin = (req.user.role === 'Admin' || req.user.role === 'Staff');
  if (!isStaffOrAdmin) {
    return res.status(403).json({ error: 'Only Staff and Admins can delete agenda details' });
  }
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No IDs provided' });
  }
  try {
    await db.query('DELETE FROM agenda_details WHERE id = ANY($1)', [ids]);
    res.json({ message: `${ids.length} detail(s) deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
