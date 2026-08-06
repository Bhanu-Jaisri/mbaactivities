import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

const FormCreation = () => {
  const [eventName, setEventName] = useState('');
  const [org1, setOrg1] = useState('');
  const [org2, setOrg2] = useState('');
  const [org3, setOrg3] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTimeHour, setStartTimeHour] = useState('10');
  const [startTimeMinute, setStartTimeMinute] = useState('00');
  const [startTimeAmpm, setStartTimeAmpm] = useState('AM');

  const [endTimeHour, setEndTimeHour] = useState('11');
  const [endTimeMinute, setEndTimeMinute] = useState('30');
  const [endTimeAmpm, setEndTimeAmpm] = useState('AM');
  
  // Organizer Filter States
  const [org1Year, setOrg1Year] = useState('');
  const [org1Section, setOrg1Section] = useState('');
  const [org2Year, setOrg2Year] = useState('');
  const [org2Section, setOrg2Section] = useState('');
  const [org3Year, setOrg3Year] = useState('');
  const [org3Section, setOrg3Section] = useState('');

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

  const getFilteredStudents = (selectedYear, selectedSection) => {
    return users.filter(u => {
      if (u.role !== 'Student') return false;
      if (selectedYear && u.year !== selectedYear) return false;
      if (selectedSection && u.section !== selectedSection) return false;
      return true;
    });
  };

  const filteredStudents1 = getFilteredStudents(org1Year, org1Section);
  const filteredStudents2 = getFilteredStudents(org2Year, org2Section);
  const filteredStudents3 = getFilteredStudents(org3Year, org3Section);

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

    const eventTime = `${startTimeHour}:${startTimeMinute} ${startTimeAmpm} - ${endTimeHour}:${endTimeMinute} ${endTimeAmpm}`;

    try {
      await api.post('/forms', {
        event_name: eventName,
        organizer_1: org1Id,
        organizer_2: org2Id || null,
        organizer_3: org3Id || null,
        event_date: eventDate,
        event_time: eventTime,
        created_date: new Date().toISOString().split('T')[0]
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
          <label>Event Date *</label>
          <input type="date" className="input" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
        </div>

        <div className="input-group">
          <label>Event Start Time *</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select className="select" style={{ flex: 1, padding: '0.5rem' }} value={startTimeHour} onChange={e => setStartTimeHour(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                <option key={h} value={h.toString().padStart(2, '0')}>{h.toString().padStart(2, '0')}</option>
              ))}
            </select>
            <select className="select" style={{ flex: 1, padding: '0.5rem' }} value={startTimeMinute} onChange={e => setStartTimeMinute(e.target.value)}>
              {Array.from({ length: 60 }, (_, i) => i).map(m => (
                <option key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</option>
              ))}
            </select>
            <select className="select" style={{ flex: 1, padding: '0.5rem' }} value={startTimeAmpm} onChange={e => setStartTimeAmpm(e.target.value)}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>

        <div className="input-group">
          <label>Event End Time *</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select className="select" style={{ flex: 1, padding: '0.5rem' }} value={endTimeHour} onChange={e => setEndTimeHour(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                <option key={h} value={h.toString().padStart(2, '0')}>{h.toString().padStart(2, '0')}</option>
              ))}
            </select>
            <select className="select" style={{ flex: 1, padding: '0.5rem' }} value={endTimeMinute} onChange={e => setEndTimeMinute(e.target.value)}>
              {Array.from({ length: 60 }, (_, i) => i).map(m => (
                <option key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</option>
              ))}
            </select>
            <select className="select" style={{ flex: 1, padding: '0.5rem' }} value={endTimeAmpm} onChange={e => setEndTimeAmpm(e.target.value)}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>


        <div className="input-group">
          <label>Organizer 1 *</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <select 
              className="select" 
              value={org1Year} 
              onChange={e => {
                setOrg1Year(e.target.value);
                setOrg1('');
              }}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              <option value="">All Years</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
            </select>
            <select 
              className="select" 
              value={org1Section} 
              onChange={e => {
                setOrg1Section(e.target.value);
                setOrg1('');
              }}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              <option value="">All Sections</option>
              <option value="A">Sec A</option>
              <option value="B">Sec B</option>
              <option value="C">Sec C</option>
              <option value="D">Sec D</option>
            </select>
          </div>
          <select 
            className="select" 
            value={org1} 
            onChange={e => setOrg1(e.target.value)} 
            required 
          >
            <option value="">Select Student</option>
            {filteredStudents1.map(u => (
              <option key={u.id} value={u.roll_number || u.username}>
                {u.username} ({u.roll_number || 'No Roll #'} - Sec {u.section || 'N/A'} - {u.year || 'N/A'})
              </option>
            ))}
          </select>
        </div>
        
        <div className="input-group">
          <label>Organizer 2 (Optional)</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <select 
              className="select" 
              value={org2Year} 
              onChange={e => {
                setOrg2Year(e.target.value);
                setOrg2('');
              }}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              <option value="">All Years</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
            </select>
            <select 
              className="select" 
              value={org2Section} 
              onChange={e => {
                setOrg2Section(e.target.value);
                setOrg2('');
              }}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              <option value="">All Sections</option>
              <option value="A">Sec A</option>
              <option value="B">Sec B</option>
              <option value="C">Sec C</option>
              <option value="D">Sec D</option>
            </select>
          </div>
          <select 
            className="select" 
            value={org2} 
            onChange={e => setOrg2(e.target.value)} 
          >
            <option value="">Select Student (Optional)</option>
            {filteredStudents2.map(u => (
              <option key={u.id} value={u.roll_number || u.username}>
                {u.username} ({u.roll_number || 'No Roll #'} - Sec {u.section || 'N/A'} - {u.year || 'N/A'})
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Organizer 3 (Optional)</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <select 
              className="select" 
              value={org3Year} 
              onChange={e => {
                setOrg3Year(e.target.value);
                setOrg3('');
              }}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              <option value="">All Years</option>
              <option value="1st Year">1st Year</option>
              <option value="2nd Year">2nd Year</option>
            </select>
            <select 
              className="select" 
              value={org3Section} 
              onChange={e => {
                setOrg3Section(e.target.value);
                setOrg3('');
              }}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              <option value="">All Sections</option>
              <option value="A">Sec A</option>
              <option value="B">Sec B</option>
              <option value="C">Sec C</option>
              <option value="D">Sec D</option>
            </select>
          </div>
          <select 
            className="select" 
            value={org3} 
            onChange={e => setOrg3(e.target.value)} 
          >
            <option value="">Select Student (Optional)</option>
            {filteredStudents3.map(u => (
              <option key={u.id} value={u.roll_number || u.username}>
                {u.username} ({u.roll_number || 'No Roll #'} - Sec {u.section || 'N/A'} - {u.year || 'N/A'})
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Submit Form</button>
      </form>
    </div>
  );
};

export default FormCreation;
