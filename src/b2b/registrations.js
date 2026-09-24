// Helpers for B2B registrations (the storefront form's submissions).

export const REG_STATUS = {
  pending: { label: 'Pending review', tone: 'attention' },
  approved: { label: 'Approved', tone: 'success' },
  declined: { label: 'Declined', tone: undefined },
};

export const fullName = (r) => `${r.firstName} ${r.lastName}`.trim();

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Today as YYYY-MM-DD in the merchant's local time (toISOString is UTC, which is
// still "yesterday" early in the morning for UTC+ timezones like Vietnam).
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const pendingCount =(db) => (db.registrations || []).filter((r) => r.status === 'pending').length;
