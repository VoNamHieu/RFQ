import React, { useState } from 'react';
import { Modal, useWcId } from '../../../shared/wc.jsx';
import { DEFAULT_SMTP_FORM, EMAIL_CONNECT_READ_MORE_URL, ENCRYPTION_OPTIONS } from './data.js';

// "Email notification" card (production: features/Email/components/EmailConnectionCard).
// Not connected: the "Sender email connection" SMTP form. Connected: the
// AccountConnection row with Disconnect (+ "Disconnect confirm" modal).
export function EmailConnectionCard({
  isConnected,
  isConnecting,
  isDisconnecting,
  connectedEmail,
  connectError,
  onConnect,
  onDisconnect,
  onDismissConnectError,
}) {
  const tipId = useWcId('oth-email-tip');
  const [smtpForm, setSmtpForm] = useState(DEFAULT_SMTP_FORM);
  const [isDisconnectPopupOpen, setIsDisconnectPopupOpen] = useState(false);

  const handleSmtpFieldChange = (field, value) => setSmtpForm((previous) => ({ ...previous, [field]: value }));

  const handleDisconnect = async () => {
    const isSuccess = await onDisconnect();
    if (isSuccess) {
      setIsDisconnectPopupOpen(false);
      setSmtpForm(DEFAULT_SMTP_FORM);
    }
  };

  const isContinueDisabled =
    [smtpForm.emailUser, smtpForm.emailPass, smtpForm.emailSmtp, smtpForm.emailPort].some((value) => !value.trim()) ||
    isConnecting;

  const errorBanner = connectError ? (
    <s-banner tone="critical" dismissible onDismiss={onDismissConnectError}>
      <s-paragraph>{connectError}</s-paragraph>
    </s-banner>
  ) : null;

  // AccountConnection's avatar initials: the first letter of each word of accountName.
  const accountName = 'Account connect';
  const initials = accountName
    .split(/\s+/)
    .map((name) => name[0])
    .join('');

  return (
    <s-section>
      <s-stack gap="small">
        <s-stack direction="inline" gap="small-400" alignItems="center">
          <s-heading>Email notification</s-heading>
          <s-button
            variant="tertiary"
            icon="info"
            href={EMAIL_CONNECT_READ_MORE_URL}
            target="_blank"
            accessibilityLabel="Read more about email notification"
            interestFor={tipId}
          />
          <s-tooltip id={tipId}>Read more</s-tooltip>
        </s-stack>

        {isConnected ? (
          <>
            {errorBanner}
            <s-box border="base" borderRadius="base" padding="base">
              <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-avatar initials={initials} alt={accountName} />
                  <s-stack gap="small-400">
                    <s-text>{accountName}</s-text>
                    {connectedEmail ? <s-text color="subdued">{connectedEmail}</s-text> : null}
                  </s-stack>
                </s-stack>
                <s-button onClick={() => setIsDisconnectPopupOpen(true)}>Disconnect</s-button>
              </s-grid>
            </s-box>
            <Modal
              open={isDisconnectPopupOpen}
              onClose={() => setIsDisconnectPopupOpen(false)}
              heading="Disconnect confirm"
              size="small"
            >
              <s-paragraph>You will no longer be able to send or receive emails if you disconnect your account.</s-paragraph>
              <s-button
                slot="primary-action"
                variant="primary"
                tone="critical"
                loading={isDisconnecting}
                disabled={isDisconnecting}
                onClick={handleDisconnect}
              >
                Disconnect
              </s-button>
              <s-button slot="secondary-actions" onClick={() => setIsDisconnectPopupOpen(false)}>
                Cancel
              </s-button>
            </Modal>
          </>
        ) : (
          <s-box border="base" borderRadius="base" padding="base">
            <s-stack gap="small">
              <s-heading>Sender email connection</s-heading>
              <s-paragraph color="subdued">
                Sender email connection is required. This sender email will be used to send the below notifications and
                emails to you and your customers
              </s-paragraph>

              <s-text-field
                autocomplete="off"
                label="Username"
                required
                placeholder="Enter your username/email address"
                value={smtpForm.emailUser}
                onInput={(e) => handleSmtpFieldChange('emailUser', e.currentTarget.value)}
              />

              <s-password-field
                autocomplete="off"
                label="Password"
                required
                placeholder="Enter your password"
                value={smtpForm.emailPass}
                onInput={(e) => handleSmtpFieldChange('emailPass', e.currentTarget.value)}
              />

              <s-text-field
                autocomplete="off"
                label="Server address"
                required
                placeholder="Enter SMTP"
                value={smtpForm.emailSmtp}
                onInput={(e) => handleSmtpFieldChange('emailSmtp', e.currentTarget.value)}
              />

              <s-text-field
                autocomplete="off"
                label="Port"
                required
                placeholder="Enter port"
                value={smtpForm.emailPort}
                onInput={(e) => {
                  // Digits only; write the cleaned value back so a rejected key doesn't stay visible.
                  const digits = e.currentTarget.value.replace(/[^0-9]/g, '');
                  if (digits !== e.currentTarget.value) e.currentTarget.value = digits;
                  handleSmtpFieldChange('emailPort', digits);
                }}
              />

              <s-select
                label="Encryption"
                required
                value={smtpForm.emailEncryption}
                onChange={(e) => handleSmtpFieldChange('emailEncryption', e.currentTarget.value)}
              >
                {ENCRYPTION_OPTIONS.map((o) => (
                  <s-option key={o.value} value={o.value}>
                    {o.label}
                  </s-option>
                ))}
              </s-select>

              {errorBanner}

              <s-stack direction="inline" justifyContent="end">
                <s-button
                  variant="primary"
                  loading={isConnecting}
                  disabled={isContinueDisabled}
                  onClick={() => onConnect(smtpForm)}
                >
                  Continue
                </s-button>
              </s-stack>
            </s-stack>
          </s-box>
        )}
      </s-stack>
    </s-section>
  );
}
