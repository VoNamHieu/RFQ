import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { ApplyForm } from '../components/ApplyForm.jsx';
import { readRegistrationForm } from '../../shared/registrationForm.js';
import { CheckIcon } from '../components/icons.jsx';

// "Apply for a business account" — the storefront page a guest (or a signed-in
// customer) lands on from the store. The fields are NOT hard-coded here: they
// come from the merchant's registration form builder in the B2B app, rendered by
// <ApplyForm>. This page only supplies the storefront framing and the
// confirmation screen.

export function BusinessAccount() {
  const { state, dispatch } = useStore();
  const session = state.session;
  const loggedIn = !!session;
  const go = (view) => dispatch({ type: 'NAVIGATE', view });
  const form = readRegistrationForm();
  const [done, setDone] = useState(null);

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
            <h1>{form.heading}</h1>
            <p>{form.subheading} Reviewed by our team — usually within one business day.</p>
          </div>

          {/* Fields come from the merchant's form builder in the B2B app. */}
          <ApplyForm session={session} dispatch={dispatch} onSubmitted={({ ref, email }) => setDone({ ref, email })} />
        </div>
      )}
    </div>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────────

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
