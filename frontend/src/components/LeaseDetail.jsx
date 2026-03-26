import React, { useState, useRef, useCallback } from 'react';
import { uploadAmendment } from '../api';

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
  const [activeTab, setActiveTab] = useState('terms'); // 'terms' | 'changelog'
  const [uploading, setUploading] = useState(false);
  const [leaseData, setLeaseData] = useState(lease);
  const amendmentFileRef = useRef(null);

  const leaseId = `L-${String(leaseData.id || 0).slice(-6).padStart(6, '0')}`;
  const hasAmendments = leaseData._amendments && leaseData._amendments.length > 0;
  const currentTerms = leaseData._current_terms || {};
  const changelog = leaseData._changelog || [];

  // Determine effective value: use current_terms if amendments exist, otherwise original
  const getEffectiveValue = useCallback((fieldKey) => {
    if (hasAmendments && currentTerms[fieldKey] !== undefined) {
      return currentTerms[fieldKey];
    }
    return leaseData[fieldKey];
  }, [hasAmendments, currentTerms, leaseData]);

  // Check if a field was modified by an amendment
  const getFieldChange = useCallback((fieldKey) => {
    if (!hasAmendments) return null;
    const changes = changelog.filter(c => c.field === fieldKey);
    return changes.length > 0 ? changes[changes.length - 1] : null;
  }, [hasAmendments, changelog]);

  const handleAmendmentUpload = useCallback(async (file) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const data = await uploadAmendment(leaseData.id, file);
      // Update local lease data with amendment results
      setLeaseData(prev => ({
        ...prev,
        _amendments: [...(prev._amendments || []), { filename: file.name, uploaded_at: new Date().toISOString() }],
        _changelog: [...(prev._changelog || []), ...(data.changelog || []).map(c => ({ ...c, amendment_filename: file.name, amendment_date: new Date().toISOString() }))],
        _current_terms: data.current_terms || prev._current_terms,
      }));
      showToast(`Amendment processed: ${data.changelog?.length || 0} term(s) changed`);
      setActiveTab('changelog');
    } catch (e) {
      showToast('Amendment upload failed: ' + e.message, true);
    } finally {
      setUploading(false);
      if (amendmentFileRef.current) amendmentFileRef.current.value = '';
    }
  }, [uploading, leaseData.id, showToast]);

  const handleExport = () => {
    const data = {};
    Object.entries(leaseData).forEach(([k, v]) => {
      if (v && k !== 'id' && k !== 'filepath') data[k] = v;
    });
    if (hasAmendments) {
      data._current_terms = currentTerms;
      data._changelog = changelog;
    }
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
            Tenant Name: <span className="text-white font-medium">{leaseData.tenant_name || 'Unknown'}</span>
          </span>
          {hasAmendments && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
              {leaseData._amendments.length} Amendment{leaseData._amendments.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={amendmentFileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleAmendmentUpload(e.target.files[0])}
          />
          <button
            onClick={() => amendmentFileRef.current?.click()}
            disabled={uploading}
            className="px-4 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {uploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Amendment
              </>
            )}
          </button>
          <button className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium">
            Verify & Save
          </button>
        </div>
      </div>

      {/* Content area: two-panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Document Viewer */}
        <div className="w-1/2 border-r border-gray-800 flex flex-col bg-navy-900">
          <div className="bg-navy-700 border-b border-gray-800 px-4 py-2 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-medium text-white">Document Viewer</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Page 1 of 45</span>
              <button className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-navy-600 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                Zoom In
              </button>
              <button className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-navy-600 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
                Zoom Out
              </button>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-navy-600 transition flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Search Document
              </button>
            </div>
          </div>

          {/* Search bar (toggleable) */}
          {showSearch && (
            <div className="bg-navy-800 border-b border-gray-800 px-4 py-2 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={searchDoc}
                onChange={(e) => setSearchDoc(e.target.value)}
                placeholder="Search within document..."
                className="flex-1 px-3 py-1.5 bg-navy-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white rounded-lg shadow-xl p-8 text-black min-h-[600px]">
              <h2 className="text-center font-bold text-lg mb-6">COMMERCIAL LEASE AGREEMENT</h2>
              <div className="space-y-4 text-sm leading-relaxed">
                {leaseData.tenant_name && (
                  <p>
                    The Lease Agreement shall use a Commercial lease Agreement, the ("Landlord"
                    {leaseData.signing_entity && <> Make {safeStr(leaseData.signing_entity)}</>}
                    {' '}and {' '}
                    <span className="bg-yellow-200 px-0.5 font-medium">{leaseData.tenant_name}</span>
                    ) January 1, 2024, the commencement of the Premises or
                    any encroachment about the Premises shall be expire this lease Agreement and shall in a
                    commercial atmosphere of the Premises.
                  </p>
                )}

                {(leaseData.base_rent_schedule || leaseData.base_rent_amount) && (
                  <>
                    <p className="font-bold mt-4">Article 3: Rent</p>
                    {Array.isArray(leaseData.base_rent_schedule) && leaseData.base_rent_schedule.length > 0 ? (
                      <>
                        <p>
                          The Base Rent for the Premises shall be{' '}
                          <span className="bg-yellow-200 px-0.5 font-bold">
                            {leaseData.base_rent_schedule[0]?.annual_rent || 'Twenty-Five Thousand Five Hundred Dollars'}
                          </span>{' '}
                          (<span className="bg-yellow-200 px-0.5 font-bold">
                            {leaseData.base_rent_schedule[0]?.monthly_rent || '$25,500.00'}
                          </span>) per month, subject to annual increases.
                        </p>
                        <p className="text-gray-600 text-xs">
                          The Premises shall be the Commencement Date is used with base interests in an reached
                          generations of the properties, annual Rent Term, or alter or validation, payment shall the
                          conference of the Lease and shall (due worksheet) annual interests for the amounts of the
                          corporation.
                        </p>
                        <p>
                          The Lease Term shall Premises shall be Twenty 1, 2024: the Hundred Dollars (
                          <span className="bg-yellow-200 px-0.5 font-bold">{leaseData.base_rent_schedule[0]?.monthly_rent || '$25,500'}</span> per
                          month, subject to annual increases.
                        </p>
                      </>
                    ) : (
                      <p>
                        Rent Amount: <span className="bg-yellow-200 px-0.5">{leaseData.base_rent_amount || 'N/A'}</span>
                      </p>
                    )}
                  </>
                )}

                {leaseData.expense_recovery_type && (
                  <p>
                    Expense Recovery: <span className="bg-yellow-200 px-0.5">{safeStr(leaseData.expense_recovery_type)}</span>
                    {leaseData.base_year && <> (Base Year: <span className="bg-yellow-200 px-0.5">{safeStr(leaseData.base_year)}</span>)</>}
                  </p>
                )}

                {leaseData.lease_commencement_date && (
                  <>
                    <p className="font-bold mt-4">Article 5: Term</p>
                    <p>
                      The Lease Term shall commence on{' '}
                      <span className="bg-yellow-200 px-0.5 font-medium">{leaseData.lease_commencement_date}</span>{' '}
                      (the "Commencement Date") and expire
                      {leaseData.expiration_date && (
                        <> on <span className="bg-yellow-200 px-0.5 font-medium">{leaseData.expiration_date}</span></>
                      )}
                      {' '}(the "Expiration Date").
                    </p>
                    {leaseData.rent_commencement_date && (
                      <p>
                        The Lease Term shall commence on{' '}
                        <span className="bg-yellow-200 px-0.5 font-medium">{leaseData.rent_commencement_date}</span>{' '}
                        (the "Commencement Date") and expire
                        {leaseData.expiration_date && (
                          <> on <span className="bg-yellow-200 px-0.5 font-medium">{leaseData.expiration_date}</span></>
                        )}
                        {' '}(the "Expiration Date").
                      </p>
                    )}
                    <p className="text-gray-600 text-xs">
                      The Lease Term shall commence shall be made for the disconnect or endorsement for the
                      Premises.
                    </p>
                  </>
                )}

                {(!leaseData.tenant_name && !leaseData.base_rent_schedule) && (
                  <p className="text-gray-400 italic text-center py-12">
                    Document preview is based on extracted data.
                    <br />Upload the original PDF for full document viewing.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Abstraction Pane */}
        <div className="w-1/2 flex flex-col bg-navy-800">
          {/* Tab bar */}
          <div className="bg-navy-700 border-b border-gray-800 px-4 py-2 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('terms')}
                className={`px-3 py-1 text-sm rounded-md transition ${activeTab === 'terms' ? 'bg-navy-600 text-white font-medium' : 'text-gray-400 hover:text-white'}`}
              >
                Current Terms
              </button>
              <button
                onClick={() => setActiveTab('changelog')}
                className={`px-3 py-1 text-sm rounded-md transition flex items-center gap-1.5 ${activeTab === 'changelog' ? 'bg-navy-600 text-white font-medium' : 'text-gray-400 hover:text-white'}`}
              >
                Change Log
                {changelog.length > 0 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300">
                    {changelog.length}
                  </span>
                )}
              </button>
            </div>
            {hasAmendments && activeTab === 'terms' && (
              <span className="text-[10px] text-gray-500">
                Amended terms shown in purple
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {activeTab === 'terms' ? (
              /* ===== TERMS VIEW ===== */
              <>
                {Object.entries(FIELD_GROUPS).map(([section, fields]) => (
                  <div key={section}>
                    <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 border-b border-gray-700/50 pb-1.5">
                      {section}
                    </h4>
                    <div className="space-y-1.5">
                      {fields.map(fieldKey => {
                        const value = getEffectiveValue(fieldKey);
                        const citation = leaseData._citations?.[fieldKey];
                        const change = getFieldChange(fieldKey);

                        if (fieldKey === 'base_rent_schedule' && Array.isArray(value) && value.length > 0) {
                          return (
                            <div key={fieldKey} className={`bg-navy-700 rounded-lg p-3 border ${change ? 'border-purple-500/50' : 'border-gray-700/50'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                                    Base Rent Schedule
                                  </span>
                                  {change && <AmendedBadge />}
                                </div>
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
                              {change && (
                                <div className="mt-2 text-[11px] text-purple-300 italic border-l-2 border-purple-500/50 pl-2">
                                  {change.summary}
                                </div>
                              )}
                            </div>
                          );
                        }

                        const displayValue = safeStr(value);
                        const confidence = getConfidence(fieldKey);

                        return (
                          <div key={fieldKey} className={`bg-navy-700 rounded-lg p-3 border ${change ? 'border-purple-500/50' : 'border-gray-700/50'}`}>
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                                  {toTitleCase(fieldKey)}
                                </span>
                                {change && <AmendedBadge />}
                              </div>
                              <div className="flex items-center gap-2">
                                {citation && <CitationTag citation={citation} />}
                                {value && <ConfidenceBadge confidence={confidence} />}
                              </div>
                            </div>
                            <div className={`text-sm ${value ? 'text-white' : 'text-gray-600 italic'}`}>
                              {displayValue || 'Not found'}
                            </div>
                            {change && (
                              <div className="mt-1.5 space-y-1">
                                <div className="text-[11px] text-gray-500 line-through">
                                  Was: {safeStr(change.previous_value) || 'Not set'}
                                </div>
                                <div className="text-[11px] text-purple-300 italic border-l-2 border-purple-500/50 pl-2">
                                  {change.summary}
                                </div>
                              </div>
                            )}
                            {!change && citation?.quote && (
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
              </>
            ) : (
              /* ===== CHANGELOG VIEW ===== */
              <>
                {/* Amendment documents list */}
                {hasAmendments && (
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 border-b border-gray-700/50 pb-1.5">
                      Amendment Documents
                    </h4>
                    <div className="space-y-1.5">
                      {leaseData._amendments.map((amendment, i) => (
                        <div key={i} className="bg-navy-700 rounded-lg p-3 border border-gray-700/50 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white font-medium truncate">{amendment.filename}</div>
                            <div className="text-[11px] text-gray-500">
                              Uploaded {new Date(amendment.uploaded_at).toLocaleDateString()}
                              {' \u2022 '}
                              {changelog.filter(c => c.amendment_filename === amendment.filename).length} change(s)
                            </div>
                          </div>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 shrink-0">
                            Amendment {i + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Change entries */}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 border-b border-gray-700/50 pb-1.5">
                    Term Changes
                  </h4>
                  {changelog.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-navy-700 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-sm">No amendments uploaded yet.</p>
                      <p className="text-gray-600 text-xs mt-1">Upload an amendment PDF to track term changes.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {changelog.map((entry, i) => (
                        <div key={i} className="bg-navy-700 rounded-lg p-3 border border-gray-700/50">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-white">
                              {toTitleCase(entry.field)}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {entry.amendment_filename}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-1.5">
                            <div className="bg-red-500/10 rounded p-2 border border-red-500/20">
                              <div className="text-[10px] uppercase tracking-wider text-red-400/70 font-medium mb-0.5">Previous</div>
                              <div className="text-xs text-red-300 line-through">
                                {safeStr(entry.previous_value) || 'Not set'}
                              </div>
                            </div>
                            <div className="bg-green-500/10 rounded p-2 border border-green-500/20">
                              <div className="text-[10px] uppercase tracking-wider text-green-400/70 font-medium mb-0.5">Current</div>
                              <div className="text-xs text-green-300">
                                {safeStr(entry.new_value) || 'Removed'}
                              </div>
                            </div>
                          </div>
                          <div className="text-[11px] text-gray-400 italic">
                            {entry.summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Bottom actions */}
          <div className="border-t border-gray-800 px-4 py-3 flex items-center justify-between shrink-0 bg-navy-700">
            <button
              onClick={() => amendmentFileRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 text-sm bg-navy-600 hover:bg-navy-500 text-gray-300 border border-gray-700 rounded-lg transition disabled:opacity-50"
            >
              {uploading ? 'Processing...' : 'Add Amendment'}
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

function AmendedBadge() {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
      Amended
    </span>
  );
}

function CitationTag({ citation }) {
  if (!citation?.page) return null;
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 cursor-default"
      title={citation.quote || ''}
    >
      p.{citation.page}
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
