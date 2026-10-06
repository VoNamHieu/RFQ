// Static demo data + constants for the "Quote form builder" screen (production
// pages/FormSettingPage.jsx → components/FormSetting). Copy comes from the
// production English locales (formSetting.json, quoteForm.json, translation.json).
// The settings shape mirrors the production `setting_forms[dtc|b2b]` object so the
// panels and the live preview read the same fields the real app does.

import productImg from './assets/product_img_preview.png';

export const SHOP_DOMAIN = '221baker.myshopify.com';

// ── Builder structure ────────────────────────────────────────────────────────
// Left rail (constant/formSetting.jsx getFormSettingTabs) — ids follow the agent
// targets (`?tab=fields|after_submit|translation|appearance`).
export const TABS = [
  { id: 'fields', icon: 'page', tooltip: 'Element' },
  { id: 'after_submit', icon: 'send', tooltip: 'After submit' },
  { id: 'translation', icon: 'language', tooltip: 'Translation' },
  { id: 'appearance', icon: 'settings', tooltip: 'Form appearance' },
];

export const STEP_1 = 'step-1';
export const STEP_2 = 'step-2';
export const EMPTY_STATE = 'empty-state';

// Detail panels a merchant can open (`?panel=…` uses the step-2 ids).
export const PANEL_TITLES = {
  formAttribute: 'Form attribute',
  productList: 'Product list',
  submitButton: 'Submit button',
  customerInfo: 'Customer info',
  note: 'Note',
  product_info: 'Product Info',
  button_step_1: 'Add To Quote button',
  product_note: 'Product note',
  display_condition: 'Display condition',
  emptyState: 'Empty state',
  behavior: 'Behavior',
};
export const AGENT_PANELS = ['behavior', 'customerInfo', 'productList', 'submitButton', 'note', 'emptyState'];

// Step 1 → a form's attributes (Step1/index.jsx variantAttribute)
export const STEP1_ATTRIBUTES = [
  { title: 'Display condition', icon: 'adjust', panel: 'display_condition' },
  { title: 'Product info', icon: 'product', panel: 'product_info' },
  { title: 'Product note', icon: 'layout-section', panel: 'product_note' },
  { title: 'Add To Quote button', icon: 'button', panel: 'button_step_1' },
  { title: 'Form attribute', icon: 'forms', panel: 'formAttribute' },
];

// Step 2 → sections (Step2/index.jsx; "Customer Type Selector" is filtered out
// once the DTC/B2B split is on).
export const STEP2_SECTIONS = [
  { title: 'Product list', icon: 'product', panel: 'productList' },
  { title: 'Customer info', icon: 'personalized-text', panel: 'customerInfo' },
  { title: 'Note', icon: 'layout-section', panel: 'note' },
  { title: 'Submit button', icon: 'button', panel: 'submitButton' },
  { title: 'Behavior', icon: 'cursor', panel: 'behavior' },
];

export const CONDITION_TYPE_LABEL = { all: 'All Product', selected: 'Specific product', automate: 'Group products' };

// quoteFormConstant().buttonPositionOptions
export const BUTTON_POSITIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Middle' },
  { value: 'right', label: 'Right' },
];

// ── Custom fields ("Add Field") ──────────────────────────────────────────────
export const ADD_FIELD_OPTIONS = [
  { name: 'simple', icon: 'text-font', label: 'Simple text' },
  { name: 'text', icon: 'text-align-left', label: 'Text field' },
  { name: 'select', icon: 'chevron-down-circle', label: 'Select' },
  { name: 'radio', icon: 'list-bulleted', label: 'Radio button' },
  { name: 'checkbox', icon: 'select', label: 'Checkbox' },
  { name: 'date', icon: 'calendar-time', label: 'Datetime picker' },
  { name: 'file', icon: 'upload', label: 'Upload files' },
  { name: 'phone', icon: 'phone', label: 'Phone' },
  { name: 'country', icon: 'globe', label: 'Country' },
  { name: 'state', icon: 'location', label: 'State' },
];

const OPTIONS_3 = () => [
  { label: 'Option 1', sel: 0 },
  { label: 'Option 2', sel: 0 },
  { label: 'Option 3', sel: 0 },
];

// quoteFormConstant().addNewFieldData
export const NEW_FIELD = {
  simple: () => ({ input: 'simple', content: 'Simple text', width: 50, req: 1 }),
  text: () => ({ label: 'Text', input: 'text', type: 'text', placeholder: 'Enter your value', defaultValue: '', max: 20, min: 0, width: 50, req: 1 }),
  select: () => ({ label: 'Select', input: 'select', placeholder: 'Select your option', defaultValue: '', choices: OPTIONS_3(), width: 50, req: 1 }),
  radio: () => ({ label: 'Radio', input: 'radio', defaultValue: '', choices: OPTIONS_3(), width: 50, req: 1 }),
  checkbox: () => ({ label: 'Checkboxes', input: 'checkbox', defaultValue: '', choices: OPTIONS_3(), width: 50, req: 1 }),
  date: () => ({ label: 'Datetime', input: 'date', placeholder: 'Select a date', defaultValue: '', width: 50, req: 1, dateFormat: 'F j, Y', allowDateBefore: true }),
  file: () => ({ label: 'Upload files', input: 'file', placeholder: 'Upload files', multi: 1, width: 50, req: 1 }),
  phone: () => ({ label: 'Phone', input: 'text', type: 'phone', placeholder: 'Enter your phone', defaultValue: '', max: 20, min: 0, width: 50, req: 1 }),
  country: () => ({ label: 'Country', input: 'text', type: 'country', placeholder: 'Enter your country', defaultValue: '', max: 20, min: 0, width: 50, req: 1 }),
  state: () => ({ label: 'State/Province', input: 'text', type: 'state', placeholder: 'State', defaultValue: '', max: 20, min: 0, width: 50, req: 1 }),
};

// getListFieldIcon(input, type)
export function fieldIcon(field) {
  if (field.input === 'text') {
    return { text: 'text-align-left', textarea: 'file', email: 'email', number: 'referral-code', phone: 'phone', country: 'globe', state: 'location' }[field.type] || 'text-align-left';
  }
  return { simple: 'text-font', select: 'chevron-down-circle', radio: 'list-bulleted', checkbox: 'select', date: 'calendar-time', file: 'upload' }[field.input] || 'text-font';
}

export const TEXT_FIELD_TYPES = [
  { value: 'text', label: 'Text field' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
];
export const TEXT_TYPE_LABEL = { text: 'Text', textarea: 'Textarea', email: 'Email', number: 'Number' };
export const TEXT_TYPE_PLACEHOLDER = { text: 'Enter your value', textarea: 'Enter your value', email: 'Enter your email', number: 'Enter your number' };

export const DEFAULT_VALUE_OPTIONS = [
  { value: '', label: 'Choose Default Value' },
  ...['customer.name', 'customer.email', 'customer.phone', 'customer.note', 'customer.tags', 'customer.default_address.address1', 'customer.default_address.city', 'customer.default_address.province', 'customer.default_address.zip', 'customer.default_address.country'].map((v) => ({ value: v, label: v })),
];

export const FIELD_WIDTHS = [
  { value: 50, label: '50%' },
  { value: 100, label: '100%' },
];

// constant/pdfTemplate.js dateFormatOptions (value = PHP format, moment = preview format)
export const DATE_FORMATS = [
  { value: 'm/d/Y', label: 'MM/DD/YYYY', moment: 'MM/DD/YYYY' },
  { value: 'd/m/Y', label: 'DD/MM/YYYY', moment: 'DD/MM/YYYY' },
  { value: 'Y/m/d', label: 'YYYY/MM/DD', moment: 'YYYY/MM/DD' },
  { value: 'd F, Y', label: 'DD Month, YYYY', moment: 'DD MMMM, YYYY' },
  { value: 'M d, Y', label: 'Month DD, YYYY', moment: 'MMM DD, YYYY' },
  { value: 'n/j/Y', label: 'M/D/YYYY', moment: 'M/D/YYYY' },
  { value: 'j/n/Y', label: 'D/M/YYYY', moment: 'D/M/YYYY' },
  { value: 'Y/n/j', label: 'YYYY/M/D', moment: 'YYYY/M/D' },
  { value: 'F j, Y', label: 'Month D, YYYY', moment: 'MMMM D, YYYY' },
  { value: 'Y, D j', label: 'YYYY, Day D', moment: 'YYYY, dddd D' },
  { value: 'm/j/Y', label: 'MM/D/YYYY', moment: 'MM/D/YYYY' },
  { value: 'j/m/Y', label: 'D/MM/YYYY', moment: 'D/MM/YYYY' },
  { value: 'Y,M j', label: 'YYYY, Month D', moment: 'YYYY, MMM D' },
];

// "Set condition to display" (constant/quoteForm.jsx getOperatorOptions / getFormType)
export function fieldFormType(field) {
  if (field.is_file) return 'file';
  if (field.input === 'text') return ['phone', 'country'].includes(field.type) ? field.type : 'text';
  return field.input;
}
export function operatorOptions(type) {
  switch (type) {
    case 'text':
    case 'file':
    case 'phone':
      return [{ value: 'empty', label: 'is empty' }, { value: 'not_empty', label: 'is not empty' }];
    case 'select':
    case 'radio':
    case 'checkbox':
      return [{ value: 'contains', label: 'contains' }, { value: 'not_contains', label: 'does not contain' }];
    case 'date':
      return [
        { value: 'today', label: 'today' },
        { value: 'on_or_before', label: 'on or before date' },
        { value: 'on_or_after', label: 'on or after date' },
        { value: 'in_the_next_x_days', label: 'in the next X days' },
        { value: 'empty', label: 'is empty' },
        { value: 'not_empty', label: 'is not empty' },
      ];
    case 'country':
      return [
        { value: 'contains', label: 'contains' },
        { value: 'not_contains', label: 'does not contain' },
        { value: 'empty', label: 'is empty' },
        { value: 'not_empty', label: 'is not empty' },
      ];
    default:
      return [{ value: 'contains', label: 'contains' }];
  }
}
export function operatorShowsValue(type, op) {
  if (type === 'date') return ['on_or_before', 'on_or_after', 'in_the_next_x_days'].includes(op);
  if (type === 'country') return ['contains', 'not_contains'].includes(op);
  return ['select', 'radio', 'checkbox'].includes(type);
}

// ── Step 1 display condition (constant/general.jsx optionConditionAutomate) ──
export const AUTO_CONDITION_TYPES = [
  { value: 'title', label: 'Product title' },
  { value: 'type', label: 'Product type' },
  { value: 'vendor', label: 'Product Vendor' },
  { value: 'price', label: 'Product price' },
  { value: 'tag', label: 'Product Tag' },
  { value: 'inventory', label: 'Inventory quantity' },
  { value: 'time', label: 'Created/Published time' },
];
const IS_STRING = [
  { value: 'contain', label: 'Contains' },
  { value: 'not_contain', label: 'does not contain' },
  { value: 'startwith', label: 'start with' },
  { value: 'endwith', label: 'end with' },
];
const IS_NUMBER = [
  { value: 'equal', label: 'is equal to' },
  { value: 'notequal', label: 'is not equal to' },
  { value: 'greater', label: 'Greater' },
  { value: 'smaller', label: 'Smaller' },
];
const IS_TIME = [
  { value: 'publish_before', label: 'is published before' },
  { value: 'publish_after', label: 'is published after' },
  { value: 'publish_equal', label: 'is published equal' },
  { value: 'create_before', label: 'is created before' },
  { value: 'create_after', label: 'is created after' },
  { value: 'create_equal', label: 'is created equal' },
];
export function autoOperatorOptions(type) {
  if (type === 'price' || type === 'inventory') return IS_NUMBER;
  if (type === 'time') return IS_TIME;
  return IS_STRING;
}
export function autoValueType(type) {
  if (type === 'price' || type === 'inventory') return 'number';
  if (type === 'time') return 'date';
  return 'text';
}
export const DEFAULT_AUTO_CONDITION = () => ({ selectedType: 'title', isChoosen: 'contain', valueCondition: '' });

// ── Markets (Customer info → Country → "Display countries belonging to markets")
export const MARKETS = [
  { id: 'gid://shopify/Market/101', name: 'Vietnam' },
  { id: 'gid://shopify/Market/102', name: 'Southeast Asia' },
  { id: 'gid://shopify/Market/103', name: 'United States' },
  { id: 'gid://shopify/Market/104', name: 'International' },
];

// ── Appearance (AppearanceFormSetting colorSettings + APPEARANCE_FORM_SETTINGS) ──
export const APPEARANCE_DEFAULT = {
  font_size: 14,
  text_color: 'rgba(0, 0, 0, 1)',
  section_title_bg_color: 'rgba(249, 250, 251, 1)',
  header_bg_color: 'rgba(255, 255, 255, 1)',
  footer_bg_color: 'rgba(255, 255, 255, 1)',
  primary_bg_color: 'rgba(255, 255, 255, 1)',
  secondary_bg_color: 'rgba(245, 245, 245, 1)',
  continue_button_bg_color: 'rgba(255, 255, 255, 1)',
  continue_button_color: 'rgba(0, 0, 0, 1)',
  submit_button_bg_color: 'rgba(0, 0, 0, 1)',
  submit_button_color: 'rgba(255, 255, 255, 1)',
};
export const COLOR_SETTINGS = [
  { field: 'text_color', label: 'Text color' },
  { field: 'primary_bg_color', label: 'Primary background color' },
  { field: 'secondary_bg_color', label: 'Secondary background color' },
  { field: 'section_title_bg_color', label: 'Section title background color' },
  { field: 'header_bg_color', label: 'Header background color' },
  { field: 'footer_bg_color', label: 'Footer background color' },
  { field: 'submit_button_color', label: 'Primary button color' },
  { field: 'submit_button_bg_color', label: 'Primary button background color' },
  { field: 'continue_button_color', label: 'Secondary button color' },
  { field: 'continue_button_bg_color', label: 'Secondary button background color' },
];

// ── Preview sample (quoteFormConstant().tableRowExProducts[0]) ────────────────
export const SAMPLE_PRODUCT = {
  product_title: 'Woman Turtleneck ',
  product_image: productImg,
  price: '$120.00',
  option: 'XL/ Silk/ Tapped',
  sku: 'AB13464879',
  properties: 'Medium/ Yellow',
  quantity: 2,
  wished_price: '200',
  wished_price_text: '$200.00',
  total_price: '$240.00',
  note: 'I want button-down design',
};

// The sample values the production preview hard-codes (PreviewCustomerTranslation
// = guest checkout, PreviewLoginCustomerTranslation = logged-in customer).
export const SAMPLE_GUEST = {
  email: 'email@example.com',
  firstName: 'John',
  lastName: 'Due',
  phone: '0989064061',
  companyName: 'QuoteSnap Store',
  companyId: 'New-998',
  shippingLastName: 'Smith',
  address: '11 Thai Ha',
  city: 'Hanoi',
  postalCode: '10000',
};
export const SAMPLE_LOGGED_IN = {
  email: 'email@example.com',
  location: '11 Thai Ha, HN, Vietnam',
  contact: ['Omega Request A Quote', 'contact@omegatheme.com', '+84 0000001'],
  company: 'QuoteSnap LTD',
  address: ['John Due', '+84 0000001', '11 Thai Ha, HN, 10000', 'Vietnam'],
  paymentTerms: 'Cash on delivery',
};

// ── Translations ─────────────────────────────────────────────────────────────
// translations[lang].translations — the storefront labels the Translation tab edits.
const LABELS_EN = {
  information_title: 'Customer information',
  products_title: 'Products',
  email_address_label: 'Email address',
  email_address_placeholder: 'Enter your email',
  location_dtc_title: 'Address',
  location_b2b_title: 'Location',
  register_as_label: 'Register as',
  auto_fill_help_text: 'Log in to fill in your details automatically.',
  contact_and_company_title: 'Contact & company',
  contact_title: 'Contact information',
  contact_person_title: 'Contact person',
  contact_first_name_label: 'First name',
  placeholder_contact_first_name: 'Enter your first name',
  contact_last_name_label: 'Last name',
  placeholder_contact_last_name: 'Enter your last name',
  contact_phone_number_label: 'Phone number',
  placeholder_contact_phone_number: 'Enter your number',
  company_title: 'Company information',
  company_name_label: 'Company name',
  company_name_placeholder: 'Enter company name',
  company_id_title: 'Company ID',
  company_id_place_holder: 'Enter company ID',
  shipping_title: 'Shipping address',
  shipping_country_label: 'Country/Region',
  placeholder_shipping_country: 'Select a country',
  shipping_first_name_label: 'First name',
  placeholder_shipping_first_name: 'Enter first name',
  shipping_last_name_label: 'Last name',
  placeholder_shipping_last_name: 'Enter last name',
  shipping_company_label: 'Company',
  placeholder_shipping_company: 'Enter company',
  shipping_address_label: 'Address',
  placeholder_shipping_address: 'Enter address',
  shipping_state_label: 'State/Province',
  placeholder_shipping_state: 'Select a state',
  shipping_city_label: 'City',
  placeholder_shipping_city: 'Enter city',
  shipping_postal_code_label: 'ZIP/Postal code',
  placeholder_shipping_postal_code: 'Enter ZIP/Postal code',
  shipping_phone_number_label: 'Phone',
  placeholder_shipping_phone_number: 'Enter your number',
  shipping_use_as_billing: 'Use as billing address',
  billing_title: 'Billing address',
  billing_country_label: 'Country/Region',
  placeholder_billing_country: 'Select a country',
  billing_first_name_label: 'First name',
  placeholder_billing_first_name: 'Enter first name',
  billing_last_name_label: 'Last name',
  placeholder_billing_last_name: 'Enter last name',
  billing_company_label: 'Company',
  placeholder_billing_company: 'Enter company',
  billing_address_label: 'Address',
  placeholder_billing_address: 'Enter address',
  billing_state_label: 'State/Province',
  placeholder_billing_state: 'Select a state',
  billing_city_label: 'City',
  placeholder_billing_city: 'Enter city',
  billing_postal_code_label: 'ZIP/Postal code',
  placeholder_billing_postal_code: 'Enter ZIP/Postal code',
  billing_phone_number_label: 'Phone',
  placeholder_billing_phone_number: 'Enter your number',
  payment_term_title: 'Payment terms',
  note_title: 'Note',
  edit_label: 'Edit',
  add_product_label: 'Add product',
  add_product_modal_title: 'Add products',
  search_products: 'Search products',
  close_modal_select_product: 'Close',
  select_product: 'Select',
  no_products_found: 'No products found',
  no_results_found: 'No results found',
  no_products_found_hint: 'Try changing the search term',
  search_by_label: 'Search by',
  search_by_all: 'All',
  search_by_title: 'Product title',
  search_by_barcode: 'Barcode',
  search_by_sku: 'SKU',
  search_by_variant: 'Variant title',
  loading_more_products: 'Loading more products...',
  products_selected: '{count} products selected',
  invalid_phone_number: 'Please enter a valid phone number',
};

const LABELS_FR = {
  ...LABELS_EN,
  information_title: 'Informations client',
  products_title: 'Produits',
  email_address_label: 'Adresse e-mail',
  email_address_placeholder: 'Saisissez votre e-mail',
  location_dtc_title: 'Adresse',
  location_b2b_title: 'Emplacement',
  auto_fill_help_text: 'Connectez-vous pour remplir vos informations automatiquement.',
  contact_and_company_title: 'Contact et entreprise',
  contact_title: 'Coordonnées',
  contact_person_title: 'Personne à contacter',
  contact_first_name_label: 'Prénom',
  placeholder_contact_first_name: 'Saisissez votre prénom',
  contact_last_name_label: 'Nom',
  placeholder_contact_last_name: 'Saisissez votre nom',
  contact_phone_number_label: 'Téléphone',
  placeholder_contact_phone_number: 'Saisissez votre numéro',
  company_title: 'Informations sur l’entreprise',
  company_name_label: 'Nom de l’entreprise',
  shipping_title: 'Adresse de livraison',
  shipping_country_label: 'Pays/Région',
  shipping_first_name_label: 'Prénom',
  shipping_last_name_label: 'Nom',
  shipping_company_label: 'Entreprise',
  shipping_address_label: 'Adresse',
  shipping_state_label: 'État/Province',
  shipping_city_label: 'Ville',
  shipping_postal_code_label: 'Code postal',
  shipping_phone_number_label: 'Téléphone',
  shipping_use_as_billing: 'Utiliser comme adresse de facturation',
  billing_title: 'Adresse de facturation',
  payment_term_title: 'Conditions de paiement',
  note_title: 'Remarque',
  edit_label: 'Modifier',
  add_product_label: 'Ajouter un produit',
};

function step2Texts(lang, header) {
  const fr = lang === 'FR';
  return {
    quote_form_header: {
      popup_header_list_quote: header[fr ? 1 : 0],
      popup_shopping_mess: fr ? 'Continuer les achats' : 'Continue Shopping',
    },
    quote_form_bottom: { submitting_quote_mess: fr ? 'Envoyer la demande' : 'Submit Request', submitting_position: 'right' },
    quote_form_request_list: fr
      ? {
          product_text: 'PRODUIT', quantity_text: 'QUANTITÉ', sku_text: 'SKU', properties_form_text: 'Propriétés', price_text: 'PRIX',
          offered_price_text: 'PRIX SOUHAITÉ', total_price_text: 'PRIX TOTAL', message_text: 'NOTES', message_placeholder: 'Saisissez vos notes', sub_total_price_quote_text: 'Sous-total',
        }
      : {
          product_text: 'PRODUCT', quantity_text: 'QUANTITY', sku_text: 'SKU', properties_form_text: 'Properties', price_text: 'PRICE',
          offered_price_text: 'WISHED PRICE', total_price_text: 'TOTAL PRICE', message_text: 'NOTES', message_placeholder: 'Enter your notes', sub_total_price_quote_text: 'Subtotal',
        },
    empty_list: fr
      ? { popup_header_empty_quote: 'Votre devis est vide', empty_quote_mess: 'Ajoutez des produits à votre devis pour commencer', continue_shopping_label: 'Continuer les achats' }
      : { popup_header_empty_quote: 'Your quote is empty', empty_quote_mess: 'Add some products to your quote to get started', continue_shopping_label: 'Continue shopping' },
    request_submit: fr
      ? { toast_message: 'Demande envoyée', popup_header_submitted_quote: 'Demande envoyée', success_submit_mess: 'Merci pour votre demande ! Nous revenons vers vous très vite.', continue_shopping_label: 'Continuer les achats' }
      : { toast_message: 'Request Submitted', popup_header_submitted_quote: 'Request Submitted', success_submit_mess: 'Thank you for your request! Our team will get back to you with a quote shortly.', continue_shopping_label: 'Continue shopping' },
    quote_form_information: { form_data: {} },
  };
}

// Field texts (label / placeholder / content / choices) live per language.
function fieldTexts(fields, lang, fr = {}) {
  const out = {};
  fields.forEach((f) => {
    const t = lang === 'FR' && fr[f.id] ? fr[f.id] : {};
    out[f.id] = {
      label: t.label ?? f.label ?? '',
      placeholder: t.placeholder ?? f.placeholder ?? '',
      content: t.content ?? f.content ?? '',
      choices: t.choices ?? (f.choices ? f.choices.map((c) => ({ ...c })) : []),
    };
  });
  return out;
}

const REQUEST_LIST_DEFAULT = {
  hide_remove_table: 0,
  hide_option_table: 0,
  hide_quantity_table: 0,
  show_product_sku: 1,
  show_properties_form: 0,
  show_product_price: 1,
  show_offered_price: 1,
  show_total_price: 1,
  show_product_message: 0,
  show_sub_total_price_quote: 1,
};

const contactInfo = () => ({
  first_name: { enabled: true, required: true },
  last_name: { enabled: true, required: false },
  phone_number: { enabled: true, required: false },
});
const shippingAddress = () => ({
  country: { enabled: true, required: true, country_mode: 'all', specific_country_codes: [], market_ids: [] },
  first_name: { enabled: true, required: false },
  last_name: { enabled: true, required: false },
  company: { enabled: false, required: false },
  address: { enabled: true, required: true },
  state: { enabled: true, required: false },
  city: { enabled: true, required: true },
  postal_code: { enabled: true, required: false },
  phone_number: { enabled: true, required: false },
});

function step1Lang(lang, fields, fr) {
  const isFr = lang === 'FR';
  return {
    quote_form_header: {
      popup_header_list_quote: isFr ? 'Étape 1 : Demande produit' : 'Step 1: Product Inquiry',
      popup_shopping_mess: isFr ? 'Continuer les achats' : 'Continue Shopping',
    },
    footer_setting: { submitting_quote_mess: isFr ? 'Ajouter au devis' : 'Add To Quote' },
    information_setting: fieldTexts(fields, lang, fr),
  };
}

// ── DTC form ─────────────────────────────────────────────────────────────────
const DTC_STEP1_FORM1 = [
  { id: 410231, input: 'text', type: 'textarea', label: 'Detail inquiry', placeholder: 'Tell us what you need', defaultValue: '', max: 20, min: 0, width: 100, req: 0 },
];
const DTC_STEP1_FORM2 = [
  { id: 410245, input: 'text', type: 'number', label: 'Target quantity', placeholder: 'Enter your number', defaultValue: '', max: 6, min: 1, width: 50, req: 1 },
  { id: 410246, input: 'date', label: 'Required delivery date', placeholder: 'Select a date', defaultValue: '', width: 50, req: 0, dateFormat: 'F j, Y', allowDateBefore: false },
];
const DTC_STEP1_FR = {
  410231: { label: 'Détail de la demande', placeholder: 'Dites-nous ce dont vous avez besoin' },
  410245: { label: 'Quantité souhaitée', placeholder: 'Saisissez un nombre' },
  410246: { label: 'Date de livraison souhaitée', placeholder: 'Choisissez une date' },
};
const DTC_STEP2_FIELDS = [
  { id: 520011, input: 'select', label: 'Preferred contact method', placeholder: 'Select your option', defaultValue: '', choices: [{ label: 'Email', sel: 0 }, { label: 'Phone', sel: 0 }, { label: 'WhatsApp', sel: 0 }], width: 50, req: 0 },
  // Shown only when the customer picks Phone or WhatsApp above ("Conditional").
  {
    id: 520014, input: 'text', type: 'phone', label: 'Phone number', placeholder: 'Enter your phone', defaultValue: '', max: 20, min: 0, width: 50, req: 1,
    use_condition: 1, conditions: [[{ formId: 520011, formType: 'select', operator: 'contains', conditionValue: ['Phone', 'WhatsApp'] }]],
  },
  { id: 520012, input: 'text', type: 'textarea', label: 'Additional notes', placeholder: 'Anything else we should know?', defaultValue: '', max: 20, min: 0, width: 100, req: 0 },
  { id: 520013, input: 'file', label: 'Upload files', placeholder: 'Upload files', multi: 1, width: 50, req: 0 },
];
const DTC_STEP2_FR = {
  520011: { label: 'Moyen de contact préféré', placeholder: 'Choisissez une option', choices: [{ label: 'E-mail', sel: 0 }, { label: 'Téléphone', sel: 0 }, { label: 'WhatsApp', sel: 0 }] },
  520014: { label: 'Numéro de téléphone', placeholder: 'Saisissez votre numéro' },
  520012: { label: 'Remarques', placeholder: 'Autre chose à nous dire ?' },
  520013: { label: 'Joindre des fichiers', placeholder: 'Joindre des fichiers' },
};

function dtcForm() {
  const translations = {
    EN: { lang_code: 'EN', lang_name: 'English', is_default: true, translations: { ...LABELS_EN }, form_step_2: step2Texts('EN', ['Step 2: Contact Info']) },
    FR: { lang_code: 'FR', lang_name: 'French', is_default: false, translations: { ...LABELS_FR }, form_step_2: step2Texts('FR', ['Step 2: Contact Info', 'Étape 2 : Coordonnées']) },
  };
  translations.EN.form_step_2.quote_form_information.form_data = fieldTexts(DTC_STEP2_FIELDS, 'EN');
  translations.FR.form_step_2.quote_form_information.form_data = fieldTexts(DTC_STEP2_FIELDS, 'FR', DTC_STEP2_FR);
  return {
    multiple_form: [
      {
        id: 3101,
        name: 'Form 1',
        is_default: 1,
        type_condition: 'all',
        manual_condition: [],
        automatically_condition: [],
        quote_form_bottom: { submitting_position: 'right' },
        display_setting: { type_form: 'popup' },
        information_setting: DTC_STEP1_FORM1,
        languages: { EN: step1Lang('EN', DTC_STEP1_FORM1), FR: step1Lang('FR', DTC_STEP1_FORM1, DTC_STEP1_FR) },
      },
      {
        id: 3102,
        name: 'Bulk order form',
        is_default: 0,
        type_condition: 'selected',
        manual_condition: [
          { id: 'FIL-XL', product_title: 'Industrial filter, XL', variant: 'Standard' },
          { id: 'HOS-12', product_title: 'Reinforced hose, 12m', variant: '12 m' },
        ],
        automatically_condition: [],
        quote_form_bottom: { submitting_position: 'right' },
        display_setting: { type_form: 'popup' },
        information_setting: DTC_STEP1_FORM2,
        languages: { EN: step1Lang('EN', DTC_STEP1_FORM2), FR: step1Lang('FR', DTC_STEP1_FORM2, DTC_STEP1_FR) },
      },
    ],
    quote_form_request_list: { ...REQUEST_LIST_DEFAULT },
    quote_form_information: {
      form_data: DTC_STEP2_FIELDS,
      product_addition_in_form: 1,
      use_google_recaptcha: 0,
      type_recaptcha: 0,
      ggsite_key: { v2: '', v3: '' },
      ggsecret_key: { v2: '', v3: '' },
    },
    view_form_submit: { dtc_show_shipping: 1, dtc_multiple_shipping: 0, b2b_show_company: 1, b2b_show_shipping: 1, b2b_show_billing: 1, b2b_show_payment_term: 1 },
    fields_setting: { contact_info: contactInfo(), shipping_address: shippingAddress() },
    empty_list: { empty_quote_image: 1, illustration_image: null, image_name: '' },
    request_submit: { type: 'full-size', request_submit_image: 1, illustration_image: null, image_name: '', redirect_url: '', open_in_new_tab: 0 },
    appearance_form: { ...APPEARANCE_DEFAULT },
    use_multiple_language: true,
    translations,
  };
}

// ── B2B form (Pro Plus): no step 1 yet, company / billing / payment terms on ──
const B2B_STEP2_FIELDS = [
  { id: 620021, input: 'text', type: 'text', label: 'PO number', placeholder: 'Enter your purchase order number', defaultValue: '', max: 20, min: 0, width: 50, req: 0 },
  { id: 620022, input: 'date', label: 'Requested delivery date', placeholder: 'Select a date', defaultValue: '', width: 50, req: 0, dateFormat: 'F j, Y', allowDateBefore: false },
  { id: 620023, input: 'text', type: 'textarea', label: 'Additional notes', placeholder: 'Delivery instructions, payment preferences…', defaultValue: '', max: 20, min: 0, width: 100, req: 0 },
];

function b2bForm() {
  const translations = {
    EN: { lang_code: 'EN', lang_name: 'English', is_default: true, translations: { ...LABELS_EN }, form_step_2: step2Texts('EN', ['Request a quote']) },
  };
  translations.EN.form_step_2.quote_form_information.form_data = fieldTexts(B2B_STEP2_FIELDS, 'EN');
  return {
    multiple_form: [],
    quote_form_request_list: { ...REQUEST_LIST_DEFAULT, show_offered_price: 0, show_product_message: 1 },
    quote_form_information: {
      form_data: B2B_STEP2_FIELDS,
      product_addition_in_form: 1,
      use_google_recaptcha: 0,
      type_recaptcha: 0,
      ggsite_key: { v2: '', v3: '' },
      ggsecret_key: { v2: '', v3: '' },
    },
    view_form_submit: { dtc_show_shipping: 1, dtc_multiple_shipping: 0, b2b_show_company: 1, b2b_show_shipping: 1, b2b_show_billing: 1, b2b_show_payment_term: 1 },
    fields_setting: { contact_info: contactInfo(), shipping_address: shippingAddress() },
    empty_list: { empty_quote_image: 1, illustration_image: null, image_name: '' },
    request_submit: { type: 'full-size', request_submit_image: 1, illustration_image: null, image_name: '', redirect_url: '', open_in_new_tab: 0 },
    appearance_form: { ...APPEARANCE_DEFAULT },
    use_multiple_language: false,
    translations,
  };
}

export function initialForms() {
  return { dtc: dtcForm(), b2b: b2bForm() };
}

// Texts a newly added language starts from ("Add new language with AI translation"):
// the prototype has no translation service, so it copies the default language.
export { LABELS_EN };
