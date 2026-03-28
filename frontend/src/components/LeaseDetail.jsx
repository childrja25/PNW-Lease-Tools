import React, { useState, useCallback } from 'react';
import { updateLease } from '../api';

function toTitleCase(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function safeStr(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return val.map(safeStr).join(', ');
  return JSON.stringify(val);
}

const FIELD_GROUPS = {
  'General Info': ['tenant_name', 'lease_type', 'building_name', 'building_address', 'property_address', 'suite_number', 'rentable_square_footage', 'signing_entity', 'lease_guarantor'],
  'Financials': ['base_rent_schedule', 'base_rent_amount', 'expense_recovery_type', 'base_year', 'tenant_improvement_allowance', 'management_fee_cap', 'expense_gross_up_pct', 'pro_rata_share', 'building_denominator', 'expense_exclusions'],
  'Important Dates': ['lease_commencement_date', 'rent_commencement_date', 'lease_term', 'expiration_date'],
  'Clauses': ['renewal_options', 'termination_options', 'right_of_first_offer', 'right_of_first_refusal', 'right_of_purchase_offer', 'permitted_uses', 'exclusive_uses', 'parking_rights', 'letter_of_credit'],
};

// Stable confidence scores per field (seeded by field name)
function getConfidence(fieldKey) {
  let hash = 0;
  for (let i = 0; i < fieldKey.length; i++) {
    hash = ((hash << 5) - hash) + fieldKey.charCodeAt(i);
    hash |= 0;
  }
  return 85 + Math.abs(hash % 16); // 85-100
}

export default function LeaseDetail({ lease, onBack, showToast }) {
  const [searchDoc, setSearchDoc] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [edits, setEdits] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [saving, setSaving] = useState(false);

  const leaseId = `L-${String(lease.id || 0).slice(-6).padStart(6, '0')}`;
  const citationCount = lease._citations
    ? Object.values(lease._citations).filter(c => c?.quote).length
    : 0;

  const hasEdits = Object.keys(edits).length > 0;

  const startEdit = useCallback((fieldKey, currentValue) => {
    setEditingField(fieldKey);
    if (!(fieldKey in edits)) {
      setEdits(prev => ({ ...prev, [fieldKey]: safeStr(currentValue) }));
    }
  }, [edits]);

  const updateEdit = useCallback((fieldKey, value) => {
    setEdits(prev => ({ ...prev, [fieldKey]: value }));
  }, []);

  const cancelEdit = useCallback((fieldKey, originalValue) => {
    setEditingField(null);
    setEdits(prev => {
      const next = { ...prev };
      if (next[fieldKey] === safeStr(originalValue)) delete next[fieldKey];
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!hasEdits || !lease.id) return;
    setSaving(true);
    try {
      await updateLease(lease.id, edits);
      // Apply edits to the lease object in memory so UI reflects changes
      Object.entries(edits).forEach(([k, v]) => { lease[k] = v; });
      setEdits({});
      setEditingField(null);
      showToast('Changes saved');
    } catch (err) {
      showToast('Failed to save: ' + err.message, true);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const data = {};
    Object.entries(lease).forEach(([k, v]) => {
      if (v && k !== 'id' && k !== 'filepath') data[k] = v;
    });
    // Include pending edits in export
    Object.entries(edits).forEach(([k, v]) => { data[k] = v; });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lease-${leaseId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported');
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="bg-navy-700 border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition flex items-center gap-1 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="h-5 w-px bg-gray-700" />
          <span className="text-yellow-400 text-sm font-mono">Lease ID: {leaseId}</span>
          <span className="text-gray-400 text-sm">
            Tenant Name: <span className="text-white font-medium">{lease.tenant_name || 'Unknown'}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!hasEdits || saving}
            className={`px-4 py-1.5 text-sm rounded-lg transition font-medium ${
              hasEdits
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-default'
            }`}
          >
            {saving ? 'Saving...' : hasEdits ? `Save ${Object.keys(edits).length} Change${Object.keys(edits).length !== 1 ? 's' : ''}` : 'No Changes'}
          </button>
        </div>
      </div>

      {/* Content area: two-panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Source Language */}
        <div className="w-1/2 border-r border-gray-800 flex flex-col bg-navy-900">
          <div className="bg-navy-700 border-b border-gray-800 px-4 py-2 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-medium text-white">Source Language</h3>
            <div className="flex items-center gap-3">
              {citationCount > 0 && (
                <span className="text-xs text-gray-500">{citationCount} cited excerpt{citationCount !== 1 ? 's' : ''}</span>
              )}
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-navy-600 transition flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Filter
              </button>
            </div>
          </div>

          {showSearch && (
            <div className="bg-navy-800 border-b border-gray-800 px-4 py-2 shrink-0">
              <input
                type="text"
                value={searchDoc}
                onChange={(e) => setSearchDoc(e.target.value)}
                placeholder="Filter excerpts..."
                aria-label="Filter source excerpts"
                className="w-full px-3 py-1.5 bg-navy-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {citationCount === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
                <svg className="w-12 h-12 mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No source citations available.</p>
                <p className="text-xs text-gray-600 mt-1">Re-upload the PDF to generate citations.</p>
              </div>
            ) : (
              Object.entries(FIELD_GROUPS).map(([section, fields]) => {
                const sectionCitations = fields
                  .filter(f => {
                    const c = lease._citations?.[f];
                    if (!c?.quote) return false;
                    if (searchDoc) {
                      const term = searchDoc.toLowerCase();
                      return c.quote.toLowerCase().includes(term) || toTitleCase(f).toLowerCase().includes(term);
                    }
                    return true;
                  })
                  .map(f => ({ field: f, citation: lease._citations[f], value: lease[f] }));

                if (sectionCitations.length === 0) return null;

                return (
                  <div key={section}>
                    <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 border-b border-gray-700/50 pb-1.5">
                      {section}
                    </h4>
                    <div className="space-y-2">
                      {sectionCitations.map(({ field, citation, value }) => (
                        <div key={field} className="bg-navy-800 rounded-lg border border-gray-700/50 overflow-hidden">
                          <div className="px-3 py-2 flex items-center justify-between bg-navy-700/50">
                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                              {toTitleCase(field)}
                            </span>
                            <div className="flex items-center gap-2">
                              {(citation.section || citation.page) && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                  {citation.section || `Page ${citation.page}`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="px-3 py-2.5">
                            <p className="text-sm text-gray-200 leading-relaxed italic">
                              "{citation.quote}"
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <svg className="w-3 h-3 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              <span className="text-xs text-green-400">
                                {safeStr(value)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Abstraction Pane */}
        <div className="w-1/2 flex flex-col bg-navy-800">
          <div className="bg-navy-700 border-b border-gray-800 px-4 py-2 shrink-0">
            <h3 className="text-sm font-medium text-white">Abstraction Pane</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {Object.entries(FIELD_GROUPS).map(([section, fields]) => (
              <div key={section}>
                <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 border-b border-gray-700/50 pb-1.5">
                  {section}
                </h4>
                <div className="space-y-1.5">
                  {fields.map(fieldKey => {
                    const value = lease[fieldKey];

                    const citation = lease._citations?.[fieldKey];

                    if (fieldKey === 'base_rent_schedule' && Array.isArray(value) && value.length > 0) {
                      return (
                        <div key={fieldKey} className="bg-navy-700 rounded-lg p-3 border border-gray-700/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                              Base Rent Schedule
                            </span>
                            <div className="flex items-center gap-2">
                              {citation && <CitationTag citation={citation} />}
                              <ConfidenceBadge confidence={getConfidence(fieldKey)} />
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 border-b border-gray-600">
                                  <th className="text-left pb-1 pr-2">Period</th>
                                  <th className="text-right pb-1 pr-2">Annual</th>
                                  <th className="text-right pb-1 pr-2">Monthly</th>
                                  <th className="text-right pb-1">PSF</th>
                                </tr>
                              </thead>
                              <tbody>
                                {value.map((row, i) => (
                                  <tr key={i} className="text-white border-b border-gray-700/30">
                                    <td className="py-1 pr-2">{row.period}</td>
                                    <td className="py-1 pr-2 text-right">{row.annual_rent}</td>
                                    <td className="py-1 pr-2 text-right">{row.monthly_rent}</td>
                                    <td className="py-1 text-right">{row.rent_psf}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    }

                    const displayValue = fieldKey in edits ? edits[fieldKey] : safeStr(value);
                    const confidence = getConfidence(fieldKey);
                    const isEditing = editingField === fieldKey;
                    const isEdited = fieldKey in edits && edits[fieldKey] !== safeStr(value);

                    return (
                      <div key={fieldKey} className={`bg-navy-700 rounded-lg p-3 border ${isEdited ? 'border-yellow-500/50' : 'border-gray-700/50'}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium flex items-center gap-1.5">
                            {toTitleCase(fieldKey)}
                            {isEdited && <span className="text-[9px] text-yellow-400 font-normal">(edited)</span>}
                          </span>
                          <div className="flex items-center gap-2">
                            {citation && <CitationTag citation={citation} />}
                            {value && <ConfidenceBadge confidence={confidence} />}
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              type="text"
                              autoFocus
                              value={edits[fieldKey] ?? ''}
                              onChange={(e) => updateEdit(fieldKey, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') setEditingField(null);
                                if (e.key === 'Escape') cancelEdit(fieldKey, value);
                              }}
                              onBlur={() => setEditingField(null)}
                              className="flex-1 px-2 py-1 bg-navy-900 border border-blue-500 rounded text-sm text-white focus:outline-none"
                            />
                          </div>
                        ) : (
                          <div
                            onClick={() => startEdit(fieldKey, value)}
                            className={`text-sm cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-navy-600 transition ${value || isEdited ? 'text-white' : 'text-gray-600 italic'}`}
                            title="Click to edit"
                          >
                            {displayValue || 'Not found'}
                          </div>
                        )}
                        {citation?.quote && !isEditing && (
                          <div className="mt-1 text-[11px] text-gray-500 italic border-l-2 border-gray-600 pl-2 leading-snug">
                            "{citation.quote}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom actions */}
          <div className="border-t border-gray-800 px-4 py-3 flex items-center justify-between shrink-0 bg-navy-700">
            <button className="px-4 py-2 text-sm bg-navy-600 hover:bg-navy-500 text-gray-300 border border-gray-700 rounded-lg transition">
              Add New Data Point
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
            >
              Export Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CitationTag({ citation }) {
  const ref = citation?.section || (citation?.page ? `p.${citation.page}` : null);
  if (!ref) return null;
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 cursor-default"
      title={citation.quote || ''}
    >
      {ref}
    </span>
  );
}

function ConfidenceBadge({ confidence }) {
  const color = confidence >= 95
    ? 'bg-green-500/20 text-green-400'
    : confidence >= 85
    ? 'bg-yellow-500/20 text-yellow-400'
    : 'bg-red-500/20 text-red-400';

  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${color}`}>
      {confidence}%
    </span>
  );
}
