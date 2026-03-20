import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import LeaseDetail from './components/LeaseDetail';
import Toast from './components/Toast';
import { fetchStats, fetchLeases } from './api';

export default function App() {
  const [view, setView] = useState('dashboard');
  const [selectedLease, setSelectedLease] = useState(null);
  const [leases, setLeases] = useState([]);
  const [stats, setStats] = useState({ count: 0, status: 'unknown' });
  const [connected, setConnected] = useState(true);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, isError = false) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, isError }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [statsData, leasesData] = await Promise.all([fetchStats(), fetchLeases()]);
      setStats(statsData);
      setLeases(leasesData.leases || []);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleViewDetails = (lease) => {
    setSelectedLease(lease);
    setView('detail');
  };

  const handleBack = () => {
    setView('dashboard');
    setSelectedLease(null);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeView={view === 'detail' ? 'dashboard' : view} onNavigate={(v) => { setView(v); setSelectedLease(null); }} />
      <main className="flex-1 overflow-y-auto">
        {view === 'detail' && selectedLease ? (
          <LeaseDetail lease={selectedLease} onBack={handleBack} showToast={showToast} />
        ) : (
          <Dashboard
            leases={leases}
            stats={stats}
            connected={connected}
            onRefresh={loadData}
            onViewDetails={handleViewDetails}
            showToast={showToast}
          />
        )}
      </main>
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} isError={t.isError} />
        ))}
      </div>
    </div>
  );
}
