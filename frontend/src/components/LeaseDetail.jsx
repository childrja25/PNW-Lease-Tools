import React, { useState } from 'react';

function toTitleCase(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

  const leaseId = `L-${String(lease.id || 0).slice(-6).padStart(6, '0')}`;

  const handleExport = () => {
    const data = {};
    Object.entries(lease).forEach(([k, v]) => {
      if (v && k !== 'id' && k !== 'filepath') data[k] = v;
    });
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
                {lease.tenant_name && (
                  <p>
                    The Lease Agreement shall use a Commercial lease Agreement, the ("Landlord"
                    {lease.signing_entity && <> Make {lease.signing_entity}</>}
                    {' '}and {' '}
                    <span className="bg-yellow-200 px-0.5 font-medium">{lease.tenant_name}</span>
                    ) January 1, 2024, the commencement of the Premises or
                    any encroachment about the Premises shall be expire this lease Agreement and shall in a
                    commercial atmosphere of the Premises.
                  </p>
                )}

                {(lease.base_rent_schedule || lease.base_rent_amount) && (
                  <>
                    <p className="font-bold mt-4">Article 3: Rent</p>
                    {Array.isArray(lease.base_rent_schedule) && lease.base_rent_schedule.length > 0 ? (
                      <>
                        <p>
                          The Base Rent for the Premises shall be{' '}
                          <span className="bg-yellow-200 px-0.5 font-bold">
                            {lease.base_rent_schedule[0]?.annual_rent || 'Twenty-Five Thousand Five Hundred Dollars'}
                          </span>{' '}
                          (<span className="bg-yellow-200 px-0.5 font-bold">
                            {lease.base_rent_schedule[0]?.monthly_rent || '$25,500.00'}
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
                          <span className="bg-yellow-200 px-0.5 font-bold">{lease.base_rent_schedule[0]?.monthly_rent || '$25,500'}</span> per
                          month, subject to annual increases.
                        </p>
                      </>
                    ) : (
                      <p>
                        Rent Amount: <span className="bg-yellow-200 px-0.5">{lease.base_rent_amount || 'N/A'}</span>
                      </p>
                    )}
                  </>
                )}

                {lease.expense_recovery_type && (
                  <p>
                    Expense Recovery: <span className="bg-yellow-200 px-0.5">{lease.expense_recovery_type}</span>
                    {lease.base_year && <> (Base Year: <span className="bg-yellow-200 px-0.5">{lease.base_year}</span>)</>}
                  </p>
                )}

                {lease.lease_commencement_date && (
                  <>
                    <p className="font-bold mt-4">Article 5: Term</p>
                    <p>
                      The Lease Term shall commence on{' '}
                      <span className="bg-yellow-200 px-0.5 font-medium">{lease.lease_commencement_date}</span>{' '}
                      (the "Commencement Date") and expire
                      {lease.expiration_date && (
                        <> on <span className="bg-yellow-200 px-0.5 font-medium">{lease.expiration_date}</span></>
                      )}
                      {' '}(the "Expiration Date").
                    </p>
                    {lease.rent_commencement_date && (
                      <p>
                        The Lease Term shall commence on{' '}
                        <span className="bg-yellow-200 px-0.5 font-medium">{lease.rent_commencement_date}</span>{' '}
                        (the "Commencement Date") and expire
                        {lease.expiration_date && (
                          <> on <span className="bg-yellow-200 px-0.5 font-medium">{lease.expiration_date}</span></>
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

                {(!lease.tenant_name && !lease.base_rent_schedule) && (
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

                    if (fieldKey === 'base_rent_schedule' && Array.isArray(value) && value.length > 0) {
                      return (
                        <div key={fieldKey} className="bg-navy-700 rounded-lg p-3 border border-gray-700/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                              Base Rent Schedule
                            </span>
                            <ConfidenceBadge confidence={getConfidence(fieldKey)} />
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

                    const displayValue = Array.isArray(value) ? value.join(', ') : value;
                    const confidence = getConfidence(fieldKey);

                    return (
                      <div key={fieldKey} className="bg-navy-700 rounded-lg p-3 border border-gray-700/50">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                            {toTitleCase(fieldKey)}
                          </span>
                          {value && <ConfidenceBadge confidence={confidence} />}
                        </div>
                        <div className={`text-sm ${value ? 'text-white' : 'text-gray-600 italic'}`}>
                          {displayValue || 'Not found'}
                        </div>
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
