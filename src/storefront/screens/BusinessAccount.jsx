import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { CheckIcon, LockIcon, BuildingIcon } from '../components/icons.jsx';

// "Apply for a business account" — self-serve B2B registration.
//
// Kept deliberately short. When the applicant is already signed in, their name,
// email and address come from the Shopify customer record, so we don't ask again
// — we show an "Applying as…" summary and only collect what the account can't
// know: the business identity. Address/phone are confirmed by the merchant when
// they set up the company location after approval, so they're not asked here.
//
// Required: business name + Tax/VAT ID + consent (plus name & email for guests).
// Everything else is optional. B2B sign-in is passwordless (a 6-digit email
// code), so there's no password field.

const BUSINESS_TYPES = ['Retailer', 'Wholesaler / Distributor', 'Reseller', 'Manufacturer', 'Contractor / Trade', 'Other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BusinessAccount() {
  const { state, dispatch } = useStore();
  const session = state.session;
  const loggedIn = !!session;
  const go = (view) => dispatch({ type: 'NAVIGATE', view });

  const [form, setForm] = useState(() => ({
    legalName: session?.companyName || '', // prefill from the account when we can
    businessType: '', taxId: '', notes: '',
    contactName: '', email: '', phone: '', // guests only
    agree: false, marketing: false,
  }));
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const check = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }));

  const required = loggedIn ? ['legalName', 'taxId'] : ['legalName', 'taxId', 'contactName', 'email'];
  const emailOk = loggedIn || EMAIL_RE.test(form.email.trim());
  const valid = required.every((k) => String(form[k]).trim()) && emailOk && form.agree;

  const errorFor = (k) => {
    if (required.includes(k) && !String(form[k]).trim()) return 'Required';
    if (k === 'email' && form.email.trim() && !EMAIL_RE.test(form.email.trim())) return 'Enter a valid email';
    return '';
  };

  const submit = () => {
    setTried(true);
    if (!valid) {
      document.querySelector('.reg-card .has-error, .reg-consent .reg-error')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const ref = `APP-${Math.floor(4200 + Math.random() * 800)}`;
    const email = loggedIn ? session.email : form.email.trim();
    dispatch({
      type: 'SUBMIT_B2B_APPLICATION',
      application: {
        ref,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        company: form.legalName.trim(),
        contact: loggedIn ? session.contact : form.contactName.trim(),
        email,
        taxId: form.taxId.trim(),
        businessType: form.businessType,
        status: 'Pending review',
        inheritedFrom: loggedIn ? session.email : null,
        form,
      },
    });
    setDone({ ref, email });
  };

  return (
    <div className="reg">
      <header className="acct-header">
        <div className="acct-logo" onClick={() => go('home')}>221 Baker</div>
        <div className="acct-header-right">
          {!done && (loggedIn ? (
            <a className="link" style={{ color: 'var(--b2b)' }} onClick={() => go('account')}>Back to account</a>
          ) : (
            <span className="muted" style={{ fontSize: '1.45rem' }}>
              Already approved?{' '}
              <a className="link" style={{ color: 'var(--b2b)' }} onClick={() => dispatch({ type: 'LOGIN' })}>Log in</a>
            </span>
          ))}
        </div>
      </header>

      {done ? <Success ref_={done.ref} email={done.email} onDone={() => go(loggedIn ? 'account' : 'home')} /> : (
        <div className="reg-wrap">
          <div className="reg-intro">
            <span className="reg-eyebrow">Wholesale &amp; trade</span>
            <h1>Apply for a business account</h1>
            <p>Contract pricing, volume discounts and quote requests. Reviewed by our team — usually within one business day.</p>
          </div>

          <div className="reg-card">
            {loggedIn && (
              <div className="reg-identity">
                <span className="reg-identity-avatar">{(session.contact || '?').charAt(0).toUpperCase()}</span>
                <div className="reg-identity-main">
                  <strong>Applying as {session.contact}</strong>
                  <p className="muted">{session.email}{session.location ? ` · ${session.location}` : ''}</p>
                </div>
                <span className="reg-identity-tag">From your account</span>
              </div>
            )}

            {!loggedIn && (
              <Fieldset legend="Primary contact" sub="This person becomes the account's first buyer and admin.">
                <Field label="Full name" required error={tried && errorFor('contactName')}>
                  <input className={cx('input', tried && errorFor('contactName'))} value={form.contactName} onChange={set('contactName')} placeholder="Watson James" />
                </Field>
                <Field label="Work email" required error={tried && errorFor('email')} hint="This becomes your sign-in.">
                  <input className={cx('input', tried && errorFor('email'))} type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" />
                </Field>
                <Field label="Phone" hint="Optional">
                  <input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+84 …" />
                </Field>
              </Fieldset>
            )}

            <Fieldset icon={<BuildingIcon />} legend="Your business" sub="What we can't get from your account.">
              <Field label="Legal business name" required error={tried && errorFor('legalName')} full>
                <input className={cx('input', tried && errorFor('legalName'))} value={form.legalName} onChange={set('legalName')} placeholder="Watson Co Ltd" />
              </Field>
              <Field label="Tax ID / VAT number" required error={tried && errorFor('taxId')} hint="We verify this during review.">
                <input className={cx('input', tried && errorFor('taxId'))} value={form.taxId} onChange={set('taxId')} placeholder="e.g. VN0312345678" />
              </Field>
              <Field label="Business type" hint="Optional">
                <select className="select" value={form.businessType} onChange={set('businessType')}>
                  <option value="" disabled>Select type…</option>
                  {BUSINESS_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Anything we should know?" hint="Optional" full>
                <textarea className="textarea" value={form.notes} onChange={set('notes')} placeholder="Products of interest, expected order frequency, existing account reference…" />
              </Field>
            </Fieldset>

            {!loggedIn && (
              <div className="reg-passwordless">
                <LockIcon />
                <span>No password to create. Once approved, you sign in with a one-time 6-digit code sent to your work email.</span>
              </div>
            )}

            <div className="reg-consent">
              <label className="reg-check">
                <input type="checkbox" checked={form.agree} onChange={check('agree')} />
                <span>
                  I'm authorised to open an account for this business and I agree to the{' '}
                  <a className="link" onClick={(e) => e.preventDefault()}>Terms</a> and{' '}
                  <a className="link" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
                  <span className="reg-required">*</span>
                </span>
              </label>
              {tried && !form.agree && <p className="reg-error">Please confirm to continue.</p>}
              <label className="reg-check">
                <input type="checkbox" checked={form.marketing} onChange={check('marketing')} />
                <span>Email me trade offers, new arrivals and bulk-pricing updates.</span>
              </label>
            </div>

            <div className="reg-actions">
              <button className="button button--b2b" onClick={submit}>Submit application</button>
              <span className="muted">
                {loggedIn ? "We'll review it and email you once your account is upgraded." : "We'll email you once your account is reviewed."}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────────

function Fieldset({ icon, legend, sub, children }) {
  return (
    <fieldset className="reg-fieldset">
      <legend className="reg-legend">{icon && <span className="reg-legend-icon">{icon}</span>}{legend}</legend>
      {sub && <p className="reg-legend-sub">{sub}</p>}
      <div className="reg-grid">{children}</div>
    </fieldset>
  );
}

function Field({ label, required, error, hint, full, children }) {
  return (
    <div className={`reg-field${full ? ' reg-field--full' : ''}`}>
      <label className="field-label">{label}{required && <span className="reg-required">*</span>}</label>
      {children}
      {error ? <p className="reg-error">{error}</p> : hint ? <p className="reg-hint">{hint}</p> : null}
    </div>
  );
}

function Success({ ref_, email, onDone }) {
  return (
    <div className="reg-success">
      <span className="reg-success-badge"><CheckIcon /></span>
      <h1>Application received</h1>
      <p>Thanks — your business account request is with our team.</p>
      <span className="badge badge--blue reg-ref">Reference {ref_}</span>
      <div className="reg-steps">
        <Step n={1}>We review your business details — usually within <strong>one business day</strong>.</Step>
        <Step n={2}>You'll get an email at <strong>{email}</strong> the moment you're approved.</Step>
        <Step n={3}>Sign in and shop at your <strong>contract prices</strong>.</Step>
      </div>
      <button className="button button--b2b" onClick={onDone}>Done</button>
    </div>
  );
}

function Step({ n, children }) {
  return (
    <div className="reg-step">
      <span className="reg-step-num">{n}</span>
      <span>{children}</span>
    </div>
  );
}

function cx(base, error) {
  return error ? `${base} has-error` : base;
}
