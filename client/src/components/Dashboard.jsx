import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';
import { LogOut, Users, FileText, PlusCircle } from 'lucide-react';
import UserManagement from './UserManagement';
import FormCreation from './FormCreation';
import FormDetails from './FormDetails';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const canManageUsers = user.role === 'Admin' || user.role === 'Staff';
  const canCreateForms = user.sub_role === 'Secretary';

  const [stats, setStats] = useState({ student: 0, secretary: 0, executive: 0 });

  useEffect(() => {
    if (canManageUsers) {
      api.get('/users').then(res => {
        const users = res.data;
        const studentCount = users.filter(u => u.role === 'Student' && (!u.sub_role || u.sub_role === 'Regular')).length;
        const secretaryCount = users.filter(u => u.role === 'Student' && u.sub_role === 'Secretary').length;
        const executiveCount = users.filter(u => u.role === 'Student' && u.sub_role === 'Executive').length;
        setStats({ student: studentCount, secretary: secretaryCount, executive: executiveCount });
      }).catch(err => console.error(err));
    }
  }, [canManageUsers]);

  return (
    <div>
      <nav className="nav-bar glass-panel" style={{ borderRadius: '0', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <div className="nav-container">
          <h2 style={{ margin: 0, background: 'linear-gradient(to right, #9EEBE8, #6FE1DC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Amirtha
          </h2>
          <div className="nav-links">
            <Link to="/" className={`btn ${location.pathname === '/' ? 'btn-secondary' : ''}`} style={{ border: 'none' }}>
              <FileText size={18} /> Forms
            </Link>
            {canCreateForms && (
              <Link to="/create-form" className={`btn ${location.pathname === '/create-form' ? 'btn-secondary' : ''}`} style={{ border: 'none' }}>
                <PlusCircle size={18} /> Create Form
              </Link>
            )}
            {canManageUsers && (
              <Link to="/users" className={`btn ${location.pathname === '/users' ? 'btn-secondary' : ''}`} style={{ border: 'none' }}>
                <Users size={18} /> Users
              </Link>
            )}
          </div>
        </div>
        <div className="nav-user">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '600' }}>{user.username}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {user.role} {user.sub_role ? `(${user.sub_role})` : ''} {user.section ? `- Sec ${user.section}` : ''}
            </div>
          </div>
          <button onClick={logout} className="btn" style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5' }}>
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {canManageUsers && (
        <div className="stats-bar">
          <span style={{ color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text)' }}>Students:</strong> {stats.student}</span>
          <span style={{ color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text)' }}>Secretaries:</strong> {stats.secretary}</span>
          <span style={{ color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text)' }}>Executives:</strong> {stats.executive}</span>
        </div>
      )}

      <div className="container">
        <Routes>
          <Route path="/" element={<FormDetails />} />
          {canCreateForms && <Route path="/create-form" element={<FormCreation />} />}
          {canManageUsers && <Route path="/users" element={<UserManagement />} />}
        </Routes>
      </div>
    </div>
  );
};

export default Dashboard;
