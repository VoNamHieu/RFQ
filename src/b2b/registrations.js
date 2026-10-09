// Helpers for B2B registrations (the storefront form's submissions).

export const REG_STATUS = {
  pending: { label: 'Pending review', tone: 'attention' },
  approved: { label: 'Approved', tone: 'success' },
  declined: { label: 'Declined', tone: undefined },
};

export const fullName = (r) => `${r.firstName} ${r.lastName}`.trim();
// No company name: a D2C buyer — approving makes them a Shopify customer, in no company.
export const isD2CRegistration = (r) => !(r.company || '').trim();
// What a registration is called in headings and lists: its company, or the buyer.
export const registrationLabel = (r) => (isD2CRegistration(r) ? fullName(r) : r.company);

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

// Records a pending registration matches, and the merchant's options (a Shopify
// customer is never created twice, and an email belongs to one Company only):
//   'same'     — 1. the email is already a contact at the Company it names:
//                   Merge (update their location / role) or Decline.
//   'contact'  — 2. the email is a contact at a different Company: Merge into that
//                   Company, or create the new one and move them there.
//   'company'  — 3. a Company with the same name, different email: Merge into it,
//                   or create a new Company anyway (Shopify allows duplicate names).
//   'customer' — the email is a Shopify customer only: Approve reuses it.
// A D2C registration (no company name) only has 'contact' (Merge into that Company,
// or leave it and become a D2C customer — an email belongs to one company or none)
// and 'customer'.
// `mergeTargets` are the Companies a Merge can go into: the email's Company first, then
// every Company with the same name (Shopify allows several — the merchant picks one).
export function registrationDuplicates(db, reg) {
  const email = (reg.email || '').trim().toLowerCase();
  const name = (reg.company || '').trim().toLowerCase();
  const sameName = name ? (db.companies || []).filter((c) => (c.name || '').trim().toLowerCase() === name) : [];
  const company = sameName[0] || null;
  const contactOf =
    (db.companies || []).find((c) => (c.contacts || []).some((ct) => (ct.email || '').trim().toLowerCase() === email)) || null;
  const customer = (db.customers || []).find((cu) => (cu.email || '').trim().toLowerCase() === email) || null;
  const kind = contactOf ? (sameName.some((c) => c.id === contactOf.id) ? 'same' : 'contact') : sameName.length ? 'company' : customer ? 'customer' : null;
  const mergeTargets = [contactOf, ...sameName].filter((c, i, all) => c && all.findIndex((x) => x && x.id === c.id) === i);
  // Cases 1–3 need the merchant's choice — they're never just approved.
  return { company, sameName, contactOf, customer, kind, mergeTargets, blocking: kind === 'same' || kind === 'contact' || kind === 'company' };
}
