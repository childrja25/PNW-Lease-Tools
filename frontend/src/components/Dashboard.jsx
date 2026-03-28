import React, { useState, useRef, useCallback } from 'react';
import { uploadLease, searchLeases, deleteLease } from '../api';

function toTitleCase(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function Dashboard({ leases, stats, connected, onRefresh, onViewDetails, showToast }) {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Lease Abstraction Tool</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            Status: <span className={connected ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
              {connected ? 'Online' : 'Offline'}
            </span>
          </span>
          <span className="text-gray-400">
            Indexed: <span className="text-blue-400 font-medium">{stats.count}</span>
          </span>
        </div>
      </div>

      {/* Connection error banner */}
      {!connected && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-center">
          <p className="text-red-400 font-semibold">Cannot connect to server</p>
          <p className="text-red-300/70 text-sm mt-1">The backend service is unreachable.</p>
          <button
            onClick={onRefresh}
            className="mt-3 px-4 py-1.5 text-sm bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 hover:bg-red-500/30 transition"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Two-column grid: Upload + Search */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <UploadCard disabled={!connected} onUploadComplete={onRefresh} showToast={showToast} />
        <SearchCard disabled={!connected} showToast={showToast} />
      </div>

      {/* Indexed Leases table */}
      <LeaseTable
        leases={leases}
        connected={connected}
        onRefresh={onRefresh}
        onViewDetails={onViewDetails}
        showToast={showToast}
      />
    </div>
  );
}

function UploadCard({ disabled, onUploadComplete, showToast }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ step: 0, pct: 0 });
  const [result, setResult] = useState(null);
  const [recentUploads, setRecentUploads] = useState([]);
  const [dragover, setDragover] = useState(false);
  const fileRef = useRef(null);

  const handleUpload = useCallback(async (file) => {
    if (!file || uploading) return;
    setUploading(true);
    setResult(null);
    setProgress({ step: 1, pct: 15 });

    const progressInterval = setInterval(() => {
      setProgress(prev => ({
        step: prev.pct > 50 ? 3 : prev.pct > 30 ? 2 : 1,
        pct: Math.min(prev.pct + 2, 85),
      }));
    }, 500);

    try {
      const data = await uploadLease(file);
      clearInterval(progressInterval);
      setProgress({ step: 4, pct: 100 });
      setResult(data);
      setRecentUploads(prev => [
        { name: `${data.fields?.tenant_name || file.name} - ${data.fields?.premises_address || ''}`, time: new Date().toISOString() },
        ...prev,
      ].slice(0, 5));
      showToast('Lease uploaded and indexed!');
      await onUploadComplete();
    } catch (e) {
      clearInterval(progressInterval);
      showToast('Upload failed: ' + e.message, true);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress({ step: 0, pct: 0 }), 1500);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [uploading, onUploadComplete, showToast]);

  const steps = ['Uploading file', 'Extracting text from PDF', 'AI field extraction', 'Generating embeddings & indexing'];

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-800 p-5">
      <h2 className="text-lg font-semibold text-white mb-4">Upload</h2>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          disabled ? 'opacity-50 pointer-events-none border-gray-700' :
          dragover ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-blue-500 hover:bg-blue-500/5'
        }`}
        onClick={() => !disabled && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={(e) => { e.preventDefault(); setDragover(false); handleUpload(e.dataTransfer.files[0]); }}
      >
        <input ref={fileRef} type="file" accept=".pdf" aria-label="Upload lease PDF" className="hidden" onChange={(e) => handleUpload(e.target.files[0])} />
        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center mx-auto mb-3">
          <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3 3 0 013.407 3.645A4.5 4.5 0 0118 19.5H6.75z" />
          </svg>
        </div>
        <p className="text-gray-300 font-medium">Drag & drop a lease PDF here</p>
        <p className="text-gray-500 text-sm mt-1">or click to browse</p>
      </div>

      {/* Progress */}
      {progress.step > 0 && (
        <div className="mt-4 bg-navy-900 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-white">
            {progress.step < 4 && <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />}
            {progress.step >= 4 ? 'Complete!' : 'Processing...'}
          </div>
          <div className="space-y-1.5">
            {steps.map((label, i) => {
              const stepNum = i + 1;
              const isDone = progress.step > stepNum || (progress.step === 4 && stepNum === 4);
              const isActive = progress.step === stepNum;
              return (
                <div key={i} className={`flex items-center gap-2 text-xs ${isDone ? 'text-green-400' : isActive ? 'text-blue-400' : 'text-gray-600'}`}>
                  <span className="w-4 text-center">{isDone ? '\u2713' : isActive ? '\u25CF' : '\u25CB'}</span>
                  {label}
                </div>
              );
            })}
          </div>
          <div className="mt-3 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}

      {/* Upload result */}
      {result && (
        <div className="mt-4 p-4 bg-navy-900 rounded-lg border border-gray-700">
          <h3 className="text-green-400 font-medium text-sm mb-3">Extracted from: {result.filename}</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(result.fields || {})
              .filter(([k, v]) => v && k !== 'key_provisions' && k !== '_citations')
              .map(([k, v]) => {
                let display;
                if (Array.isArray(v)) {
                  display = v.map(item =>
                    typeof item === 'object' ? Object.values(item).join(' | ') : String(item)
                  ).join('; ');
                } else if (typeof v === 'object' && v !== null) {
                  display = JSON.stringify(v);
                } else {
                  display = String(v);
                }
                return (
                  <div key={k} className="bg-navy-600 rounded p-2 border-l-2 border-blue-500">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500">{toTitleCase(k)}</div>
                    <div className="text-sm text-gray-200 truncate">{display}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Recent Uploads */}
      {recentUploads.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Recent Uploads</h3>
          <div className="space-y-1.5">
            {recentUploads.map((u, i) => (
              <div key={i} className="text-xs text-gray-500">
                <span className="text-gray-300">{u.name}</span>
                <br />
                {new Date(u.time).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchCard({ disabled, showToast }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    try {
      const data = await searchLeases(query);
      setResults(data.results || []);
    } catch (e) {
      showToast('Search failed: ' + e.message, true);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-800 p-5">
      <h2 className="text-lg font-semibold text-white mb-4">Search & Intelligence</h2>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            aria-label="Search leases"
            placeholder="Search leases, e.g., 'leases expiring 2027' or 'NNN with CAM over $5'"
            disabled={disabled}
            className="w-full pl-9 pr-4 py-2.5 bg-navy-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={disabled || searching}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Search results */}
      {results && (
        <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No matching leases found.</p>
          ) : (
            results.map((r, i) => (
              <div key={i} className="bg-navy-900 rounded-lg p-3 border-l-3 border-l-blue-500 border border-gray-700/50">
                <div className="text-blue-400 text-xs mb-1">{(r.score * 100).toFixed(1)}% match</div>
                <div className="text-white font-medium text-sm">{r.tenant_name || r.filename}</div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {r.property_address && <span className="text-xs bg-navy-600 text-gray-300 px-2 py-0.5 rounded">{r.property_address}</span>}
                  {r.rentable_square_footage && <span className="text-xs bg-navy-600 text-gray-300 px-2 py-0.5 rounded">{String(r.rentable_square_footage).replace(/\s*SF\s*$/i, '')} SF</span>}
                  {r.expense_recovery_type && <span className="text-xs bg-navy-600 text-gray-300 px-2 py-0.5 rounded">{r.expense_recovery_type}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function LeaseTable({ leases, connected, onRefresh, onViewDetails, showToast }) {
  const handleDelete = async (lease) => {
    if (!lease.id) {
      showToast('Cannot delete: lease has no ID', true);
      return;
    }
    if (!window.confirm(`Delete lease "${lease.tenant_name || lease.filename}"? This cannot be undone.`)) return;
    try {
      await deleteLease(lease.id);
      showToast('Lease deleted');
      await onRefresh();
    } catch (e) {
      showToast('Delete failed: ' + e.message, true);
    }
  };

  return (
    <div className="bg-navy-700 rounded-xl border border-gray-800 p-5">
      <h2 className="text-lg font-semibold text-white mb-4">Indexed Leases</h2>

      {!connected ? (
        <p className="text-gray-500 text-center py-8">Cannot load leases - server unreachable.</p>
      ) : leases.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No leases indexed yet. Upload a PDF to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-700/50">
                <th className="pb-3 pr-4 font-medium">Tenant</th>
                <th className="pb-3 pr-4 font-medium hidden md:table-cell">Summary</th>
                <th className="pb-3 pr-4 font-medium hidden lg:table-cell">Data Tags</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {leases.map((lease, i) => (
                <tr key={lease.id || i} className="group hover:bg-navy-600/30 transition">
                  <td className="py-3 pr-4">
                    <div className="text-white font-medium">{lease.tenant_name || 'Unknown Tenant'}</div>
                    <div className="text-gray-500 text-xs">{lease.property_address || lease.filename}</div>
                  </td>
                  <td className="py-3 pr-4 hidden md:table-cell">
                    <div className="text-gray-400 text-xs max-w-[250px]">
                      {Array.isArray(lease.base_rent_schedule) && lease.base_rent_schedule.length > 0
                        ? `Rent starting at ${lease.base_rent_schedule[0].monthly_rent}/mo`
                        : ''}
                    </div>
                  </td>
                  <td className="py-3 pr-4 hidden lg:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {lease.rentable_square_footage && <span className="text-[10px] bg-navy-500 text-gray-300 px-1.5 py-0.5 rounded">{String(lease.rentable_square_footage).replace(/\s*SF\s*$/i, '')} SF</span>}
                      {lease.expense_recovery_type && <span className="text-[10px] bg-navy-500 text-gray-300 px-1.5 py-0.5 rounded">{lease.expense_recovery_type}</span>}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="text-xs text-gray-400">
                      {lease.lease_term ? (
                        <>{lease.lease_term}</>
                      ) : lease.lease_commencement_date ? (
                        <>From: {lease.lease_commencement_date}</>
                      ) : '-'}
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onViewDetails(lease)}
                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-full transition font-medium whitespace-nowrap"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleDelete(lease)}
                        className="px-2 py-1.5 text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition opacity-0 group-hover:opacity-100"
                        title="Delete"
                        aria-label={`Delete lease for ${lease.tenant_name || 'unknown tenant'}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
