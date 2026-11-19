// Static demo data for the Others page (production: pages/Others + features/Email).

export const OTHERS_HELP_URL = 'https://help.omegatheme.com/en/article/others-settings-1iqta3i/';
export const EMAIL_CONNECT_READ_MORE_URL = 'https://help.omegatheme.com/en/article/connect-email-b2b-1iqta3i/?bust=1772677259201';

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
  allow_order_request_received_email: false,
  allow_order_request_declined_email: false,
  allow_contract_started_email: false,
  allow_contract_ending_email: false,
  allow_contract_ended_email: false,
  allow_contract_renewed_email: false,
  allow_contract_reminder_email: false,
  allow_contract_approval_request_email: false,
  allow_contract_request_declined_email: false,
  allow_contract_request_received_email: false,
  allow_contract_approved_email: false,
  allow_contract_end_request_email: false,
  allow_contract_end_answered_email: false,
  allow_contract_version_declined_email: false,
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
// Order request emails also fill in the order request (see b2b/components/HeldOrders.jsx).
const ORDER_REQUEST_DYNAMIC_VALUES = [
  ...COMMON_DYNAMIC_VALUES,
  { description: 'Company name', value: '{company_name}' },
  { description: 'Location name', value: '{location_name}' },
  { description: 'Order number', value: '{order_number}' },
  { description: 'Order total', value: '{order_total}' },
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
export const ADMIN_EMAIL_KEYS = [
  'allow_admin_notification_email',
  'allow_order_request_received_email',
  'allow_contract_reminder_email',
  'allow_contract_request_received_email',
  'allow_contract_approved_email',
  'allow_contract_end_answered_email',
  'allow_contract_version_declined_email',
];

const P = (html) => `<p style="margin:0;padding:0">${html}</p>`;
const body = (...paragraphs) => paragraphs.map(P).join('');

const REGISTRATION_EMAIL_TEMPLATES = {
  allow_auto_response_email: {
    title: 'Registration received',
    description: 'Sent immediately after a customer submits the form',
    recipient: { type: 'buyer' },
    detail: 'Registration received email is sent automatically to your customers after they submitted requests',
    dynamicValues: COMMON_DYNAMIC_VALUES,
    preheaderFields: [
      { key: 'senderName', label: 'Sender name', autoComplete: 'off' },
      { key: 'recipientName', label: 'Recipient name', autoComplete: 'off' },
    ],
  },
  allow_admin_notification_email: {
    title: 'New registration submitted',
    description: 'Alerts your review team when a new company applies',
    recipient: { type: 'admin' },
    detail: 'New registration submitted email is sent automatically to admin after customers submitted requests',
    dynamicValues: COMMON_DYNAMIC_VALUES,
    preheaderFields: [
      { key: 'adminRecipient', label: 'Admin recipient', autoComplete: 'off', required: true, helpText: RECIPIENTS_HELP_TEXT },
      { key: 'cc', label: 'Cc', autoComplete: 'off', placeholder: 'Enter value', helpText: RECIPIENTS_HELP_TEXT },
      { key: 'bcc', label: 'Bcc', autoComplete: 'off', placeholder: 'Enter value', helpText: RECIPIENTS_HELP_TEXT },
      { key: 'replyTo', label: 'Reply to', autoComplete: 'off', placeholder: 'Enter value', helpText: RECIPIENTS_HELP_TEXT },
    ],
  },
  allow_approval_notification_email: {
    title: 'Registration approved',
    description: 'Sent when you approve the company registration',
    recipient: { type: 'buyer' },
    detail: 'Registration approved email is sent automatically to your customers after you approve their registrations',
    dynamicValues: COMMON_DYNAMIC_VALUES,
    preheaderFields: [
      { key: 'senderName', label: 'Sender name', autoComplete: 'off' },
      { key: 'recipientName', label: 'Recipient name', autoComplete: 'off' },
    ],
  },
  allow_rejection_notification_email: {
    title: 'Registration declined',
    description: 'Sent when you decline the company registration',
    recipient: { type: 'buyer' },
    detail: 'Registration declined email is sent automatically to your customers after you reject their registrations',
    dynamicValues: COMMON_DYNAMIC_VALUES,
    preheaderFields: [
      { key: 'senderName', label: 'Sender name', autoComplete: 'off' },
      { key: 'recipientName', label: 'Recipient name', autoComplete: 'off' },
    ],
  },
};

// Order request emails (Upcoming version): to you when a buyer sends an order request
// over an order limit's maximum; to that buyer when you decline it.
const ORDER_REQUEST_EMAIL_TEMPLATES = {
  allow_order_request_received_email: {
    title: 'New order request',
    description: 'Alerts your team when a buyer sends an order request for review',
    recipient: { type: 'admin' },
    detail: 'New order request email is sent automatically to admin when a buyer sends an order request over an order limit, for you to approve or decline it in the app',
    dynamicValues: [
      ...ORDER_REQUEST_DYNAMIC_VALUES,
      { description: 'Why it needs review', value: '{review_reason}' },
      { description: 'Buyer’s note, when they write one', value: '{buyer_message}' },
    ],
    preheaderFields: ADMIN_PREHEADER_FIELDS,
  },
  allow_order_request_declined_email: {
    title: 'Order request declined',
    description: 'Sent when you decline the customer’s order request',
    recipient: { type: 'buyer' },
    detail: 'Order request declined email is sent automatically to the buyer who sent an order request over an order limit, when you decline it, with your message if you add one',
    dynamicValues: [...ORDER_REQUEST_DYNAMIC_VALUES, { description: 'Your message to the buyer', value: '{decline_message}' }],
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
};

// Contract emails (Upcoming version): to the buyers at the locations a contract
// applies to when it starts, when its renewal reminder starts (reminderDays in
// agreements.js), when it ends and when it's extended; and to you when the reminder
// starts. Then the approval ones (a contract saved with Buyer must approve): to the
// company's buyers — any of them can respond for it — when one waits for their
// approval, and to the buyer whose request you declined; to you when a buyer sends a
// request or approves one.
const CONTRACT_EMAIL_TEMPLATES = {
  allow_contract_started_email: {
    title: 'Contract started',
    description: 'Sent when a contract becomes active',
    recipient: { type: 'buyer' },
    detail: 'Contract started email is sent automatically to the buyers at the locations a contract applies to, when its pricing and order limits start applying',
    dynamicValues: CONTRACT_DYNAMIC_VALUES,
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
  allow_contract_ending_email: {
    title: 'Contract ending soon',
    description: 'Sent before a contract reaches its end date',
    recipient: { type: 'buyer' },
    detail: 'Contract ending soon email is sent automatically to the buyers at the locations a contract applies to, 30 days before its end date, or halfway through a contract shorter than 60 days. A contract shorter than 7 days gets none',
    dynamicValues: CONTRACT_DYNAMIC_VALUES,
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
  allow_contract_ended_email: {
    title: 'Contract ended',
    description: 'Sent when a contract expires or is ended manually',
    recipient: { type: 'buyer' },
    detail: 'Contract ended email is sent automatically to the buyers at the locations a contract applied to, when it expires or you end it',
    dynamicValues: CONTRACT_DYNAMIC_VALUES,
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
  allow_contract_renewed_email: {
    title: 'Contract extended',
    description: 'Sent when the end date is extended',
    recipient: { type: 'buyer' },
    detail: 'Contract extended email is sent automatically to the buyers at the locations a contract applies to, when you extend it',
    dynamicValues: CONTRACT_DYNAMIC_VALUES,
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
  allow_contract_reminder_email: {
    title: 'Contract extension reminder',
    description: 'Reminds the account team to review an expiring contract',
    recipient: { type: 'admin' },
    detail: 'Contract extension reminder email is sent automatically to admin 30 days before a contract’s end date, or halfway through a contract shorter than 60 days, unless a next contract is set to take over. A contract shorter than 7 days gets none',
    dynamicValues: CONTRACT_DYNAMIC_VALUES,
    preheaderFields: ADMIN_PREHEADER_FIELDS,
  },
  allow_contract_approval_request_email: {
    title: 'Contract waiting for approval',
    description: 'Sent when a contract, a new version or an extension needs the buyer’s approval',
    recipient: { type: 'buyer' },
    detail: 'Contract waiting for approval email is sent automatically to the company’s buyers at the locations the contract applies to, when you send them a contract to approve, a new version of one or an extension, with your message if you add one',
    dynamicValues: [
      ...CONTRACT_DYNAMIC_VALUES,
      { description: 'Contract version', value: '{contract_version}' },
      { description: 'Date to approve it by', value: '{approve_by}' },
      { description: 'Your message to the buyer, when you add one', value: '{seller_message}' },
    ],
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
  allow_contract_request_declined_email: {
    title: 'Contract request declined',
    description: 'Sent when you decline a buyer’s request for changes or cancellation',
    recipient: { type: 'buyer' },
    detail: 'Contract request declined email is sent automatically to the buyer who asked to change or cancel a contract, when you decline their request, with your reply',
    dynamicValues: [
      ...CONTRACT_DYNAMIC_VALUES,
      { description: 'What they asked for: changes or cancellation', value: '{request_type}' },
      { description: 'Buyer’s message', value: '{buyer_message}' },
      { description: 'Your reply to the buyer', value: '{seller_reply}' },
    ],
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
  allow_contract_request_received_email: {
    title: 'Contract request received',
    description: 'Alerts your team when a buyer asks to change or cancel a contract',
    recipient: { type: 'admin' },
    detail: 'Contract request received email is sent automatically to admin when a buyer sends Request changes or Request cancellation from their B2B Portal, for you to answer it on the contract page',
    dynamicValues: [
      ...CONTRACT_DYNAMIC_VALUES,
      { description: 'Contract version', value: '{contract_version}' },
      { description: 'What they asked for: changes or cancellation', value: '{request_type}' },
      { description: 'Buyer’s message', value: '{buyer_message}' },
    ],
    preheaderFields: ADMIN_PREHEADER_FIELDS,
  },
  allow_contract_approved_email: {
    title: 'Contract approved by buyer',
    description: 'Alerts your team when a buyer approves a contract, a new version or an extension',
    recipient: { type: 'admin' },
    detail: 'Contract approved by buyer email is sent automatically to admin when a buyer approves a contract, a new version or an extension in their B2B Portal',
    dynamicValues: [
      ...CONTRACT_DYNAMIC_VALUES,
      { description: 'Contract version', value: '{contract_version}' },
    ],
    preheaderFields: ADMIN_PREHEADER_FIELDS,
  },
  allow_contract_end_request_email: {
    title: 'Contract end requested',
    description: 'Sent when you ask a company’s buyers to approve ending or cancelling a contract',
    recipient: { type: 'buyer' },
    detail: 'Contract end requested email is sent automatically to the company’s buyers at the locations the contract applies to, when you ask them to end a contract saved with Buyer must approve — or to cancel one that hasn’t started — with your reason',
    dynamicValues: [
      ...CONTRACT_DYNAMIC_VALUES,
      { description: 'What you asked: end (it has started) or cancel (it hasn’t)', value: '{request_type}' },
      { description: 'Your reason', value: '{seller_message}' },
    ],
    preheaderFields: BUYER_PREHEADER_FIELDS,
  },
  allow_contract_end_answered_email: {
    title: 'Contract end answered',
    description: 'Alerts your team when a buyer approves or declines ending or cancelling a contract',
    recipient: { type: 'admin' },
    detail: 'Contract end answered email is sent automatically to admin when a buyer approves or declines your request to end or cancel a contract in their B2B Portal, with their message',
    dynamicValues: [
      ...CONTRACT_DYNAMIC_VALUES,
      { description: 'What you asked: end or cancel', value: '{request_type}' },
      { description: 'Their answer: approved or declined', value: '{end_answer}' },
      { description: 'Buyer’s message', value: '{buyer_message}' },
    ],
    preheaderFields: ADMIN_PREHEADER_FIELDS,
  },
  allow_contract_version_declined_email: {
    title: 'Contract version declined',
    description: 'Alerts your team when a buyer declines a new version or an extension',
    recipient: { type: 'admin' },
    detail: 'Contract version declined email is sent automatically to admin when a buyer declines a new version or an extension you sent them, with their message. The version they approved stays as it is',
    dynamicValues: [
      ...CONTRACT_DYNAMIC_VALUES,
      { description: 'The version they declined', value: '{contract_version}' },
      { description: 'Buyer’s message', value: '{buyer_message}' },
    ],
    preheaderFields: ADMIN_PREHEADER_FIELDS,
  },
};

export const NOTIFICATION_EMAIL_TEMPLATES = { ...REGISTRATION_EMAIL_TEMPLATES, ...ORDER_REQUEST_EMAIL_TEMPLATES, ...CONTRACT_EMAIL_TEMPLATES };

const itemsOf = (templates) =>
  Object.keys(templates).map((key) => {
    const template = templates[key];
    return { key, title: template.title, description: template.description, detail: template.detail, recipient: template.recipient };
  });
export const REGISTRATION_NOTIFICATION_ITEMS = itemsOf(REGISTRATION_EMAIL_TEMPLATES);
export const ORDER_REQUEST_NOTIFICATION_ITEMS = itemsOf(ORDER_REQUEST_EMAIL_TEMPLATES);
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
    adminRecipient: 'admin@221baker.com',
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
  allow_order_request_received_email: {
    subject: 'Order request {order_number} from {company_name} needs your review',
    emailBody: body(
      'New order request to review',
      '<br>',
      '{customer_name} ({email}) sent an order request for {company_name} · {location_name}. It’s over an order limit, so it isn’t placed until you approve it.',
      '<br>',
      'Order request: {order_number}<br>Order total: {order_total}<br>Why it needs review: {review_reason}',
      '{buyer_message}',
      '<br>',
      'Go to B2B Quote Snap to approve or decline it. If you approve it, the buyer gets an invoice to complete the order. If you decline it, the buyer gets an email that it was declined, with your message if you add one.',
    ),
    adminRecipient: 'admin@221baker.com',
    cc: '',
    bcc: '',
    replyTo: '',
  },
  allow_order_request_declined_email: {
    subject: 'Your order request {order_number} was declined',
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      '{store_name} declined your order request {order_number} for {order_total} for {company_name} · {location_name}. It wasn’t placed and you weren’t charged.',
      '<br>',
      '{decline_message}',
      '<br>',
      'You can change your order and send it again at <a href="{store_url}">our store</a>.',
      '<br>',
      'If you have any questions, contact us at {store_email}.',
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
      'After that, {company_name} orders at our standard business prices and order limits, unless the contract is extended.',
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
    subject: 'Your contract {contract_number} is extended until {end_date}',
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      'Your contract {contract_number} · {contract_name} with {store_name} is extended until {end_date}.',
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
      'Go to B2B Quote Snap to extend it or set up the next contract. After the end date, {company_name} goes back to the pricing and limits outside the contract.',
    ),
    adminRecipient: 'contracts@221baker.com',
    cc: '',
    bcc: '',
    replyTo: '',
  },
  allow_contract_approval_request_email: {
    subject: 'Contract {contract_number} is waiting for your approval',
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      '{store_name} sent {company_name} version {contract_version} of contract {contract_number} · {contract_name} to approve.',
      '<br>',
      '{seller_message}',
      '<br>',
      'Review it in your B2B Portal at <a href="{store_url}">our store</a> and answer it by {approve_by}.',
      '<br>',
      'If you have any questions, contact us at {store_email}.',
      '<br>',
      'Best regards,<br>{store_name}',
    ),
    senderName: '221 Baker',
    recipientName: '{customer_name}',
  },
  allow_contract_request_declined_email: {
    subject: 'About your request on contract {contract_number}',
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      '{store_name} declined your request for {request_type} on contract {contract_number} · {contract_name}. The contract stays as it is.',
      '<br>',
      '{seller_reply}',
      '<br>',
      'You can see it, and answer again, in your B2B Portal at <a href="{store_url}">our store</a>.',
      '<br>',
      'If you have any questions, contact us at {store_email}.',
      '<br>',
      'Best regards,<br>{store_name}',
    ),
    senderName: '221 Baker',
    recipientName: '{customer_name}',
  },
  allow_contract_request_received_email: {
    subject: '{company_name} sent a request for {request_type} on contract {contract_number}',
    emailBody: body(
      '{customer_name} ({email}) at {company_name} sent a request for {request_type} on contract {contract_number} · {contract_name}, version {contract_version}.',
      '<br>',
      '{buyer_message}',
      '<br>',
      'Go to B2B Quote Snap to answer it on the contract page.',
    ),
    adminRecipient: 'contracts@221baker.com',
    cc: '',
    bcc: '',
    replyTo: '',
  },
  allow_contract_approved_email: {
    subject: '{company_name} approved contract {contract_number}',
    emailBody: body(
      '{customer_name} ({email}) at {company_name} approved version {contract_version} of contract {contract_number} · {contract_name}.',
      '<br>',
      'It runs from {start_date} to {end_date}. See it in B2B Quote Snap.',
    ),
    adminRecipient: 'contracts@221baker.com',
    cc: '',
    bcc: '',
    replyTo: '',
  },
  allow_contract_end_request_email: {
    subject: '{store_name} asked to {request_type} contract {contract_number}',
    emailBody: body(
      'Dear {first_name},',
      '<br>',
      '{store_name} asked {company_name} to {request_type} contract {contract_number} · {contract_name}.',
      '<br>',
      '{seller_message}',
      '<br>',
      'Approve or decline it in your B2B Portal at <a href="{store_url}">our store</a>. Nothing changes until you answer.',
      '<br>',
      'If you have any questions, contact us at {store_email}.',
      '<br>',
      'Best regards,<br>{store_name}',
    ),
    senderName: '221 Baker',
    recipientName: '{customer_name}',
  },
  allow_contract_end_answered_email: {
    subject: '{company_name} {end_answer} your request to {request_type} contract {contract_number}',
    emailBody: body(
      '{customer_name} ({email}) at {company_name} {end_answer} your request to {request_type} contract {contract_number} · {contract_name}.',
      '<br>',
      '{buyer_message}',
      '<br>',
      'Approved, it has ended (or won’t start) and its prices and limits don’t apply. Declined, it stays as it is. See it in B2B Quote Snap.',
    ),
    adminRecipient: 'contracts@221baker.com',
    cc: '',
    bcc: '',
    replyTo: '',
  },
  allow_contract_version_declined_email: {
    subject: '{company_name} declined version {contract_version} of contract {contract_number}',
    emailBody: body(
      '{customer_name} ({email}) at {company_name} declined version {contract_version} of contract {contract_number} · {contract_name}.',
      '<br>',
      '{buyer_message}',
      '<br>',
      'The version they approved stays as it is. Open the contract in B2B Quote Snap to change it and send a new version.',
    ),
    adminRecipient: 'contracts@221baker.com',
    cc: '',
    bcc: '',
    replyTo: '',
  },
};

// Demo: what GET /email/settings returns for this shop — a connected sender
// account with three of the four registration notifications on, and the order
// request and contract ones on.
export const DEMO_EMAIL_SETTINGS = {
  is_connected: true,
  email: 'wholesale@221baker.com',
  allow_auto_response_email: true,
  allow_admin_notification_email: true,
  allow_approval_notification_email: true,
  allow_rejection_notification_email: false,
  allow_order_request_received_email: true,
  allow_order_request_declined_email: true,
  allow_contract_started_email: true,
  allow_contract_ending_email: true,
  allow_contract_ended_email: true,
  allow_contract_renewed_email: true,
  allow_contract_reminder_email: true,
  allow_contract_approval_request_email: true,
  allow_contract_request_declined_email: true,
  allow_contract_request_received_email: true,
  allow_contract_approved_email: true,
  allow_contract_end_request_email: true,
  allow_contract_end_answered_email: true,
  allow_contract_version_declined_email: true,
};
