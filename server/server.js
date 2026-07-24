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
    if (!req.user || req.user.role !== 'Student' || !allowedSubRoles.includes(req.user.sub_role)) {
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

// Update individual user details (e.g. username)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const targetUserRes = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (targetUserRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const targetRole = targetUserRes.rows[0].role;

    // Admin can edit Staff/Students. Staff can edit Students.
    if (targetRole === 'Student' && req.user.role !== 'Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Staff and Admin can edit Student accounts' });
    }
    if (targetRole === 'Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admin can edit Staff accounts' });
    }
    if (targetRole === 'Admin') {
      return res.status(403).json({ error: 'Cannot edit Admin accounts' });
    }

    // Check if the username is already taken by another user
    const checkUser = await db.query('SELECT id FROM users WHERE username = $1 AND id <> $2', [username, id]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const result = await db.query(
      'UPDATE users SET username = $1 WHERE id = $2 RETURNING *',
      [username, id]
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
  const { event_name, organizer_1, organizer_2, organizer_3 } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO event_forms (event_name, created_by, organizer_1, organizer_2, organizer_3) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [event_name, req.user.id, organizer_1, organizer_2 || null, organizer_3 || null]
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
      const isCreatorSecretary = (req.user.role === 'Student' && req.user.sub_role === 'Secretary' && form.created_by === req.user.id);
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
        o1.username as org1_name,
        o2.username as org2_name,
        o3.username as org3_name,
        a.username as approved_by_name,
        a.section as approved_by_section
      FROM event_forms f
      LEFT JOIN users u1 ON f.created_by = u1.id
      LEFT JOIN users o1 ON f.organizer_1 = o1.id
      LEFT JOIN users o2 ON f.organizer_2 = o2.id
      LEFT JOIN users o3 ON f.organizer_3 = o3.id
      LEFT JOIN users a ON f.approved_by = a.id
      ORDER BY f.created_at DESC
    `;
    const formsResult = await db.query(query);
    
    // Fetch participants for all forms
    const partsResult = await db.query(`
      SELECT fp.form_id, u.id, u.username 
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

// Edit Participants (Executive only)
app.put('/api/forms/:id/participants', authenticateToken, authorizeSubRole('Executive'), async (req, res) => {
  const { id } = req.params;
  const { student_ids } = req.body; // Array of student IDs
  try {
    const formCheck = await db.query('SELECT status FROM event_forms WHERE id = $1', [id]);
    if (formCheck.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    if (formCheck.rows[0].status === 'Approved') {
      return res.status(403).json({ error: 'Cannot edit participants on an approved form' });
    }

    await db.query('BEGIN');
    await db.query('DELETE FROM form_participants WHERE form_id = $1', [id]);
    for (let sid of student_ids) {
      await db.query('INSERT INTO form_participants (form_id, student_id) VALUES ($1, $2)', [id, sid]);
    }
    await db.query('COMMIT');
    res.json({ message: 'Participants updated' });
  } catch (err) {
    await db.query('ROLLBACK');
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
    const isOrganizer = [form.organizer_1, form.organizer_2, form.organizer_3].includes(req.user.id);
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

// Upload PPT (Organizers only)
app.put('/api/forms/:id/ppt', authenticateToken, authorizeRole('Student'), upload.single('ppt'), async (req, res) => {
  const { id } = req.params;
  try {
    const formCheck = await db.query('SELECT status, organizer_1, organizer_2, organizer_3, ppt_filename FROM event_forms WHERE id = $1', [id]);
    if (formCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }
    
    const form = formCheck.rows[0];
    if (form.status === 'Approved') {
      return res.status(403).json({ error: 'Cannot upload PPT to an approved form' });
    }

    // Check if user is organizer
    const isOrganizer = [form.organizer_1, form.organizer_2, form.organizer_3].includes(req.user.id);
    if (!isOrganizer) {
      return res.status(403).json({ error: 'Only organizers can upload PPT' });
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

  // Check role: must be Student and sub_role is Secretary or Executive
  if (req.user.role !== 'Student' || !['Secretary', 'Executive'].includes(req.user.sub_role)) {
    return res.status(403).json({ error: 'Only Secretary or Executive can approve or reject event forms' });
  }

  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // Check if form is complete (has event_name, all 3 rounds details, ppt_filename, and at least 1 participant)
    const formCheck = await db.query(`
      SELECT f.*,
        (SELECT COUNT(*) FROM form_participants WHERE form_id = f.id) as participant_count
      FROM event_forms f
      WHERE f.id = $1
    `, [id]);

    if (formCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formCheck.rows[0];
    if (
      !form.event_name || form.event_name.trim() === '' ||
      !form.organizer_1 ||
      !form.ppt_filename || form.ppt_filename.trim() === '' ||
      !form.round_1_details || form.round_1_details.trim() === '' ||
      parseInt(form.participant_count) === 0
    ) {
      return res.status(400).json({
        error: 'Cannot approve or reject: All event details (Event name, Round 1 details, PPT file, and saved participants) must be filled out.'
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
    const formCheck = await db.query('SELECT * FROM event_forms WHERE id = $1', [id]);
    if (formCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formCheck.rows[0];
    if (form.status !== 'Approved') {
      return res.status(400).json({ error: 'Only approved event forms can be marked as completed' });
    }

    // Check authorization: must be Student and sub_role is Secretary or Executive
    const isSecOrExec = req.user.role === 'Student' && ['Secretary', 'Executive'].includes(req.user.sub_role);

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


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
