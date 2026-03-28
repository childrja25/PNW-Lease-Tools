const API = '';

export async function fetchStats() {
  const res = await fetch(`${API}/api/stats`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchLeases() {
  const res = await fetch(`${API}/api/leases`);
  if (!res.ok) throw new Error('Failed to fetch leases');
  return res.json();
}

export async function uploadLease(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function searchLeases(query, limit = 10) {
  const res = await fetch(`${API}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function updateLease(id, fields) {
  const res = await fetch(`${API}/api/leases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function deleteLease(id) {
  const res = await fetch(`${API}/api/leases/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Server returned ${res.status}`);
  }
  return res.json();
}

export async function checkHealth() {
  const res = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}
