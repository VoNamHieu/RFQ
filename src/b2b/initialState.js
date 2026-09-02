// Initial store state, applying cross-app persistence + handoff from the RFQ app
// (legacy restoreRfqCompanies + receiveRfqHandoff at b2b/index.html §8190-8262).
import { dbSeed } from './data/db.js';
import { DEMO_STATE_KEY, readJSON, consumeHandoff } from '../shared/persistence.js';
import { normalizeDb, injectRfqCompany, applyQuotePricingTransfer } from './dbHelpers.js';

export function makeBaseState() {
  return {
    view: 'customers', // customers | company | pricing | analytics | settings | quote | location
    selectedCompany: 'c1',
    companyTab: 'pricing',
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
    db: normalizeDb(dbSeed),
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
      s.view = 'company';
      s.selectedCompany = id;
      const lines = handoff.quote && Array.isArray(handoff.quote.lines) ? handoff.quote.lines : [];
      const hasLines = lines.length > 0;
      // openPricing: the RFQ "no B2B pricing" prompt sends the merchant straight to
      // the company's Pricing tab to add a base price.
      s.companyTab = (hasLines && handoff.pricingTransfer) || handoff.openPricing ? 'pricing' : 'locations';
      if (hasLines && handoff.pricingTransfer) {
        s.toast = applyQuotePricingTransfer(s.db, id, lines, handoff.pricingTransfer);
      }
    }
  }
  return s;
}
