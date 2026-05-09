import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { Trash2, UserPlus } from 'lucide-react';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user.role === 'Admin' ? 'Staff' : 'Student');
  const [subRole, setSubRole] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
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
        roll_number: role === 'Student' ? rollNumber : null
      });
      setUsername('');
      setPassword('');
      setRollNumber('');
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

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
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
          <div className="input-group">
            <label>Role</label>
            <select className="select" value={role} onChange={e => setRole(e.target.value)}>
              {user.role === 'Admin' && <option value="Staff">Staff</option>}
              {user.role === 'Staff' && <option value="Student">Student</option>}
            </select>
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
                </select>
              </div>
            </>
          )}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Account</button>
        </form>
      </div>

      <div className="glass-panel">
        <h3>User List</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Roll Number</th>
                <th>Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td style={{ fontWeight: 500 }}>{u.username}</td>
                  <td>{u.roll_number || '-'}</td>
                  <td>
                    <span className={`badge badge-${u.role}`}>{u.role}</span>
                    {u.sub_role && <span className="badge" style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.1)' }}>{u.sub_role}</span>}
                  </td>
                  <td>
                    {u.id !== user.id && u.role !== 'Admin' && (
                      <button onClick={() => handleDelete(u.id)} className="btn btn-danger" style={{ padding: '0.4rem 0.8rem' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
