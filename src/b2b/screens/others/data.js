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

const P = (html) => `<p style="margin:0;padding:0">${html}</p>`;
const body = (...paragraphs) => paragraphs.map(P).join('');

export const NOTIFICATION_EMAIL_TEMPLATES = {
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

export const REGISTRATION_NOTIFICATION_ITEMS = Object.keys(NOTIFICATION_EMAIL_TEMPLATES).map((key) => {
  const template = NOTIFICATION_EMAIL_TEMPLATES[key];
  return { key, title: template.title, description: template.description, detail: template.detail };
});

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
};

// Demo: what GET /email/settings returns for this shop — a connected sender
// account with three of the four registration notifications on.
export const DEMO_EMAIL_SETTINGS = {
  is_connected: true,
  email: 'wholesale@221baker.com',
  allow_auto_response_email: true,
  allow_admin_notification_email: true,
  allow_approval_notification_email: true,
  allow_rejection_notification_email: false,
};
