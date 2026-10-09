// Pure helpers over the form settings object (see data.js for its shape) and the
// React context the builder's panels share. Mirrors the production selectors
// (useSettingMultipleForm, translations[lang].form_step_2, multiple_form[v].languages).

import { createContext, useContext } from 'react';
import { STEP_1, STEP_2, EMPTY_STATE } from './data.js';

export const BuilderContext = createContext(null);
export function useBuilder() {
  return useContext(BuilderContext);
}

export function defaultLang(form) {
  const codes = Object.keys(form.translations || {});
  return codes.find((c) => form.translations[c].is_default) || codes[0] || 'EN';
}

// utils/common.js resolveSelectedLanguage
export function resolveLang(form, lang) {
  return form.translations?.[lang] ? lang : defaultLang(form);
}

export function step2(form, lang) {
  return form.translations[resolveLang(form, lang)].form_step_2;
}

export function labels(form, lang) {
  return form.translations[resolveLang(form, lang)].translations;
}

export function step1Lang(form, variant, lang) {
  const mf = form.multiple_form[variant];
  if (!mf) return null;
  return mf.languages?.[lang] || mf.languages?.[defaultLang(form)] || null;
}

// utils visibleChoices — the storefront drops options without a label.
export const visibleChoices = (choices) => (Array.isArray(choices) ? choices.filter((c) => c?.label?.trim()) : []);

// Field definitions + their texts in `lang` (RequestFormTranslation fieldsTranslated).
export function fieldsWithText(form, step, variant, lang) {
  if (step === STEP_1) {
    const mf = form.multiple_form[variant];
    if (!mf) return [];
    const texts = step1Lang(form, variant, lang)?.information_setting || {};
    return (mf.information_setting || []).map((f) => ({ ...f, ...(texts[f.id] || {}) }));
  }
  const texts = step2(form, lang).quote_form_information.form_data || {};
  return (form.quote_form_information.form_data || []).map((f) => ({ ...f, ...(texts[f.id] || {}) }));
}

let seq = Date.now() % 100000;
export function newId() {
  seq += 1;
  return 700000 + seq;
}

// rgba(…) ↔ hex for the appearance color rows ("#000000, 100%").
export function parseRgba(value) {
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(value || '');
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  const h = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value || '');
  if (h) {
    const n = parseInt(h[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: h[2] ? parseInt(h[2], 16) / 255 : 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}
export function toHex({ r, g, b }) {
  return [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function toRgba({ r, g, b, a }) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * 100) / 100})`;
}

// utils convertToKilobytes
export function kilobytes(size) {
  return Math.round(Number(size) / 1024);
}

// utils isValidUrl (protocol optional) / normalizeRedirectUrl / redirectUrlErrorKey
const URL_PATTERN = new RegExp(
  '^(https?:\\/\\/)?' +
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
    '((\\d{1,3}\\.){3}\\d{1,3}))' +
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
    '(\\?[;&a-z\\d%_.~+=-]*)?' +
    '(\\#[-a-z\\d_]*)?$',
  'i',
);
export const isValidUrl = (url) => URL_PATTERN.test(url || '');
export function normalizeRedirectUrl(value) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const host = trimmed.split(/[/?#]/)[0];
  if (trimmed.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(trimmed) || !host.includes('.')) return trimmed;
  return `https://${trimmed}`;
}
export function redirectUrlError(value) {
  if (!value?.trim()) return "This field can't be blank";
  if (!isValidUrl(value)) return 'Please enter a valid URL';
  return '';
}

// validateCountryRestriction.js (the demo markets are all live).
export function countryRestrictionInvalid(country) {
  if (!country || country.enabled === false) return false;
  const mode = country.country_mode || 'all';
  if (mode === 'specific') return !(country.specific_country_codes || []).length;
  if (mode === 'markets') return !(country.market_ids || []).length;
  return false;
}

// ── Save validation (FormSetting/index.jsx handleSaveSettings + toggleTabOnError) ──
// Returns where the builder jumps to for the first problem, in production order:
// missing field labels → country restriction → redirect URL (client checks), then
// the required texts the API rejects ("Invalid data").
const blank = (v) => !String(v ?? '').trim();
const firstMissingLabel = (fields, texts) =>
  fields.find((f) => f.input !== 'simple' && texts?.[f.id] && blank(texts[f.id].label));

function labelError(form) {
  const codes = Object.keys(form.translations);
  for (let v = 0; v < form.multiple_form.length; v += 1) {
    const mf = form.multiple_form[v];
    const fields = mf.information_setting || [];
    for (const code of Object.keys(mf.languages || {})) {
      const f = firstMissingLabel(fields, mf.languages[code].information_setting);
      if (f) return { tab: 0, step: STEP_1, variant: v, lang: code, detail: 'product_note', fieldId: f.id };
    }
    const base = fields.find((f) => f.input !== 'simple' && blank(f.label));
    if (base) return { tab: 0, step: STEP_1, variant: v, detail: 'product_note', fieldId: base.id };
  }
  const fields = form.quote_form_information.form_data || [];
  const base = fields.find((f) => f.input !== 'simple' && blank(f.label));
  if (base) return { tab: 0, step: STEP_2, detail: 'note', fieldId: base.id };
  for (const code of codes) {
    const f = firstMissingLabel(fields, form.translations[code].form_step_2.quote_form_information.form_data);
    if (f) return { tab: 0, step: STEP_2, lang: code, detail: 'note', fieldId: f.id };
  }
  return null;
}

const REQUEST_LIST_LABELS = [
  ['product_text', () => true],
  ['quantity_text', (rl) => !Number(rl.hide_quantity_table)],
  ['sku_text', (rl) => !!Number(rl.show_product_sku)],
  ['properties_form_text', (rl) => !!Number(rl.show_properties_form)],
  ['price_text', (rl) => !!Number(rl.show_product_price)],
  ['offered_price_text', (rl) => !!Number(rl.show_offered_price)],
  ['sub_total_price_quote_text', (rl) => !!Number(rl.show_sub_total_price_quote)],
  ['total_price_text', (rl) => !!Number(rl.show_total_price)],
  ['message_text', (rl) => !!Number(rl.show_product_message)],
];

function serverError(form) {
  for (let v = 0; v < form.multiple_form.length; v += 1) {
    const mf = form.multiple_form[v];
    for (const code of Object.keys(mf.languages || {})) {
      const l = mf.languages[code];
      if (blank(l.quote_form_header?.popup_header_list_quote) || blank(l.quote_form_header?.popup_shopping_mess)) {
        return { tab: 0, step: STEP_1, variant: v, lang: code, detail: null };
      }
      if (blank(l.footer_setting?.submitting_quote_mess)) return { tab: 0, step: STEP_1, variant: v, lang: code, detail: 'button_step_1' };
    }
    const conditionError =
      (mf.type_condition === 'selected' && !mf.manual_condition.length) ||
      (mf.type_condition === 'automate' && mf.automatically_condition.some((g) => g.some((c) => blank(c.valueCondition))));
    if (conditionError) return { tab: 0, step: STEP_1, variant: v, detail: 'display_condition' };
    if (blank(mf.name)) return { tab: 0, step: STEP_1, variant: v, detail: 'formAttribute' };
  }
  const info = form.quote_form_information;
  const ver = Number(info.type_recaptcha) ? 'v3' : 'v2';
  if (Number(info.use_google_recaptcha) && (blank(info.ggsite_key?.[ver]) || blank(info.ggsecret_key?.[ver]))) {
    return { tab: 0, step: STEP_2, detail: 'behavior' };
  }
  const rl = form.quote_form_request_list;
  const rs = form.request_submit;
  for (const code of Object.keys(form.translations)) {
    const t2 = form.translations[code].form_step_2;
    const listError = REQUEST_LIST_LABELS.some(([key, on]) => on(rl) && blank(t2.quote_form_request_list[key]));
    const bottomError = blank(t2.quote_form_bottom.submitting_quote_mess);
    const headerError = blank(t2.quote_form_header.popup_header_list_quote) || blank(t2.quote_form_header.popup_shopping_mess);
    const emptyError = blank(t2.empty_list.popup_header_empty_quote) || blank(t2.empty_list.continue_shopping_label);
    const submitError =
      (rs.type === 'toast' && blank(t2.request_submit.toast_message)) ||
      ((rs.type || 'full-size') === 'full-size' && (blank(t2.request_submit.popup_header_submitted_quote) || blank(t2.request_submit.continue_shopping_label)));
    if (listError) return { tab: 0, step: STEP_2, lang: code, detail: 'productList' };
    if (bottomError) return { tab: 0, step: STEP_2, lang: code, detail: 'submitButton' };
    if (headerError) return { tab: 0, step: STEP_2, lang: code, detail: null };
    if (emptyError) return { tab: 0, step: EMPTY_STATE, lang: code, detail: 'emptyState' };
    if (submitError) return { tab: 1, lang: code };
  }
  return null;
}

export function findSaveError(forms) {
  const types = ['dtc', 'b2b'];
  for (const type of types) {
    const e = labelError(forms[type]);
    if (e) return { ...e, type, kind: 'labels' };
  }
  for (const type of types) {
    if (countryRestrictionInvalid(forms[type].fields_setting.shipping_address.country)) {
      return { type, kind: 'country', tab: 0, step: STEP_2, detail: 'customerInfo' };
    }
  }
  for (const type of types) {
    const rs = forms[type].request_submit;
    if (rs.type === 'direct-to-url' && redirectUrlError(rs.redirect_url)) return { type, kind: 'url', tab: 1 };
  }
  for (const type of types) {
    const e = serverError(forms[type]);
    if (e) return { ...e, type, kind: 'server' };
  }
  return null;
}
