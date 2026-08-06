import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';

const Agenda = () => {
  const { user } = useAuth();
  const [agendaItems, setAgendaItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [category, setCategory] = useState('Patron');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');

  // Bulk operation states
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEditingCategory, setBulkEditingCategory] = useState(null);
  const [bulkEditItems, setBulkEditItems] = useState([]);
  const [addMembers, setAddMembers] = useState([{ category: 'Patron', name: '', designation: '' }]);

  const isStaffOrAdmin = user && (user.role === 'Admin' || user.role === 'Staff');

  const categories = [
    'Patron',
    'President',
    'Faculty Advisor',
    'Secretaries',
    'Executive Council',
    'NISM Faculty Advisor',
    'NISM Secretary',
    'NISM Executive Council',
    'NIPM Faculty Advisor',
    'NIPM Secretary',
    'NIPM Executive Council',
    'Ad Club Faculty Advisor',
    'Ad Club Secretary',
    'Ad Club Executive Council'
  ];

  const fetchAgenda = async () => {
    try {
      setLoading(true);
      const res = await api.get('/agenda');
      setAgendaItems(res.data);
    } catch (err) {
      console.error('Failed to fetch agenda details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgenda();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    
    // Filter out rows without a name
    const validMembers = addMembers.filter(m => m.name.trim() !== '');
    if (validMembers.length === 0) {
      return alert('At least one member name is required');
    }

    try {
      const payload = validMembers.map(m => ({
        category: m.category,
        name: m.name.trim(),
        designation: m.designation.trim()
      }));

      await api.post('/agenda', payload);
      setAddMembers([{ category: 'Patron', name: '', designation: '' }]);
      setShowAddForm(false);
      fetchAgenda();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add agenda details');
    }
  };

  const handlePopulateAllCategories = () => {
    setAddMembers(categories.map(cat => ({
      category: cat,
      name: '',
      designation: ''
    })));
  };

  const handleLoadStandardTemplate = async () => {
    if (!window.confirm('Are you sure you want to load the standard Board template? This will add typical placeholder roles to the agenda.')) return;
    const template = [
      { category: 'Patron', name: 'Dr. S. Aruvarasu', designation: 'Patron & Director' },
      { category: 'President', name: 'Dr. I. Arianan', designation: 'President & Principal' },
      { category: 'Faculty Advisor', name: 'Dr. K. Saroja', designation: 'Faculty Advisor & Head of MBA' },
      { category: 'Secretaries', name: 'Mr. B. Sathish Kumar', designation: 'Student Secretary' },
      { category: 'Executive Council', name: 'Ms. G. Swetha', designation: 'Executive Council Member' }
    ];
    try {
      setLoading(true);
      await api.post('/agenda', template);
      fetchAgenda();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to load standard template');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setCategory(item.category);
    setName(item.name);
    setDesignation(item.designation || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setDesignation('');
  };

  const handleEditSave = async (id) => {
    if (!name.trim()) return alert('Name is required');
    try {
      await api.put(`/agenda/${id}`, { category, name, designation });
      setEditingId(null);
      setName('');
      setDesignation('');
      fetchAgenda();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update agenda details');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this detail?')) return;
    try {
      await api.delete(`/agenda/${id}`);
      setSelectedIds(prev => prev.filter(sid => sid !== id));
      fetchAgenda();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete agenda details');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected detail(s)?`)) return;
    try {
      await api.post('/agenda/bulk-delete', { ids: selectedIds });
      setSelectedIds([]);
      fetchAgenda();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete agenda details');
    }
  };

  const handleBulkEditSave = async () => {
    const invalid = bulkEditItems.some(item => !item.name.trim());
    if (invalid) {
      return alert('Name is required for all members');
    }
    try {
      const payload = bulkEditItems.map(item => ({
        id: item.id,
        category: item.category,
        name: item.name.trim(),
        designation: item.designation.trim()
      }));
      await api.put('/agenda/bulk', { items: payload });
      setBulkEditingCategory(null);
      fetchAgenda();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update agenda details');
    }
  };

  const handleCheckboxChange = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handleSelectAllCategory = (cat, items) => {
    const itemIds = items.map(item => item.id);
    const allSelected = itemIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !itemIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const unique = new Set([...prev, ...itemIds]);
        return Array.from(unique);
      });
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>Loading Agenda Details...</div>;
  }

  // Group items by category
  const groupedItems = categories.reduce((acc, cat) => {
    acc[cat] = agendaItems.filter(item => item.category === cat);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header and Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Agenda Members</h2>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)' }}>
            Overview of the current office bearers, patrons, and council members.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isStaffOrAdmin && selectedIds.length > 0 && (
            <button 
              className="btn btn-secondary" 
              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              onClick={handleBulkDelete}
            >
              <Trash2 size={18} /> Delete Selected ({selectedIds.length})
            </button>
          )}

          {isStaffOrAdmin && !showAddForm && (
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setShowAddForm(true);
                setAddMembers([{ category: 'Patron', name: '', designation: '' }]);
              }}
            >
              <Plus size={18} /> Add Member
            </button>
          )}
        </div>
      </div>

      {/* Add New Member Form */}
      {showAddForm && (
        <div className="glass-panel" style={{ maxWidth: '800px', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Add New Agenda Member(s)</h3>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.25rem 0.5rem', border: 'none' }}
              onClick={() => setShowAddForm(false)}
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {addMembers.map((member, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '0.5rem', width: '100%' }}>
                  <div style={{ flex: 1.5, minWidth: '120px' }}>
                    {index === 0 && <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem' }}>Category *</label>}
                    <select 
                      className="select" 
                      value={member.category} 
                      onChange={e => {
                        const updated = [...addMembers];
                        updated[index].category = e.target.value;
                        setAddMembers(updated);
                      }}
                      style={{ width: '100%' }}
                      required
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 2, minWidth: '150px' }}>
                    {index === 0 && <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem' }}>Name *</label>}
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. Dr. John Doe" 
                      value={member.name} 
                      onChange={e => {
                        const updated = [...addMembers];
                        updated[index].name = e.target.value;
                        setAddMembers(updated);
                      }} 
                      style={{ width: '100%' }}
                      required={index === 0} 
                    />
                  </div>
                  <div style={{ flex: 3.5, minWidth: '200px' }}>
                    {index === 0 && <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem' }}>Designation / Role Details</label>}
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="e.g. Professor & HOD / Student Coordinator" 
                      value={member.designation} 
                      onChange={e => {
                        const updated = [...addMembers];
                        updated[index].designation = e.target.value;
                        setAddMembers(updated);
                      }} 
                      style={{ width: '100%' }}
                    />
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ 
                      padding: '0.75rem', 
                      color: '#EF4444', 
                      border: 'none',
                      background: 'rgba(239, 68, 68, 0.05)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }} 
                    onClick={() => {
                      const updated = addMembers.filter((_, i) => i !== index);
                      if (updated.length === 0) {
                        setAddMembers([{ category: 'Patron', name: '', designation: '' }]);
                      } else {
                        setAddMembers(updated);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                onClick={() => setAddMembers([...addMembers, { category: 'Patron', name: '', designation: '' }])}
              >
                <Plus size={14} /> Add Another Row
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(16, 185, 129, 0.1)', color: '#A7F3D0', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                onClick={handlePopulateAllCategories}
              >
                Populate All Categories
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1rem' }}>
              <button type="submit" className="btn btn-primary">Save Details</button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {agendaItems.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', border: '1px dashed var(--surface-border)', borderRadius: '12px' }}>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.1rem', fontStyle: 'italic' }}>
              No members added to the agenda yet. Click "Add Member" or "Load Standard Template" to set them up.
            </p>
          </div>
        ) : (
          categories.map(cat => {
            const items = groupedItems[cat] || [];
            if (items.length === 0) return null;
            const isBulkEditing = bulkEditingCategory === cat;
            return (
              <div key={cat} className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.75rem', color: 'var(--secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isStaffOrAdmin && items.length > 0 && !isBulkEditing && (
                      <input 
                        type="checkbox" 
                        style={{ cursor: 'pointer', width: '18px', height: '18px', margin: 0 }}
                        checked={items.every(item => selectedIds.includes(item.id))}
                        onChange={() => handleSelectAllCategory(cat, items)}
                      />
                    )}
                    <span>{cat}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {isStaffOrAdmin && items.length > 0 && (
                      <button 
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', border: 'none' }}
                        onClick={() => {
                          if (isBulkEditing) {
                            setBulkEditingCategory(null);
                          } else {
                            setBulkEditingCategory(cat);
                            setBulkEditItems(items.map(item => ({ ...item })));
                          }
                        }}
                      >
                        {isBulkEditing ? 'Cancel' : 'Edit All'}
                      </button>
                    )}
                    <span className="badge badge-Student" style={{ fontSize: '0.75rem', fontWeight: '500' }}>
                      {items.length} {items.length === 1 ? 'Person' : 'People'}
                    </span>
                  </div>
                </h3>
                
                {isBulkEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    {bulkEditItems.map((item, idx) => (
                      <div 
                        key={item.id} 
                        style={{ 
                          display: 'flex', 
                          gap: '1rem', 
                          alignItems: 'flex-end', 
                          padding: '0.75rem 1rem', 
                          background: 'rgba(255, 255, 255, 0.03)', 
                          borderRadius: '8px', 
                          border: '1px solid var(--surface-border)',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Category</label>
                          <select 
                            className="select" 
                            value={item.category} 
                            onChange={e => {
                              const updated = [...bulkEditItems];
                              updated[idx].category = e.target.value;
                              setBulkEditItems(updated);
                            }} 
                            style={{ padding: '0.35rem', fontSize: '0.85rem', width: '100%' }}
                          >
                            {categories.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: 2, minWidth: '150px' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Name *</label>
                          <input 
                            type="text" 
                            className="input" 
                            value={item.name} 
                            onChange={e => {
                              const updated = [...bulkEditItems];
                              updated[idx].name = e.target.value;
                              setBulkEditItems(updated);
                            }} 
                            style={{ padding: '0.35rem', fontSize: '0.85rem', width: '100%' }}
                            required
                          />
                        </div>
                        <div style={{ flex: 3, minWidth: '150px' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Designation</label>
                          <input 
                            type="text" 
                            className="input" 
                            value={item.designation || ''} 
                            onChange={e => {
                              const updated = [...bulkEditItems];
                              updated[idx].designation = e.target.value;
                              setBulkEditItems(updated);
                            }} 
                            style={{ padding: '0.35rem', fontSize: '0.85rem', width: '100%' }}
                          />
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ background: '#10B981', border: 'none' }}
                        onClick={handleBulkEditSave}
                      >
                        Save Changes
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => setBulkEditingCategory(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    {items.map(item => {
                      const isEditing = editingId === item.id;
                      return (
                        <div 
                          key={item.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '0.75rem 1rem', 
                            background: 'rgba(255, 255, 255, 0.02)', 
                            borderRadius: '8px', 
                            border: '1px solid var(--surface-border)' 
                          }}
                        >
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '1rem', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                              <select 
                                className="select" 
                                value={category} 
                                onChange={e => setCategory(e.target.value)} 
                                style={{ padding: '0.35rem', fontSize: '0.85rem', flex: 1, minWidth: '120px' }}
                              >
                                {categories.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <input 
                                type="text" 
                                className="input" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                style={{ padding: '0.35rem', fontSize: '0.85rem', flex: 1, minWidth: '150px' }}
                                placeholder="Name"
                              />
                              <input 
                                type="text" 
                                className="input" 
                                value={designation} 
                                onChange={e => setDesignation(e.target.value)} 
                                style={{ padding: '0.35rem', fontSize: '0.85rem', flex: 1, minWidth: '150px' }}
                                placeholder="Designation (optional)"
                              />
                              <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                <button 
                                  className="btn btn-primary" 
                                  style={{ padding: '0.35rem 0.5rem', background: '#10B981' }} 
                                  onClick={() => handleEditSave(item.id)}
                                  title="Save"
                                >
                                  <Check size={16} />
                                </button>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.35rem 0.5rem' }} 
                                  onClick={cancelEdit}
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {isStaffOrAdmin && (
                                  <input 
                                    type="checkbox" 
                                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                    checked={selectedIds.includes(item.id)}
                                    onChange={() => handleCheckboxChange(item.id)}
                                  />
                                )}
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                                  {item.designation && (
                                    <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                      {item.designation}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {isStaffOrAdmin && (
                                <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.4rem', border: 'none' }} 
                                    onClick={() => startEdit(item)}
                                    title="Edit"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.4rem', border: 'none', color: '#EF4444' }} 
                                    onClick={() => handleDelete(item.id)}
                                    title="Delete"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Agenda;
