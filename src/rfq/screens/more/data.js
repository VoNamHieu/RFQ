// Static demo data for the RFQ app's "View more" screens (Pricing plan, What's New).
// Copy comes from the production app's English locales (pricingPlan.json,
// translation.json › pricingPlan, whatsNew.json); plan prices mirror the
// production test fixtures. Rich text uses **bold** markers (see Rich in shared.jsx).

// ── Pricing plan ────────────────────────────────────────────────────────────
export const ID_FREE_PLAN = 3;
export const ID_STARTER_PLAN = 4;
export const ID_PRO_PLAN = 5;
export const ID_ENTERPRISE_PLAN = 6; // "Pro Plus" — the B2B plan

export const CHARGE_TYPE_FREE = 0;
export const CHARGE_TYPE_MONTHLY = 1;
export const CHARGE_TYPE_YEARLY = 2;

// What the billing API returns (GET plans): monthly price + yearly discount %.
export const LIST_PLAN = [
  { id: ID_FREE_PLAN, price: 0, discount: 0 },
  { id: ID_STARTER_PLAN, price: 14.99, discount: 20 },
  { id: ID_PRO_PLAN, price: 24.99, discount: 20 },
  { id: ID_ENTERPRISE_PLAN, price: 99.99, discount: 20 },
];

// The demo shop uses the B2B features (Shopify companies, catalogs), so it is
// on Pro Plus, billed yearly. It is a regular (non-Plus) Shopify plan, so the
// "Recommend" ribbon and primary plan buttons show.
export const CURRENT_SUBSCRIPTION = { planId: ID_ENTERPRISE_PLAN, chargeType: CHARGE_TYPE_YEARLY };
export const IS_SHOPIFY_PLUS = false;

export const PLAN_DATA = {
  [ID_FREE_PLAN]: {
    title: 'Free',
    desc: 'Best for testing and gaining benefits',
    startText: 'All you need to kick start:',
    packages: [
      '**10** quotes/ month',
      'Hide price (**50** product variants)',
      '**Basic** Form Builder Settings',
      '**Basic** email notification',
      'PDF: quote & invoice',
      'Max upload file size: **5MB**',
      '24/7 support',
    ],
  },
  [ID_STARTER_PLAN]: {
    title: 'Starter',
    desc: 'Best for new and growing stores',
    startText: 'All in Free, plus:',
    packages: [
      '**50** quotes/ month',
      'Hide price **(Unlimited)**',
      'Convert quote to draft order',
      'Sync data to many platforms',
      'Export PDF invoice',
      'Max upload file size: **10MB**',
      'Members and permission: **2 seats**',
      '**Bulk edit** quote information',
      'Remove Omega branding',
    ],
  },
  [ID_PRO_PLAN]: {
    title: 'Pro',
    desc: 'Best for stores of any sizes',
    startText: 'All in Starter, plus:',
    packages: [
      '**Unlimited** quotes/ month',
      '**Tax, Discount, Shipping** settings',
      '**Multi-language / Advanced** Form',
      'Members and permission: **Unlimited**',
      'Sync data using Webhook',
      'PDF: Add custom sections',
      'Customer account UI',
      'Advanced automation',
      '**Basic** or **Advanced** customization (+ fee)',
      { text: '**Profit leak report**', isNew: true },
    ],
  },
  [ID_ENTERPRISE_PLAN]: {
    title: 'Pro Plus',
    desc: 'Best for Shopify Plus stores, and B2B stores.',
    startText: 'All in Pro, plus:',
    packages: [
      'Get **instant** quote',
      '**Auto fill** logged-in B2B customer data',
      '**B2B** Catalog & Payment terms',
      'Separate settings of **B2B storefront**',
      'Quote checkout extension',
      { text: 'API Gateway access', isNew: true },
      { text: 'Create orders with deposit (available with Shopify Plus)', isNew: true },
      { text: '**AI quote analysis**', isNew: true },
      { text: '**Salesforce** integration', isNew: true, logo: 'salesforce' },
      { text: '**WhatsApp** notifications', isNew: true, logo: 'whatsapp' },
    ],
  },
};

// Add discount code modal › Select plan (paidPlanOptions).
export const PAID_PLAN_OPTIONS = [
  { value: ID_STARTER_PLAN, label: 'Starter' },
  { value: ID_PRO_PLAN, label: 'Pro' },
  { value: ID_ENTERPRISE_PLAN, label: 'Pro Plus' },
];

// "Show pricing details" comparison table (pricingPlanDetailSections).
// values: [Free, Starter, Pro, Pro Plus] — true = check mark, false = "-", string = text.
const Y = true;
const N = false;
export const DETAIL_SECTIONS = [
  {
    id: 'quoteAndHide',
    title: 'Request for quote & Hide price',
    features: [
      ['Quote limit', ['10 quotes / month', '50 quotes / month', 'Unlimited', 'Unlimited']],
      ['Quote button settings', ['Product page only', 'Position, product/ customer filters, appearance', Y, Y]],
      ['B2B storefront settings', [N, N, N, Y]],
      ['Get instant quote', [N, N, Y, Y]],
      ['Quote cart widget', [Y, Y, Y, Y]],
      ['Quote history widget', [N, N, Y, Y]],
      ['Hide price settings', ['Up to 50 variants, Product page only', Y, Y, Y]],
      ['Hide Add To Cart threshold', [N, N, Y, Y]],
      ['Single translation quote button & messages', [N, Y, Y, Y]],
      ['Multi-language quote button & messages', [N, N, Y, Y]],
      ['Quote checkout extension', [N, N, N, Y]],
    ],
  },
  {
    id: 'quoteForm',
    title: 'Quote form',
    features: [
      ['Basic quote form builder', [Y, Y, Y, Y]],
      ['Auto-fill B2B data', [N, N, N, Y]],
      ['Customer info settings', ['Basic', 'Basic', Y, Y]],
      ['After submit settings', [N, Y, Y, Y]],
      ['Form appearance', [N, N, Y, Y]],
      ['Single translation quote form', [N, Y, Y, Y]],
      ['Multi-language quote form', [N, N, Y, Y]],
    ],
  },
  {
    id: 'costManagement',
    title: 'Cost management',
    features: [
      ['Discount settings', [N, N, Y, Y]],
      ['Shipping settings', [N, N, Y, Y]],
      ['Tax settings', [N, N, Y, Y]],
    ],
  },
  {
    id: 'quoteSubmission',
    title: 'Quote submission',
    features: [
      ['B2B payment terms / catalog', [N, N, N, Y]],
      ['Create quote manually', [Y, Y, Y, Y]],
      ['Export quote PDF', [Y, Y, Y, Y]],
      ['Create draft order', [N, Y, Y, Y]],
      ['Draft order currency', [N, Y, Y, Y]],
      ['Export invoice PDF', [N, Y, Y, Y]],
      ['Bulk edit', [N, Y, Y, Y]],
    ],
  },
  {
    id: 'customerAccount',
    title: 'Customer account',
    features: [
      ['Customer account settings', [N, N, Y, Y]],
      ['Reorder', [N, N, Y, Y]],
    ],
  },
  {
    id: 'other',
    title: 'Others',
    features: [
      ['PDF Template (Custom Section)', ['Basic', 'Basic', Y, Y]],
      ['Email notifications (Admin/Vendor)', ['Admin only', 'Admin only', Y, Y]],
      ['Proposal email', ['Basic', Y, Y, Y]],
      ['Proposal email (Accept & Reject option)', [N, Y, Y, Y]],
      ['Multi-language Proposal email', [N, N, '2 languages', 'Unlimited']],
      ['Proposal email (Review & Negotiate option)', [N, Y, Y, Y]],
      ['Auto-response email with quotation PDF', [N, N, Y, Y]],
      ['Abandoned quote reminder', [N, Y, Y, Y]],
      ['Sync data', [N, 'Shopify, HubSpot, Mailchimp', Y, Y]],
      ['Members & permissions', [N, '2 seats, and limited permissions', Y, Y]],
      ['Remove Omega branding', [N, Y, Y, Y]],
      ['Other notifications', [N, Y, Y, Y]],
      ['Lead scoring', [Y, Y, Y, Y]],
      ['Profit leak report', [N, N, Y, Y]],
      ['AI quote analysis', [N, N, N, Y]],
      ['API Gateway', [N, N, N, Y]],
      ['Salesforce integration', [N, N, N, Y]],
    ],
  },
  {
    id: 'automation',
    title: 'Automation',
    features: [
      ['Export quote PDF', [N, N, Y, Y]],
      ['Send proposal email', [N, N, Y, Y]],
      ['Direct to Checkout page', [N, Y, Y, Y]],
    ],
  },
  {
    id: 'customization',
    title: 'Customization',
    features: [
      ['Basic customization support', [N, N, Y, Y]],
      ['Advanced customization support (Extra-fee)', [N, N, Y, Y]],
    ],
  },
];

// Downgrade confirm modal: settings lost when moving from one plan to a lower one.
const LOST_LABELS = {
  quoteLimit: 'Quote limit',
  quoteButtonSettings: 'Quote button settings',
  b2bStorefrontSettings: 'B2B storefront settings',
  getInstantQuote: 'Get instant quote',
  quoteHistoryWidget: 'Quote history widget',
  hidePriceSettings: 'Hide price settings',
  singleTranslationQuoteButton: 'Single translation quote button',
  multipleLanguageQuoteButtonMessages: 'Multi-language quote button & messages',
  autoFillB2BData: 'Auto-fill B2B data',
  customerInfoSettings: 'Customer info settings',
  afterSubmitSettings: 'After submit settings',
  singleTranslationQuoteButtonMessages: 'Single translation quote button & messages',
  formAppearance: 'Form appearance',
  singleTranslationQuoteForm: 'Single translation quote form',
  multipleLanguageQuoteForm: 'Multi-language quote form',
  discountSettings: 'Discount settings',
  shippingSettings: 'Shipping settings',
  taxSettings: 'Tax settings',
  b2bPaymentTermsCatalog: 'B2B payment terms / catalog',
  createDraftOrder: 'Create draft order',
  draftOrderCurrency: 'Draft order currency',
  exportInvoicePDF: 'Export invoice PDF',
  bulkEdit: 'Bulk edit',
  customerAccountSettings: 'Customer account settings',
  reorder: 'Reorder',
  pdfTemplateCustomSection: 'PDF Template (Custom Section)',
  emailNotificationsAdminVendor: 'Email notifications (Admin/Vendor)',
  proposalEmail: 'Proposal email',
  proposalEmailAcceptReject: 'Proposal email (Accept & Reject option)',
  proposalEmailMultiLanguage: 'Multi-language Proposal email',
  proposalEmailUnlimitedLanguages: 'Unlimited Proposal email languages (limited to 2 languages)',
  proposalEmailReviewNegotiate: 'Proposal email (Review & Negotiate option)',
  autoResponseEmailWithPDF: 'Auto-response email with quotation PDF',
  syncData: 'Sync data',
  membersAndPermission: 'Members & permission',
  removeOmegaBranding: 'Remove Omega branding',
  otherNotification: 'Other notification',
  basicCustomizationSupport: 'Basic customization support',
  advancedCustomizationSupport: 'Advanced customization support (Extra-fee)',
  checkoutButton: 'Quote checkout extension',
  hideAddCartThreshold: 'Hide Add To Cart threshold',
  apiGateway: 'API Gateway',
  salesforceIntegration: 'Salesforce integration',
};

const LOST_KEYS = {
  [ID_PRO_PLAN]: {
    [ID_STARTER_PLAN]: ['quoteLimit', 'quoteButtonSettings', 'getInstantQuote', 'quoteHistoryWidget', 'multipleLanguageQuoteButtonMessages', 'customerInfoSettings', 'formAppearance', 'multipleLanguageQuoteForm', 'discountSettings', 'shippingSettings', 'taxSettings', 'customerAccountSettings', 'reorder', 'pdfTemplateCustomSection', 'emailNotificationsAdminVendor', 'proposalEmailMultiLanguage', 'autoResponseEmailWithPDF', 'syncData', 'membersAndPermission', 'basicCustomizationSupport', 'advancedCustomizationSupport', 'hideAddCartThreshold'],
    [ID_FREE_PLAN]: ['quoteLimit', 'quoteButtonSettings', 'getInstantQuote', 'quoteHistoryWidget', 'hidePriceSettings', 'singleTranslationQuoteButton', 'multipleLanguageQuoteButtonMessages', 'customerInfoSettings', 'afterSubmitSettings', 'formAppearance', 'multipleLanguageQuoteForm', 'discountSettings', 'shippingSettings', 'taxSettings', 'createDraftOrder', 'draftOrderCurrency', 'exportInvoicePDF', 'bulkEdit', 'customerAccountSettings', 'reorder', 'pdfTemplateCustomSection', 'emailNotificationsAdminVendor', 'proposalEmail', 'proposalEmailAcceptReject', 'proposalEmailMultiLanguage', 'proposalEmailReviewNegotiate', 'autoResponseEmailWithPDF', 'syncData', 'membersAndPermission', 'removeOmegaBranding', 'otherNotification', 'basicCustomizationSupport', 'advancedCustomizationSupport', 'hideAddCartThreshold'],
  },
  [ID_STARTER_PLAN]: {
    [ID_FREE_PLAN]: ['quoteLimit', 'quoteButtonSettings', 'hidePriceSettings', 'singleTranslationQuoteButton', 'afterSubmitSettings', 'singleTranslationQuoteButtonMessages', 'createDraftOrder', 'draftOrderCurrency', 'exportInvoicePDF', 'bulkEdit', 'proposalEmail', 'proposalEmailAcceptReject', 'proposalEmailReviewNegotiate', 'syncData', 'membersAndPermission', 'removeOmegaBranding', 'otherNotification'],
  },
  [ID_ENTERPRISE_PLAN]: {
    [ID_PRO_PLAN]: ['b2bStorefrontSettings', 'autoFillB2BData', 'b2bPaymentTermsCatalog', 'checkoutButton', 'proposalEmailUnlimitedLanguages', 'apiGateway', 'salesforceIntegration'],
    [ID_STARTER_PLAN]: ['quoteLimit', 'quoteButtonSettings', 'b2bStorefrontSettings', 'getInstantQuote', 'quoteHistoryWidget', 'multipleLanguageQuoteButtonMessages', 'autoFillB2BData', 'customerInfoSettings', 'formAppearance', 'multipleLanguageQuoteForm', 'discountSettings', 'shippingSettings', 'taxSettings', 'b2bPaymentTermsCatalog', 'customerAccountSettings', 'reorder', 'pdfTemplateCustomSection', 'emailNotificationsAdminVendor', 'proposalEmailMultiLanguage', 'autoResponseEmailWithPDF', 'syncData', 'membersAndPermission', 'basicCustomizationSupport', 'advancedCustomizationSupport', 'checkoutButton', 'hideAddCartThreshold', 'apiGateway', 'salesforceIntegration'],
    [ID_FREE_PLAN]: ['quoteLimit', 'quoteButtonSettings', 'b2bStorefrontSettings', 'getInstantQuote', 'quoteHistoryWidget', 'hidePriceSettings', 'singleTranslationQuoteButton', 'multipleLanguageQuoteButtonMessages', 'autoFillB2BData', 'customerInfoSettings', 'afterSubmitSettings', 'formAppearance', 'singleTranslationQuoteForm', 'multipleLanguageQuoteForm', 'discountSettings', 'shippingSettings', 'taxSettings', 'b2bPaymentTermsCatalog', 'createDraftOrder', 'draftOrderCurrency', 'exportInvoicePDF', 'bulkEdit', 'customerAccountSettings', 'reorder', 'pdfTemplateCustomSection', 'emailNotificationsAdminVendor', 'proposalEmail', 'proposalEmailAcceptReject', 'proposalEmailMultiLanguage', 'proposalEmailReviewNegotiate', 'autoResponseEmailWithPDF', 'syncData', 'membersAndPermission', 'removeOmegaBranding', 'otherNotification', 'basicCustomizationSupport', 'advancedCustomizationSupport', 'checkoutButton', 'hideAddCartThreshold', 'apiGateway', 'salesforceIntegration'],
  },
};

export const lostFeatures = (fromPlanId, toPlanId) =>
  (LOST_KEYS[fromPlanId]?.[toPlanId] || []).map((key) => LOST_LABELS[key]);

// ── What's New ──────────────────────────────────────────────────────────────
// Tab order is fixed so the nav stays stable regardless of entry order.
export const CATEGORY_ORDER = ['quoting', 'integration', 'notification', 'analytics'];
export const CATEGORY_LABELS = {
  all: 'All',
  quoting: 'Quoting',
  integration: 'Integrations',
  notification: 'Notifications',
  analytics: 'Analytics',
};

// cta.view → navigate inside the prototype; cta.toast → deeper page of the full app.
export const CHANGELOG_ENTRIES = [
  {
    id: 'quote_product_sources',
    date: '2026-09-28',
    category: 'quoting',
    icon: 'product',
    title: 'Add quote products from your catalog, store, or B2B pricing',
    description:
      "Add products to a quote from three sources with the same picker: the company's Shopify catalog at catalog prices, your whole store, or a base pricing switched on for the company in the B2B app. Lines already on the quote are marked, and picking one from a different source replaces its price without touching the quantity.",
    isNew: true,
    cta: { label: 'Open quotes', view: 'submissionList' },
    helpUrl: 'https://help.omegatheme.com/en/article/8-quote-management-1wpltp4/',
  },
  {
    id: 'quote_prices_to_b2b',
    date: '2026-09-21',
    category: 'quoting',
    icon: 'cash-dollar',
    title: 'Turn closed quote prices into B2B pricing',
    description:
      "On a closed quote, save the prices you agreed straight into the company's B2B pricing — review each one, drop the ones you don't want, then add them to an existing base pricing or create a new one.",
    cta: { label: 'Open quotes', view: 'submissionList' },
    helpUrl: 'https://help.omegatheme.com/en/article/sync-data-from-quotesnap-rfq-to-quotesnap-b2b-149j3fx/',
  },
  {
    id: 'b2b_relationship',
    date: '2026-09-18',
    category: 'quoting',
    icon: 'organization',
    title: 'B2B relationship on quote details',
    description:
      'See whether a requester already belongs to a Shopify company, pick or create one, add them as a buyer at a location, and sync the company to QuoteSnap B2B — all from the quote details page.',
    cta: { label: 'Open quotes', view: 'submissionList' },
    helpUrl: 'https://help.omegatheme.com/en/article/sync-data-from-quotesnap-rfq-to-quotesnap-b2b-149j3fx/',
  },
  {
    id: 'webhook_events',
    date: '2026-09-15',
    category: 'integration',
    icon: 'connect',
    title: 'Webhook events for Zapier, Make & more',
    description:
      'Send a webhook to any URL when a new quote is submitted — connect Zapier, Make, or your own endpoint from Other systems.',
    cta: { label: 'Set up webhooks', toast: 'Opens Other systems integration in the full app' },
    helpUrl: 'https://help.omegatheme.com/en/article/webhook-setting-guide-nkz0yd/',
  },
  {
    id: 'whatsapp_notifications',
    date: '2026-09-14',
    category: 'notification',
    logo: 'whatsapp',
    title: 'WhatsApp notifications',
    description:
      'Get quote submit, accept and reject alerts on WhatsApp — send to one or more recipient numbers. Set it up in Notification settings.',
    cta: { label: 'Set up WhatsApp', toast: 'Opens WhatsApp notification settings in the full app' },
    helpUrl: 'https://help.omegatheme.com/en/article/others-4db6ev/',
  },
  {
    id: 'salesforce_integration',
    date: '2026-09-04',
    category: 'integration',
    logo: 'salesforce',
    title: 'Salesforce integration',
    description:
      'Automatically sync submitted quotes to Salesforce as opportunities, so your CRM and QuoteSnap stay in sync without manual entry.',
    cta: { label: 'Connect Salesforce', toast: 'Opens Salesforce integration in the full app' },
    helpUrl: 'https://help.omegatheme.com/en/article/sync-quotes-to-salesforce-1fulwso/',
  },
  {
    id: 'dealhub_negotiation',
    date: '2026-08-28',
    category: 'quoting',
    icon: 'chat',
    title: 'DealHub: negotiate quotes',
    description:
      'Let customers counter-offer and negotiate in real time. Review each version side by side and approve or reject right from the quote list.',
    cta: { label: 'Go to quotes', view: 'submissionList' },
    helpUrl: 'https://help.omegatheme.com/en/article/negotiate-quotes-with-quotesnap-dealhub-1v3wupx/',
  },
  {
    id: 'quote_cost_margin',
    date: '2026-08-22',
    category: 'analytics',
    icon: 'chart-vertical',
    title: 'Quote cost & margin',
    description:
      'See the profit margin on every quote, catch low-margin deals with the Profit Leak report, and get AI insights before you approve.',
    cta: { label: 'View Profit Leak report', toast: 'Opens Profit Leak report in the full app' },
    helpUrl: 'https://help.omegatheme.com/en/article/cost-management-shipping-tax-settings-cnolyx/',
  },
  {
    id: 'cost_management',
    date: '2026-07-15',
    category: 'quoting',
    icon: 'cash-dollar',
    title: 'Cost management: shipping, tax & discount',
    description:
      'Add shipping fees, tax and discounts to quotes with custom rules, so you control the final price customers see.',
    cta: { label: 'Open Cost management', view: 'configuration', patch: { configSection: 'costManagement' } },
    helpUrl: 'https://help.omegatheme.com/en/article/cost-management-shipping-tax-settings-cnolyx/',
  },
];
