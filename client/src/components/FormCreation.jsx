import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const FormCreation = () => {
  const [eventName, setEventName] = useState('');
  const [org1, setOrg1] = useState('');
  const [org2, setOrg2] = useState('');
  const [org3, setOrg3] = useState('');
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Need to fetch users to select organizers
    const fetchUsers = async () => {
      try {
        const res = await api.get('/users');
        setUsers(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const findUserId = (identifier) => {
      if (!identifier) return null;
      const user = users.find(u => u.roll_number === identifier || u.username === identifier);
      return user ? user.id : null;
    };

    const org1Id = findUserId(org1);
    const org2Id = findUserId(org2);
    const org3Id = findUserId(org3);

    if (!org1Id) return alert('Organizer 1 not found. Please check the roll number.');
    if (org2 && !org2Id) return alert('Organizer 2 not found. Please check the roll number.');
    if (org3 && !org3Id) return alert('Organizer 3 not found. Please check the roll number.');

    try {
      await api.post('/forms', {
        event_name: eventName,
        organizer_1: org1Id,
        organizer_2: org2Id || null,
        organizer_3: org3Id || null
      });
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create form');
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2>Create New Event Form</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Event Name *</label>
          <input type="text" className="input" value={eventName} onChange={e => setEventName(e.target.value)} required />
        </div>
        
        <div className="input-group">
          <label>Organizer 1 Roll Number *</label>
          <input type="text" className="input" value={org1} onChange={e => setOrg1(e.target.value)} required placeholder="Enter roll number" />
        </div>

        <div className="input-group">
          <label>Organizer 2 Roll Number (Optional)</label>
          <input type="text" className="input" value={org2} onChange={e => setOrg2(e.target.value)} placeholder="Enter roll number" />
        </div>

        <div className="input-group">
          <label>Organizer 3 Roll Number (Optional)</label>
          <input type="text" className="input" value={org3} onChange={e => setOrg3(e.target.value)} placeholder="Enter roll number" />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Submit Form</button>
      </form>
    </div>
  );
};

export default FormCreation;
