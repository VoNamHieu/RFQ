// Inside Shopify admin (b2b/shopify.html), every screen has its own link — kept in
// step with the screen as the merchant moves around (App Bridge carries it into the
// admin URL), so a reload, Back or a shared link opens the same screen, and admin's
// nav lights the section. Each section is a page of its own (postbuild copies the
// app page there, no rewrites needed); a screen inside one adds its ids:
//   /b2b/shopify/                                    Home
//   /b2b/shopify/companies/                          B2B Company
//   /b2b/shopify/companies/?company=c1               a company (&page=quotes|orders|analytics)
//   /b2b/shopify/companies/?company=c1&location=l1   a location
//   /b2b/shopify/companies/?company=c1&order=%231045 an order
//   /b2b/shopify/companies/?quote=1051074            a quote
//   /b2b/shopify/registrations/?registration=r1      a registration (?form=1: the form)
//   /b2b/shopify/orders-and-rules/                  Orders & rules (a section per list);
//                                                    ?tab=contracts|order-limits|manual-orders|discounts: a list
//   /b2b/shopify/pricing/, analytics/, settings/, store-settings/, order-limit-tests/
export const SHOPIFY_BASE = '/b2b/shopify/';

const SECTIONS = {
  home: '',
  registrations: 'registrations',
  customers: 'companies',
  pricing: 'pricing',
  terms: 'orders-and-rules',
  limitTests: 'order-limit-tests',
  analytics: 'analytics',
  others: 'settings',
  settings: 'store-settings',
};
// Every section's page (postbuild writes one for each).
export const SHOPIFY_SECTION_PATHS = Object.values(SECTIONS).filter(Boolean);
const VIEW_OF_SECTION = Object.fromEntries(Object.entries(SECTIONS).map(([view, path]) => [path, view]));
// A company's pages of their own (companyTab); its other tabs are its one page.
const COMPANY_PAGES = { 'quotes-all': 'quotes', 'orders-all': 'orders', analytics: 'analytics' };
const COMPANY_TAB_OF_PAGE = Object.fromEntries(Object.entries(COMPANY_PAGES).map(([tab, page]) => [page, tab]));
// The link parts this app owns (the rest — Shopify's, ?v= — stay as they are).
const OWN = ['company', 'location', 'order', 'quote', 'registration', 'form', 'page', 'view', 'tab'];

// The screen's link for the state: { path, params }, or null.
export function shopifyLinkFor(state) {
  const at = (section, params = {}) => ({ path: section ? `${SHOPIFY_BASE}${section}/` : SHOPIFY_BASE, params });
  switch (state.view) {
    case 'company': {
      if (!state.selectedCompany) return null;
      const page = COMPANY_PAGES[state.companyTab];
      return at('companies', { company: state.selectedCompany, ...(page ? { page } : {}) });
    }
    case 'location':
      return state.selectedCompany && state.selectedLocation
        ? at('companies', { company: state.selectedCompany, location: state.selectedLocation })
        : null;
    case 'order':
      return state.selectedOrder ? at('companies', { company: state.selectedOrder.companyId, order: state.selectedOrder.orderId }) : null;
    case 'quote':
      return state.selectedQuote ? at('companies', { quote: state.selectedQuote }) : null;
    case 'registration':
      return state.selectedRegistration ? at('registrations', { registration: state.selectedRegistration }) : null;
    case 'form':
      return at('registrations', { form: '1' });
    // Orders & rules: its lists.
    case 'agreements':
      return at('orders-and-rules', { tab: 'contracts' });
    case 'limits':
      return at('orders-and-rules', { tab: 'order-limits' });
    case 'manualOrders':
      return at('orders-and-rules', { tab: 'manual-orders' });
    case 'discounts':
      return at('orders-and-rules', { tab: 'discounts' });
    default:
      return state.view in SECTIONS ? at(SECTIONS[state.view]) : null;
  }
}

// The full URL (path + query) for a link, keeping the query parts that aren't ours.
export function shopifyHref(link, search) {
  const q = new URLSearchParams(search);
  OWN.forEach((k) => q.delete(k));
  Object.entries(link.params).forEach(([k, v]) => q.set(k, v));
  const s = q.toString();
  return `${link.path}${s ? `?${s}` : ''}`;
}

// The screen a URL opens: { view, patch } (patch: the ids it needs), or null.
export function shopifyScreenFor(pathname, search) {
  if (!pathname || !pathname.startsWith(SHOPIFY_BASE.slice(0, -1))) return null;
  const section = pathname.slice(SHOPIFY_BASE.length).split('/').filter(Boolean)[0] || '';
  const q = new URLSearchParams(search);
  if (section === 'companies') {
    if (q.get('quote')) return { view: 'quote', patch: { selectedQuote: q.get('quote') } };
    if (q.get('company') && q.get('order')) {
      return { view: 'order', patch: { selectedCompany: q.get('company'), selectedOrder: { companyId: q.get('company'), orderId: q.get('order') } } };
    }
    if (q.get('company') && q.get('location')) {
      return { view: 'location', patch: { selectedCompany: q.get('company'), selectedLocation: q.get('location') } };
    }
    if (q.get('company')) {
      return { view: 'company', patch: { selectedCompany: q.get('company'), companyTab: COMPANY_TAB_OF_PAGE[q.get('page')] || 'overview' } };
    }
  }
  const TAB_VIEW = { contracts: 'agreements', 'order-limits': 'limits', 'manual-orders': 'manualOrders', discounts: 'discounts' };
  if (section === 'orders-and-rules' && TAB_VIEW[q.get('tab')]) return { view: TAB_VIEW[q.get('tab')], patch: {} };
  if (section === 'registrations') {
    if (q.get('form')) return { view: 'form', patch: {} };
    if (q.get('registration')) return { view: 'registration', patch: { selectedRegistration: q.get('registration') } };
  }
  return section in VIEW_OF_SECTION ? { view: VIEW_OF_SECTION[section], patch: {} } : null;
}

// Whether the ids a screen needs exist (a link to a company or location since deleted
// opens its section instead).
export function shopifyScreenExists(screen, db) {
  const company = (id) => (db.companies || []).find((c) => c.id === id);
  if (screen.view === 'company') return !!company(screen.patch.selectedCompany);
  if (screen.view === 'location') {
    return !!(company(screen.patch.selectedCompany)?.locations || []).find((l) => l.id === screen.patch.selectedLocation);
  }
  if (screen.view === 'quote') return (db.quotes || []).some((q) => q.id === screen.patch.selectedQuote);
  if (screen.view === 'order') return !!(company(screen.patch.selectedOrder.companyId)?.orders || []).some((o) => o.id === screen.patch.selectedOrder.orderId);
  return true;
}
