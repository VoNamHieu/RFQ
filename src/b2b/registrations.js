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

// Personal inboxes say nothing about the employer, so they never domain-match.
const FREE_EMAIL = new Set(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'live.com', 'proton.me']);
const normName = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\b(co|ltd|jsc|llc|inc|company)\b/g, '').replace(/\s+/g, ' ').trim();

// Which linked Company this applicant most likely belongs to — the "match
// Company" step of registration → review → activate. Strongest signal first:
// already a contact there › same work-email domain › same company name.
export function matchCompany(reg, companies) {
  const email = (reg.email || '').toLowerCase();
  const domain = email.split('@')[1] || '';
  const emailsOf = (c) => (c.contacts || []).map((ct) => (ct.email || '').toLowerCase());

  const contact = companies.find((c) => emailsOf(c).includes(email));
  if (contact) return { company: contact, reason: 'Already a contact at this company' };

  if (domain && !FREE_EMAIL.has(domain)) {
    const byDomain = companies.find((c) => emailsOf(c).some((e) => e.endsWith(`@${domain}`)));
    if (byDomain) return { company: byDomain, reason: `Same email domain (@${domain})` };
  }

  const name = normName(reg.company);
  const byName = name && companies.find((c) => normName(c.name) === name);
  if (byName) return { company: byName, reason: 'Same company name' };

  return null;
}
