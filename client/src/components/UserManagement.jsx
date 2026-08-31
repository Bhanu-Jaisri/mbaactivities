import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { Trash2, UserPlus, Edit3, Check, X, Key, Lock } from 'lucide-react';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  
  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user.role === 'Admin' ? 'Staff' : 'Student');
  const [subRole, setSubRole] = useState('Regular');
  const [rollNumber, setRollNumber] = useState('');
  const [section, setSection] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState('');

  // Editing State
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingUsername, setEditingUsername] = useState('');
  const [editingSubRole, setEditingSubRole] = useState('Regular');
  const [editingSection, setEditingSection] = useState('A');
  const [editingYear, setEditingYear] = useState('1st Year');
  const [editingPassword, setEditingPassword] = useState('');

  // Staff Reset Password Modal State
  const [resetPasswordModalUser, setResetPasswordModalUser] = useState(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  const handleEditClick = (u) => {
    setEditingUserId(u.id);
    setEditingUsername(u.username);
    setEditingSubRole(u.sub_role || 'Regular');
    setEditingSection(u.section || 'A');
    setEditingYear(u.year || '1st Year');
    setEditingPassword('');
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingUsername('');
    setEditingSubRole('Regular');
    setEditingSection('A');
    setEditingYear('1st Year');
    setEditingPassword('');
  };

  const handleSaveEdit = async (uId) => {
    if (!editingUsername.trim()) {
      alert('Username is required');
      return;
    }
    try {
      const payload = {
        username: editingUsername,
        sub_role: editingSubRole,
        section: editingSection,
        year: editingYear
      };
      if (editingPassword && editingPassword.trim() !== '') {
        payload.password = editingPassword;
      }
      await api.put(`/users/${uId}`, payload);
      setEditingUserId(null);
      setEditingUsername('');
      setEditingPassword('');
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update student details');
    }
  };

  const handleOpenResetPassword = (u) => {
    setResetPasswordModalUser(u);
    setNewResetPassword('');
  };

  const handleSaveResetPassword = async (e) => {
    e.preventDefault();
    if (!newResetPassword || newResetPassword.trim() === '') {
      alert('New password is required');
      return;
    }
    setResetPasswordLoading(true);
    try {
      await api.put(`/users/${resetPasswordModalUser.id}/reset-password`, {
        newPassword: newResetPassword
      });
      alert(`Password for user "${resetPasswordModalUser.username}" updated successfully!`);
      setResetPasswordModalUser(null);
      setNewResetPassword('');
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setResetPasswordLoading(false);
    }
  };


  // Filter & Search State
  const [filterType, setFilterType] = useState('All'); // 'All', 'Staff', '1st Year', '2nd Year'
  const [filterSection, setFilterSection] = useState(''); // '', 'A', 'B', 'C', 'D'
  const [searchQuery, setSearchQuery] = useState('');

  const handleFilterTypeChange = (type) => {
    setFilterType(type);
    setFilterSection('');
  };

  const filteredUsers = users.filter(u => {
    if (filterType === 'Staff') {
      if (!(u.role === 'Staff' || u.role === 'Admin')) return false;
    } else if (filterType === '1st Year') {
      if (!(u.role === 'Student' && u.year === '1st Year' && (filterSection ? u.section === filterSection : true))) return false;
    } else if (filterType === '2nd Year') {
      if (!(u.role === 'Student' && u.year === '2nd Year' && (filterSection ? u.section === filterSection : true))) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (u.username || '').toLowerCase().includes(q);
      const rollMatch = (u.roll_number || '').toLowerCase().includes(q);
      const subRoleMatch = (u.sub_role || '').toLowerCase().includes(q);
      const roleMatch = (u.role || '').toLowerCase().includes(q);
      const sectionMatch = (u.section || '').toLowerCase().includes(q);
      const yearMatch = (u.year || '').toLowerCase().includes(q);

      return nameMatch || rollMatch || subRoleMatch || roleMatch || sectionMatch || yearMatch;
    }

    return true;
  }).sort((a, b) => (a.username || '').localeCompare(b.username || ''));

  useEffect(() => {
    fetchUsers();
  }, []);

  const isDeletable = (u) => {
    if (u.id === user.id) return false;
    if (u.role === 'Admin') return false;
    if (user.role === 'Admin' && u.role === 'Staff') return true;
    if (user.role === 'Staff' && u.role === 'Student') return true;
    return false;
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
      setSelectedUserIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', {
        username,
        password,
        role,
        sub_role: role === 'Student' ? subRole : null,
        roll_number: role === 'Student' ? rollNumber : null,
        section: role === 'Student' ? section : null,
        year: role === 'Student' ? year : null
      });
      setUsername('');
      setPassword('');
      setRollNumber('');
      setSection('');
      setYear('');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedUserIds.length} selected user(s)?`)) return;
    try {
      await api.post('/users/bulk-delete', { ids: selectedUserIds });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete selected users');
    }
  };

  const handlePromoteAll = async () => {
    if (!window.confirm('Are you sure you want to promote all 1st Year students to 2nd Year?')) return;
    try {
      const res = await api.put('/users/promote-first-year');
      alert(res.data.message || 'Students promoted successfully');
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to promote students');
    }
  };

  const handleRemoveAll = async () => {
    if (!window.confirm('Are you sure you want to delete all 2nd Year students? This action is irreversible.')) return;
    try {
      const res = await api.delete('/users/remove-second-year');
      alert(res.data.message || 'Students removed successfully');
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove students');
    }
  };

  const handleRemoveAllFirstYear = async () => {
    if (!window.confirm('Are you sure you want to delete all 1st Year students? This action is irreversible.')) return;
    try {
      const res = await api.delete('/users/remove-first-year');
      alert(res.data.message || 'Students removed successfully');
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove students');
    }
  };

  const handleCheckboxChange = (userId) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const deletableUsers = filteredUsers.filter(isDeletable);
  const allSelected = deletableUsers.length > 0 && deletableUsers.every(u => selectedUserIds.includes(u.id));

  const handleSelectAllToggle = () => {
    if (allSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(deletableUsers.map(u => u.id));
    }
  };

  // Bulk Import State
  const [createMode, setCreateMode] = useState('single'); // 'single' | 'bulk'
  const [bulkText, setBulkText] = useState('');
  const [bulkSection, setBulkSection] = useState('');
  const [bulkYear, setBulkYear] = useState('1st Year');
  const [bulkSubRole, setBulkSubRole] = useState('Regular');
  const [bulkMsg, setBulkMsg] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Auto-detect section and parse student list (supports single-line and multi-line Word tables)
  const parseStudentList = () => {
    if (!bulkText.trim()) return { detectedSection: 'A', students: [] };

    // Detect section if not manually set
    let detectedSec = bulkSection;
    if (!detectedSec) {
      const secMatch = bulkText.match(/Section\s*[-–—]?\s*([A-D])/i);
      if (secMatch) {
        detectedSec = secMatch[1].toUpperCase();
      }
    }
    if (!detectedSec) detectedSec = 'A';

    const rawLines = bulkText.split(/\r?\n/);
    const tokens = [];

    for (let l of rawLines) {
      const t = l.trim();
      if (!t) continue;

      // Skip common document header phrases
      if (t.match(/MEPCO|SCHLENK|ENGINEERING|COLLEGE|AUTONOMOUS|SIVAKASI|SCHOOL|MANAGEMENT|STUDIES|Students List|Roll No|Name of the Student|^Sl\.?$/i)) {
        continue;
      }

      // Split line if tab-separated
      const parts = t.split(/\t+/);
      if (parts.length > 1) {
        for (let p of parts) {
          const pt = p.trim();
          if (pt) tokens.push(pt);
        }
      } else {
        tokens.push(t);
      }
    }

    const isRollNumber = (str) => {
      if (!str) return false;
      const s = str.trim();
      if (/\s/.test(s)) return false;
      if (s.length < 5 || s.length > 15) return false;
      return /\d/.test(s) && /[A-Za-z]/.test(s);
    };

    const isSerial = (str) => {
      return /^\d+[\.\)]?$/.test(str.trim());
    };

    const students = [];
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i].trim();

      // 1. Single-line check e.g. "1. 25MBA001 Abinaya.S" or "25MBA001 Abinaya.S"
      const cleanToken = token.replace(/^\d+[\.\)]?\s*/, '').trim();
      const inlineMatch = cleanToken.match(/^([A-Za-z0-9]{5,15})\s+([A-Za-z0-9\.\s'-]+)$/);

      if (inlineMatch && isRollNumber(inlineMatch[1])) {
        const roll = inlineMatch[1].trim();
        const name = inlineMatch[2].trim().replace(/^[-:\.]\s*/, '');
        if (roll && name && name.length >= 2) {
          students.push({
            roll_number: roll,
            username: name,
            section: detectedSec,
            year: bulkYear,
            sub_role: bulkSubRole,
            role: 'Student',
            password: roll
          });
        }
        i++;
        continue;
      }

      // 2. Multi-line check (Token i is Roll Number, Token i+1 is Name)
      if (isRollNumber(token)) {
        const roll = token;
        let nextIdx = i + 1;
        let name = '';
        while (nextIdx < tokens.length) {
          const nextTok = tokens[nextIdx].trim();
          if (isSerial(nextTok)) {
            nextIdx++;
            continue;
          }
          if (!isRollNumber(nextTok)) {
            name = nextTok.replace(/^[-:\.]\s*/, '');
            break;
          } else {
            break;
          }
        }

        if (roll && name && name.length >= 2) {
          students.push({
            roll_number: roll,
            username: name,
            section: detectedSec,
            year: bulkYear,
            sub_role: bulkSubRole,
            role: 'Student',
            password: roll
          });
          i = nextIdx + 1;
          continue;
        }
      }

      i++;
    }

    return { detectedSection: detectedSec, students };
  };

  const parsedData = parseStudentList();
  const effectiveSection = bulkSection || parsedData.detectedSection;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target.result;
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ arrayBuffer });
          setBulkText(result.value);
        } catch (err) {
          console.error('Word parsing error:', err);
          // Fallback text extraction
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(event.target.result);
          const matches = text.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
          if (matches) {
            setBulkText(matches.map(m => m.replace(/<[^>]+>/g, '')).join('\n'));
          } else {
            setBulkText(text.replace(/[\x00-\x1F\x7F-\x9F]/g, ' '));
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBulkText(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleBulkImportSubmit = async (e) => {
    e.preventDefault();
    setBulkError('');
    setBulkMsg('');

    if (parsedData.students.length === 0) {
      setBulkError('No valid student entries found in the text. Ensure roll numbers and names are present.');
      return;
    }

    setIsImporting(true);
    try {
      // Apply current section, year, subrole to all students
      const finalStudents = parsedData.students.map(s => ({
        ...s,
        section: effectiveSection,
        year: bulkYear,
        sub_role: bulkSubRole,
        password: s.roll_number
      }));

      const res = await api.post('/users/bulk', { students: finalStudents });
      setBulkMsg(res.data.message || 'Students imported successfully!');
      setBulkText('');
      fetchUsers();
    } catch (err) {
      setBulkError(err.response?.data?.error || 'Failed to import students');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="grid-split">
      <div className="glass-panel">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', pb: '0.75rem' }}>
          <button
            type="button"
            className={`btn ${createMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCreateMode('single')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
          >
            Single User
          </button>
          {(user.role === 'Staff' || user.role === 'Admin') && (
            <button
              type="button"
              className={`btn ${createMode === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCreateMode('bulk')}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
            >
              Bulk Student Import (Word / List)
            </button>
          )}
        </div>

        {createMode === 'single' ? (
          <>
            <h3><UserPlus size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Create User</h3>
            {error && <div style={{ color: '#FCA5A5', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="input-group">
                <label>Username</label>
                <input type="text" className="input" value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              {role === 'Student' && (
                <>
                  <div className="input-group">
                    <label>Roll Number *</label>
                    <input type="text" className="input" value={rollNumber} onChange={e => setRollNumber(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <label>Sub-Role</label>
                    <select className="select" value={subRole} onChange={e => setSubRole(e.target.value)}>
                      <option value="Regular">Regular Student</option>
                      <option value="Secretary">Secretary</option>
                      <option value="Executive">Executive</option>
                      <option value="NISM Secretary">NISM Secretary</option>
                      <option value="NISM Executive">NISM Executive</option>
                      <option value="NIPM Secretary">NIPM Secretary</option>
                      <option value="NIPM Executive">NIPM Executive</option>
                      <option value="Ad Club Secretary">Ad Club Secretary</option>
                      <option value="Ad Club Executive">Ad Club Executive</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Section *</label>
                    <select className="select" value={section} onChange={e => setSection(e.target.value)} required={role === 'Student'}>
                      <option value="">Select Section</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Year *</label>
                    <select className="select" value={year} onChange={e => setYear(e.target.value)} required={role === 'Student'}>
                      <option value="">Select Year</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                    </select>
                  </div>
                </>
              )}
              <div className="input-group">
                <label>Role</label>
                <select className="select" value={role} onChange={e => setRole(e.target.value)}>
                  {user.role === 'Admin' && <option value="Staff">Staff</option>}
                  {user.role === 'Staff' && <option value="Student">Student</option>}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Account</button>
            </form>
          </>
        ) : (
          <div>
            <h3>Bulk Import Students</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Paste student list from Word or upload a file. Auto-detects Section, sets default Year as 1st Year, Sub-Role as Regular, and Password as Roll Number.
            </p>

            {bulkError && <div style={{ color: '#FCA5A5', marginBottom: '1rem', fontSize: '0.875rem' }}>{bulkError}</div>}
            {bulkMsg && <div style={{ color: '#34D399', marginBottom: '1rem', fontSize: '0.875rem' }}>{bulkMsg}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Section (Auto: {parsedData.detectedSection})</label>
                <select className="select" value={effectiveSection} onChange={e => setBulkSection(e.target.value)}>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                  <option value="D">Section D</option>
                </select>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label>Default Year</label>
                <select className="select" value={bulkYear} onChange={e => setBulkYear(e.target.value)}>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                </select>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label>Default Sub-Role</label>
                <select className="select" value={bulkSubRole} onChange={e => setBulkSubRole(e.target.value)}>
                  <option value="Regular">Regular Student</option>
                  <option value="Secretary">Secretary</option>
                  <option value="Executive">Executive</option>
                  <option value="NISM Secretary">NISM Secretary</option>
                  <option value="NISM Executive">NISM Executive</option>
                  <option value="NIPM Secretary">NIPM Secretary</option>
                  <option value="NIPM Executive">NIPM Executive</option>
                  <option value="Ad Club Secretary">Ad Club Secretary</option>
                  <option value="Ad Club Executive">Ad Club Executive</option>
                </select>
              </div>
            </div>

            <div className="input-group">
              <label>Upload File (.txt, .doc, .docx)</label>
              <input type="file" accept=".txt,.doc,.docx" onChange={handleFileUpload} className="input" style={{ padding: '0.4rem' }} />
            </div>

            <div className="input-group">
              <label>Or Paste Text from Word Document</label>
              <textarea
                className="input"
                rows={8}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={`Paste student list here, e.g.:

MEPCO SCHLENK ENGINEERING COLLEGE (AUTONOMOUS), SIVAKASI
MEPCO SCHOOL OF MANAGEMENT STUDIES
Students List (2025 – 2027) – Section A

Sl. Roll No Name of the Student
1. 25MBA001 Abinaya.S
2. 25MBA002 Aishwarya.G`}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>

            {parsedData.students.length > 0 && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontWeight: 600, color: '#34D399', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  ✓ Preview: {parsedData.students.length} student(s) detected for Section {effectiveSection} ({bulkYear})
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '0.8rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                        <th style={{ padding: '4px' }}>Roll No</th>
                        <th style={{ padding: '4px' }}>Name</th>
                        <th style={{ padding: '4px' }}>Section</th>
                        <th style={{ padding: '4px' }}>Year</th>
                        <th style={{ padding: '4px' }}>Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.students.slice(0, 10).map((s, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '4px' }}>{s.roll_number}</td>
                          <td style={{ padding: '4px' }}>{s.username}</td>
                          <td style={{ padding: '4px' }}>{effectiveSection}</td>
                          <td style={{ padding: '4px' }}>{bulkYear}</td>
                          <td style={{ padding: '4px', color: 'var(--text-muted)' }}>{s.roll_number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedData.students.length > 10 && (
                    <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                      ...and {parsedData.students.length - 10} more student(s)
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleBulkImportSubmit}
              disabled={isImporting || parsedData.students.length === 0}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {isImporting ? 'Importing...' : `Import ${parsedData.students.length} Student(s)`}
            </button>
          </div>
        )}
      </div>

      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ margin: 0 }}>User List</h3>
          {selectedUserIds.length > 0 && (
            <button onClick={handleBulkDelete} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
              <Trash2 size={16} /> Delete Selected ({selectedUserIds.length})
            </button>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['All', 'Staff', '1st Year', '2nd Year'].map((type) => (
              <button
                key={type}
                onClick={() => handleFilterTypeChange(type)}
                className={`btn ${filterType === type ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}
              >
                {type}
              </button>
            ))}
          </div>

          <div style={{ minWidth: '240px', flex: '1', maxWidth: '380px' }}>
            <input
              type="text"
              className="input"
              placeholder="🔍 Search by Name, Roll No, or Sub-Role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.85rem',
                fontSize: '0.875rem',
                background: 'var(--input-bg)',
                border: '1px solid var(--surface-border)',
                borderRadius: '8px'
              }}
            />
          </div>
        </div>

        {/* Section selection for 1st/2nd Year */}
        {(filterType === '1st Year' || filterType === '2nd Year') && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: '1rem', 
            marginBottom: '1rem', 
            padding: '0.75rem', 
            background: 'rgba(255, 255, 255, 0.03)', 
            borderRadius: '8px',
            border: '1px dashed var(--surface-border)',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                Select Section:
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFilterSection('')}
                  className={`btn ${filterSection === '' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    padding: '0.25rem 0.75rem', 
                    fontSize: '0.875rem',
                    boxShadow: filterSection === '' ? '0 2px 8px rgba(79, 70, 229, 0.3)' : 'none'
                  }}
                >
                  All Sections
                </button>
                {['A', 'B', 'C', 'D'].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setFilterSection(sec)}
                    className={`btn ${filterSection === sec ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ 
                      padding: '0.25rem 0.75rem', 
                      fontSize: '0.875rem',
                      minWidth: '36px',
                      boxShadow: filterSection === sec ? '0 2px 8px rgba(79, 70, 229, 0.3)' : 'none'
                    }}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            </div>

            {/* Special Action Buttons */}
            {filterType === '1st Year' && (user.role === 'Staff' || user.role === 'Admin') && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handlePromoteAll}
                  className="btn btn-secondary"
                  style={{ 
                    padding: '0.4rem 1rem', 
                    fontSize: '0.875rem',
                    borderColor: 'var(--primary)',
                    color: 'var(--text)'
                  }}
                >
                  Promote All to 2nd Year
                </button>
                <button
                  onClick={handleRemoveAllFirstYear}
                  className="btn btn-danger"
                  style={{ 
                    padding: '0.4rem 1rem', 
                    fontSize: '0.875rem'
                  }}
                >
                  Remove All 1st Year Students
                </button>
              </div>
            )}
            {filterType === '2nd Year' && (user.role === 'Staff' || user.role === 'Admin') && (
              <button
                onClick={handleRemoveAll}
                className="btn btn-danger"
                style={{ 
                  padding: '0.4rem 1rem', 
                  fontSize: '0.875rem'
                }}
              >
                Remove All 2nd Year Students
              </button>
            )}
          </div>
        )}

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAllToggle}
                    disabled={deletableUsers.length === 0}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>ID</th>
                <th>Username</th>
                <th>Roll Number</th>
                <th>Section</th>
                <th>Year</th>
                <th>Role</th>
                <th>Sub-Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td style={{ textAlign: 'center' }}>
                    {isDeletable(u) ? (
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={() => handleCheckboxChange(u.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    ) : null}
                  </td>
                  <td>{u.id}</td>
                  <td style={{ fontWeight: 500 }}>
                    {editingUserId === u.id ? (
                      <input
                        type="text"
                        className="input"
                        value={editingUsername}
                        onChange={(e) => setEditingUsername(e.target.value)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem', width: '100%' }}
                        autoFocus
                      />
                    ) : (
                      u.username
                    )}
                  </td>
                  <td>{u.roll_number || '-'}</td>
                  <td>
                    {editingUserId === u.id && u.role === 'Student' ? (
                      <select
                        className="select"
                        value={editingSection}
                        onChange={(e) => setEditingSection(e.target.value)}
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.85rem' }}
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    ) : (
                      u.section || '-'
                    )}
                  </td>
                  <td>
                    {editingUserId === u.id && u.role === 'Student' ? (
                      <select
                        className="select"
                        value={editingYear}
                        onChange={(e) => setEditingYear(e.target.value)}
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.85rem' }}
                      >
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                      </select>
                    ) : (
                      u.year || '-'
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${u.role}`}>{u.role}</span>
                  </td>
                  <td>
                    {editingUserId === u.id && u.role === 'Student' ? (
                      <select
                        className="select"
                        value={editingSubRole}
                        onChange={(e) => setEditingSubRole(e.target.value)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', minWidth: '140px' }}
                      >
                        <option value="Regular">Regular Student</option>
                        <option value="Secretary">Secretary</option>
                        <option value="Executive">Executive</option>
                        <option value="NISM Secretary">NISM Secretary</option>
                        <option value="NISM Executive">NISM Executive</option>
                        <option value="NIPM Secretary">NIPM Secretary</option>
                        <option value="NIPM Executive">NIPM Executive</option>
                        <option value="Ad Club Secretary">Ad Club Secretary</option>
                        <option value="Ad Club Executive">Ad Club Executive</option>
                      </select>
                    ) : (
                      u.sub_role ? (
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>{u.sub_role}</span>
                      ) : (
                        '-'
                      )
                    )}
                  </td>
                  <td>
                    {editingUserId === u.id ? (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button onClick={() => handleSaveEdit(u.id)} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', color: '#34D399', borderColor: '#34D399' }} title="Save">
                          <Check size={16} />
                        </button>
                        <button onClick={handleCancelEdit} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', color: '#F87171', borderColor: '#F87171' }} title="Cancel">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {isDeletable(u) && (
                          <>
                            <button onClick={() => handleEditClick(u)} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} title="Edit Student">
                              <Edit3 size={16} />
                            </button>
                            <button onClick={() => handleOpenResetPassword(u)} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', color: '#60A5FA', borderColor: 'rgba(96, 165, 250, 0.3)' }} title="Reset User Password">
                              <Key size={16} />
                            </button>
                            <button onClick={() => handleDelete(u.id)} className="btn btn-danger" style={{ padding: '0.4rem 0.6rem' }} title="Delete User">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && !loading && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {resetPasswordModalUser && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--modal-overlay, rgba(15, 23, 42, 0.75))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
            backdropFilter: 'blur(6px)'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '420px',
              background: 'var(--modal-bg, #1e293b)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--surface-border)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(96, 165, 250, 0.2)', color: '#60A5FA' }}>
                  <Key size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Reset Password</h3>
              </div>
              <button
                onClick={() => setResetPasswordModalUser(null)}
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.5rem', borderRadius: '8px', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Enter a new password for <strong style={{ color: 'var(--text)' }}>{resetPasswordModalUser.username}</strong> ({resetPasswordModalUser.roll_number || resetPasswordModalUser.role}).
            </p>

            <form onSubmit={handleSaveResetPassword}>
              <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.85rem' }}>New Password</label>
                <input
                  type="text"
                  className="input"
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setResetPasswordModalUser(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordLoading}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  {resetPasswordLoading ? 'Saving...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


export default UserManagement;
