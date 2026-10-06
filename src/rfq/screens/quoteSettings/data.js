// Static demo data for the Quote settings screen (production: pages/CollectQuotePage.jsx
// and components/CollectQuote/*). Each settings group has one record per store mode
// ("dtc" = Default store, "b2b" = B2B store), like the app's settings endpoints.
// Copy comes from fe/rfq/public/locales/en/*.json.
import { RFQ_CATALOG } from '../../data/catalog.js';
import { COUNTRY_OPTIONS, QUOTE_BUTTON_TRANSLATIONS } from './i18nData.js';

export const clone = (o) => JSON.parse(JSON.stringify(o));

// ── Tabs (pageTrans.json) ──────────────────────────────────────────────────
export const TABS = [
  { id: 'quote-button', content: 'Quote button', group: 'quoteButton' },
  { id: 'hide-price', content: 'Hide price', group: 'hidePrice' },
  { id: 'hide-add-cart', content: 'Hide Add To Cart button', group: 'hideButtons' },
  { id: 'hide-buy-now', content: 'Hide Buy Now button', group: 'hideButtons' },
  { id: 'quote-cart', content: 'Quote cart widget', group: 'quoteCart' },
  { id: 'quote-history', content: 'Quote history widget', group: 'history' },
  { id: 'quote-checkout', content: 'Checkout page', group: 'checkout' },
];

export const HELP_LINKS = {
  'quote-button': 'https://help.omegatheme.com/en/article/1-quote-button-1hr18hp/',
  'hide-price': 'https://help.omegatheme.com/en/article/2-hide-price-1wzrn8o/',
  'hide-add-cart': 'https://help.omegatheme.com/en/article/3-hide-add-to-cart-button-1r0uzem/',
  'hide-buy-now': 'https://help.omegatheme.com/en/article/4-hide-buy-now-button-1u5mes1/',
  'quote-cart': 'https://help.omegatheme.com/en/article/5-quote-cart-widget-1fkt5ya/',
  'quote-history': 'https://help.omegatheme.com/en/article/6-quote-history-widget-1hi8ekr/',
  'quote-checkout': 'https://help.omegatheme.com/en/article/1-quote-button-1hr18hp/',
};

// ── Shared option lists (translation.json → general.*) ─────────────────────
export const POSITION_OPTIONS = [
  { value: 'auto', label: "Under Button 'Add To Cart'" },
  { value: 'title', label: 'Under product title' },
  { value: 'price', label: 'Under product price' },
  { value: 'description', label: 'Under product description' },
  { value: 'addCode', label: 'Position of your choice' },
];

export const CART_POSITION_OPTIONS = [
  { value: 'under', label: 'Under Checkout button' },
  { value: 'before', label: 'Above Checkout button' },
];

export const CONDITION_TYPE_OPTIONS = [
  { value: 'title', label: 'Product title' },
  { value: 'type', label: 'Product type' },
  { value: 'vendor', label: 'Product Vendor' },
  { value: 'price', label: 'Product price' },
  { value: 'tag', label: 'Product Tag' },
  { value: 'inventory', label: 'Inventory quantity' },
  { value: 'time', label: 'Created/Published time' },
];

const OPTIONS_IS_STRING = [
  { value: 'contain', label: 'Contains' },
  { value: 'not_contain', label: 'does not contain' },
  { value: 'startwith', label: 'start with' },
  { value: 'endwith', label: 'end with' },
];
const OPTIONS_IS_NUMBER = [
  { value: 'equal', label: 'is equal to' },
  { value: 'notequal', label: 'is not equal to' },
  { value: 'greater', label: 'Greater' },
  { value: 'smaller', label: 'Smaller' },
];
const OPTIONS_IS_TIME = [
  { value: 'publish_before', label: 'is published before' },
  { value: 'publish_after', label: 'is published after' },
  { value: 'publish_equal', label: 'is published equal' },
  { value: 'create_before', label: 'is created before' },
  { value: 'create_after', label: 'is created after' },
  { value: 'create_equal', label: 'is created equal' },
];

export function isChosenOptions(selectedType) {
  if (selectedType === 'price' || selectedType === 'inventory') return OPTIONS_IS_NUMBER;
  if (selectedType === 'time') return OPTIONS_IS_TIME;
  return OPTIONS_IS_STRING;
}

export function valueTypeFor(selectedType) {
  if (selectedType === 'price' || selectedType === 'inventory') return 'number';
  if (selectedType === 'time') return 'date';
  return 'text';
}

export const DEFAULT_AND_CONDITION = {
  selectedType: 'title',
  isChoosen: 'contain',
  valueCondition: '',
  isString: true,
  isNumber: false,
  isCustomer: false,
  isInventory: false,
  isTime: false,
};

// APPLY_CUSTOMER_MODE (constant/general.jsx)
export const CUSTOMER_MODE = {
  ALL: 0,
  LOGGED_IN: 1,
  GUEST: 2,
  WITH_TAGS: 3,
  COUNTRY: 4,
  WITHOUT_TAGS: 5,
};

// constant/quoteForm.jsx positionOptions / unitOptions
export const WIDGET_POSITION_OPTIONS = [
  { value: 'next_cart', label: 'Next to "Cart icon"' },
  { value: 'right', label: 'On the right' },
  { value: 'left', label: 'On the left' },
];
export const UNIT_OPTIONS = [
  { value: 'percentage', label: '%' },
  { value: 'px', label: 'px' },
];

// Quote button default texts per language and the country list (i18nData.js).
export { COUNTRY_OPTIONS, QUOTE_BUTTON_TRANSLATIONS };

// constant/graphqlLanguages.js LANGUAGE_OPTIONS ([code, label]).
export const LANGUAGE_OPTIONS = [["AF","Afrikaans"],["AK","Akan"],["AM","Amharic"],["AR","Arabic"],["AS","Assamese"],["AZ","Azerbaijani"],["BE","Belarusian"],["BG","Bulgarian"],["BM","Bambara"],["BN","Bangla"],["BO","Tibetan"],["BR","Breton"],["BS","Bosnian"],["CA","Catalan"],["CE","Chechen"],["CKB","Central Kurdish"],["CS","Czech"],["CU","Church Slavic"],["CY","Welsh"],["DA","Danish"],["DE","German"],["DZ","Dzongkha"],["EE","Ewe"],["EL","Greek"],["EN","English"],["EO","Esperanto"],["ES","Spanish"],["ET","Estonian"],["EU","Basque"],["FA","Persian"],["FF","Fulah"],["FI","Finnish"],["FIL","Filipino"],["FO","Faroese"],["FR","French"],["FY","Western Frisian"],["GA","Irish"],["GD","Scottish Gaelic"],["GL","Galician"],["GU","Gujarati"],["GV","Manx"],["HA","Hausa"],["HE","Hebrew"],["HI","Hindi"],["HR","Croatian"],["HU","Hungarian"],["HY","Armenian"],["IA","Interlingua"],["ID","Indonesian"],["IG","Igbo"],["II","Sichuan Yi"],["IS","Icelandic"],["IT","Italian"],["JA","Japanese"],["JV","Javanese"],["KA","Georgian"],["KI","Kikuyu"],["KK","Kazakh"],["KL","Kalaallisut"],["KM","Khmer"],["KN","Kannada"],["KO","Korean"],["KS","Kashmiri"],["KU","Kurdish"],["KW","Cornish"],["KY","Kyrgyz"],["LA","Latin"],["LB","Luxembourgish"],["LG","Ganda"],["LN","Lingala"],["LO","Lao"],["LT","Lithuanian"],["LU","Luba-Katanga"],["LV","Latvian"],["MG","Malagasy"],["MI","Māori"],["MK","Macedonian"],["ML","Malayalam"],["MN","Mongolian"],["MO","Moldavian"],["MR","Marathi"],["MS","Malay"],["MT","Maltese"],["MY","Burmese"],["NB","Norwegian (Bokmål)"],["ND","North Ndebele"],["NE","Nepali"],["NL","Dutch"],["NN","Norwegian Nynorsk"],["NO","Norwegian"],["OM","Oromo"],["OR","Odia"],["OS","Ossetic"],["PA","Punjabi"],["PL","Polish"],["PS","Pashto"],["PT","Portuguese"],["PT_BR","Portuguese (Brazil)"],["PT_PT","Portuguese (Portugal)"],["QU","Quechua"],["RM","Romansh"],["RN","Rundi"],["RO","Romanian"],["RU","Russian"],["RW","Kinyarwanda"],["SA","Sanskrit"],["SC","Sardinian"],["SD","Sindhi"],["SE","Northern Sami"],["SG","Sango"],["SH","Serbo-Croatian"],["SI","Sinhala"],["SK","Slovak"],["SL","Slovenian"],["SN","Shona"],["SO","Somali"],["SQ","Albanian"],["SR","Serbian"],["SU","Sundanese"],["SV","Swedish"],["SW","Swahili"],["TA","Tamil"],["TE","Telugu"],["TG","Tajik"],["TH","Thai"],["TI","Tigrinya"],["TK","Turkmen"],["TO","Tongan"],["TR","Turkish"],["TT","Tatar"],["UG","Uyghur"],["UK","Ukrainian"],["UR","Urdu"],["UZ","Uzbek"],["VI","Vietnamese"],["VO","Volapük"],["WO","Wolof"],["XH","Xhosa"],["YI","Yiddish"],["YO","Yoruba"],["ZH","Chinese"],["ZH_CN","Chinese (Simplified)"],["ZH_TW","Chinese (Traditional)"],["ZU","Zulu"]].map(([code, label]) => ({ code, label, value: label }));

export const languageLabel = (code) => LANGUAGE_OPTIONS.find((l) => l.code === code)?.label || 'English';

// Languages the quote form already has translations for (quote form builder) —
// a quote-button language outside this list gets the "Add … translation for
// quote form" suggestion.
export const QUOTE_FORM_LANGUAGES = { dtc: ['EN', 'VI'], b2b: ['EN'] };

// ── Shopify resource picker data (products / collections of the demo store) ──
export const PICKER_PRODUCTS = RFQ_CATALOG.map((p, i) => ({
  product_id: 8800100 + i,
  title: p.title,
  handle: p.sku.toLowerCase(),
  variants: p.variants.map((v, j) => ({ id: 47100200 + i * 10 + j, title: v.title, sku: v.id })),
}));

export const PICKER_COLLECTIONS = [
  { collection_id: 4401001, title: 'Filters & filtration', handle: 'filters', count: 2 },
  { collection_id: 4401002, title: 'Hoses & fittings', handle: 'hoses-fittings', count: 1 },
  { collection_id: 4401003, title: 'Valves', handle: 'valves', count: 1 },
  { collection_id: 4401004, title: 'Sealants & adhesives', handle: 'sealants', count: 1 },
  { collection_id: 4401005, title: 'Team apparel', handle: 'team-apparel', count: 1 },
  { collection_id: 4401006, title: 'Wholesale only', handle: 'wholesale-only', count: 4 },
];

// A manual_condition row (handleFilterDataProduct): one entry per product variant.
export const productRow = (product, variant) => ({
  product_id: product.product_id,
  product_variant_id: variant.id,
  product_title: product.title,
  product_handle: product.handle,
  product_image: '',
  product_variant: { id: variant.id, title: variant.title },
});

// ── Default settings per store mode ────────────────────────────────────────
const baseStyles = (label, overrides = {}) => ({
  label,
  font_size: '14px',
  font_color: 'rgba(255, 255, 255, 1)',
  bg_color: 'rgba(0, 0, 0, 1)',
  border_radius: '4px',
  text_align: 'center',
  text_bold: 0,
  text_italic: 0,
  text_underline: 0,
  stroke_enable: 1,
  stroke_size: '0px',
  stroke_color: 'rgba(0, 0, 0, 1)',
  shadow_enable: 0,
  hover_enable: 0,
  hover_font_size: '14px',
  hover_font_color: 'rgba(255, 255, 255, 1)',
  hover_border_radius: '4px',
  hover_bg_color: 'rgba(48, 48, 48, 1)',
  hover_stroke_size: '0px',
  hover_stroke_color: 'rgba(0, 0, 0, 1)',
  ...overrides,
});

const quoteButton = (type, extra = {}) => ({
  type,
  show_on_product: 1,
  show_on_collection: 0,
  show_on_cart: 0,
  position_button: 'auto',
  cart_position: 'under',
  custom_element_position: '',
  type_condition: 'all',
  manual_condition: [],
  collection_condition: [],
  automatically_condition: [[{ ...DEFAULT_AND_CONDITION }]],
  applied_customers_mode: CUSTOMER_MODE.ALL,
  applied_customers_tags: [],
  applied_customers_without_tags: [],
  quantity_limit_setting: {
    active: false,
    applied_product_type: 0,
    min_quantity: 1,
    max_quantity: 0,
    max_same_as_inventory: false,
    allow_submit_out_of_stock: false,
  },
  type_form: 'popup',
  get_quote_action: { product_additions: false, export_pdf: true, send_quote_email: true },
  translations: [{ lang_code: 'EN', lang_name: 'English', is_default: true, translations: { ...QUOTE_BUTTON_TRANSLATIONS.EN } }],
  custom_styles: baseStyles('Request for quote'),
  ...extra,
});

const hidePrice = (type, extra = {}) => ({
  type,
  to_see_price: 1,
  hide_price_show_text: 'Contact us for price',
  hide_price_full_text_login: 'Please login to see price',
  hide_price_text_login: 'login',
  hide_price_login_url: '',
  hide_price_enter_pass: '',
  hide_on_product: 1,
  hide_on_collection: 1,
  hide_on_all_page: 0,
  type_condition: 'all',
  manual_condition: [],
  collection_condition: [],
  automatically_condition: [[{ ...DEFAULT_AND_CONDITION }]],
  applied_customers_mode: CUSTOMER_MODE.GUEST,
  applied_customers_tags: [],
  applied_customers_without_tags: [],
  applied_customers_country: [],
  ...extra,
});

const hideButtons = (type, extra = {}) => ({
  type,
  hide_add_cart: {
    hide: 0,
    display_logic: 0,
    atc_behavior: 'not_required',
    quantity_threshold: 10,
    use_inventory_threshold: 0,
    always_display_quote: 0,
  },
  hide_buy_now: { hide: 1, display_logic: 0 },
  ...extra,
});

const quoteCart = (type, extra = {}) => ({
  type,
  show_view_button: 1,
  show_view_button_empty: 0,
  view_quote_position: { side: 'right', margin_top: { amount: 50, unit: 'percentage' } },
  custom_styles: baseStyles('View quote', { quote_cart_icon: null }),
  ...extra,
});

const history = (type, extra = {}) => ({
  type,
  show_history_quotes_button: 1,
  view_history_quote_position: { side: 'left', margin_top: { amount: 40, unit: 'percentage' } },
  custom_styles: baseStyles('Quote history', { bg_color: 'rgba(255, 255, 255, 1)', font_color: 'rgba(0, 0, 0, 1)', stroke_size: '1px' }),
  ...extra,
});

export const INITIAL_SETTINGS = {
  quoteButton: {
    dtc: quoteButton('dtc'),
    b2b: quoteButton('b2b', {
      show_on_collection: 1,
      applied_customers_mode: CUSTOMER_MODE.LOGGED_IN,
      type_form: 'page',
    }),
  },
  hidePrice: {
    dtc: hidePrice('dtc'),
    b2b: hidePrice('b2b', { to_see_price: 4, applied_customers_mode: CUSTOMER_MODE.ALL }),
  },
  hideButtons: {
    dtc: hideButtons('dtc'),
    b2b: hideButtons('b2b', { hide_add_cart: { hide: 1, display_logic: 0, atc_behavior: 'not_required', quantity_threshold: 10, use_inventory_threshold: 0, always_display_quote: 0 } }),
  },
  quoteCart: { dtc: quoteCart('dtc'), b2b: quoteCart('b2b', { view_quote_position: { side: 'next_cart', margin_top: { amount: 50, unit: 'percentage' } } }) },
  history: { dtc: history('dtc'), b2b: history('b2b') },
  checkout: { enabled: false },
};
