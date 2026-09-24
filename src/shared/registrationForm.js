// The B2B registration form, shared by the two sides of the demo:
//   - the B2B app's form builder (Registrations → form) WRITES the configuration
//     the merchant edits (fields, title, after-submit message);
//   - the storefront's "Apply for a business account" page READS it and renders
//     exactly those fields, so the apply form always matches the configuration.
//
// The two live on separate pages (a full reload apart), so the hand-off goes
// through localStorage — the same trick as the RFQ ↔ B2B demo state.
import { readJSON, writeJSON } from './persistence.js';

export const REGISTRATION_FORM_KEY = 'qsRegistrationForm';

// Every field the builder can put on the form. `half` = sits next to the field
// before it; headings split the form into sections.
export const BUILTIN_FIELDS = [
  { id: 'contactHeading', kind: 'heading', label: 'Contact information' },
  { id: 'firstName', kind: 'text', label: 'First name', required: true, half: true },
  { id: 'lastName', kind: 'text', label: 'Last name', required: true, half: true },
  { id: 'email', kind: 'email', label: 'Business email', required: true },
  { id: 'password', kind: 'password', label: 'Password', required: true },
  { id: 'phone', kind: 'phone', label: 'Phone number' },
  { id: 'businessHeading', kind: 'heading', label: 'Business information' },
  { id: 'company', kind: 'company', label: 'Company name', required: true },
  { id: 'country', kind: 'country', label: 'Country', required: true },
  { id: 'state', kind: 'state', label: 'State' },
  { id: 'taxId', kind: 'text', label: 'Tax / VAT ID' },
  { id: 'address', kind: 'location', label: 'Address' },
  { id: 'apartment', kind: 'location', label: 'Apartment' },
  { id: 'city', kind: 'location', label: 'City' },
  { id: 'zip', kind: 'location', label: 'Zip code' },
  { id: 'aboutHeading', kind: 'heading', label: 'Tell us about your business (optional)' },
  { id: 'message', kind: 'textarea', label: 'Message / business details' },
  { id: 'marketing', kind: 'checkbox', label: 'Subscribe to our marketing emails' },
  { id: 'submit', kind: 'submit', label: 'Submit B2B application' },
];
export const BUILTIN_ORDER = BUILTIN_FIELDS.map((f) => f.id);

// ── Field rules ──────────────────────────────────────────────────────────────
// One set of rules, read by the form builder, the storefront form and the review
// screen, so "required" means the same thing on all three.
//
// Required only applies to inputs: headings and the submit button never are.
export const canRequire = (f) => f.kind !== 'heading' && f.kind !== 'submit';
// Always required and can't be removed: approving an application needs them — the
// company name names the new Company, the email is its main contact.
export const LOCKED_FIELDS = ['email', 'company'];
export const isLocked = (f) => LOCKED_FIELDS.includes(f.id);
export const isRequired = (f) => isLocked(f) || (canRequire(f) && !!f.required);
// Every form keeps its submit button and its locked fields.
export const canRemove = (f) => f.kind !== 'submit' && !isLocked(f);

// A heading the merchant marked "(optional)" drops the note once a field in its
// section (up to the next heading) is required — the section isn't optional then.
const OPTIONAL_NOTE = /\s*\(optional\)\s*$/i;
export const withoutOptionalNote = (label) => label.replace(OPTIONAL_NOTE, '');
export function headingLabel(fields, index) {
  const heading = fields[index];
  const rest = fields.slice(index + 1);
  const end = rest.findIndex((f) => f.kind === 'heading');
  const section = end === -1 ? rest : rest.slice(0, end);
  return section.some(isRequired) ? withoutOptionalNote(heading.label) : heading.label;
}

// Choices for Dropdown / Radio options fields (the builder has no options editor yet).
export const DEFAULT_CHOICES = ['Option 1', 'Option 2', 'Option 3'];
export const choicesFor = (f) => (Array.isArray(f.options) && f.options.length ? f.options : DEFAULT_CHOICES);

// State / province by the chosen country; a country without a list types it in.
export const STATES = {
  Vietnam: ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Bắc Ninh', 'Bình Dương', 'Đồng Nai', 'Quảng Ninh', 'Khánh Hòa'],
  'United States': ['California', 'Florida', 'Georgia', 'Illinois', 'New York', 'North Carolina', 'Ohio', 'Pennsylvania', 'Texas', 'Washington'],
  Japan: ['Tokyo', 'Osaka', 'Kanagawa', 'Aichi', 'Hokkaido', 'Fukuoka'],
  Australia: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia', 'Tasmania'],
};

// Saved configs from before these rules: locked fields back to required, the
// submit button never required.
const normalizeFields = (fields) => fields.map((f) => (
  f.kind === 'submit' ? { ...f, required: false } : isLocked(f) ? { ...f, required: true } : f
));

// The starter form: only what the merchant needs to decide "do I approve this
// buyer, and which company do they belong to?". It reads as a B2B application,
// not a customer sign-up, so there's no password; address details are a layer
// merchants add when they need them.
export const DEFAULT_FIELD_IDS = [
  'contactHeading', 'firstName', 'lastName', 'email',
  'businessHeading', 'company', 'country', 'taxId',
  'aboutHeading', 'message', 'submit',
];
export const TEMPLATE_FIELDS = BUILTIN_FIELDS.filter((f) => DEFAULT_FIELD_IDS.includes(f.id));

// Storefront copy around the configured fields. The merchant's builder owns the
// fields and the after-submit message; the rest is the app's own storefront copy.
export const DEFAULT_FORM = {
  title: 'B2B registration form',
  heading: 'Apply for a business account',
  subheading: 'Contract pricing, volume discounts and quote requests.',
  sectionHeading: 'Your business',
  consent: "I'm authorised to apply for a business account.",
  fields: TEMPLATE_FIELDS,
  message: 'Thank you for completing your registration. Our team will connect with you as soon as possible',
};

// Written by the B2B form builder when the merchant saves.
export function writeRegistrationForm(config) {
  writeJSON(REGISTRATION_FORM_KEY, config);
}

// Read by the storefront, the review screen and the builder's "Edit form". Falls
// back to the starter form when the merchant hasn't saved one yet (or storage is
// unavailable).
export function readRegistrationForm() {
  const saved = readJSON(REGISTRATION_FORM_KEY);
  if (!saved || !Array.isArray(saved.fields) || !saved.fields.length) return DEFAULT_FORM;
  return { ...DEFAULT_FORM, ...saved, fields: normalizeFields(saved.fields) };
}

// The label the merchant gave the submit button, e.g. "Submit application".
export const submitLabel = (form) => form.fields.find((f) => f.kind === 'submit')?.label || 'Submit application';

// Fields the storefront actually asks for: headings and inputs, minus the submit
// row and minus anything the signed-in customer account already answers.
const KNOWN_FROM_ACCOUNT = ['firstName', 'lastName', 'email', 'password'];
export function visibleFields(form, { signedIn }) {
  const fields = form.fields.filter((f) => f.kind !== 'submit' && !(signedIn && KNOWN_FROM_ACCOUNT.includes(f.id)));
  // Drop a heading left with no fields under it (e.g. "Contact information"
  // once the account supplies the name and email).
  return fields.filter((f, i) => {
    if (f.kind !== 'heading') return true;
    const next = fields[i + 1];
    return next && next.kind !== 'heading';
  });
}
