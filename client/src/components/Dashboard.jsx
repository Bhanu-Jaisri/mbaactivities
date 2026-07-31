import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { LogOut, Users, FileText, PlusCircle, Sun, Moon } from 'lucide-react';
import UserManagement from './UserManagement';
import FormCreation from './FormCreation';
import FormDetails from './FormDetails';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
        <div className="nav-container" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className="nav-brand" style={{ display: 'flex', flexDirection: 'column', marginRight: '1rem' }}>
            <span style={{ 
              fontSize: '1.05rem', 
              fontWeight: '700', 
              background: 'var(--logo-gradient)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              lineHeight: '1.2'
            }}>
              Mepco Schlenk Engineering College (Autonomous)
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>
              Sivakasi, Tamilnadu, India - 626005
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)', marginTop: '0.15rem', lineHeight: '1.2' }}>
              Mepco School of Management Studies
            </span>
          </div>
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
          <button 
            onClick={toggleTheme} 
            className="btn" 
            style={{ 
              padding: '0.5rem', 
              background: 'rgba(255, 255, 255, 0.05)', 
              color: 'var(--text)',
              border: '1px solid var(--surface-border)',
              borderRadius: '8px'
            }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '600' }}>{user.username}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {user.role} {user.sub_role ? `(${user.sub_role})` : ''} {user.section ? `- Sec ${user.section}` : ''}{user.year ? ` - ${user.year}` : ''}
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
