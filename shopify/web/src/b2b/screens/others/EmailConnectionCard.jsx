import React, { useEffect, useState } from 'react';
import { Modal, useWcId } from '../../../shared/wc.jsx';
import { DEFAULT_SMTP_FORM, EMAIL_CONNECT_READ_MORE_URL, ENCRYPTION_OPTIONS } from './data.js';

// "Sender email" card (production: features/Email/components/EmailConnectionCard).
// The same card either way: its heading with a Connected / Not connected badge, then one
// row. Connected: the sender email with Disconnect, which opens the "Disconnect
// confirm" modal. Not connected: a line with Connect, which opens the "Sender email
// connection" SMTP form in a modal.
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
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  // A successful connect closes the form.
  useEffect(() => {
    if (isConnected) setIsConnectModalOpen(false);
  }, [isConnected]);

  const closeConnectModal = () => {
    setIsConnectModalOpen(false);
    onDismissConnectError();
  };

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

  return (
    <s-section>
      <s-stack gap="small">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-stack direction="inline" gap="small-400" alignItems="center">
            <s-heading>Sender email</s-heading>
            <s-button
              variant="tertiary"
              icon="info"
              href={EMAIL_CONNECT_READ_MORE_URL}
              target="_blank"
              accessibilityLabel="Read more about the sender email"
              interestFor={tipId}
            />
            <s-tooltip id={tipId}>Read more</s-tooltip>
          </s-stack>
          <s-badge tone={isConnected ? 'success' : 'caution'}>{isConnected ? 'Connected' : 'Not connected'}</s-badge>
        </s-stack>

        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="center">
          {isConnected ? (
            <s-stack gap="small-500">
              <s-text>{connectedEmail}</s-text>
              <s-text color="subdued">Connected sender account</s-text>
            </s-stack>
          ) : (
            <s-text color="subdued">Connect an email account to send notifications.</s-text>
          )}
          {isConnected ? (
            <s-button onClick={() => setIsDisconnectPopupOpen(true)}>Disconnect</s-button>
          ) : (
            <s-button onClick={() => setIsConnectModalOpen(true)}>Connect</s-button>
          )}
        </s-grid>
      </s-stack>

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

      <Modal open={isConnectModalOpen} onClose={closeConnectModal} heading="Sender email connection">
        <s-stack gap="small">
          <s-paragraph color="subdued">
            This sender email will be used to send notifications and emails to you and your customers
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
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          loading={isConnecting}
          disabled={isContinueDisabled}
          onClick={() => onConnect(smtpForm)}
        >
          Continue
        </s-button>
        <s-button slot="secondary-actions" onClick={closeConnectModal}>
          Cancel
        </s-button>
      </Modal>
    </s-section>
  );
}
