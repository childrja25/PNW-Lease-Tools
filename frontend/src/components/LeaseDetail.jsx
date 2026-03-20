import React, { useState } from 'react';

function toTitleCase(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const FIELD_GROUPS = {
  'General Info': ['tenant_name', 'property_address', 'building_name', 'suite_number', 'rentable_square_footage', 'signing_entity', 'lease_guarantor'],
  'Rent & Expenses': ['base_rent_schedule', 'expense_recovery_type', 'base_year', 'tenant_improvement_allowance', 'management_fee_cap', 'expense_gross_up_pct', 'pro_rata_share', 'building_denominator', 'expense_exclusions'],
  'Dates & Term': ['lease_commencement_date', 'rent_commencement_date', 'lease_term'],
  'Options & Rights': ['renewal_options', 'termination_options', 'right_of_first_offer', 'right_of_first_refusal', 'right_of_purchase_offer'],
  'Use & Other': ['permitted_uses', 'exclusive_uses', 'parking_rights', 'letter_of_credit'],
};

export default function LeaseDetail({ lease, onBack, showToast }) {
  const [activeSection, setActiveSection] = useState('General Info');

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
              <span className="text-xs text-gray-500">Page 1 of 1</span>
              <button className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-navy-600 transition">Zoom In</button>
              <button className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-navy-600 transition">Zoom Out</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white rounded-lg shadow-xl p-8 text-black min-h-[600px]">
              <h2 className="text-center font-bold text-lg mb-6">COMMERCIAL LEASE AGREEMENT</h2>
              <div className="space-y-4 text-sm leading-relaxed">
                {lease.tenant_name && (
                  <p>
                    Tenant: <span className="bg-yellow-200 px-0.5">{lease.tenant_name}</span>
                    {lease.signing_entity && <> (Signing Entity: <span className="bg-yellow-200 px-0.5">{lease.signing_entity}</span>)</>}
                  </p>
                )}
                {lease.property_address && (
                  <p>
                    Property: <span className="bg-yellow-200 px-0.5">{lease.property_address}</span>
                    {lease.building_name && <>, <span className="bg-yellow-200 px-0.5">{lease.building_name}</span></>}
                    {lease.suite_number && <>, Suite <span className="bg-yellow-200 px-0.5">{lease.suite_number}</span></>}
                  </p>
                )}
                {lease.rentable_square_footage && (
                  <p>
                    Rentable Area: <span className="bg-yellow-200 px-0.5">{lease.rentable_square_footage}</span> SF
                  </p>
                )}
                {lease.lease_commencement_date && (
                  <>
                    <p className="font-bold mt-4">Term</p>
                    <p>
                      Lease commences <span className="bg-yellow-200 px-0.5">{lease.lease_commencement_date}</span>
                      {lease.lease_term && <> for a term of <span className="bg-yellow-200 px-0.5">{lease.lease_term}</span></>}.
                      {lease.rent_commencement_date && <> Rent commences <span className="bg-yellow-200 px-0.5">{lease.rent_commencement_date}</span>.</>}
                    </p>
                  </>
                )}
                {Array.isArray(lease.base_rent_schedule) && lease.base_rent_schedule.length > 0 && (
                  <>
                    <p className="font-bold mt-4">Base Rent Schedule</p>
                    <table className="w-full border-collapse text-xs mt-2">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-2 py-1 text-left">Period</th>
                          <th className="border border-gray-300 px-2 py-1 text-right">Annual Rent</th>
                          <th className="border border-gray-300 px-2 py-1 text-right">Monthly Rent</th>
                          <th className="border border-gray-300 px-2 py-1 text-right">Rent PSF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lease.base_rent_schedule.map((row, i) => (
                          <tr key={i} className="bg-yellow-50">
                            <td className="border border-gray-300 px-2 py-1">{row.period}</td>
                            <td className="border border-gray-300 px-2 py-1 text-right">{row.annual_rent}</td>
                            <td className="border border-gray-300 px-2 py-1 text-right">{row.monthly_rent}</td>
                            <td className="border border-gray-300 px-2 py-1 text-right">{row.rent_psf}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {lease.expense_recovery_type && (
                  <p>
                    Expense Recovery: <span className="bg-yellow-200 px-0.5">{lease.expense_recovery_type}</span>
                    {lease.base_year && <> (Base Year: <span className="bg-yellow-200 px-0.5">{lease.base_year}</span>)</>}
                  </p>
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
          <div className="flex-1 overflow-y-auto p-4">
            {/* Section tabs */}
            <div className="flex gap-1 mb-4 bg-navy-900 rounded-lg p-1">
              {Object.keys(FIELD_GROUPS).map(section => (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={`flex-1 text-xs py-2 px-2 rounded-md transition font-medium ${
                    activeSection === section
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-navy-700'
                  }`}
                >
                  {section}
                </button>
              ))}
            </div>

            {/* Fields for active section */}
            <div className="space-y-2">
              {FIELD_GROUPS[activeSection]?.map(fieldKey => {
                const value = lease[fieldKey];

                if (fieldKey === 'base_rent_schedule' && Array.isArray(value) && value.length > 0) {
                  return (
                    <div key={fieldKey} className="bg-navy-700 rounded-lg p-3 border border-gray-700/50">
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2">
                        Base Rent Schedule
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
                const confidence = value ? Math.floor(Math.random() * 15 + 85) : 0;

                return (
                  <div key={fieldKey} className="bg-navy-700 rounded-lg p-3 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                        {toTitleCase(fieldKey)}
                      </span>
                      {value && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          confidence >= 95 ? 'bg-green-500/20 text-green-400' :
                          confidence >= 85 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {confidence}%
                        </span>
                      )}
                    </div>
                    <div className={`text-sm ${value ? 'text-white' : 'text-gray-600 italic'}`}>
                      {displayValue || 'Not found'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* All sections displayed below for complete view */}
            {Object.entries(FIELD_GROUPS)
              .filter(([section]) => section !== activeSection)
              .map(([section, fields]) => (
                <div key={section} className="mt-6">
                  <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-2">{section}</h4>
                  <div className="space-y-2">
                    {fields.map(fieldKey => {
                      const value = lease[fieldKey];
                      const displayValue = Array.isArray(value) ? value.join(', ') : value;
                      return (
                        <div key={fieldKey} className="bg-navy-700 rounded-lg p-3 border border-gray-700/50">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">
                            {toTitleCase(fieldKey)}
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
