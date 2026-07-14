import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { CheckCircle, XCircle, Edit3, Users, Printer, Trash2 } from 'lucide-react';

const FormDetails = () => {
  const { user } = useAuth();
  const [forms, setForms] = useState([]);
  const [users, setUsers] = useState([]); // for executive to select participants
  const [expandedForms, setExpandedForms] = useState([]); // tracks which forms are expanded
  const [printingFormId, setPrintingFormId] = useState(null);
  
  // Edit State
  const [editingRounds, setEditingRounds] = useState(null);
  const [roundsData, setRoundsData] = useState({ round_1: '', round_2: '', round_3: '' });
  
  const [editingParticipants, setEditingParticipants] = useState(null);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [participantInput, setParticipantInput] = useState('');

  // Rejection/Resubmit State
  const [rejectingFormId, setRejectingFormId] = useState(null);
  const [rejectionQueries, setRejectionQueries] = useState('');

  useEffect(() => {
    fetchForms();
    if (user.sub_role === 'Executive') {
      fetchUsers();
    }
  }, [user]);

  const fetchForms = async () => {
    try {
      const res = await api.get('/forms');
      setForms(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      // Only get students
      setUsers(res.data.filter(u => u.role === 'Student'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (formId, status) => {
    try {
      await api.put(`/forms/${formId}/status`, { status });
      fetchForms();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const submitRejection = async (formId) => {
    if (!rejectionQueries.trim()) {
      alert('Please enter queries/reasons for rejection.');
      return;
    }
    try {
      await api.put(`/forms/${formId}/status`, { status: 'Rejected', queries: rejectionQueries });
      setRejectingFormId(null);
      setRejectionQueries('');
      fetchForms();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit rejection');
    }
  };

  const handleResubmit = async (formId) => {
    try {
      await api.put(`/forms/${formId}/resubmit`);
      fetchForms();
      alert('Form resubmitted successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to resubmit form');
    }
  };

  const startEditingRounds = (form) => {
    setEditingRounds(form.id);
    setRoundsData({
      round_1: form.round_1_details || '',
      round_2: form.round_2_details || '',
      round_3: form.round_3_details || ''
    });
  };

  const saveRounds = async (formId) => {
    try {
      await api.put(`/forms/${formId}/rounds`, {
        round_1_details: roundsData.round_1,
        round_2_details: roundsData.round_2,
        round_3_details: roundsData.round_3,
      });
      setEditingRounds(null);
      fetchForms();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update rounds');
    }
  };

  const getPptUrl = (filename) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const uploadBase = apiBase.replace(/\/api\/?$/, '/uploads');
    return `${uploadBase}/${filename}`;
  };

  const [uploadingFormId, setUploadingFormId] = useState(null);

  const handlePptUpload = async (formId, file) => {
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'ppt' && ext !== 'pptx') {
      alert('Only .ppt and .pptx files are allowed!');
      return;
    }

    const formData = new FormData();
    formData.append('ppt', file);

    setUploadingFormId(formId);
    try {
      await api.put(`/forms/${formId}/ppt`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      fetchForms();
      alert('PPT uploaded successfully');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload PPT');
    } finally {
      setUploadingFormId(null);
    }
  };

  const startEditingParticipants = (form) => {
    setEditingParticipants(form.id);
    setSelectedParticipants(form.participants.map(p => p.id.toString()));
  };

  const toggleParticipant = (userId) => {
    const idStr = userId.toString();
    setSelectedParticipants(prev => 
      prev.includes(idStr) ? prev.filter(id => id !== idStr) : [...prev, idStr]
    );
  };

  const addParticipantByRoll = () => {
    if (!participantInput) return;
    const user = users.find(u => u.roll_number === participantInput || u.username === participantInput);
    if (!user) {
      alert('Participant not found. Please check the roll number.');
      return;
    }
    const idStr = user.id.toString();
    if (!selectedParticipants.includes(idStr)) {
      setSelectedParticipants([...selectedParticipants, idStr]);
    }
    setParticipantInput('');
  };

  const saveParticipants = async (formId) => {
    try {
      await api.put(`/forms/${formId}/participants`, {
        student_ids: selectedParticipants.map(Number)
      });
      setEditingParticipants(null);
      fetchForms();
    } catch (err) {
      alert('Failed to update participants');
    }
  };

  const isParticipant = (form) => {
    return form.participants.some(p => p.id === user.id);
  };

  const isOrganizer = (form) => {
    return [form.organizer_1, form.organizer_2, form.organizer_3].includes(user.id);
  };

  const isFormComplete = (form) => {
    return (
      form.event_name && form.event_name.trim() !== '' &&
      form.organizer_1 &&
      form.ppt_filename && form.ppt_filename.trim() !== '' &&
      form.round_1_details && form.round_1_details.trim() !== '' &&
      form.participants && form.participants.length > 0
    );
  };

  const toggleExpand = (formId) => {
    setExpandedForms(prev => prev.includes(formId) ? prev.filter(id => id !== formId) : [...prev, formId]);
  };

  const handlePrint = (formId) => {
    setPrintingFormId(formId);
    // ensure the form is expanded before printing
    if (!expandedForms.includes(formId)) {
      setExpandedForms(prev => [...prev, formId]);
    }
    setTimeout(() => {
      window.print();
      setPrintingFormId(null);
    }, 100);
  };

  const canDeleteForm = (form) => {
    if (form.status === 'Approved') return false;
    if (user.role === 'Admin') return true;
    if (user.role === 'Student' && user.sub_role === 'Secretary' && form.created_by === user.id) return true;
    return false;
  };

  const handleDeleteForm = async (formId) => {
    if (!window.confirm('Are you sure you want to delete this event form? This action cannot be undone.')) return;
    try {
      await api.delete(`/forms/${formId}`);
      fetchForms();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete form');
    }
  };

  return (
    <div className="grid print-container">
      {forms.map(form => {
        const isExpanded = expandedForms.includes(form.id);
        const printClass = printingFormId ? (printingFormId === form.id ? 'print-target' : 'no-print') : '';
        return (
        <div key={form.id} className={`card ${printClass}`}>
          {/* Print Layout */}
          <div className="print-only">
            <h1 style={{ textAlign: 'center', fontSize: '24pt', textDecoration: 'underline', marginBottom: '3rem', color: 'black', background: 'none', WebkitTextFillColor: 'black' }}>MBA Students Activities</h1>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', fontSize: '14pt', color: 'black' }}>
              <div><strong>Event Name:</strong> {form.event_name}</div>
              <div><strong>Date:</strong> {new Date(form.created_at).toLocaleDateString()}</div>
            </div>

            <div style={{ marginBottom: '2rem', fontSize: '14pt', color: 'black' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div><strong>Organizer 1:</strong> {form.org1_name}</div>
                <div><strong>Organizer 2:</strong> {form.org2_name || 'N/A'}</div>
              </div>
              <div><strong>Organizer 3:</strong> {form.org3_name || 'N/A'}</div>
            </div>

            <div style={{ marginBottom: '2rem', fontSize: '14pt', color: 'black' }}>
              <strong>Decision Status:</strong> {form.status}
              {form.approved_by_name && ` (by ${form.approved_by_name}, Section ${form.approved_by_section || 'N/A'})`}
              {form.status === 'Rejected' && form.rejection_queries && ` - Queries: ${form.rejection_queries}`}
            </div>

            <div style={{ fontSize: '14pt', color: 'black', marginBottom: '2rem' }}>
              <strong>Participants:</strong>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', border: '1px solid black' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'left', width: '10%' }}>S.No</th>
                    <th style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'left', width: '90%' }}>Name</th>
                  </tr>
                </thead>
                <tbody>
                  {form.participants.map((p, index) => (
                    <tr key={p.id}>
                      <td style={{ border: '1px solid black', padding: '0.5rem' }}>{index + 1}</td>
                      <td style={{ border: '1px solid black', padding: '0.5rem' }}>{p.username}</td>
                    </tr>
                  ))}
                  {form.participants.length === 0 && (
                    <tr>
                      <td colSpan="2" style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'center' }}>No participants</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: '14pt', color: 'black', marginBottom: '2rem' }}>
              <strong>Rounds:</strong>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', border: '1px solid black' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'left', width: '33.33%' }}>Round 1</th>
                    <th style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'left', width: '33.33%' }}>Round 2</th>
                    <th style={{ border: '1px solid black', padding: '0.5rem', textAlign: 'left', width: '33.33%' }}>Round 3</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid black', padding: '0.5rem', verticalAlign: 'top' }}>{form.round_1_details || 'N/A'}</td>
                    <td style={{ border: '1px solid black', padding: '0.5rem', verticalAlign: 'top' }}>{form.round_2_details || 'N/A'}</td>
                    <td style={{ border: '1px solid black', padding: '0.5rem', verticalAlign: 'top' }}>{form.round_3_details || 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {form.ppt_original_name && (
              <div style={{ fontSize: '14pt', color: 'black', marginBottom: '2rem' }}>
                <strong>Presentation (PPT):</strong> {form.ppt_original_name}
              </div>
            )}

            </div>


          {/* Web Layout */}
          <div className="hide-on-print">
            <div className="card-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>{form.event_name}</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {form.status === 'Approved' && (
                <button className="btn btn-secondary hide-on-print" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', border: 'none' }} onClick={() => handlePrint(form.id)}>
                  <Printer size={16} /> Print
                </button>
              )}
              {canDeleteForm(form) && (
                <button className="btn btn-danger hide-on-print" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => handleDeleteForm(form.id)}>
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <span className={`badge badge-${form.status}`}>{form.status}</span>
            </div>
          </div>
          
          <div style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
            <p><strong>Created By:</strong> {form.created_by_name}</p>
            <p><strong>Date:</strong> {new Date(form.created_at).toLocaleDateString()}</p>
          </div>

          <button 
            className="btn btn-secondary hide-on-print" 
            style={{ width: '100%', marginBottom: isExpanded ? '1rem' : '0' }} 
            onClick={() => toggleExpand(form.id)}
          >
            {isExpanded ? 'Hide Details' : 'View Details'}
          </button>

          {isExpanded && (
            <>
              <div style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
                <p><strong>Organizers:</strong> {form.org1_name} {form.org2_name ? `, ${form.org2_name}` : ''} {form.org3_name ? `, ${form.org3_name}` : ''}</p>
                {form.status === 'Approved' && form.approved_by_name && (
                  <p style={{ color: '#34D399', fontWeight: 500 }}>
                    ✓ Approved by {form.approved_by_name} (Section {form.approved_by_section || 'N/A'})
                  </p>
                )}
                {form.status === 'Rejected' && form.approved_by_name && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', marginTop: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <p style={{ color: '#F87171', fontWeight: 500, margin: 0 }}>
                      ✗ Rejected by {form.approved_by_name} (Section {form.approved_by_section || 'N/A'})
                    </p>
                    {form.rejection_queries && (
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <strong>Queries:</strong> {form.rejection_queries}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <hr style={{ borderColor: 'var(--surface-border)', margin: '1rem 0' }} />

          {/* Participants Section */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1rem' }}><Users size={16} style={{ verticalAlign: 'middle' }}/> Participants</h4>
              {user.sub_role === 'Executive' && editingParticipants !== form.id && form.status !== 'Approved' && (
                <button className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => startEditingParticipants(form)}>
                  <Edit3 size={14} /> Edit
                </button>
              )}
            </div>
            
            {editingParticipants === form.id ? (
              <div style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Enter roll number" 
                    value={participantInput} 
                    onChange={(e) => setParticipantInput(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && addParticipantByRoll()}
                  />
                  <button className="btn btn-primary" onClick={addParticipantByRoll}>Add</button>
                </div>
                <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '1rem' }}>
                  {selectedParticipants.map(idStr => {
                    const u = users.find(user => user.id.toString() === idStr);
                    return u ? (
                      <div key={idStr} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                        <span>{u.username} ({u.roll_number || 'No Roll #'})</span>
                        <button className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => toggleParticipant(u.id)}>Remove</button>
                      </div>
                    ) : null;
                  })}
                  {selectedParticipants.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No participants added yet.</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={() => saveParticipants(form.id)}>Save</button>
                  <button className="btn btn-secondary" onClick={() => { setEditingParticipants(null); setParticipantInput(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem' }}>
                {form.participants.length > 0 
                  ? form.participants.map(p => p.username).join(', ') 
                  : 'No participants assigned'}
              </p>
            )}
          </div>

          {/* Rounds Section */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1rem' }}>Rounds</h4>
              {isOrganizer(form) && editingRounds !== form.id && form.status !== 'Approved' && (
                <button className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => startEditingRounds(form)}>
                  <Edit3 size={14} /> Edit
                </button>
              )}
            </div>

            {editingRounds === form.id ? (
              <div style={{ marginTop: '0.5rem' }}>
                <textarea className="textarea" placeholder="Round 1 Details" value={roundsData.round_1} onChange={e => setRoundsData({...roundsData, round_1: e.target.value})} style={{ width: '100%', marginBottom: '0.5rem', minHeight: '60px' }} />
                <textarea className="textarea" placeholder="Round 2 Details" value={roundsData.round_2} onChange={e => setRoundsData({...roundsData, round_2: e.target.value})} style={{ width: '100%', marginBottom: '0.5rem', minHeight: '60px' }} />
                <textarea className="textarea" placeholder="Round 3 Details" value={roundsData.round_3} onChange={e => setRoundsData({...roundsData, round_3: e.target.value})} style={{ width: '100%', marginBottom: '0.5rem', minHeight: '60px' }} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={() => saveRounds(form.id)}>Save</button>
                  <button className="btn btn-secondary" onClick={() => setEditingRounds(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', background: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '8px' }}>
                <p><strong>R1:</strong> {form.round_1_details || 'N/A'}</p>
                <p><strong>R2:</strong> {form.round_2_details || 'N/A'}</p>
                <p><strong>R3:</strong> {form.round_3_details || 'N/A'}</p>
              </div>
            )}
          </div>

          {/* Presentation (PPT) Section */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Presentation (PPT)</h4>
            {form.ppt_filename ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.85rem', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  📄 {form.ppt_original_name || form.ppt_filename}
                </span>
                <a
                  href={getPptUrl(form.ppt_filename)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={form.ppt_original_name || 'presentation.pptx'}
                  className="btn btn-secondary"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-block' }}
                >
                  Download
                </a>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>No PPT uploaded yet.</p>
            )}

            {isOrganizer(form) && form.status !== 'Approved' && (
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  type="file"
                  accept=".ppt,.pptx"
                  style={{ display: 'none' }}
                  id={`ppt-file-input-${form.id}`}
                  onChange={(e) => handlePptUpload(form.id, e.target.files[0])}
                  disabled={uploadingFormId === form.id}
                />
                <label
                  htmlFor={`ppt-file-input-${form.id}`}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  {uploadingFormId === form.id 
                    ? 'Uploading...' 
                    : form.ppt_filename 
                      ? 'Change PPT' 
                      : 'Upload PPT'}
                </label>
              </div>
            )}
          </div>

          {/* Approval Actions (Secretary/Executive Student only) */}
          {user.role === 'Student' && ['Secretary', 'Executive'].includes(user.sub_role) && form.status === 'Pending' && (
            (!isFormComplete(form) || editingParticipants === form.id) ? (
              <div style={{ marginTop: '1rem', background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem', color: '#F59E0B' }}>
                ⚠ All details (Event Name, Round 1 details, PPT file, and saved Participants) must be completed before you can Approve or Reject.
              </div>
            ) : rejectingFormId === form.id ? (
              <div style={{ marginTop: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Rejection Queries / Reasons</label>
                <textarea
                  className="textarea"
                  placeholder="Enter details of why this form is being rejected..."
                  value={rejectionQueries}
                  onChange={(e) => setRejectionQueries(e.target.value)}
                  style={{ width: '100%', marginBottom: '0.5rem', minHeight: '80px' }}
                  required
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-danger" onClick={() => submitRejection(form.id)}>Submit Rejection</button>
                  <button className="btn btn-secondary" onClick={() => setRejectingFormId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-primary" style={{ flex: 1, background: 'var(--secondary)' }} onClick={() => handleStatusChange(form.id, 'Approved')}>
                  <CheckCircle size={16} /> Approve
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { setRejectingFormId(form.id); setRejectionQueries(''); }}>
                  <XCircle size={16} /> Reject
                </button>
              </div>
            )
          )}

          {/* Organizer Resubmit Action */}
          {isOrganizer(form) && form.status === 'Rejected' && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#60A5FA', fontWeight: 500 }}>
                Form has rejection queries. Edit rounds or PPT above, then click below to resubmit.
              </p>
              <button
                className="btn btn-primary"
                style={{ width: '100%', background: '#3B82F6' }}
                onClick={() => handleResubmit(form.id)}
              >
                Resubmit Form
              </button>
            </div>
          )}
            </>
          )}
          </div>
        </div>
      )})}
      {forms.length === 0 && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)' }}>No event forms found.</p>}
    </div>
  );
};

export default FormDetails;
