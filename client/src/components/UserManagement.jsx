import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { Trash2, UserPlus, Edit3, Check, X } from 'lucide-react';

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

  const handleEditClick = (u) => {
    setEditingUserId(u.id);
    setEditingUsername(u.username);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingUsername('');
  };

  const handleSaveEdit = async (uId) => {
    if (!editingUsername.trim()) {
      alert('Username is required');
      return;
    }
    try {
      await api.put(`/users/${uId}`, { username: editingUsername });
      setEditingUserId(null);
      setEditingUsername('');
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update student name');
    }
  };

  // Filter State
  const [filterType, setFilterType] = useState('All'); // 'All', 'Staff', '1st Year', '2nd Year'
  const [filterSection, setFilterSection] = useState(''); // '', 'A', 'B', 'C', 'D'

  const handleFilterTypeChange = (type) => {
    setFilterType(type);
    setFilterSection('');
  };

  const filteredUsers = users.filter(u => {
    if (filterType === 'All') return true;
    if (filterType === 'Staff') {
      return u.role === 'Staff' || u.role === 'Admin';
    }
    if (filterType === '1st Year') {
      return u.role === 'Student' && u.year === '1st Year' && (filterSection ? u.section === filterSection : true);
    }
    if (filterType === '2nd Year') {
      return u.role === 'Student' && u.year === '2nd Year' && (filterSection ? u.section === filterSection : true);
    }
    return true;
  });

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

  return (
    <div className="grid-split">
      <div className="glass-panel">
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

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
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
            {filterType === '1st Year' && (
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
            )}
            {filterType === '2nd Year' && (
              <button
                onClick={handleRemoveAll}
                className="btn btn-danger"
                style={{ 
                  padding: '0.4rem 1rem', 
                  fontSize: '0.875rem'
                }}
              >
                Remove All Students
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
                  <td>{u.section || '-'}</td>
                  <td>{u.year || '-'}</td>
                  <td>
                    <span className={`badge badge-${u.role}`}>{u.role}</span>
                    {u.sub_role && <span className="badge" style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.1)' }}>{u.sub_role}</span>}
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
                            <button onClick={() => handleEditClick(u)} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} title="Edit Name">
                              <Edit3 size={16} />
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
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
