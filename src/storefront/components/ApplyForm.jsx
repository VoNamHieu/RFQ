import React, { useMemo, useState } from 'react';
import {
  readRegistrationForm, submitLabel, visibleFields, isRequired, headingLabel, choicesFor, STATES,
} from '../../shared/registrationForm.js';

// The storefront side of the merchant's registration form: it renders exactly the
// fields configured in the B2B app's form builder (Registrations → form), so
// adding or removing a field there changes this form too.
//
// Fields the signed-in customer account already answers (name, email, password)
// are dropped — Shopify knows them — and shown as an "Applying as…" line instead.

const COUNTRIES = ['Vietnam', 'United States', 'Japan', 'Singapore', 'Australia', 'United Kingdom', 'Other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ApplyForm({ session, onSubmitted, dispatch }) {
  const form = useMemo(readRegistrationForm, []);
  // Headings read against what's actually shown: "(optional)" drops once a field below is required.
  const fields = useMemo(() => {
    const shown = visibleFields(form, { signedIn: !!session });
    return shown.map((f, i) => (f.kind === 'heading' ? { ...f, label: headingLabel(shown, i) } : f));
  }, [form, session]);
  const [values, setValues] = useState(() => {
    const seed = {};
    fields.forEach((f) => { seed[f.id] = f.kind === 'checkbox' ? false : ''; });
    if (seed.company !== undefined && session?.companyName) seed.company = session.companyName;
    return seed;
  });
  const [agree, setAgree] = useState(false);
  const [tried, setTried] = useState(false);

  // A new country has its own states, so the picked one no longer applies.
  const set = (id, value) => setValues((v) => ({ ...v, [id]: value, ...(id === 'country' && v.state !== undefined ? { state: '' } : {}) }));
  // Same rule as the builder (shared isRequired); a required checkbox must be ticked.
  const errorFor = (f) => {
    const value = values[f.id];
    const empty = f.kind === 'checkbox' ? !value : !String(value ?? '').trim();
    if (isRequired(f) && empty) return 'Required';
    if (f.kind === 'email' && String(value).trim() && !EMAIL_RE.test(String(value).trim())) return 'Enter a valid email';
    return '';
  };
  const valid = fields.every((f) => !errorFor(f)) && agree;

  const submit = () => {
    setTried(true);
    if (!valid) return;
    const ref = `APP-${Math.floor(4200 + Math.random() * 800)}`;
    const contact = session?.contact || `${values.firstName || ''} ${values.lastName || ''}`.trim();
    const email = session?.email || values.email || '';
    dispatch({
      type: 'SUBMIT_B2B_APPLICATION',
      application: {
        ref,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        company: values.company || values.legalName || '',
        contact,
        email,
        taxId: values.taxId || '',
        businessType: values.businessType || '',
        status: 'Pending review',
        inheritedFrom: session?.email || null,
        values,
      },
    });
    onSubmitted?.({ ref, email });
  };

  return (
    <div className="apply-card">
      <h3>{form.sectionHeading}</h3>

      {session && (
        <p className="muted apply-as">Applying as {session.contact} · {session.email}</p>
      )}

      {fields.map((f) => (
        <FormField key={f.id} field={f} value={values[f.id]} country={values.country} error={tried ? errorFor(f) : ''}
          onChange={(v) => set(f.id, v)} />
      ))}

      <label className="apply-check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>{form.consent}</span>
      </label>
      {tried && !agree && <p className="reg-error">Please confirm to continue.</p>}

      <button className="button button--b2b" onClick={submit}>{submitLabel(form)}</button>
    </div>
  );
}

// One configured field. The label doubles as the placeholder, as in the design;
// selects keep a small label above the value so the choice stays readable.
function FormField({ field, value, country, error, onChange }) {
  const cls = `input${error ? ' has-error' : ''}`;
  const label = field.label + (isRequired(field) ? ' *' : '');

  if (field.kind === 'heading') return <h4 className="apply-heading">{field.label}</h4>;

  if (field.kind === 'textarea') {
    return (
      <div className="apply-field">
        <textarea className={`textarea${error ? ' has-error' : ''}`} rows="3" aria-label={field.label}
          placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} />
        {error && <p className="reg-error">{error}</p>}
      </div>
    );
  }

  if (field.kind === 'checkbox') {
    return (
      <div className="apply-field">
        <label className="apply-check">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span>{label}</span>
        </label>
        {error && <p className="reg-error">{error}</p>}
      </div>
    );
  }

  if (field.kind === 'radio') {
    return (
      <div className="apply-field apply-field--select" role="radiogroup" aria-label={field.label}>
        <span className="apply-field-label">{label}</span>
        {choicesFor(field).map((o) => (
          <label key={o} className="apply-check">
            <input type="radio" name={field.id} checked={value === o} onChange={() => onChange(o)} />
            <span>{o}</span>
          </label>
        ))}
        {error && <p className="reg-error">{error}</p>}
      </div>
    );
  }

  // State is a list only for a chosen country that has one; otherwise it's typed in.
  const states = field.kind === 'state' ? STATES[country] : null;
  if (field.kind === 'country' || states || field.kind === 'dropdown') {
    const options = field.kind === 'country' ? COUNTRIES : states || choicesFor(field);
    return (
      <div className="apply-field apply-field--select">
        <span className="apply-field-label">{label}</span>
        <select className="select" aria-label={field.label} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {error && <p className="reg-error">{error}</p>}
      </div>
    );
  }

  const type = field.kind === 'email' ? 'email' : field.kind === 'phone' ? 'tel'
    : field.kind === 'password' ? 'password' : field.kind === 'number' ? 'number'
    : field.kind === 'date' ? 'date' : field.kind === 'upload' ? 'file' : 'text';

  return (
    <div className="apply-field">
      <input className={cls} type={type} aria-label={field.label} placeholder={label}
        value={type === 'file' ? undefined : value} onChange={(e) => onChange(e.target.value)} />
      {error && <p className="reg-error">{error}</p>}
    </div>
  );
}
