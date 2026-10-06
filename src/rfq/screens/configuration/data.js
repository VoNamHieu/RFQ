// Static demo data for the RFQ "Configuration" page (production: /app_settings →
// components/Settings). Values mirror what the production API returns for a shop
// on a paid plan; names/emails match the rest of the RFQ prototype (QuoteSnap
// store, Charles N as owner).

import shopifyImg from './assets/shopify.jpg';
import mailchimpImg from './assets/mailchimp.jpg';
import salesforceImg from './assets/saleforce.jpg';
import hubspotImg from './assets/hubspot.jpg';
import otherSystemImg from './assets/integration-other.png';
import apiGatewayImg from './assets/apigateway.jpg';
import googleApiImg from './assets/google_api.png';
import gmailImg from './assets/gmail_icon.png';
import office365Img from './assets/office_365.png';
import sendgridImg from './assets/sendgrid.png';
import emailOtherImg from './assets/email-other.png';
import whatsappImg from './assets/whatsapp.svg';
import slackImg from './assets/slack-icon.svg';
import telegramImg from './assets/telegram.png';

export const SHOP = {
  domain: 'quotesnap.myshopify.com',
  initials: 'Q',
  ownerEmail: 'charles@quotesnap.co',
};

export const TODAY = '2026-10-06';

// Settings that the page-level contextual save bar covers (production Settings/index.jsx
// `allSettings` + email settings + vendor data + assignment settings + abandoned reminder).
export const INITIAL_SETTINGS = {
  custom_quote: { prefix: '', suffix: '' },
  pdf_name_format: { quote: 'Quote-{{quote_id}}-{{create_date}}', invoice: 'Invoice-{{quote_id}}-{{order_date}}' },
  name_format: { order: 'first_last' },
  address_format: { displayDirection: 'vertical' },
  quote_reminder: 3,
  custom_css: '/*write your custom CSS here*/\n.omg-rfq-button {\n  border-radius: 6px;\n  letter-spacing: 0.02em;\n}\n',
  email: { send_to_customer: 1, send_to_admin: 1, attach_quote_pdf_to_auto_response: 1 },
  vendor: { send_to_vendor: 0 },
  assignment: {
    type: 'customize',
    condition: [
      {
        status: 1,
        assign_to: 'linh@quotesnap.co',
        updated_at: '09/18/2026 10:24:05',
        condition_type: 'product',
        type_product: 'tag',
        type_product_operator: 'contain',
        type_product_value: 'jersey',
        type_customer: 'customer',
        type_customer_value: '',
        type_quote: 'country',
        type_quote_operator: 'inset',
        type_quote_value: '',
        type_quote_state_value: '',
        type_lead_score_tier: '',
      },
      {
        status: 1,
        assign_to: 'minh@quotesnap.co',
        updated_at: '09/24/2026 16:02:41',
        condition_type: 'quote',
        type_product: 'tag',
        type_product_operator: 'contain',
        type_product_value: '',
        type_customer: 'customer',
        type_customer_value: '',
        type_quote: 'quote_value',
        type_quote_operator: 'greater',
        type_quote_value: '5000',
        type_quote_state_value: '',
        type_lead_score_tier: '',
      },
      {
        status: 0,
        assign_to: 'linh@quotesnap.co',
        updated_at: '10/01/2026 09:12:17',
        condition_type: 'lead_score',
        type_product: 'tag',
        type_product_operator: 'contain',
        type_product_value: '',
        type_customer: 'customer',
        type_customer_value: '',
        type_quote: 'country',
        type_quote_operator: 'inset',
        type_quote_value: '',
        type_quote_state_value: '',
        type_lead_score_tier: 'high',
      },
    ],
  },
  abandoned: { enabled: true, mode: 'auto', time_value: 2, time_unit: 'days' },
};

// Sender email connection (production emailSettings slice). null = not connected.
export const INITIAL_EMAIL_ACCOUNT = { account_type: 'gmail_api', email: 'charles@quotesnap.co', name: 'Charles N' };

export const EMAIL_PROVIDERS = [
  { account_type: 'gmail_api', content: 'Sign in with Google', image: googleApiImg, oauth: true },
  { account_type: 'gmail', content: 'Gmail SMTP', image: gmailImg, email_smtp: 'smtp.gmail.com', email_user: '', email_port: '465', email_encryption: 'ssl' },
  { account_type: 'office_365', content: 'Sign in with Office 365', image: office365Img, oauth: true },
  { account_type: 'sendgrid', content: 'SendGrid', image: sendgridImg, email_smtp: 'smtp.sendgrid.net', email_user: 'apikey', email_port: '465', email_encryption: 'ssl', email_from: '' },
  { account_type: 'other', content: 'Other', image: emailOtherImg, email_smtp: '', email_user: '', email_port: '465', email_encryption: 'ssl' },
];

// Members and permission (DealHub branch — the current salesperson version).
export const DEALHUB_PERMISSIONS = ['update_quote', 'create_quote', 'send_email', 'counter_review'];
export const INITIAL_MEMBERS = [
  { id: 'sp-1', name: 'Linh Tran', email: 'linh@quotesnap.co', created_at: 'March 12, 2026', status: 1, permissions: DEALHUB_PERMISSIONS },
  { id: 'sp-2', name: 'Minh Pham', email: 'minh@quotesnap.co', created_at: 'May 4, 2026', status: 1, permissions: ['update_quote', 'send_email'] },
  { id: 'sp-3', name: '', email: 'an.nguyen@quotesnap.co', created_at: 'September 28, 2026', status: 0, is_pending: true, permissions: DEALHUB_PERMISSIONS },
  { id: 'sp-4', name: 'Bao Le', email: 'bao@quotesnap.co', created_at: 'January 20, 2026', status: 0, permissions: ['update_quote'] },
];

export const INTEGRATIONS = {
  shopify: [
    { type: 'shopify', title: 'Shopify', img: shopifyImg, integrated: true },
  ],
  email: [{ type: 'mailchimp', title: 'MailChimp', img: mailchimpImg }],
  crm: [
    { type: 'salesforce', title: 'Salesforce', img: salesforceImg },
    { type: 'hubspot', title: 'HubSpot', img: hubspotImg, inactive: true },
    { type: 'other_integrations', title: 'Other systems', img: otherSystemImg },
    { type: 'api_gateway', title: 'API Gateway', img: apiGatewayImg },
  ],
};

export const NOTIFICATION_CHANNELS = [
  { type: 'whatsapp', title: 'WhatsApp', logo: whatsappImg, featured: true },
  { type: 'slack', title: 'Slack', logo: slackImg },
  { type: 'telegram', title: 'Telegram', logo: telegramImg },
];

// Lead scoring list (production leadScoringSlice `list`); names longer than ~100px
// are truncated in the table with a tooltip.
export const INITIAL_LEAD_SCORES = [
  { id: 1, name: 'B2B wholesale fit', is_active: true, created_at: '2026-08-14' },
  { id: 2, name: 'Enterprise prospects (EU)', is_active: false, created_at: '2026-09-22' },
];

// Cost management → Discount list (production discount slice).
export const INITIAL_DISCOUNTS = [
  {
    id: 101,
    title: 'Wholesale 10% off',
    reason_message: 'Volume pricing for approved wholesale accounts ordering 50 or more units per quote',
    apply_type: 'quote',
    status: 1,
    end_date: null,
  },
  {
    id: 102,
    title: 'Team kit bundle',
    reason_message: 'Club and school team orders of 20+ jerseys',
    apply_type: 'line-item',
    status: 1,
    end_date: '2026-12-31',
  },
  {
    id: 103,
    title: 'Summer clearance',
    reason_message: 'Clearance pricing on last season training wear',
    apply_type: 'line-item',
    status: 1,
    end_date: '2026-08-31',
  },
  {
    id: 104,
    title: 'Returning B2B buyer',
    reason_message: 'Thank-you discount for companies with three or more accepted quotes',
    apply_type: 'quote',
    status: 0,
    end_date: null,
  },
];

export const INITIAL_SHIPPING = {
  label: 'Shipping',
  type: 'CUSTOM',
  custom_rules: [
    { limit_price: '500.00', shipping_price: '25.00', type: 'SMALLER' },
    { limit_price: '2000.00', shipping_price: '15.00', type: 'SMALLER' },
    { limit_price: '2000.00', shipping_price: '0.00', type: 'BIGGER_OR_EQUAL' },
  ],
};

export const INITIAL_TAX = { is_use_shopify_tax: 1, show_price_before_tax: 0, tax_label: 'Tax' };

// Customer Account → Permission conditions.
const ALL_ON = (keys) => Object.fromEntries(keys.map((k) => [k, 1]));
export const PERMISSION_KEYS = ['export_pdf', 'accept_quote', 'reject_quote', 'view_detail'];
export const CUSTOMER_INFO_KEYS = ['show_contact', 'show_billing', 'show_shipping', 'show_payment_term'];
export const PRODUCT_INFO_KEYS = [
  'show_quantity',
  'show_variant',
  'show_sku',
  'show_properties',
  'show_wished_price',
  'show_price',
  'show_total',
  'show_subtotal',
  'show_shipping',
  'show_tax',
  'show_discount',
];

const conditionsFor = ({ tag = '', tagKey = 'has_tag', countries = [], countryKey = 'inset', type = 'dtc', typeKey = 'equal' } = {}) => [
  { type: 'tag', condition: { key: tagKey, value: tag } },
  { type: 'country', condition: { key: countryKey, value: countries } },
  { type: 'type', condition: { key: typeKey, value: type } },
];

export const newCondition = () => ({
  title: 'Condition',
  status: false,
  condition_type: 'tag',
  conditions: conditionsFor(),
  permissions: { export_pdf: 0, view_detail: 0, accept_quote: 0, reject_quote: 0 },
  customer_information: { show_billing: 0, show_contact: 0, show_shipping: 0, show_payment_term: 0 },
  product_information: Object.fromEntries(PRODUCT_INFO_KEYS.map((k) => [k, 0])),
  reorder: {
    status: false,
    button_visibility: { quote_list: true, quote_detail: true },
    button_condition: 'anytime',
    button_conditions: { converted_to_draft_orders: false, after_quote_expiration: false },
  },
});

export const INITIAL_ACCOUNT_CONDITIONS = [
  {
    ...newCondition(),
    id: 1,
    title: 'All customers',
    condition_type: 'default',
    // The default condition and the other conditions are mutually exclusive
    // (production customerAccountSlice `updateConditionStatusFn`); "Wholesale buyers" is on.
    status: 0,
    permissions: { ...ALL_ON(PERMISSION_KEYS), all_permissions: 1 },
    customer_information: { ...ALL_ON(CUSTOMER_INFO_KEYS), all_permissions: 1 },
    product_information: { ...ALL_ON(PRODUCT_INFO_KEYS), show_wished_price: 0, show_properties: 0 },
  },
  {
    ...newCondition(),
    id: 2,
    title: 'Wholesale buyers',
    condition_type: 'tag',
    status: 1,
    conditions: conditionsFor({ tag: 'wholesale' }),
    permissions: { ...ALL_ON(PERMISSION_KEYS), all_permissions: 1 },
    customer_information: { ...ALL_ON(CUSTOMER_INFO_KEYS), all_permissions: 1 },
    product_information: { ...ALL_ON(PRODUCT_INFO_KEYS), all_permissions: 1 },
    reorder: {
      status: true,
      button_visibility: { quote_list: true, quote_detail: true },
      button_condition: 'conditions',
      button_conditions: { converted_to_draft_orders: true, after_quote_expiration: false },
    },
  },
  {
    ...newCondition(),
    id: 3,
    title: 'Southeast Asia buyers',
    condition_type: 'country',
    status: 0,
    conditions: conditionsFor({ countries: ['VN', 'SG', 'TH'] }),
    permissions: { export_pdf: 1, view_detail: 1, accept_quote: 0, reject_quote: 0 },
    customer_information: { show_billing: 1, show_contact: 1, show_shipping: 1, show_payment_term: 0 },
    product_information: { ...ALL_ON(PRODUCT_INFO_KEYS), show_wished_price: 0 },
  },
];

export const ACCOUNT_TRANSLATIONS = {
  page_title: 'Quotes',
  all: 'All',
  new_created: 'New',
  new_created_by_admin: 'Created by store',
  read: 'Read',
  deal_closed: 'Accepted',
  deal_rejected: 'Rejected',
  trashed: 'Trashed',
  updated: 'Updated',
  quoted: 'Quoted',
  canceled: 'Canceled',
  new_assigned: 'Assigned',
  submitted: 'Submitted',
  created: 'Created',
  received: 'Received',
  pending: 'Pending',
  draft_order_created: 'Draft order created',
  draft_order_updated: 'Draft order updated',
  auto_confirmed: 'Auto confirmed',
  pdf_exported: 'PDF exported',
  email_sent: 'Email sent',
  manage_your_quote_list: 'Manage your quote list',
  view_quote: 'View quote',
  quote_request: 'Quote request',
  export_pdf: 'Export PDF',
  export_quote: 'Export quote',
  download_file: 'Download file',
  accept_quote: 'Accept quote',
  reject_quote: 'Reject quote',
  more_action: 'More actions',
  draft_order_is_created: 'Draft order is created',
  modal_accept_quote_title: 'Accept this quote?',
  modal_accept_quote: 'A draft order will be created so you can complete your purchase.',
  modal_reject_quote_title: 'Reject this quote?',
  modal_reject_quote: 'The store will be notified that you rejected this quote.',
  reorder: 'Reorder',
  reorder_toast: 'Items were added to your cart',
  item: 'Item',
  items: 'Items',
  received_by: 'Received by',
  product_information: 'Product information',
  price: 'Price',
  sku: 'SKU',
  variant: 'Variant',
  show_details: 'Show details',
  payment_information: 'Payment information',
  subtotal: 'Subtotal',
  discount: 'Discount',
  shipping: 'Shipping',
  tax: 'Tax',
  total: 'Total',
  customer_information: 'Customer information',
  shipping_address: 'Shipping address',
  billing_address: 'Billing address',
  company: 'Company',
  payment_terms: 'Payment terms',
  due_on_fulfillment: 'Due on fulfillment',
  special_note: 'Special note',
  not_found: 'Not found',
  quote: 'Quote',
  no_quotes: 'No quotes yet',
  go_to_store: 'Go to store to place quote.',
};

export const COUNTRY_OPTIONS = [
  { value: 'AU', label: 'Australia' },
  { value: 'CA', label: 'Canada' },
  { value: 'CN', label: 'China' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'HK', label: 'Hong Kong SAR' },
  { value: 'IN', label: 'India' },
  { value: 'ID', label: 'Indonesia' },
  { value: 'IT', label: 'Italy' },
  { value: 'JP', label: 'Japan' },
  { value: 'MY', label: 'Malaysia' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'NZ', label: 'New Zealand' },
  { value: 'PH', label: 'Philippines' },
  { value: 'SG', label: 'Singapore' },
  { value: 'KR', label: 'South Korea' },
  { value: 'ES', label: 'Spain' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'TH', label: 'Thailand' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'VN', label: 'Vietnam' },
];

// States offered for quote-based assignment conditions when the country has them.
export const COUNTRY_STATES = {
  US: ['California', 'New York', 'Texas', 'Washington'],
  AU: ['New South Wales', 'Queensland', 'Victoria'],
  CA: ['British Columbia', 'Ontario', 'Quebec'],
};
