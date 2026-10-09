import React, { useEffect, useRef, useState } from 'react';
import { Modal, useWcId } from '../../../shared/wc.jsx';
import { EMAIL_PROVIDERS } from './data.js';
import { DataRows, InnerCard, fullApp, useToast } from './ui.jsx';
import './email.css';

// Production: components/Settings/EmailTemplate.jsx + QuoteSettings/GeneralSettings/EmailSettings.jsx
// (sender connection) + FormConnect/FormSetupSMTPBFS.jsx / FormSetupMailAPIBFS.jsx.

const AUTO = 'auto_confirm';
const ADMIN = 'admin_notice';
const PROPOSAL = 'quote_email';
const VENDOR = 'quote_vendor';

const TEMPLATES = [
  { type: AUTO, title: 'Auto-response email', description: 'Email sent automatically to customers after quote submission' },
  { type: ADMIN, title: 'Admin email', description: 'Email sent automatically to you after quote submission' },
  { type: PROPOSAL, title: 'Proposal email', description: 'Email sent to customers to offer product price' },
  { type: VENDOR, title: 'Vendor email', description: 'Email sent automatically to vendors after quote submission for price inquiry' },
];

export function EmailTemplateSection({ email, vendor, onEmailChange, onVendorChange, account, onAccountChange }) {
  const toast = useToast();
  const id = useWcId('qcfg-email');
  const connected = !!account;

  const statusOf = (type) => {
    if (type === VENDOR) return !!vendor.send_to_vendor;
    if (type === ADMIN) return !!email.send_to_admin;
    if (type === AUTO) return !!email.send_to_customer;
    return false;
  };

  const toggle = (type) => {
    if (type === VENDOR) onVendorChange({ ...vendor, send_to_vendor: Number(!vendor.send_to_vendor) });
    else if (type === ADMIN) onEmailChange({ ...email, send_to_admin: Number(!email.send_to_admin) });
    else if (type === AUTO) onEmailChange({ ...email, send_to_customer: Number(!email.send_to_customer) });
  };

  const tooltipFor = (type) => {
    if (!connected) return 'Connect sender email to activate';
    return statusOf(type) ? 'Click to deactivate email' : 'Click to activate email';
  };

  const rows = TEMPLATES.map((t) => {
    const active = statusOf(t.type);
    return {
      key: t.type,
      content: (
        <>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-text fontWeight="bold">{t.title}</s-text>
            {t.type !== PROPOSAL ? <s-badge tone={active ? 'success' : undefined}>{active ? 'Active' : 'Inactive'}</s-badge> : null}
          </s-stack>
          <s-text>{t.description}</s-text>
          {t.type === AUTO ? (
            <s-box paddingBlockStart="small-400">
              <s-checkbox
                label="Attach Quote PDF with email"
                checked={!!email.attach_quote_pdf_to_auto_response}
                disabled={!email.send_to_customer}
                onChange={(e) => onEmailChange({ ...email, attach_quote_pdf_to_auto_response: e.currentTarget.checked ? 1 : 0 })}
              />
            </s-box>
          ) : null}
        </>
      ),
      actions: (
        <s-stack direction="inline" gap="small-200" justifyContent="end">
          {t.type !== PROPOSAL ? (
            <>
              {/* A disabled button gets no hover, so the tooltip anchors on a wrapper text. */}
              <s-text interestFor={`${id}-tip-${t.type}`}>
                <s-button
                  icon={active ? 'toggle-on' : 'toggle-off'}
                  accessibilityLabel={tooltipFor(t.type)}
                  disabled={!connected}
                  onClick={() => toggle(t.type)}
                />
              </s-text>
              <s-tooltip id={`${id}-tip-${t.type}`}>{tooltipFor(t.type)}</s-tooltip>
            </>
          ) : null}
          <s-button
            icon="edit"
            accessibilityLabel={`Edit ${t.title}`}
            disabled={!connected}
            onClick={() => toast(fullApp(`the ${t.title} template editor`))}
          />
        </s-stack>
      ),
    };
  });

  return (
    <s-section>
      <s-stack gap="base">
        <s-heading fontSize="large">Email Template</s-heading>
        <EmailConnection account={account} onAccountChange={onAccountChange} />
        <div className="qcfg-email-table">
          <DataRows headings={['Name', 'Action']} rows={rows} />
        </div>
      </s-stack>
    </s-section>
  );
}

function initialsOf(text) {
  return String(text || '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2);
}

// Polaris AccountConnection (connected state) as a nested card.
function AccountConnection({ name, title, details, action }) {
  return (
    <InnerCard>
      <div className="qcfg-email-account">
        <s-avatar initials={initialsOf(name)} alt={name} size="base" />
        <s-stack gap="small-500">
          <s-heading>{title}</s-heading>
          <s-text color="subdued">{details}</s-text>
        </s-stack>
        <div>{action}</div>
      </div>
    </InnerCard>
  );
}

const SMTP_TYPES = ['gmail', 'sendgrid', 'other'];
const DEFAULT_TYPE = 'gmail_api';
const OAUTH_TYPES = ['gmail_api', 'office_365'];

function providerDefaults(type) {
  const p = EMAIL_PROVIDERS.find((x) => x.account_type === type) || EMAIL_PROVIDERS[0];
  return {
    account_type: p.account_type,
    email_user: p.email_user ?? '',
    email_pass: '',
    email_smtp: p.email_smtp ?? '',
    email_port: p.email_port ?? '465',
    email_encryption: p.email_encryption ?? 'ssl',
    email_from: p.email_from ?? '',
    oAuthData: null,
  };
}

function EmailConnection({ account, onAccountChange }) {
  const toast = useToast();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [connectType, setConnectType] = useState(() => providerDefaults('gmail_api'));
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(2); // 2 = choose / fill in, 3 = sending the test email
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const choose = (type) => {
    clearTimeout(timer.current);
    setConnectType(providerDefaults(type));
    setErrors({});
    setStep(2);
  };

  const sendTestEmail = (connectedAccount) => {
    setStep(3);
    timer.current = setTimeout(() => {
      onAccountChange(connectedAccount);
      setStep(2);
      toast('Test email sent');
    }, 1200);
  };

  const submitSmtp = () => {
    const e = {
      email_user: !connectType.email_user.trim(),
      email_pass: !connectType.email_pass.trim(),
      email_smtp: !connectType.email_smtp.trim(),
      email_port: !String(connectType.email_port).trim(),
    };
    if (connectType.account_type === 'sendgrid') e.email_from = !connectType.email_from.trim();
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    const address = connectType.account_type === 'sendgrid' ? connectType.email_from : connectType.email_user;
    sendTestEmail({ account_type: connectType.account_type, email: address, name: address });
  };

  // OAuth popup (Google / Microsoft) in production — here it signs in the store owner.
  const login = () => {
    setConnectType((c) => ({ ...c, oAuthData: { name: 'Charles N', email: 'charles@quotesnap.co' } }));
  };

  const field = (key) => ({
    value: connectType[key],
    error: errors[key] ? 'This field is required' : undefined,
    onInput: (e) => {
      const v = e.currentTarget.value;
      setErrors((x) => ({ ...x, [key]: false }));
      setConnectType((c) => ({ ...c, [key]: key === 'email_port' ? v.replace('-', '') : v }));
    },
  });

  // Production `enableConnectButton`: picking a type other than the stored one (Sign in with
  // Google once disconnected) enables Continue right away; validation runs on submit.
  const smtpChanged = (() => {
    if (connectType.account_type !== DEFAULT_TYPE) return true;
    const d = providerDefaults(connectType.account_type);
    return ['email_user', 'email_pass', 'email_smtp', 'email_port', 'email_encryption'].some((k) => connectType[k] !== d[k]);
  })();

  return (
    <>
      {account ? (
        <AccountConnection
          name={account.email}
          title="Account connect"
          details={account.email}
          action={<s-button onClick={() => setConfirmDisconnect(true)}>Disconnect</s-button>}
        />
      ) : (
        <InnerCard>
          <s-stack gap="small-200">
            <s-heading>Sender email connection</s-heading>
            <s-paragraph>
              Sender email connection is required. This sender email will be used to send the below notifications and emails to you and your
              customers
            </s-paragraph>
            {step !== 3 ? (
              <div className="qcfg-actionlist" role="menu">
                {EMAIL_PROVIDERS.map((p) => {
                  const active = p.account_type === connectType.account_type;
                  return (
                    <button
                      key={p.account_type}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      className="qcfg-actionlist__item"
                      onClick={() => choose(p.account_type)}
                    >
                      <img src={p.image} alt="" />
                      <span className="qcfg-actionlist__label">{p.content}</span>
                      {active ? <s-icon type="check" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {step === 2 ? (
              // Production: <Box paddingBlockStart={200}> around the setup form + its button row.
              <s-box paddingBlockStart="small-200">
                {SMTP_TYPES.includes(connectType.account_type) ? (
                  <s-stack gap="base">
                    <s-text-field label="Username" placeholder="Enter your username/ email address" autocomplete="off" {...field('email_user')} />
                    <s-password-field label="Password" placeholder="Enter your password" autocomplete="off" {...field('email_pass')} />
                    {connectType.account_type === 'sendgrid' ? (
                      <s-email-field label="Email send from" placeholder="Enter send from email address" autocomplete="off" {...field('email_from')} />
                    ) : null}
                    <s-text-field label="Server address" placeholder="Enter SMTP" {...field('email_smtp')} />
                    <s-number-field label="Port" placeholder="Enter port" min={0} inputMode="numeric" {...field('email_port')} />
                    <s-select
                      label="Encryption"
                      value={connectType.email_encryption}
                      onChange={(e) => {
                        const v = e.currentTarget.value;
                        setConnectType((c) => ({ ...c, email_encryption: v }));
                      }}
                    >
                      <s-option value="ssl">SSL</s-option>
                      <s-option value="tls">TLS</s-option>
                    </s-select>
                    <s-stack direction="inline" justifyContent="end">
                      <s-button variant="primary" disabled={!smtpChanged} onClick={submitSmtp}>
                        Continue
                      </s-button>
                    </s-stack>
                  </s-stack>
                ) : null}

                {OAUTH_TYPES.includes(connectType.account_type) && connectType.oAuthData ? (
                  <AccountConnection
                    name={connectType.oAuthData.name}
                    title="Account connect"
                    details={connectType.oAuthData.email}
                    action={
                      <s-button
                        variant="primary"
                        onClick={() => sendTestEmail({ account_type: connectType.account_type, ...connectType.oAuthData })}
                      >
                        Continue
                      </s-button>
                    }
                  />
                ) : null}

                {OAUTH_TYPES.includes(connectType.account_type) && !connectType.oAuthData ? (
                  <s-stack direction="inline" justifyContent="end">
                    <s-button variant="primary" onClick={login}>
                      Continue
                    </s-button>
                  </s-stack>
                ) : null}
              </s-box>
            ) : null}

            {step === 3 ? (
              <s-stack direction="inline" gap="small-400" alignItems="center">
                <s-spinner size="base" accessibilityLabel="Sending test email" />
                <s-text>Test email is being sent....</s-text>
              </s-stack>
            ) : null}
          </s-stack>
        </InnerCard>
      )}

      <Modal open={confirmDisconnect} size="small" heading="Disconnect confirm" onClose={() => setConfirmDisconnect(false)}>
        <s-paragraph>You will no longer be able to send or receive emails if you disconnect your account.</s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          onClick={() => {
            setConfirmDisconnect(false);
            onAccountChange(null);
            choose('gmail_api');
            toast('Email disconnected');
          }}
        >
          Disconnect
        </s-button>
        <s-button slot="secondary-actions" onClick={() => setConfirmDisconnect(false)}>
          Cancel
        </s-button>
      </Modal>
    </>
  );
}
