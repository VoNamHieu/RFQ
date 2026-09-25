// Initial store state, applying cross-app persistence + handoff from the RFQ app
// (legacy restoreRfqCompanies + receiveRfqHandoff at b2b/index.html §8190-8262).
import { dbSeed } from './data/db.js';
import { registrationSeed } from './data/registrations.js';
import { DEMO_STATE_KEY, readJSON, consumeHandoff } from '../shared/persistence.js';
import { normalizeDb, injectRfqCompany, applyQuotePricingTransfer } from './dbHelpers.js';

export function makeBaseState() {
  return {
    view: 'home', // home | customers | company | pricing | analytics | settings | quote | location | registrations | registration | form
    selectedCompany: 'c1',
    // Registrations (storefront form submissions)
    selectedRegistration: null,
    registrationFilter: 'pending', // pending | approved | declined | all
    registrationSearch: '',
    registrationSort: 'submitted desc', // `${field} ${dir}` — see Registrations SORT_OPTIONS
    formEntry: null, // from Registrations: 'editor' (Edit form) | 'create' (Create form → template picker)
    companyTab: 'pricing',
    homeGuideHidden: false, // app home: "Hide guide" collapses the setup guide
    pricingChooser: false, // open the Pricing screen straight on its type chooser (from app home)
    pricingStatus: null, // open the Pricing screen pre-filtered by status, e.g. 'inactive' (from app home)
    selectedQuote: null,
    selectedLocation: null,
    // Companies list
    listFilter: 'all',
    companySearch: '',
    companySortField: 'name', // name | locations | status
    companySortDir: 'asc', // asc | desc
    // Base pricing pagination (spec §5.1)
    basePricingSearch: '',
    basePage: 1,
    basePageSize: 5,
    // Pricing editor (spec §5.3)
    builder: null, // working policy copy, or null when the editor is closed
    pricingBuilderTab: 'settings', // 'settings' | 'appearance' — the editor's two tabs (god file)
    ruleEdit: null, // index of the conditional-rule open for inline edit
    addRuleMenu: false,
    editorContext: null, // { mode:'edit'|'add-base'|'swap', companyId, swapId }
    // Build pricing from closed quotes (spec §5.4)
    buildQuotes: null, // { companyId, rows:[{sku,quoted,proposed,from}], dest }
    priceBoard: null, // { companyId, search } — resolved-prices preview
    assign: null, // { companyId, mode:'add'|'swap', swapId, selectedId } — assign/swap base
    assignMulti: null, // { policyId } — assign one policy to many companies/customers/tags/global
    addCompany: null, // { step, shopifyId, baseId } — add-company wizard
    emptyMode: false, // "show the app with no data" (fresh-install simulation)
    emptyBackup: null,
    // The seeded registrations came in through the form, so it already exists. It starts
    // unpublished so Home shows the "form isn't published" warning without any clicks.
    db: normalizeDb({ ...dbSeed, registrations: registrationSeed, hasRegistrationForm: true, registrationFormPublished: false, rfqAppInstalled: true }),
    toast: null,
  };
}

export function buildInitialState() {
  const s = makeBaseState();
  // 1) Rebuild every company created/synced from RFQ, persisted across reloads.
  const demo = readJSON(DEMO_STATE_KEY);
  if (demo && demo.b2bCompanies) {
    Object.values(demo.b2bCompanies).forEach((p) => injectRfqCompany(s.db, p));
  }
  // 2) One-shot handoff: open the specific company just handed over from RFQ.
  const handoff = consumeHandoff();
  if (handoff) {
    const id = injectRfqCompany(s.db, handoff);
    if (id) {
      s.selectedCompany = id;
      const lines = handoff.quote && Array.isArray(handoff.quote.lines) ? handoff.quote.lines : [];
      const hasLines = lines.length > 0;
      if (hasLines && handoff.pricingTransfer) {
        // Quote → B2B price transfer lands on the company's Pricing tab.
        s.view = 'company';
        s.companyTab = 'pricing';
        s.toast = applyQuotePricingTransfer(s.db, id, lines, handoff.pricingTransfer);
      } else if (handoff.openPricing) {
        // "Create pricing" from the RFQ "no B2B pricing" prompt → land on the B2B
        // app's Pricing screen. The company is still created so it can be assigned
        // a pricing there.
        s.view = 'pricing';
      } else {
        s.view = 'company';
        s.companyTab = 'locations';
      }
    }
  } else {
    // 3) No handoff: honor a deep-link hash (e.g. RFQ "Create pricing" → Pricing
    // library) so a redirect can land on a view other than the default.
    const view = viewFromHash(typeof window !== 'undefined' ? window.location.hash : '');
    if (view) s.view = view;
  }
  return s;
}

// Map the URL hash (kept in sync by the nav's `url`s) to an initial view.
function viewFromHash(hash) {
  const map = {
    '#/b2b': 'home',
    '#/b2b/registrations': 'registrations',
    '#/b2b/pricing': 'pricing',
    '#/b2b/company': 'customers',
    '#/b2b/analytics': 'analytics',
    '#/b2b/settings': 'settings',
  };
  return map[hash] || null;
}
