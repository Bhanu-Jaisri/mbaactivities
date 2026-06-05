require('dotenv').config();
require('./init_db');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

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
      { id: user.id, username: user.username, role: user.role, sub_role: user.sub_role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, sub_role: user.sub_role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- USER ROUTES ---
app.get('/api/users', authenticateToken, async (req, res) => {
  // Only Admin or Staff can view all users, or maybe we need Students to be viewed by Staff/Secretary/Executive
  try {
    const result = await db.query('SELECT id, username, role, sub_role, roll_number FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  const { username, password, role, sub_role, roll_number } = req.body;
  
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

  try {
    // Saving password directly in plain text
    const result = await db.query(
      'INSERT INTO users (username, password_hash, role, sub_role, roll_number) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role, sub_role, roll_number',
      [username, password, role, sub_role || null, roll_number || null]
    );
    res.json(result.rows[0]);
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
        a.username as approved_by_name
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

// Approve/Reject (Staff only)
app.put('/api/forms/:id/status', authenticateToken, authorizeRole('Staff'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'Approved' or 'Rejected'
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const result = await db.query(
      'UPDATE event_forms SET status = $1, approved_by = $2 WHERE id = $3 RETURNING *',
      [status, req.user.id, id]
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
