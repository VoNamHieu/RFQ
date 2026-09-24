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
  { id: 'submit', kind: 'submit', label: 'Submit B2B application', required: true },
];
export const BUILTIN_ORDER = BUILTIN_FIELDS.map((f) => f.id);

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

// Written by the B2B form builder on every edit.
export function writeRegistrationForm(config) {
  writeJSON(REGISTRATION_FORM_KEY, config);
}

// Read by the storefront. Falls back to the starter form when the merchant has
// not opened the builder yet (or storage is unavailable).
export function readRegistrationForm() {
  const saved = readJSON(REGISTRATION_FORM_KEY);
  if (!saved || !Array.isArray(saved.fields) || !saved.fields.length) return DEFAULT_FORM;
  return { ...DEFAULT_FORM, ...saved };
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
