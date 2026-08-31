import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { CheckCircle, XCircle, Edit3, Users, Printer, Trash2, Search } from 'lucide-react';

const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr) return 'N/A';
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}-${m}-${y}`;
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const startTime = timeStr.split('-')[0].trim();
  const match = startTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

const sortFormsAscending = (formList) => {
  if (!Array.isArray(formList)) return [];
  return [...formList].sort((a, b) => {
    // 1. Compare Event Date ASC
    const dateA = a.event_date ? new Date(a.event_date).getTime() : 0;
    const dateB = b.event_date ? new Date(b.event_date).getTime() : 0;
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    // 2. Compare Event Time ASC
    const timeA = parseTimeToMinutes(a.event_time);
    const timeB = parseTimeToMinutes(b.event_time);
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    // 3. Compare Created Date ASC
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdA - createdB;
  });
};

const FormDetails = () => {
  const { user } = useAuth();
  const [forms, setForms] = useState([]);
  const [users, setUsers] = useState([]); // for executive to select participants
  const [expandedForms, setExpandedForms] = useState([]); // tracks which forms are expanded
  const [printingFormId, setPrintingFormId] = useState(null);

  // Batch Selection & Agenda State for Secretary Multi-Export
  const [selectedBatchFormIds, setSelectedBatchFormIds] = useState([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [agendaItems, setAgendaItems] = useState([]);
  const [editingRounds, setEditingRounds] = useState(null);
  const [roundsData, setRoundsData] = useState({ round_1: '', round_2: '', round_3: '' });
  const [viewingForm, setViewingForm] = useState(null);
  const [editingDateTime, setEditingDateTime] = useState(null);
  const [editEventDate, setEditEventDate] = useState('');
  const [editStartHour, setEditStartHour] = useState('10');
  const [editStartMinute, setEditStartMinute] = useState('00');
  const [editStartAmpm, setEditStartAmpm] = useState('AM');
  const [editEndHour, setEditEndHour] = useState('11');
  const [editEndMinute, setEditEndMinute] = useState('30');
  const [editEndAmpm, setEditEndAmpm] = useState('AM');

  const [editingParticipants, setEditingParticipants] = useState(null);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [participantInput, setParticipantInput] = useState('');
  const [partYear, setPartYear] = useState('');
  const [partSection, setPartSection] = useState('');
  const [partSearch, setPartSearch] = useState('');

  // Rejection/Resubmit State
  const [rejectingFormId, setRejectingFormId] = useState(null);
  const [rejectionQueries, setRejectionQueries] = useState('');

  const [singlePrintForm, setSinglePrintForm] = useState(null);

  const [activeTab, setActiveTab] = useState('active');
  const [filterDate, setFilterDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssociation, setFilterAssociation] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Pagination State
  const [activePage, setActivePage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page numbers on tab or filter change
  useEffect(() => {
    setActivePage(1);
    setCompletedPage(1);
  }, [activeTab, filterDate, searchTerm, filterAssociation, filterStatus]);

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

  const canEditParticipants = (form) => {
    if (!form || form.is_completed) return false;
    if (user.role !== 'Student') return false;

    const sub = (user.sub_role || '').toLowerCase();
    const isExecutive = sub.includes('exec');

    if (isExecutive && isAssociationAligned(form.created_by_sub_role, user.sub_role)) {
      return true;
    }
    return false;
  };

  const normalizeDateStr = (dateStr) => {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    if (str.includes('T')) return str.split('T')[0];
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          let p1 = parseInt(parts[0], 10);
          let p2 = parseInt(parts[1], 10);
          if (p1 > 12) {
            return `${parts[2]}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
          } else {
            return `${parts[2]}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
          }
        }
      }
    }
    return str;
  };

  const getConflictInfoForStudent = (studentId, date, currentFormId) => {
    if (!date || !studentId) return null;
    const targetDate = normalizeDateStr(date);
    if (!targetDate) return null;

    const currentForm = forms.find(f => f.id === currentFormId);
    if (currentForm) {
      const orgs = [currentForm.organizer_1, currentForm.organizer_2, currentForm.organizer_3].filter(Boolean);
      if (orgs.includes(studentId)) {
        return 'Organizer of this event';
      }
    }

    for (const f of forms) {
      if (f.is_completed) continue;
      if (f.id === currentFormId) continue;
      if (normalizeDateStr(f.event_date) === targetDate) {
        if (f.participants && f.participants.some(p => p.id === studentId)) {
          return `Participant in "${f.event_name}"`;
        }
      }
    }
    return null;
  };

  const canEditDateTime = (form) => {
    if (!form || form.is_completed) return false;
    if (user.role === 'Staff' || user.role === 'Admin') return true;
    if (user.role !== 'Student') return false;

    const sub = (user.sub_role || '').toLowerCase();
    const isExecOrSec = sub.includes('exec') || sub.includes('secret') || sub.includes('secert');
    if (!isExecOrSec) return false;

    const isOrg = [form.organizer_1, form.organizer_2, form.organizer_3].includes(user.id);
    const isCreatorSec = (sub.includes('secret') || sub.includes('secert')) && form.created_by === user.id;
    const isAligned = isAssociationAligned(form.created_by_sub_role, user.sub_role);

    if (isOrg || isCreatorSec || isAligned) return true;
    return false;
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
      const rangeParts = form.event_time.split(' - ');
      if (rangeParts.length === 2) {
        // Parse Start Time
        const sParts = rangeParts[0].trim().split(' ');
        if (sParts.length === 2) {
          const t = sParts[0].split(':');
          if (t.length === 2) {
            setEditStartHour(t[0]);
            setEditStartMinute(t[1]);
          }
          setEditStartAmpm(sParts[1]);
        }
        // Parse End Time
        const eParts = rangeParts[1].trim().split(' ');
        if (eParts.length === 2) {
          const t = eParts[0].split(':');
          if (t.length === 2) {
            setEditEndHour(t[0]);
            setEditEndMinute(t[1]);
          }
          setEditEndAmpm(eParts[1]);
        }
      } else {
        // Fallback single time
        const sParts = form.event_time.trim().split(' ');
        if (sParts.length === 2) {
          const t = sParts[0].split(':');
          if (t.length === 2) {
            setEditStartHour(t[0]);
            setEditStartMinute(t[1]);
          }
          setEditStartAmpm(sParts[1]);
          setEditEndAmpm(sParts[1]);
        }
        setEditEndHour('11');
        setEditEndMinute('30');
      }
    } else {
      setEditStartHour('10');
      setEditStartMinute('00');
      setEditStartAmpm('AM');
      setEditEndHour('11');
      setEditEndMinute('30');
      setEditEndAmpm('AM');
    }
  };

  const saveDateTime = async (formId) => {
    try {
      const eventTimeStr = `${editStartHour}:${editStartMinute} ${editStartAmpm} - ${editEndHour}:${editEndMinute} ${editEndAmpm}`;
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
    fetchAgenda();
    fetchUsers();
  }, [user]);

  useEffect(() => {
    if (showBatchModal) {
      fetchForms();
      fetchAgenda();
    }
  }, [showBatchModal]);

  const fetchForms = async () => {
    try {
      const res = await api.get('/forms');
      setForms(sortFormsAscending(res.data));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAgenda = async () => {
    try {
      const res = await api.get('/agenda');
      setAgendaItems(res.data);
    } catch (err) {
      console.error('Failed to fetch agenda:', err);
    }
  };

  const isSecretaryUser = user.role === 'Student' && ((user.sub_role || '').toLowerCase().includes('secret') || (user.sub_role || '').toLowerCase().includes('secert'));
  const canSelectMultipleForms = isSecretaryUser || user.role === 'Staff' || user.role === 'Admin';

  const isFormEligibleForBatch = (form) => {
    if (form.status !== 'Approved') return false;
    if (form.is_completed) return false;
    return isAssociationAligned(form.created_by_sub_role, user.sub_role);
  };

  const toggleBatchFormSelection = (formId) => {
    setSelectedBatchFormIds(prev =>
      prev.includes(formId) ? prev.filter(id => id !== formId) : [...prev, formId]
    );
  };

  const toggleSelectAllEligible = () => {
    const eligibleFormIds = filteredForms.filter(isFormEligibleForBatch).map(f => f.id);
    const allSelected = eligibleFormIds.length > 0 && eligibleFormIds.every(id => selectedBatchFormIds.includes(id));
    if (allSelected) {
      setSelectedBatchFormIds(prev => prev.filter(id => !eligibleFormIds.includes(id)));
    } else {
      setSelectedBatchFormIds(prev => Array.from(new Set([...prev, ...eligibleFormIds])));
    }
  };

  const getAgendaCategoriesForExport = (selectedFormsList) => {
    let assocType = 'NORMAL';

    // 1. Check selected forms' creator association first
    if (selectedFormsList && selectedFormsList.length > 0 && selectedFormsList[0].created_by_sub_role) {
      const creatorSub = selectedFormsList[0].created_by_sub_role.toUpperCase();
      if (creatorSub.includes('NISM')) assocType = 'NISM';
      else if (creatorSub.includes('NIPM') || creatorSub.includes('SIPM')) assocType = 'NIPM';
      else if (creatorSub.includes('AD CLUB')) assocType = 'AD_CLUB';
    }

    // 2. Fallback to user sub_role if selected form doesn't specify
    if (assocType === 'NORMAL') {
      const sub = (user.sub_role || '').toUpperCase();
      if (sub.includes('NISM')) assocType = 'NISM';
      else if (sub.includes('NIPM') || sub.includes('SIPM')) assocType = 'NIPM';
      else if (sub.includes('AD CLUB')) assocType = 'AD_CLUB';
    }

    let facultyCat = 'Faculty Advisor';
    let secretaryCat = 'Secretaries';
    let execCat = 'Executive Council';

    let facultyLabel = 'Faculty Advisor';
    let secretaryLabel = 'Secretary';
    let execLabel = 'Executive Council';

    if (assocType === 'NISM') {
      facultyCat = 'NISM Faculty Advisor';
      secretaryCat = 'NISM Secretary';
      execCat = 'NISM Executive Council';
      facultyLabel = 'NISM Faculty Advisor';
      secretaryLabel = 'NISM Secretary';
      execLabel = 'NISM Executive Council';
    } else if (assocType === 'NIPM') {
      facultyCat = 'NIPM Faculty Advisor';
      secretaryCat = 'NIPM Secretary';
      execCat = 'NIPM Executive Council';
      facultyLabel = 'NIPM Faculty Advisor';
      secretaryLabel = 'NIPM Secretary';
      execLabel = 'NIPM Executive Council';
    } else if (assocType === 'AD_CLUB') {
      facultyCat = 'Ad Club Faculty Advisor';
      secretaryCat = 'Ad Club Secretary';
      execCat = 'Ad Club Executive Council';
      facultyLabel = 'Ad Club Faculty Advisor';
      secretaryLabel = 'Ad Club Secretary';
      execLabel = 'Ad Club Executive Council';
    }

    const findCat = (catName) => {
      const target = catName.trim().toLowerCase();
      return agendaItems.filter(i => (i.category || '').trim().toLowerCase() === target);
    };

    let patrons = findCat('Patron');
    if (patrons.length === 0) patrons = findCat('Patrons');

    let presidents = findCat('President');
    if (presidents.length === 0) presidents = findCat('Presidents');

    let faculty = findCat(facultyCat);
    if (faculty.length === 0 && facultyCat !== 'Faculty Advisor') {
      faculty = findCat('Faculty Advisor');
    }

    let secretaries = findCat(secretaryCat);
    if (secretaries.length === 0 && secretaryCat !== 'Secretaries') {
      secretaries = findCat('Secretaries');
    }
    if (secretaries.length === 0) {
      secretaries = findCat('Secretary');
    }

    let execs = findCat(execCat);
    if (execs.length === 0 && execCat !== 'Executive Council') {
      execs = findCat('Executive Council');
    }

    return {
      assocType,
      categories: [
        { title: 'Patron', items: patrons },
        { title: 'President', items: presidents },
        { title: facultyLabel, items: faculty },
        { title: secretaryLabel, items: secretaries },
        { title: execLabel, items: execs }
      ]
    };
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
      alert('File uploaded successfully');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploadingFormId(null);
    }
  };

  const startEditingParticipants = (form) => {
    if (users.length === 0) {
      fetchUsers();
    }
    setEditingParticipants(form.id);
    setSelectedParticipants(form.participants ? form.participants.map(p => p.id.toString()) : []);
    setPartYear('');
    setPartSection('');
    setPartSearch('');
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
    const targetUser = users.find(u => u.roll_number === participantInput || u.username === participantInput);
    if (!targetUser) {
      alert('Participant not found. Please check the roll number.');
      return;
    }
    const conflict = currentViewingForm ? getConflictInfoForStudent(targetUser.id, currentViewingForm.event_date, currentViewingForm.id) : null;
    if (conflict) {
      alert(`Cannot add ${targetUser.username}: ${conflict} on ${currentViewingForm?.event_date ? new Date(currentViewingForm.event_date).toLocaleDateString() : 'this date'}.`);
      return;
    }
    const idStr = targetUser.id.toString();
    if (selectedParticipants.includes(idStr)) {
      alert(`${targetUser.username} is already added as a participant.`);
      return;
    }
    setSelectedParticipants([...selectedParticipants, idStr]);
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
    if (!form || !user || !user.id) return false;
    const orgs = [form.organizer_1, form.organizer_2, form.organizer_3].filter(Boolean).map(String);
    return orgs.includes(user.id.toString());
  };

  const canEditPpt = (form) => {
    if (!form || form.is_completed) return false;
    return isOrganizer(form);
  };

  const shouldShowPpt = (form) => {
    if (!form) return false;
    if (user.role === 'Admin' || user.role === 'Staff') return true;
    if (isOrganizer(form)) return true;
    const sub = (user.sub_role || '').toLowerCase();
    const isSecOrExec = sub.includes('secret') || sub.includes('secert') || sub.includes('exec');
    if (!isSecOrExec) return false;
    return isAssociationAligned(form.created_by_sub_role, user.sub_role);
  };

  const isFormComplete = (form) => {
    if (!form || !form.event_name || !form.organizer_1 || !form.round_1_details) {
      return false;
    }
    const hasParticipants = form.participants && form.participants.length > 0;
    if (hasParticipants) {
      return Boolean(form.ppt_filename && form.ppt_filename.trim() !== '');
    }
    return true;
  };

  const toggleExpand = (formId) => {
    setExpandedForms(prev => prev.includes(formId) ? prev.filter(id => id !== formId) : [...prev, formId]);
  };

  const handlePrint = (formOrId) => {
    const targetForm = typeof formOrId === 'object' ? formOrId : forms.find(f => f.id === formOrId);
    if (targetForm) {
      setSinglePrintForm(targetForm);
    }
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

  const filteredForms = sortFormsAscending(
    forms.filter(form => {
      // 1. Tab check
      const matchesTab = activeTab === 'completed' ? form.is_completed : !form.is_completed;
      if (!matchesTab) return false;

      // Restrict access to completed forms to Staff/Admin only
      if (activeTab === 'completed' && user.role !== 'Staff' && user.role !== 'Admin') {
        return false;
      }

      // 2. Date check (Filter by Event Date)
      if (filterDate) {
        const formEvtDate = form.event_date ? normalizeDateStr(form.event_date) : normalizeDateStr(form.created_at);
        const selectedDate = normalizeDateStr(filterDate);
        if (formEvtDate !== selectedDate) return false;
      }

      // 3. Association Dropdown Filter
      if (filterAssociation) {
        const assocLabel = getAssociationLabel(form.created_by_sub_role);
        if (assocLabel !== filterAssociation) return false;
      }

      // 4. Status Dropdown Filter
      if (filterStatus) {
        if (form.status !== filterStatus) return false;
      }

      // 5. Search Term check (Event Name & Participant Roll #)
      if (searchTerm && searchTerm.trim() !== '') {
        const query = searchTerm.trim().toLowerCase();

        // Match Event Name
        const nameMatch = (form.event_name || '').toLowerCase().includes(query);

        // Match Participants' Roll Number & Name
        const participantMatch = (form.participants || []).some(p => 
          (p.roll_number || '').toLowerCase().includes(query) ||
          (p.username || '').toLowerCase().includes(query)
        );

        if (!nameMatch && !participantMatch) {
          return false;
        }
      }

      return true;
    })
  );

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

        {/* Search & Filter Dropdowns Bar */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Text Search Box (Event Name, Participant Roll #) */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.6rem', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              placeholder="Search Event Name or Participant Roll #..."
              style={{ padding: '0.35rem 0.6rem 0.35rem 2.2rem', fontSize: '0.85rem', background: 'var(--input-bg)', minWidth: '260px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Association Dropdown Filter */}
          <select
            className="select"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', background: 'var(--input-bg)', cursor: 'pointer' }}
            value={filterAssociation}
            onChange={(e) => setFilterAssociation(e.target.value)}
          >
            <option value="">All Associations</option>
            <option value="General">General</option>
            <option value="NISM">NISM</option>
            <option value="NIPM">NIPM</option>
            <option value="Ad Club">AD Club</option>
          </select>

          {/* Status Dropdown Filter */}
          <select
            className="select"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', background: 'var(--input-bg)', cursor: 'pointer' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Date Filter Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date:</span>
            <input
              type="date"
              className="input"
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', background: 'var(--input-bg)' }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>

          {(filterDate || searchTerm || filterAssociation || filterStatus) && (
            <button
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: 'var(--danger)', color: '#F87171' }}
              onClick={() => { setFilterDate(''); setSearchTerm(''); setFilterAssociation(''); setFilterStatus(''); }}
            >
              Clear All
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

          {/* Secretary Batch Multi-Form Toolbar */}
          {canSelectMultipleForms && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
              padding: '0.75rem 1.25rem',
              background: 'rgba(79, 70, 229, 0.1)',
              borderRadius: '10px',
              border: '1px solid rgba(79, 70, 229, 0.25)',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Printer size={18} style={{ color: 'var(--primary-hover)' }} />
                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text)' }}>
                  Selected Forms for Export: <span style={{ color: 'var(--primary-hover)', fontWeight: 'bold', fontSize: '1.05rem' }}>{selectedBatchFormIds.length}</span>
                </span>
                {selectedBatchFormIds.length > 0 && (
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderColor: 'var(--surface-border)' }}
                    onClick={() => setSelectedBatchFormIds([])}
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  className="btn btn-primary"
                  disabled={selectedBatchFormIds.length === 0}
                  onClick={() => {
                    fetchAgenda();
                    setShowBatchModal(true);
                  }}
                  style={{
                    opacity: selectedBatchFormIds.length === 0 ? 0.5 : 1,
                    cursor: selectedBatchFormIds.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem'
                  }}
                  title={selectedBatchFormIds.length === 0 ? "Select at least 1 approved form to print/download PDF" : "Print or Save PDF for selected forms"}
                >
                  <Printer size={16} /> Print / Export PDF ({selectedBatchFormIds.length})
                </button>
              </div>
            </div>
          )}

          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--surface-border)' }}>
                  {canSelectMultipleForms && (
                    <th style={{ padding: '1rem', width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        checked={filteredForms.filter(isFormEligibleForBatch).length > 0 && filteredForms.filter(isFormEligibleForBatch).every(f => selectedBatchFormIds.includes(f.id))}
                        onChange={toggleSelectAllEligible}
                        title="Select / Deselect all eligible approved forms"
                      />
                    </th>
                  )}
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
                {paginatedActiveForms.map(form => {
                  const isEligible = isFormEligibleForBatch(form);
                  return (
                    <tr key={form.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      {canSelectMultipleForms && (
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            style={{ cursor: isEligible ? 'pointer' : 'not-allowed', width: '16px', height: '16px' }}
                            disabled={!isEligible}
                            checked={selectedBatchFormIds.includes(form.id)}
                            onChange={() => toggleBatchFormSelection(form.id)}
                            title={isEligible
                              ? "Select form for batch print/export"
                              : form.status !== 'Approved'
                                ? "Form must be approved before exporting"
                                : form.is_completed
                                  ? "Completed form cannot be re-exported in active agenda batch"
                                  : "Form belongs to a different association"}
                          />
                        </td>
                      )}
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 500 }}>
                          {formatDateDDMMYYYY(form.event_date)}
                        </div>
                        {form.event_time && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--primary-hover)', marginTop: '0.25rem', fontWeight: 500 }}>
                            ⏰ {form.event_time}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{form.event_name}</td>
                      <td style={{ padding: '1rem' }}>
                        <span className="association-badge" style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
                          {getAssociationLabel(form.created_by_sub_role)}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
                          <div><strong>{form.org1_name}</strong></div>
                          {form.org2_name && <div><strong>{form.org2_name}</strong></div>}
                          {form.org3_name && <div><strong>{form.org3_name}</strong></div>}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', minWidth: '220px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                            {form.participants && form.participants.length > 0 ? (
                              <>
                                {form.participants.slice(0, 3).map(p => (
                                  <span
                                    key={p.id}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '12px',
                                      fontSize: '0.78rem',
                                      fontWeight: 500,
                                      background: 'rgba(79, 70, 229, 0.12)',
                                      color: 'var(--text)',
                                      border: '1px solid rgba(79, 70, 229, 0.25)',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {p.username}
                                  </span>
                                ))}
                                {form.participants.length > 3 && (
                                  <span
                                    style={{
                                      padding: '0.2rem 0.5rem',
                                      borderRadius: '12px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      background: 'rgba(6, 182, 212, 0.15)',
                                      color: 'var(--cyan)',
                                      border: '1px solid rgba(6, 182, 212, 0.3)'
                                    }}
                                    title={form.participants.map(p => p.username).join(', ')}
                                  >
                                    +{form.participants.length - 3} more
                                  </span>
                                )}
                              </>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                No participants
                              </span>
                            )}
                          </div>
                          {canEditParticipants(form) && (
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--primary)',
                                padding: '0.25rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
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
                  );
                })}
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
                    <div><strong>Created Date:</strong> {formatDateDDMMYYYY(form.created_date || form.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><strong>Event Date:</strong> {formatDateDDMMYYYY(form.event_date)}</div>
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
                        <td style={{ border: '1px solid black', padding: '0.5rem', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{form.round_1_details || 'N/A'}</td>
                        <td style={{ border: '1px solid black', padding: '0.5rem', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{form.round_2_details || 'N/A'}</td>
                        <td style={{ border: '1px solid black', padding: '0.5rem', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{form.round_3_details || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {form.ppt_original_name && (
                  <div style={{ fontSize: '14pt', color: 'black', marginBottom: '2rem' }}>
                    <strong>Attachment File:</strong> {form.ppt_original_name}
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
          backgroundColor: 'var(--modal-overlay, rgba(15, 23, 42, 0.75))',
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
            background: 'var(--modal-bg, #ffffff)',
            color: 'var(--text)',
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
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Event Start Time *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      className="select"
                      value={editStartHour}
                      onChange={e => setEditStartHour(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'var(--text)', borderRadius: '4px' }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                        <option key={h} value={h.toString().padStart(2, '0')}>{h.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <select
                      className="select"
                      value={editStartMinute}
                      onChange={e => setEditStartMinute(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'var(--text)', borderRadius: '4px' }}
                    >
                      {Array.from({ length: 60 }, (_, i) => i).map(m => (
                        <option key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <select
                      className="select"
                      value={editStartAmpm}
                      onChange={e => setEditStartAmpm(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'var(--text)', borderRadius: '4px' }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Event End Time *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      className="select"
                      value={editEndHour}
                      onChange={e => setEditEndHour(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'var(--text)', borderRadius: '4px' }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                        <option key={h} value={h.toString().padStart(2, '0')}>{h.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <select
                      className="select"
                      value={editEndMinute}
                      onChange={e => setEditEndMinute(e.target.value)}
                      style={{ flex: 1, padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--surface-border)', color: 'var(--text)', borderRadius: '4px' }}
                    >
                      {Array.from({ length: 60 }, (_, i) => i).map(m => (
                        <option key={m} value={m.toString().padStart(2, '0')}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <select
                      className="select"
                      value={editEndAmpm}
                      onChange={e => setEditEndAmpm(e.target.value)}
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
                <p style={{ margin: '0.25rem 0' }}><strong>Created Date:</strong> {formatDateDDMMYYYY(currentViewingForm.created_date || currentViewingForm.created_at)}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Event Date:</strong> {formatDateDDMMYYYY(currentViewingForm.event_date)}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Event Time:</strong> {currentViewingForm.event_time || 'N/A'}</p>
                <p style={{ margin: '0.25rem 0' }}><strong>Status:</strong> <span className={`badge badge-${currentViewingForm.status}`}>{currentViewingForm.status}</span></p>
                {canEditDateTime(currentViewingForm) && (
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
                    <h4 style={{ margin: 0, fontSize: '1.05rem' }}><Users size={16} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} /> Participants</h4>
                    {canEditParticipants(currentViewingForm) && editingParticipants !== currentViewingForm.id && (
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => startEditingParticipants(currentViewingForm)}>
                        <Edit3 size={14} /> Edit
                      </button>
                    )}
                  </div>

                  {editingParticipants === currentViewingForm.id ? (
                    <div style={{
                      marginTop: '0.75rem',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--surface-border)',
                      padding: '1.25rem',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                    }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Filter & Add Student Participant
                      </h5>

                      {/* Filter controls */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Year</label>
                          <select
                            className="select"
                            value={partYear}
                            onChange={e => {
                              setPartYear(e.target.value);
                              setParticipantInput('');
                            }}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                          >
                            <option value="">All Years</option>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Section</label>
                          <select
                            className="select"
                            value={partSection}
                            onChange={e => {
                              setPartSection(e.target.value);
                              setParticipantInput('');
                            }}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                          >
                            <option value="">All Sections</option>
                            <option value="A">Sec A</option>
                            <option value="B">Sec B</option>
                            <option value="C">Sec C</option>
                            <option value="D">Sec D</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Search Student</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Name, Roll #, or Sub-Role..."
                            value={partSearch}
                            onChange={e => setPartSearch(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>

                      {/* Selection Row */}
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Select Student</label>
                          <select
                            className="select"
                            value={participantInput}
                            onChange={(e) => setParticipantInput(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                          >
                            <option value="">-- Choose Student --</option>
                            {users
                              .filter(u => {
                                if (partYear && u.year !== partYear) return false;
                                if (partSection && u.section !== partSection) return false;
                                if (partSearch.trim()) {
                                  const q = partSearch.toLowerCase().trim();
                                  const nameMatch = (u.username || '').toLowerCase().includes(q);
                                  const rollMatch = (u.roll_number || '').toLowerCase().includes(q);
                                  const subMatch = (u.sub_role || '').toLowerCase().includes(q);
                                  if (!nameMatch && !rollMatch && !subMatch) return false;
                                }
                                return true;
                              })
                              .sort((a, b) => (a.username || '').localeCompare(b.username || ''))
                              .map(u => {
                                const isAlreadyAdded = selectedParticipants.includes(u.id.toString());
                                const conflict = getConflictInfoForStudent(u.id, currentViewingForm?.event_date, currentViewingForm?.id);
                                const isDisabled = isAlreadyAdded || Boolean(conflict);

                                let statusText = '';
                                if (isAlreadyAdded) {
                                  statusText = ' - (Already Added)';
                                } else if (conflict) {
                                  statusText = ` - (${conflict})`;
                                }

                                return (
                                  <option key={u.id} value={u.roll_number || u.username} disabled={isDisabled}>
                                    {u.username} ({u.roll_number || 'No Roll #'} | Sec {u.section || 'N/A'} - {u.year || 'N/A'}{u.sub_role ? ` | ${u.sub_role}` : ''}){statusText}
                                  </option>
                                );
                              })
                            }
                          </select>
                        </div>
                        <button
                          className="btn btn-primary"
                          onClick={addParticipantByRoll}
                          style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', height: '38px', whiteSpace: 'nowrap' }}
                        >
                          + Add
                        </button>
                      </div>

                      {/* Added Participants Container */}
                      <div style={{
                        border: '1px solid var(--surface-border)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        background: 'var(--surface)',
                        marginBottom: '1.25rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                            Selected Participants ({selectedParticipants.length})
                          </span>
                        </div>

                        <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
                          {selectedParticipants.map(idStr => {
                            const u = users.find(user => user.id.toString() === idStr);
                            return u ? (
                              <div
                                key={idStr}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: 'rgba(79, 70, 229, 0.08)',
                                  border: '1px solid rgba(79, 70, 229, 0.2)',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: '6px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{u.username}</strong>
                                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    ({u.roll_number || 'No Roll #'} • Sec {u.section || 'N/A'} • {u.year || 'N/A'})
                                  </span>
                                </div>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', height: 'auto' }}
                                  onClick={() => toggleParticipant(u.id)}
                                >
                                  Remove
                                </button>
                              </div>
                            ) : null;
                          })}
                          {selectedParticipants.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                              No participants selected. Choose a student above and click "+ Add".
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Buttons */}
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={() => { setEditingParticipants(null); setParticipantInput(''); setPartYear(''); setPartSection(''); }}>
                          Cancel
                        </button>
                        <button className="btn btn-primary" onClick={() => saveParticipants(currentViewingForm.id)}>
                          Save Participants
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.5rem' }}>
                      {currentViewingForm.participants && currentViewingForm.participants.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {currentViewingForm.participants.map(p => (
                            <div
                              key={p.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '20px',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                background: 'rgba(79, 70, 229, 0.12)',
                                color: 'var(--text)',
                                border: '1px solid rgba(79, 70, 229, 0.25)'
                              }}
                            >
                              <span>👤</span>
                              <span>{p.username}</span>
                              {p.roll_number && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  ({p.roll_number})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                          No participants assigned
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Rounds Section */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem' }}>Rounds Details</h4>
                    {isOrganizer(currentViewingForm) && editingRounds !== currentViewingForm.id && !currentViewingForm.is_completed && (
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => startEditingRounds(currentViewingForm)}>
                        <Edit3 size={14} /> {(!currentViewingForm.round_1_details && !currentViewingForm.round_2_details && !currentViewingForm.round_3_details) ? 'Add Rounds' : 'Edit Rounds'}
                      </button>
                    )}
                  </div>

                  {editingRounds === currentViewingForm.id ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <textarea className="textarea" placeholder="Round 1 Details (Press Enter for line 1, line 2, etc.)" rows={3} value={roundsData.round_1} onChange={e => setRoundsData({ ...roundsData, round_1: e.target.value })} style={{ width: '100%', marginBottom: '0.5rem', minHeight: '75px', padding: '0.5rem' }} />
                      <textarea className="textarea" placeholder="Round 2 Details (Press Enter for line 1, line 2, etc.)" rows={3} value={roundsData.round_2} onChange={e => setRoundsData({ ...roundsData, round_2: e.target.value })} style={{ width: '100%', marginBottom: '0.5rem', minHeight: '75px', padding: '0.5rem' }} />
                      <textarea className="textarea" placeholder="Round 3 Details (Press Enter for line 1, line 2, etc.)" rows={3} value={roundsData.round_3} onChange={e => setRoundsData({ ...roundsData, round_3: e.target.value })} style={{ width: '100%', marginBottom: '0.5rem', minHeight: '75px', padding: '0.5rem' }} />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-primary" onClick={() => saveRounds(currentViewingForm.id)}>Save</button>
                        <button className="btn btn-secondary" onClick={() => setEditingRounds(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.9rem', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '8px' }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Round 1:</strong>
                        <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.25rem' }}>{currentViewingForm.round_1_details || 'N/A'}</div>
                      </div>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Round 2:</strong>
                        <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.25rem' }}>{currentViewingForm.round_2_details || 'N/A'}</div>
                      </div>
                      <div>
                        <strong>Round 3:</strong>
                        <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.25rem' }}>{currentViewingForm.round_3_details || 'N/A'}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* File Attachment Section */}
                {shouldShowPpt(currentViewingForm) && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem' }}>Event Attachment (PPT, PDF, ZIP, Image, etc.)</h4>
                    {currentViewingForm.ppt_filename ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.85rem', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          📄 {currentViewingForm.ppt_original_name || currentViewingForm.ppt_filename}
                        </span>
                        <a
                          href={getPptUrl(currentViewingForm.ppt_filename)}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={currentViewingForm.ppt_original_name || 'attachment'}
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-block' }}
                        >
                          Download
                        </a>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>No file uploaded yet.</p>
                    )}

                    {canEditPpt(currentViewingForm) && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <input
                          type="file"
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
                              ? 'Change File'
                              : 'Upload File'}
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* Approval Actions */}
                {user.role === 'Student' && (((user.sub_role || '').toLowerCase().includes('secret') || (user.sub_role || '').toLowerCase().includes('secert') || (user.sub_role || '').toLowerCase().includes('exec'))) && isAssociationAligned(currentViewingForm.created_by_sub_role, user.sub_role) && currentViewingForm.status === 'Pending' && (
                  (!isFormComplete(currentViewingForm) || editingParticipants === currentViewingForm.id) ? (
                    <div style={{ marginTop: '1rem', background: 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.85rem', color: '#F59E0B' }}>
                      ⚠ Basic event details (Event Name, Round 1 details, and PPT if participants exist) must be completed before you can Approve or Reject.
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
                  {currentViewingForm.participants && currentViewingForm.participants.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {currentViewingForm.participants.map(p => (
                        <div
                          key={p.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            background: 'rgba(79, 70, 229, 0.12)',
                            color: 'var(--text)',
                            border: '1px solid rgba(79, 70, 229, 0.25)'
                          }}
                        >
                          <span>👤</span>
                          <span>{p.username}</span>
                          {p.roll_number && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ({p.roll_number})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                      No participants assigned
                    </p>
                  )}
                </div>

                <div style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Rounds Details</h4>
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Round 1:</strong>
                      <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.25rem' }}>{currentViewingForm.round_1_details || 'N/A'}</div>
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Round 2:</strong>
                      <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.25rem' }}>{currentViewingForm.round_2_details || 'N/A'}</div>
                    </div>
                    <div>
                      <strong>Round 3:</strong>
                      <div style={{ whiteSpace: 'pre-wrap', marginTop: '0.25rem' }}>{currentViewingForm.round_3_details || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {shouldShowPpt(currentViewingForm) && currentViewingForm.ppt_filename && (
                  <div style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Event Attachment (PPT, PDF, ZIP, Image, etc.)</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px' }}>
                      <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        📄 {currentViewingForm.ppt_original_name || currentViewingForm.ppt_filename}
                      </span>
                      <a
                        href={getPptUrl(currentViewingForm.ppt_filename)}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={currentViewingForm.ppt_original_name || 'attachment'}
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

      {/* Batch Export Modal / Print Preview */}
      {showBatchModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--modal-overlay, rgba(15, 23, 42, 0.75))',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '1050px',
            maxHeight: '92vh',
            overflowY: 'auto',
            background: 'var(--modal-bg, #ffffff)',
            color: 'var(--text)',
            borderRadius: '16px',
            border: '1px solid var(--surface-border)'
          }}>
            {/* Header / Actions */}
            <div className="hide-on-print" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              borderBottom: '1px solid var(--surface-border)',
              paddingBottom: '1rem'
            }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Printer size={20} style={{ color: 'var(--primary)' }} />
                  Batch Agenda & Events Export ({selectedBatchFormIds.length} Form{selectedBatchFormIds.length > 1 ? 's' : ''})
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Left side: Agenda office bearers | Right side: Selected event timings & organizer details.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Printer size={18} /> Print / Save as PDF
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowBatchModal(false)}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Preview Area */}
            {(() => {
              const selectedFormsList = sortFormsAscending(forms.filter(f => selectedBatchFormIds.includes(f.id)));
              const { assocType, categories } = getAgendaCategoriesForExport(selectedFormsList);

              return (
                <div className="batch-print-wrapper" style={{
                  background: 'white',
                  color: 'black',
                  padding: '2.5rem',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}>
                  {/* College & Department Branding Header */}
                  <div style={{ textAlign: 'center', borderBottom: '2.5px solid black', paddingBottom: '1.25rem', marginBottom: '1.75rem' }}>
                    <h1 style={{ fontSize: '20pt', fontWeight: 'bold', color: 'black', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Mepco Schlenk Engineering College (Autonomous)
                    </h1>
                    <h2 style={{ fontSize: '13pt', fontWeight: '600', color: '#1e293b', margin: '0.35rem 0' }}>
                      Sivakasi, Tamilnadu, India - 626005 | Mepco School of Management Studies
                    </h2>
                    <h3 style={{ fontSize: '14pt', fontWeight: 'bold', color: '#1e40af', margin: '0.65rem 0 0 0', textDecoration: 'underline' }}>
                      {assocType === 'NISM'
                        ? 'NISM ASSOCIATION ACTIVITIES'
                        : assocType === 'NIPM'
                          ? 'NIPM ASSOCIATION ACTIVITIES'
                          : assocType === 'AD_CLUB'
                            ? 'AD CLUB ASSOCIATION ACTIVITIES'
                            : 'ASSOCIATION ACTIVITIES'}
                    </h3>
                  </div>

                  {/* Two-Column Split Layout */}
                  <div style={{ display: 'grid', gridTemplateColumns: '18% 80%', gap: '2%', alignItems: 'start' }}>

                    {/* LEFT COLUMN: Agenda Office Bearers (Minimized Left Space/Width) */}
                    <div style={{ borderRight: '1.5px solid #cbd5e1', paddingRight: '0.5rem' }}>
                      {categories.map(catGroup => (
                        <div key={catGroup.title} style={{ marginBottom: '0.4rem' }}>
                          <div style={{
                            fontWeight: 'bold',
                            fontSize: '7.5pt',
                            color: '#1e40af',
                            borderBottom: '1px dashed #cbd5e1',
                            paddingBottom: '0.1rem',
                            marginBottom: '0.2rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.2px'
                          }}>
                            {catGroup.title}
                          </div>
                          {catGroup.items.length === 0 ? (
                            <div style={{ fontSize: '7pt', color: '#64748b', fontStyle: 'italic' }}>
                              No member assigned
                            </div>
                          ) : (
                            catGroup.items.map(item => (
                              <div key={item.id} style={{ marginBottom: '0.15rem' }}>
                                <div style={{ fontSize: '7.5pt', fontWeight: '600', color: 'black', lineHeight: '1.2' }}>
                                  {item.name}
                                </div>
                                {item.designation && (
                                  <div style={{ fontSize: '7pt', color: '#475569', lineHeight: '1.1' }}>
                                    {item.designation}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      ))}
                    </div>

                    {/* RIGHT COLUMN: Selected Events Table */}
                    <div>
                      <div style={{
                        fontSize: '11pt',
                        fontWeight: 'bold',
                        color: 'black',
                        borderBottom: '1.5px solid black',
                        paddingBottom: '0.4rem',
                        marginBottom: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>Event Activities</span>
                        <span style={{ fontSize: '9.5pt', fontWeight: 'bold', color: 'black' }}>
                          Date: {formatDateDDMMYYYY(selectedFormsList[0]?.event_date)}
                        </span>
                      </div>

                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '9pt',
                        color: 'black',
                        border: '1px solid black'
                      }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid black' }}>
                            <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'center', width: '35px' }}>S.No</th>
                            <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'left' }}>Event Name</th>
                            <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'left', whiteSpace: 'nowrap' }}>Timing</th>
                            <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'left' }}>Organiser</th>
                            <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'left', whiteSpace: 'nowrap' }}>Roll Number</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedFormsList.map((form, idx) => (
                            <tr key={form.id} style={{ pageBreakInside: 'avoid', borderBottom: '1px solid black' }}>
                              <td style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'center', fontWeight: 'bold' }}>
                                {idx + 1}
                              </td>
                              <td style={{ padding: '0.5rem', border: '1px solid black', fontWeight: 'bold', color: 'black' }}>
                                {form.event_name}
                              </td>
                              <td style={{ padding: '0.5rem', border: '1px solid black', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                {form.event_time || 'N/A'}
                              </td>
                              <td style={{ padding: '0.5rem', border: '1px solid black' }}>
                                {(() => {
                                  const orgs = [
                                    { name: form.org1_name, roll: form.org1_roll },
                                    { name: form.org2_name, roll: form.org2_roll },
                                    { name: form.org3_name, roll: form.org3_roll },
                                  ].filter(o => Boolean(o.name));

                                  if (orgs.length === 0) return <span style={{ color: '#64748b', fontStyle: 'italic' }}>N/A</span>;

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      {orgs.map((org, i) => (
                                        <div key={i} style={{
                                          fontSize: '8.5pt',
                                          color: 'black',
                                          lineHeight: '1.4',
                                          marginBottom: i < orgs.length - 1 ? '0.3rem' : 0,
                                          paddingBottom: i < orgs.length - 1 ? '0.3rem' : 0,
                                          borderBottom: i < orgs.length - 1 ? '1px dashed #e2e8f0' : 'none'
                                        }}>
                                          {org.name || 'N/A'}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: '0.5rem', border: '1px solid black' }}>
                                {(() => {
                                  const orgs = [
                                    { name: form.org1_name, roll: form.org1_roll },
                                    { name: form.org2_name, roll: form.org2_roll },
                                    { name: form.org3_name, roll: form.org3_roll },
                                  ].filter(o => Boolean(o.name));

                                  if (orgs.length === 0) return <span style={{ color: '#64748b', fontStyle: 'italic' }}>N/A</span>;

                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                      {orgs.map((org, i) => (
                                        <div key={i} style={{
                                          fontSize: '8.5pt',
                                          color: 'black',
                                          lineHeight: '1.4',
                                          whiteSpace: 'nowrap',
                                          marginBottom: i < orgs.length - 1 ? '0.3rem' : 0,
                                          paddingBottom: i < orgs.length - 1 ? '0.3rem' : 0,
                                          borderBottom: i < orgs.length - 1 ? '1px dashed #e2e8f0' : 'none'
                                        }}>
                                          {org.roll || 'N/A'}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                  </div>

                  {/* Signatures Footer Block */}
                  <div style={{
                    marginTop: '3.5rem',
                    paddingTop: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    pageBreakInside: 'avoid'
                  }}>
                    <div style={{ textAlign: 'center', width: '28%' }}>
                      <div style={{ borderBottom: '1.5px solid black', height: '35px', marginBottom: '0.5rem' }}></div>
                      <div style={{ fontSize: '9.5pt', fontWeight: 'bold', color: 'black' }}>
                        {assocType === 'NISM'
                          ? 'NISM Secretary'
                          : assocType === 'NIPM'
                            ? 'NIPM Secretary'
                            : assocType === 'AD_CLUB'
                              ? 'Ad Club Secretary'
                              : 'Student Secretary'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', width: '28%' }}>
                      <div style={{ borderBottom: '1.5px solid black', height: '35px', marginBottom: '0.5rem' }}></div>
                      <div style={{ fontSize: '9.5pt', fontWeight: 'bold', color: 'black' }}>
                        {assocType === 'NISM'
                          ? 'NISM Faculty Advisor'
                          : assocType === 'NIPM'
                            ? 'NIPM Faculty Advisor'
                            : assocType === 'AD_CLUB'
                              ? 'Ad Club Faculty Advisor'
                              : 'Faculty Advisor'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', width: '28%' }}>
                      <div style={{ borderBottom: '1.5px solid black', height: '35px', marginBottom: '0.5rem' }}></div>
                      <div style={{ fontSize: '9.5pt', fontWeight: 'bold', color: 'black' }}>
                        President / Principal
                      </div>
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal for Single Event Print */}
      {singlePrintForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--modal-overlay, rgba(15, 23, 42, 0.75))',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '950px',
            maxHeight: '92vh',
            overflowY: 'auto',
            background: 'var(--modal-bg, #ffffff)',
            color: 'var(--text)',
            borderRadius: '16px',
            border: '1px solid var(--surface-border)'
          }}>
            {/* Header / Actions (hidden on print) */}
            <div className="hide-on-print" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              borderBottom: '1px solid var(--surface-border)',
              paddingBottom: '1rem'
            }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Printer size={20} style={{ color: 'var(--primary)' }} />
                  Print Event Details: {singlePrintForm.event_name}
                </h3>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Printer size={18} /> Print / Save as PDF
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSinglePrintForm(null)}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Content for Single Event */}
            <div className="batch-print-wrapper" style={{
              background: 'white',
              color: 'black',
              padding: '2.5rem',
              borderRadius: '12px'
            }}>
              {/* College Header */}
              <div style={{ textAlign: 'center', borderBottom: '2.5px solid black', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '18pt', fontWeight: 'bold', color: 'black', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Mepco Schlenk Engineering College (Autonomous)
                </h1>
                <h2 style={{ fontSize: '11pt', fontWeight: '600', color: '#1e293b', margin: '0.35rem 0' }}>
                  Sivakasi, Tamilnadu, India - 626005 | Mepco School of Management Studies
                </h2>
                <h3 style={{ fontSize: '13pt', fontWeight: 'bold', color: '#1e40af', margin: '0.5rem 0 0 0', textDecoration: 'underline' }}>
                  EVENT REPORT
                </h3>
              </div>

              {/* Event Basic Info */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', border: '1px solid black', fontSize: '9.5pt', color: 'black' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid black' }}>
                    <td style={{ padding: '0.5rem', width: '20%', fontWeight: 'bold', background: '#f1f5f9', borderRight: '1px solid black' }}>Event Name</td>
                    <td style={{ padding: '0.5rem', width: '80%', fontWeight: 'bold' }}>{singlePrintForm.event_name}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid black' }}>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold', background: '#f1f5f9', borderRight: '1px solid black' }}>Event Date & Time</td>
                    <td style={{ padding: '0.5rem' }}>
                      {formatDateDDMMYYYY(singlePrintForm.event_date)} {singlePrintForm.event_time ? ` (${singlePrintForm.event_time})` : ''}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold', background: '#f1f5f9', borderRight: '1px solid black', verticalAlign: 'top' }}>Event Organizers</td>
                    <td style={{ padding: '0.5rem' }}>
                      {(() => {
                        const orgs = [
                          { name: singlePrintForm.org1_name, roll: singlePrintForm.org1_roll, year: singlePrintForm.org1_year, sec: singlePrintForm.org1_section },
                          { name: singlePrintForm.org2_name, roll: singlePrintForm.org2_roll, year: singlePrintForm.org2_year, sec: singlePrintForm.org2_section },
                          { name: singlePrintForm.org3_name, roll: singlePrintForm.org3_roll, year: singlePrintForm.org3_year, sec: singlePrintForm.org3_section }
                        ].filter(o => Boolean(o.name));

                        if (orgs.length === 0) return 'N/A';

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {orgs.map((org, i) => (
                              <div key={i}>
                                <strong>{i + 1}. {org.name}</strong> {org.roll ? `(Roll No: ${org.roll})` : ''} - {org.year || '1st Year'}, Sec {org.sec || 'A'}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Rounds Table */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '11pt', fontWeight: 'bold', color: 'black', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Rounds Details
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', color: 'black', border: '1px solid black' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid black' }}>
                      <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'left', width: '33.33%' }}>Round 1</th>
                      <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'left', width: '33.33%' }}>Round 2</th>
                      <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'left', width: '33.33%' }}>Round 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.5rem', border: '1px solid black', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{singlePrintForm.round_1_details || 'N/A'}</td>
                      <td style={{ padding: '0.5rem', border: '1px solid black', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{singlePrintForm.round_2_details || 'N/A'}</td>
                      <td style={{ padding: '0.5rem', border: '1px solid black', verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{singlePrintForm.round_3_details || 'N/A'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Participants Table (Only rendered if form has participants) */}
              {singlePrintForm.participants && singlePrintForm.participants.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '11pt', fontWeight: 'bold', color: 'black', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    Participants ({singlePrintForm.participants.length})
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', color: 'black', border: '1px solid black' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid black' }}>
                        <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'center', width: '40px' }}>S.No</th>
                        <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'left' }}>Participant Name</th>
                        <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'left', width: '140px' }}>Roll Number</th>
                        <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'center', width: '90px' }}>Year</th>
                        <th style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'center', width: '80px' }}>Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {singlePrintForm.participants.map((p, index) => (
                        <tr key={p.id || index} style={{ borderBottom: '1px solid black' }}>
                          <td style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'center' }}>{index + 1}</td>
                          <td style={{ padding: '0.5rem', border: '1px solid black', fontWeight: '500' }}>{p.username || p.name || 'N/A'}</td>
                          <td style={{ padding: '0.5rem', border: '1px solid black' }}>{p.roll_number || p.roll_no || 'N/A'}</td>
                          <td style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'center' }}>{p.year || '1st Year'}</td>
                          <td style={{ padding: '0.5rem', border: '1px solid black', textAlign: 'center' }}>{p.section || 'A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}



            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormDetails;
