// Static demo data for the Others page (production: pages/Others + features/Email).

export const OTHERS_HELP_URL = 'https://help.omegatheme.com/en/article/others-settings-1iqta3i/';
export const EMAIL_CONNECT_READ_MORE_URL = 'https://help.omegatheme.com/en/article/connect-email-b2b-1iqta3i/?bust=1772677259201';

export const OTHERS_SIDEBAR_ITEMS = [{ id: 'email-notification', icon: 'email', label: 'Email notification' }];

export const DEFAULT_SMTP_FORM = {
  emailUser: '',
  emailPass: '',
  emailSmtp: 'smtp.gmail.com',
  emailPort: '465',
  emailEncryption: 'ssl',
};

export const ENCRYPTION_OPTIONS = [
  { label: 'SSL', value: 'ssl' },
  { label: 'TLS', value: 'tls' },
];

export const DEFAULT_NOTIFICATION_STATE = {
  allow_auto_response_email: false,
  allow_admin_notification_email: false,
  allow_approval_notification_email: false,
  allow_rejection_notification_email: false,
  allow_contract_started_email: false,
  allow_contract_ending_email: false,
  allow_contract_ended_email: false,
  allow_contract_renewed_email: false,
  allow_contract_reminder_email: false,
};

// Registration form notification emails (features/Email/constants/email.constant.ts):
// list copy, the template editor's left panel (detail, dynamic values, preheader
// fields) and the default template content.
const COMMON_DYNAMIC_VALUES = [
  { description: 'Customer name', value: '{customer_name}' },
  { description: 'First name of customer', value: '{first_name}' },
  { description: 'Last name of customer', value: '{last_name}' },
  { description: 'Email of customers', value: '{email}' },
  { description: 'Name of store', value: '{store_name}' },
  { description: 'Email of store', value: '{store_email}' },
  { description: 'Store URL', value: '{store_url}' },
];

const RECIPIENTS_HELP_TEXT = 'Add multiple recipients by using commas and space';

// Contract emails also fill in the contract (see b2b/agreements.js).
const CONTRACT_DYNAMIC_VALUES = [
  ...COMMON_DYNAMIC_VALUES,
  { description: 'Company name', value: '{company_name}' },
  { description: 'Contract number', value: '{contract_number}' },
  { description: 'Contract name', value: '{contract_name}' },
  { description: 'Contract start date', value: '{start_date}' },
  { description: 'Contract end date', value: '{end_date}' },
];
const BUYER_PREHEADER_FIELDS = [
  { key: 'senderName', label: 'Sender name', autoComplete: 'off' },
  { key: 'recipientName', label: 'Recipient name', autoComplete: 'off' },
];
const ADMIN_PREHEADER_FIELDS = [
  { key: 'adminRecipient', label: 'Admin recipient', autoComplete: 'off', required: true, helpText: RECIPIENTS_HELP_TEXT },
  { key: 'cc', label: 'Cc', autoComplete: 'off', placeholder: 'Enter value', helpText: RECIPIENTS_HELP_TEXT },
  { key: 'bcc', label: 'Bcc', autoComplete: 'off', placeholder: 'Enter value', helpText: RECIPIENTS_HELP_TEXT },
  { key: 'replyTo', label: 'Reply to', autoComplete: 'off', placeholder: 'Enter value', helpText: RECIPIENTS_HELP_TEXT },
];
// Templates with an admin recipient (validated as email addresses on save).
export const ADMIN_EMAIL_KEYS = ['allow_admin_notification_email', 'allow_contract_reminder_email'];

const P = (html) => `<p style="margin:0;padding:0">${html}</p>`;
const body = (...paragraphs) => paragraphs.map(P).join('');

const REGISTRATION_EMAIL_TEMPLATES = {
  allow_auto_response_email: {
    title: 'Auto-response email',
    description: 'Email sent automatically to customers after submission',
    detail: 'Auto-response email is sent automatically to your customers after they submitted requests',
    dynamicValues: COMMON_DYNAMIC_VALUES,
    preheaderFields: [
      { key: 'senderName', label: 'Sender name', autoComplete: 'off' },
      { key: 'recipientName', label: 'Recipient name', autoComplete: 'off' },
    ],
  },
  allow_admin_notification_email: {
    title: 'Admin email',
    description: 'Email sent automatically to admin after submission',
    detail: 'Admin email is sent automatically to admin after customers submitted requests',
    dynamicValues: COMMON_DYNAMIC_VALUES,
    preheaderFields: [
      { key: 'adminRecipient', label: 'Admin recipient', autoComplete: 'off', required: true, helpText: RECIPIENTS_HELP_TEXT },
      { key: 'cc', label: 'Cc', autoComplete: 'off', placeholder: 'Enter value', helpText: RECIPIENTS_HELP_TEXT },
      { key: 'bcc', label: 'Bcc', autoComplete: 'off', placeholder: 'Enter value', helpText: RECIPIENTS_HELP_TEXT },
      { key: 'replyTo', label: 'Reply to', autoComplete: 'off', placeholder: 'Enter value', helpText: RECIPIENTS_HELP_TEXT },
    ],
  },
  allow_approval_notification_email: {
    title: 'Approval email',
    description: 'Email sent to customers when you approve their registrations',
    detail: 'Approval email is sent automatically to your customers after you approve their registrations',
    dynamicValues: COMMON_DYNAMIC_VALUES,
    preheaderFields: [
      { key: 'senderName', label: 'Sender name', autoComplete: 'off' },
      { key: 'recipientName', label: 'Recipient name', autoComplete: 'off' },
    ],
  },
  allow_rejection_notification_email: {
    title: 'Rejection email',
    description: 'Email sent to customers when you reject their registrations',
    detail: 'Rejection email is sent automatically to your customers after you reject their registrations',
    dynamicValues: COMMON_DYNAMIC_VALUES,
    preheaderFields: [
      { key: 'senderName', label: 'Sender name', autoComplete: 'off' },
      { key: 'recipientName', label: 'Recipient name', autoComplete: 'off' },
    ],
  },
};

// Contract emails (Upcoming version): to the buyers at the locations a contract
// applies to when it starts, 30 days before it ends, when it ends and when it's
// renewed; and to you 30 days before it ends.
const CONTRACT_EMAIL_TEMPLATES = {
  allow_contract_started_email: {
    title: 'Contract started',
    description: 'Email sent to the company’s buyers when a contract starts',
    detail: 'Contract started email is sent automatically to the buyers at the locations a contract applies to, when its pricing and order limits start applying',
    dynamicValues: CONTRACT_DYNAMIC_VALUES,
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
  allow_contract_ending_email: {
    title: 'Contract ending soon',
    description: 'Email sent to the company’s buyers 30 days before a contract ends',
    detail: 'Contract ending soon email is sent automatically to the buyers at the locations a contract applies to, 30 days before its end date',
    dynamicValues: CONTRACT_DYNAMIC_VALUES,
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
  allow_contract_ended_email: {
    title: 'Contract ended',
    description: 'Email sent to the company’s buyers when a contract expires or you end it',
    detail: 'Contract ended email is sent automatically to the buyers at the locations a contract applied to, when it expires or you end it',
    dynamicValues: CONTRACT_DYNAMIC_VALUES,
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
  allow_contract_renewed_email: {
    title: 'Contract renewed',
    description: 'Email sent to the company’s buyers when you renew a contract',
    detail: 'Contract renewed email is sent automatically to the buyers at the locations a contract applies to, when you renew it',
    dynamicValues: CONTRACT_DYNAMIC_VALUES,
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
  allow_contract_reminder_email: {
    title: 'Renewal reminder',
    description: 'Email sent to admin 30 days before a contract ends',
    detail: 'Renewal reminder email is sent automatically to admin 30 days before a contract’s end date, unless a next contract is set to take over',
    dynamicValues: CONTRACT_DYNAMIC_VALUES,
    preheaderFields: ADMIN_PREHEADER_FIELDS,
  },
};

export const NOTIFICATION_EMAIL_TEMPLATES = { ...REGISTRATION_EMAIL_TEMPLATES, ...CONTRACT_EMAIL_TEMPLATES };

const itemsOf = (templates) =>
  Object.keys(templates).map((key) => {
    const template = templates[key];
    return { key, title: template.title, description: template.description, detail: template.detail };
  });
export const REGISTRATION_NOTIFICATION_ITEMS = itemsOf(REGISTRATION_EMAIL_TEMPLATES);
export const CONTRACT_NOTIFICATION_ITEMS = itemsOf(CONTRACT_EMAIL_TEMPLATES);

// Demo: what GET /email/templates/{type} returns for this shop, as editor form
// state (the app's default content with the shop's sender name and admin inbox).
export const DEMO_EMAIL_TEMPLATES = {
  allow_auto_response_email: {
    subject: 'New customers registered',
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      'Thank you for signing up to be our customer.',
      '<br>',
      'We have received your submission and will get back to you with the result soon. Here are your submitted information:',
      '<br>',
      'First name: {first_name}<br>Last name: {last_name}<br>Email: {email}',
      '<br>',
      'Thank you for trusting our brand,<br>{store_name}',
    ),
    senderName: '221 Baker',
    recipientName: '{customer_name}',
  },
  allow_admin_notification_email: {
    subject: 'Registration submission',
    emailBody: body(
      'New registration for your store',
      '<br>',
      '{email} has signed up for an account in your store. Please go to B2B Quote Snap to see and approve the request.',
      '<br>',
      'A new account has been registered with the following information',
      '<br>',
      'First name: {first_name}<br>Last name: {last_name}<br>Email: {email}',
    ),
    adminRecipient: 'wholesale@221baker.com',
    cc: '',
    bcc: '',
    replyTo: '',
  },
  allow_approval_notification_email: {
    subject: 'Your account registration is approved!',
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      'Your customer account for {store_name} has been created.',
      '<br>',
      'Get started with bulk shopping by <a href="{store_url}">visiting our store</a>',
      '<br>',
      'If you have any questions, contact us at {store_email}.',
      '<br>',
      'Best regards,<br>{store_name}',
    ),
    senderName: '221 Baker',
    recipientName: '{customer_name}',
  },
  allow_rejection_notification_email: {
    subject: "We're sorry! Your account registration is not approved",
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      'Your customer account for {store_name} has been rejected by the shop owner.',
      '<br>',
      'If you have any questions, contact us at {store_email}.',
      '<br>',
      '<a href="{store_url}">Visit our store</a>',
      '<br>',
      'Best regards,<br>{store_name}',
    ),
    senderName: '221 Baker',
    recipientName: '{customer_name}',
  },
  allow_contract_started_email: {
    subject: 'Your contract {contract_number} has started',
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      'Your contract {contract_number} · {contract_name} with {store_name} applies to {company_name} from {start_date}.',
      '<br>',
      'Sign in and order at <a href="{store_url}">our store</a> to get your contract prices. Its order limits apply at checkout.',
      '<br>',
      'If you have any questions, contact us at {store_email}.',
      '<br>',
      'Best regards,<br>{store_name}',
    ),
    senderName: '221 Baker',
    recipientName: '{customer_name}',
  },
  allow_contract_ending_email: {
    subject: 'Your contract {contract_number} ends on {end_date}',
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      'Your contract {contract_number} · {contract_name} with {store_name} ends on {end_date}.',
      '<br>',
      'After that, {company_name} orders at our standard business prices and order limits, unless the contract is renewed.',
      '<br>',
      'If you have any questions, contact us at {store_email}.',
      '<br>',
      'Best regards,<br>{store_name}',
    ),
    senderName: '221 Baker',
    recipientName: '{customer_name}',
  },
  allow_contract_ended_email: {
    subject: 'Your contract {contract_number} has ended',
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      'Your contract {contract_number} · {contract_name} with {store_name} has ended.',
      '<br>',
      '{company_name} now orders at our standard business prices and order limits.',
      '<br>',
      'If you have any questions, contact us at {store_email}.',
      '<br>',
      'Best regards,<br>{store_name}',
    ),
    senderName: '221 Baker',
    recipientName: '{customer_name}',
  },
  allow_contract_renewed_email: {
    subject: 'Your contract {contract_number} is renewed until {end_date}',
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      'Your contract {contract_number} · {contract_name} with {store_name} is renewed until {end_date}.',
      '<br>',
      'Your contract prices and order limits stay the same.',
      '<br>',
      'If you have any questions, contact us at {store_email}.',
      '<br>',
      'Best regards,<br>{store_name}',
    ),
    senderName: '221 Baker',
    recipientName: '{customer_name}',
  },
  allow_contract_reminder_email: {
    subject: 'Contract {contract_number} ends on {end_date}',
    emailBody: body(
      'Contract {contract_number} · {contract_name} with {company_name} ends on {end_date}.',
      '<br>',
      'Go to B2B Quote Snap to renew it or set up the next contract. After the end date, {company_name} goes back to the pricing and limits outside the contract.',
    ),
    adminRecipient: 'wholesale@221baker.com',
    cc: '',
    bcc: '',
    replyTo: '',
  },
};

// Demo: what GET /email/settings returns for this shop — a connected sender
// account with three of the four registration notifications on, and the contract
// ones on.
export const DEMO_EMAIL_SETTINGS = {
  is_connected: true,
  email: 'wholesale@221baker.com',
  allow_auto_response_email: true,
  allow_admin_notification_email: true,
  allow_approval_notification_email: true,
  allow_rejection_notification_email: false,
  allow_contract_started_email: true,
  allow_contract_ending_email: true,
  allow_contract_ended_email: true,
  allow_contract_renewed_email: true,
  allow_contract_reminder_email: true,
};
