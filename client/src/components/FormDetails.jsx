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
  const [viewingForm, setViewingForm] = useState(null);
  const [editingDateTime, setEditingDateTime] = useState(null);
  const [editEventDate, setEditEventDate] = useState('');
  const [editTimeHour, setEditTimeHour] = useState('10');
  const [editTimeMinute, setEditTimeMinute] = useState('00');
  const [editTimeAmpm, setEditTimeAmpm] = useState('AM');
  
  const [editingParticipants, setEditingParticipants] = useState(null);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [participantInput, setParticipantInput] = useState('');
  const [partYear, setPartYear] = useState('');
  const [partSection, setPartSection] = useState('');

  // Rejection/Resubmit State
  const [rejectingFormId, setRejectingFormId] = useState(null);
  const [rejectionQueries, setRejectionQueries] = useState('');

  const [activeTab, setActiveTab] = useState('active');
  const [filterDate, setFilterDate] = useState('');

  // Pagination State
  const [activePage, setActivePage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page numbers on tab or filter change
  useEffect(() => {
    setActivePage(1);
    setCompletedPage(1);
  }, [activeTab, filterDate]);

  const renderPagination = (currentPage, setCurrentPage, totalCount) => {
    const limit = parseInt(pageSize, 10) || 10;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    
    // Safety check: if currentPage exceeds totalPages, clamp it
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
    
    const startItem = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const endItem = Math.min(currentPage * limit, totalCount);

    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: '1.5rem', 
        flexWrap: 'wrap', 
        gap: '1rem',
        borderTop: '1px solid var(--surface-border)',
        paddingTop: '1.25rem'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing <span style={{ color: 'var(--text)', fontWeight: 600 }}>{startItem}</span> to <span style={{ color: 'var(--text)', fontWeight: 600 }}>{endItem}</span> of <span style={{ color: 'var(--text)', fontWeight: 600 }}>{totalCount}</span> forms
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Custom Page Size Input Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>Show</span>
            <input 
              type="number" 
              className="input" 
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setPageSize('');
                } else {
                  const parsed = parseInt(val, 10);
                  if (parsed > 0) {
                    setPageSize(parsed);
                    setActivePage(1);
                    setCompletedPage(1);
                  }
                }
              }}
              onBlur={() => {
                if (!pageSize || pageSize < 1) {
                  setPageSize(10);
                }
              }}
              style={{ 
                width: '60px', 
                padding: '0.25rem 0.5rem', 
                textAlign: 'center', 
                fontSize: '0.85rem',
                background: 'var(--input-bg)',
                borderRadius: '6px'
              }}
              min="1"
            />
            <span>per page</span>
          </div>

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              Previous
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
              if (totalPages > 5 && Math.abs(pageNum - currentPage) > 1 && pageNum !== 1 && pageNum !== totalPages) {
                if (pageNum === 2 || pageNum === totalPages - 1) {
                  return <span key={pageNum} style={{ color: 'var(--text-muted)', padding: '0 0.25rem', fontSize: '0.85rem' }}>...</span>;
                }
                return null;
              }
              return (
                <button
                  key={pageNum}
                  className={`btn ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ 
                    padding: '0.35rem 0.75rem', 
                    fontSize: '0.8rem',
                    minWidth: '32px'
                  }}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}

            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  const currentViewingForm = viewingForm ? (forms.find(f => f.id === viewingForm.id) || viewingForm) : null;

  const getAssociationLabel = (creatorSubRole) => {
    if (!creatorSubRole) return 'General';
    const sub = creatorSubRole.toUpperCase();
    if (sub.includes('NISM')) return 'NISM';
    if (sub.includes('NIPM') || sub.includes('SIPM')) return 'NIPM';
    if (sub.includes('AD CLUB')) return 'Ad Club';
    return 'General';
  };

  const isAssociationAligned = (creatorSubRole, userSubRole) => {
    if (user.role !== 'Student') return true;
    
    const creator = (creatorSubRole || 'Regular').toUpperCase();
    const usr = (userSubRole || 'Regular').toUpperCase();
    
    const isNismCreator = creator.includes('NISM');
    const isNipmCreator = creator.includes('NIPM') || creator.includes('SIPM');
    const isAdCreator = creator.includes('AD CLUB');
    const isNormalCreator = !isNismCreator && !isNipmCreator && !isAdCreator;

    const isNismUser = usr.includes('NISM');
    const isNipmUser = usr.includes('NIPM') || usr.includes('SIPM');
    const isAdUser = usr.includes('AD CLUB');
    const isNormalUser = !isNismUser && !isNipmUser && !isAdUser;

    if (isNismCreator && isNismUser) return true;
    if (isNipmCreator && isNipmUser) return true;
    if (isAdCreator && isAdUser) return true;
    if (isNormalCreator && isNormalUser) return true;

    return false;
  };

  const canCompleteForm = (form) => {
    if (form.status !== 'Approved') return false;
    const userSubRole = (user.sub_role || '').toLowerCase();
    const isSecOrExec = userSubRole.includes('secret') || userSubRole.includes('secert') || userSubRole.includes('exec');
    return user.role === 'Student' && isSecOrExec && isAssociationAligned(form.created_by_sub_role, user.sub_role);
  };


  const handleCompleteChange = async (formId, isCompleted) => {
    const actionText = isCompleted ? 'mark this event as completed' : 'reopen this event';
    if (!window.confirm(`Are you sure you want to ${actionText}?`)) return;
    try {
      await api.put(`/forms/${formId}/complete`, { is_completed: isCompleted });
      fetchForms();
      alert(`Event successfully ${isCompleted ? 'marked as completed' : 'reopened'}!`);
    } catch (err) {
      alert(err.response?.data?.error || `Failed to ${isCompleted ? 'complete' : 'reopen'} event`);
    }
  };

  const startEditingDateTime = (form) => {
    setEditingDateTime(form.id);
    setEditEventDate(form.event_date || '');
    if (form.event_time) {
      const parts = form.event_time.split(' ');
      if (parts.length === 2) {
        const timeParts = parts[0].split(':');
        if (timeParts.length === 2) {
          setEditTimeHour(timeParts[0]);
          setEditTimeMinute(timeParts[1]);
        }
        setEditTimeAmpm(parts[1]);
      } else {
        setEditTimeHour('10');
        setEditTimeMinute('00');
        setEditTimeAmpm('AM');
      }
    } else {
      setEditTimeHour('10');
      setEditTimeMinute('00');
      setEditTimeAmpm('AM');
    }
  };

  const saveDateTime = async (formId) => {
    try {
      const eventTimeStr = `${editTimeHour}:${editTimeMinute} ${editTimeAmpm}`;
      await api.put(`/forms/${formId}/datetime`, {
        event_date: editEventDate,
        event_time: eventTimeStr
      });
      setEditingDateTime(null);
      fetchForms();
      alert('Event date and time successfully updated!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update date/time');
    }
  };

  useEffect(() => {
    fetchForms();
    const sub = (user.sub_role || '').toLowerCase();
    if (sub.includes('exec')) {
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
    setPartYear('');
    setPartSection('');
    setParticipantInput('');
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
      alert(err.response?.data?.error || 'Failed to update participants');
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
    setTimeout(() => {
      window.print();
      setPrintingFormId(null);
    }, 150);
  };

  const canDeleteForm = (form) => {
    if (form.is_completed) {
      return user.role === 'Staff' || user.role === 'Admin';
    }
    if (form.status === 'Approved') return false;
    if (user.role === 'Admin') return true;
    const sub = (user.sub_role || '').toLowerCase();
    if (user.role === 'Student' && (sub.includes('secret') || sub.includes('secert')) && form.created_by === user.id) return true;
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

  const filteredForms = forms.filter(form => {
    // 1. Tab check
    const matchesTab = activeTab === 'completed' ? form.is_completed : !form.is_completed;
    if (!matchesTab) return false;

    // Restrict access to completed forms to Staff/Admin only
    if (activeTab === 'completed' && user.role !== 'Staff' && user.role !== 'Admin') {
      return false;
    }

    // 2. Date check
    if (filterDate) {
      const formDate = new Date(form.created_at);
      const selectedDate = new Date(filterDate);
      const isSameDay = 
        formDate.getFullYear() === selectedDate.getFullYear() &&
        formDate.getMonth() === selectedDate.getMonth() &&
        formDate.getDate() === selectedDate.getDate();
      if (!isSameDay) return false;
    }

    return true;
  });

  const limit = parseInt(pageSize, 10) || 10;
  
  // Slice for completed forms page
  const completedStartIndex = (completedPage - 1) * limit;
  const paginatedCompletedForms = filteredForms.slice(completedStartIndex, completedStartIndex + limit);

  // Slice for active forms page
  const activeStartIndex = (activePage - 1) * limit;
  const paginatedActiveForms = filteredForms.slice(activeStartIndex, activeStartIndex + limit);

  return (
    <div>
      {/* Tabs and Date Filters */}
      <div className="hide-on-print" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        gap: '1rem', 
        marginBottom: '1.5rem', 
        borderBottom: '1px solid var(--surface-border)', 
        paddingBottom: '0.75rem' 
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => setActiveTab('active')} 
            className={`btn ${activeTab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
          >
            Active Forms
          </button>
          {(user.role === 'Staff' || user.role === 'Admin') && (
            <button 
              onClick={() => setActiveTab('completed')} 
              className={`btn ${activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
            >
              Completed Folder
            </button>
          )}
        </div>

        {/* Date Filter Input */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filter by Date:</span>
            <input 
              type="date" 
              className="input" 
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', background: 'var(--input-bg)' }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          {filterDate && (
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'var(--danger)', color: '#F87171' }}
              onClick={() => setFilterDate('')}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {activeTab === 'completed' ? (
        <div className="glass-panel hide-on-print" style={{ padding: '1.5rem', marginTop: '1rem' }}>
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600' }}>Event Name</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600' }}>Created By</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600' }}>Association</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600' }}>Approved By</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600' }}>Approved Status</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600' }}>Completed Status</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCompletedForms.map(form => (
                  <tr key={form.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{form.event_name}</td>
                    <td style={{ padding: '1rem' }}>{form.created_by_name}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className="association-badge" style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
                        {getAssociationLabel(form.created_by_sub_role)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>{form.approved_by_name || 'N/A'}</td>
                    <td style={{ padding: '1rem' }}>{form.created_date ? new Date(form.created_date).toLocaleDateString() : new Date(form.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge badge-${form.status}`}>{form.status}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className="badge badge-Approved" style={{ background: 'rgba(52, 211, 153, 0.2)', color: '#34D399' }}>
                        Completed
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handlePrint(form.id)}>
                          Print
                        </button>
                        <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--secondary)' }} onClick={() => setViewingForm(form)}>
                          View
                        </button>
                        {canDeleteForm(form) && (
                          <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleDeleteForm(form.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredForms.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No completed events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {renderPagination(completedPage, setCompletedPage, filteredForms.length)}
        </div>
      ) : (
        <div className="glass-panel hide-on-print" style={{ padding: '1.5rem', marginTop: '1rem' }}>
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600', textAlign: 'left' }}>Event Date</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600', textAlign: 'left' }}>Event Name</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600', textAlign: 'left' }}>Association</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600', textAlign: 'left' }}>Organizers</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600', textAlign: 'left' }}>Participants</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600', textAlign: 'left' }}>Approved Status</th>
                  <th style={{ padding: '1rem', color: 'var(--heading-color)', fontWeight: '600', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedActiveForms.map(form => (
                  <tr key={form.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: '1rem' }}>{form.event_date ? new Date(form.event_date).toLocaleDateString() : 'N/A'}</td>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>{form.event_name}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className="association-badge" style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
                        {getAssociationLabel(form.created_by_sub_role)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {form.org1_name}
                      {form.org2_name ? `, ${form.org2_name}` : ''}
                      {form.org3_name ? `, ${form.org3_name}` : ''}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span>
                          {form.participants && form.participants.length > 0 
                            ? form.participants.map(p => p.username).join(', ') 
                            : 'No participants'}
                        </span>
                        {((user.sub_role || '').toLowerCase().includes('exec')) && isAssociationAligned(form.created_by_sub_role, user.sub_role) && !form.is_completed && (
                          <button 
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              cursor: 'pointer', 
                              color: 'var(--primary)',
                              padding: '0.25rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }} 
                            onClick={() => {
                              setViewingForm(form);
                              startEditingParticipants(form);
                            }}
                            title="Edit Participants"
                          >
                            <Edit3 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge badge-${form.status}`}>{form.status}</span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--secondary)' }} onClick={() => setViewingForm(form)}>
                          View
                        </button>
                        {form.status === 'Approved' && (
                          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handlePrint(form.id)}>
                            Print
                          </button>
                        )}
                        {canDeleteForm(form) && (
                          <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleDeleteForm(form.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredForms.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No active event forms found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {renderPagination(activePage, setActivePage, filteredForms.length)}
        </div>
      )}

      {/* Hidden Print Container for all forms */}
      <div className="print-only grid print-container">
        {forms.map(form => {
          const printClass = printingFormId === form.id ? 'print-target' : 'no-print';
          return (
            <div key={`print-${form.id}`} className={`card ${printClass}`}>
              <div className="print-only">
                <h1 style={{ textAlign: 'center', fontSize: '24pt', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'black', background: 'none', WebkitTextFillColor: 'black' }}>Mepco Schlenk Engineering College</h1>
                <h2 style={{ textAlign: 'center', fontSize: '18pt', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '3rem', color: 'black', background: 'none', WebkitTextFillColor: 'black' }}>MBA Students Activities</h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem', fontSize: '14pt', color: 'black' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><strong>Event Name:</strong> {form.event_name}</div>
                    <div><strong>Created Date:</strong> {form.created_date ? new Date(form.created_date).toLocaleDateString() : new Date(form.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><strong>Event Date:</strong> {form.event_date ? new Date(form.event_date).toLocaleDateString() : 'N/A'}</div>
                    <div><strong>Event Time:</strong> {form.event_time || 'N/A'}</div>
                  </div>
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
                      {form.participants && form.participants.map((p, index) => (
                        <tr key={p.id}>
                          <td style={{ border: '1px solid black', padding: '0.5rem' }}>{index + 1}</td>
                          <td style={{ border: '1px solid black', padding: '0.5rem' }}>{p.username}</td>
                        </tr>
                      ))}
                      {(!form.participants || form.participants.length === 0) && (
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
            </div>
          );
        })}
      </div>

      {/* Modal for viewing form details */}
      {currentViewingForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }} onClick={() => setViewingForm(null)}>
          <div className="glass-panel" style={{
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            border: '1px solid var(--surface-border)',
            boxShadow: 'var(--glass-shadow)',
          }} onClick={(e) => e.stopPropagation()}>
            <button 
              className="btn btn-secondary" 
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                padding: '0.25rem 0.6rem',
                fontSize: '0.85rem'
              }}
              onClick={() => setViewingForm(null)}
            >
              ✕ Close
            </button>

            <h2 style={{ paddingRight: '3rem', wordBreak: 'break-all' }}>{currentViewingForm.event_name}</h2>

            {editingDateTime === currentViewingForm.id ? (
              <div style={{ margin: '1rem 0', padding: '1rem', border: '1px solid var(--surface-border)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Event Date *</label>
                  <input 
                    type="date" 
                    className="input" 
                    value={editEventDate} 
                    onChange={e => setEditEventDate(e.target.value)} 
                    style={{ width: '100%', padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'var(--text)', borderRadius: '4px' }}
                    required 
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Event Time *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select 
                      className="select" 
                      value={editTimeHour} 
                      onChange={e => setEditTimeHour(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'var(--text)', borderRadius: '4px' }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                        <option key={h} value={h.toString().padStart(2, '0')}>{h.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <select 
                      className="select" 
                      value={editTimeMinute} 
                      onChange={e => setEditTimeMinute(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'var(--text)', borderRadius: '4px' }}
                    >
                      {Array.from({ length: 60 }, (_, i) => i).map(m => (
                        <option key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <select 
                      className="select" 
                      value={editTimeAmpm} 
                      onChange={e => setEditTimeAmpm(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'var(--text)', borderRadius: '4px' }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={() => saveDateTime(currentViewingForm.id)}>Save</button>
                  <button className="btn btn-secondary" onClick={() => setEditingDateTime(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.9rem', marginBottom: '1.25rem', color: 'var(--text-muted)' }}>
                <p style={{ margin: '0.25rem 0' }}><strong>Created By:</strong> {currentViewingForm.created_by_name}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Created Date:</strong> {currentViewingForm.created_date ? new Date(currentViewingForm.created_date).toLocaleDateString() : new Date(currentViewingForm.created_at).toLocaleDateString()}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Event Date:</strong> {currentViewingForm.event_date ? new Date(currentViewingForm.event_date).toLocaleDateString() : 'N/A'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Event Time:</strong> {currentViewingForm.event_time || 'N/A'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Status:</strong> <span className={`badge badge-${currentViewingForm.status}`}>{currentViewingForm.status}</span></p>
                {((user.role === 'Student' && ((user.sub_role || '').toLowerCase().includes('secret') || (user.sub_role || '').toLowerCase().includes('secert')) && currentViewingForm.created_by === user.id) ||
                  (user.role === 'Student' && ((user.sub_role || '').toLowerCase().includes('exec')) && isAssociationAligned(currentViewingForm.created_by_sub_role, user.sub_role)) ||
                  (user.role === 'Admin' || user.role === 'Staff')) && !currentViewingForm.is_completed && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', marginTop: '0.5rem' }} 
                    onClick={() => startEditingDateTime(currentViewingForm)}
                  >
                    Edit Date/Time
                  </button>
                )}
              </div>
            )}

            <hr style={{ borderColor: 'var(--surface-border)', margin: '1rem 0' }} />

            {!currentViewingForm.is_completed ? (
              <>
                <div style={{ fontSize: '0.9rem', marginBottom: '1.25rem', color: 'var(--text-muted)' }}>
                  <p><strong>Organizers:</strong> {currentViewingForm.org1_name} {currentViewingForm.org2_name ? `, ${currentViewingForm.org2_name}` : ''} {currentViewingForm.org3_name ? `, ${currentViewingForm.org3_name}` : ''}</p>
                  {currentViewingForm.status === 'Approved' && currentViewingForm.approved_by_name && (
                    <p style={{ color: '#34D399', fontWeight: 500 }}>
                      ✓ Approved by {currentViewingForm.approved_by_name} (Section {currentViewingForm.approved_by_section || 'N/A'})
                    </p>
                  )}
                  {currentViewingForm.status === 'Rejected' && currentViewingForm.approved_by_name && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', marginTop: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <p style={{ color: '#F87171', fontWeight: 500, margin: 0 }}>
                        ✗ Rejected by {currentViewingForm.approved_by_name} (Section {currentViewingForm.approved_by_section || 'N/A'})
                      </p>
                      {currentViewingForm.rejection_queries && (
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <strong>Queries:</strong> {currentViewingForm.rejection_queries}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <hr style={{ borderColor: 'var(--surface-border)', margin: '1rem 0' }} />

                {/* Participants Section */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem' }}><Users size={16} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }}/> Participants</h4>
                    {((user.sub_role || '').toLowerCase().includes('exec')) && isAssociationAligned(currentViewingForm.created_by_sub_role, user.sub_role) && editingParticipants !== currentViewingForm.id && (
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => startEditingParticipants(currentViewingForm)}>
                        <Edit3 size={14} /> Edit
                      </button>
                    )}
                  </div>
                  
                  {editingParticipants === currentViewingForm.id ? (
                    <div style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <select 
                          className="select" 
                          value={partYear} 
                          onChange={e => {
                            setPartYear(e.target.value);
                            setParticipantInput('');
                          }}
                          style={{ flex: 1, padding: '0.5rem' }}
                        >
                          <option value="">All Years</option>
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                        </select>
                        <select 
                          className="select" 
                          value={partSection} 
                          onChange={e => {
                            setPartSection(e.target.value);
                            setParticipantInput('');
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
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <select 
                          className="select" 
                          value={participantInput} 
                          onChange={(e) => setParticipantInput(e.target.value)}
                          style={{ flex: 1, padding: '0.5rem' }}
                        >
                          <option value="">Select Student</option>
                          {users
                            .filter(u => {
                              if (partYear && u.year !== partYear) return false;
                              if (partSection && u.section !== partSection) return false;
                              return true;
                            })
                            .map(u => (
                              <option key={u.id} value={u.roll_number || u.username}>
                                {u.username} ({u.roll_number || 'No Roll #'} - Sec {u.section || 'N/A'} - {u.year || 'N/A'})
                              </option>
                            ))
                          }
                        </select>
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
                        <button className="btn btn-primary" onClick={() => saveParticipants(currentViewingForm.id)}>Save</button>
                        <button className="btn btn-secondary" onClick={() => { setEditingParticipants(null); setParticipantInput(''); setPartYear(''); setPartSection(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.9rem' }}>
                      {currentViewingForm.participants.length > 0 
                        ? currentViewingForm.participants.map(p => p.username).join(', ') 
                        : 'No participants assigned'}
                    </p>
                  )}
                </div>

                {/* Rounds Section */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem' }}>Rounds Details</h4>
                    {isOrganizer(currentViewingForm) && editingRounds !== currentViewingForm.id && currentViewingForm.status !== 'Approved' && (
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => startEditingRounds(currentViewingForm)}>
                        <Edit3 size={14} /> Edit
                      </button>
                    )}
                  </div>

                  {editingRounds === currentViewingForm.id ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <textarea className="textarea" placeholder="Round 1 Details" value={roundsData.round_1} onChange={e => setRoundsData({...roundsData, round_1: e.target.value})} style={{ width: '100%', marginBottom: '0.5rem', minHeight: '60px' }} />
                      <textarea className="textarea" placeholder="Round 2 Details" value={roundsData.round_2} onChange={e => setRoundsData({...roundsData, round_2: e.target.value})} style={{ width: '100%', marginBottom: '0.5rem', minHeight: '60px' }} />
                      <textarea className="textarea" placeholder="Round 3 Details" value={roundsData.round_3} onChange={e => setRoundsData({...roundsData, round_3: e.target.value})} style={{ width: '100%', marginBottom: '0.5rem', minHeight: '60px' }} />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-primary" onClick={() => saveRounds(currentViewingForm.id)}>Save</button>
                        <button className="btn btn-secondary" onClick={() => setEditingRounds(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.9rem', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '8px' }}>
                      <p style={{ marginBottom: '0.25rem' }}><strong>Round 1:</strong> {currentViewingForm.round_1_details || 'N/A'}</p>
                      <p style={{ marginBottom: '0.25rem' }}><strong>Round 2:</strong> {currentViewingForm.round_2_details || 'N/A'}</p>
                      <p><strong>Round 3:</strong> {currentViewingForm.round_3_details || 'N/A'}</p>
                    </div>
                  )}
                </div>

                {/* Presentation (PPT) Section */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem' }}>Presentation (PPT)</h4>
                  {currentViewingForm.ppt_filename ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.85rem', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        📄 {currentViewingForm.ppt_original_name || currentViewingForm.ppt_filename}
                      </span>
                      <a
                        href={getPptUrl(currentViewingForm.ppt_filename)}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={currentViewingForm.ppt_original_name || 'presentation.pptx'}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-block' }}
                      >
                        Download
                      </a>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>No PPT uploaded yet.</p>
                  )}

                  {isOrganizer(currentViewingForm) && currentViewingForm.status !== 'Approved' && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <input
                        type="file"
                        accept=".ppt,.pptx"
                        style={{ display: 'none' }}
                        id={`modal-ppt-file-input-${currentViewingForm.id}`}
                        onChange={(e) => handlePptUpload(currentViewingForm.id, e.target.files[0])}
                        disabled={uploadingFormId === currentViewingForm.id}
                      />
                      <label
                        htmlFor={`modal-ppt-file-input-${currentViewingForm.id}`}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        {uploadingFormId === currentViewingForm.id 
                          ? 'Uploading...' 
                          : currentViewingForm.ppt_filename 
                            ? 'Change PPT' 
                            : 'Upload PPT'}
                      </label>
                    </div>
                  )}
                </div>

                {/* Approval Actions */}
                {user.role === 'Student' && (((user.sub_role || '').toLowerCase().includes('secret') || (user.sub_role || '').toLowerCase().includes('secert') || (user.sub_role || '').toLowerCase().includes('exec'))) && isAssociationAligned(currentViewingForm.created_by_sub_role, user.sub_role) && currentViewingForm.status === 'Pending' && (
                  (!isFormComplete(currentViewingForm) || editingParticipants === currentViewingForm.id) ? (
                    <div style={{ marginTop: '1rem', background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem', color: '#F59E0B' }}>
                      ⚠ All details (Event Name, Round 1 details, PPT file, and saved Participants) must be completed before you can Approve or Reject.
                    </div>
                  ) : rejectingFormId === currentViewingForm.id ? (
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
                        <button className="btn btn-danger" onClick={() => submitRejection(currentViewingForm.id)}>Submit Rejection</button>
                        <button className="btn btn-secondary" onClick={() => setRejectingFormId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button className="btn btn-primary" style={{ flex: 1, background: 'var(--secondary)' }} onClick={() => handleStatusChange(currentViewingForm.id, 'Approved')}>
                        <CheckCircle size={16} /> Approve
                      </button>
                      <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { setRejectingFormId(currentViewingForm.id); setRejectionQueries(''); }}>
                        <XCircle size={16} /> Reject
                      </button>
                    </div>
                  )
                )}

                {/* Organizer Resubmit Action */}
                {isOrganizer(currentViewingForm) && currentViewingForm.status === 'Rejected' && (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#60A5FA', fontWeight: 500 }}>
                      Form has rejection queries. Edit rounds or PPT above, then click below to resubmit.
                    </p>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', background: '#3B82F6' }}
                      onClick={() => handleResubmit(currentViewingForm.id)}
                    >
                      Resubmit Form
                    </button>
                  </div>
                )}

                {/* Completion Section for Approved Active Events */}
                {currentViewingForm.status === 'Approved' && !currentViewingForm.is_completed && canCompleteForm(currentViewingForm) && (
                  <div style={{ 
                    marginTop: '1.5rem', 
                    background: 'rgba(99, 102, 241, 0.1)', 
                    padding: '1rem', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    textAlign: 'center'
                  }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#818CF8', fontWeight: 500 }}>
                      Is this event completed?
                    </p>
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', background: 'var(--primary)' }}
                      onClick={() => handleCompleteChange(currentViewingForm.id, true)}
                    >
                      Mark as Completed
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.9rem', marginBottom: '1.25rem', color: 'var(--text-muted)' }}>
                  <p><strong>Organizers:</strong> {currentViewingForm.org1_name} {currentViewingForm.org2_name ? `, ${currentViewingForm.org2_name}` : ''} {currentViewingForm.org3_name ? `, ${currentViewingForm.org3_name}` : ''}</p>
                </div>

                <div style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Participants</h4>
                  <p style={{ wordBreak: 'break-word' }}>
                    {currentViewingForm.participants && currentViewingForm.participants.length > 0 
                      ? currentViewingForm.participants.map(p => p.username).join(', ') 
                      : 'No participants assigned'}
                  </p>
                </div>

                <div style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Rounds Details</h4>
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '8px' }}>
                    <p style={{ marginBottom: '0.25rem' }}><strong>Round 1:</strong> {currentViewingForm.round_1_details || 'N/A'}</p>
                    <p style={{ marginBottom: '0.25rem' }}><strong>Round 2:</strong> {currentViewingForm.round_2_details || 'N/A'}</p>
                    <p><strong>Round 3:</strong> {currentViewingForm.round_3_details || 'N/A'}</p>
                  </div>
                </div>

                {currentViewingForm.ppt_filename && (
                  <div style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Presentation (PPT)</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                      <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        📄 {currentViewingForm.ppt_original_name || currentViewingForm.ppt_filename}
                      </span>
                      <a
                        href={getPptUrl(currentViewingForm.ppt_filename)}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={currentViewingForm.ppt_original_name || 'presentation.pptx'}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', textDecoration: 'none' }}
                      >
                        Download
                      </a>
                    </div>
                  </div>
                )}

                {/* Reopen Action for authorized students (Secretary/Executive) */}
                {currentViewingForm.is_completed && canCompleteForm(currentViewingForm) && (
                  <div style={{ 
                    marginTop: '1.5rem', 
                    background: 'rgba(99, 102, 241, 0.1)', 
                    padding: '1rem', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    textAlign: 'center'
                  }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', background: 'var(--primary)' }}
                      onClick={async () => {
                        await handleCompleteChange(currentViewingForm.id, false);
                        setViewingForm(null);
                      }}
                    >
                      Reopen Event
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FormDetails;
