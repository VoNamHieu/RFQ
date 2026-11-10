import React, { useState } from 'react';
import { Modal } from '../../../shared/wc.jsx';

// "Send test email" (production: features/Email/components/SendTestEmailModal).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function SendTestEmailModal({ open, email, loading = false, onClose, onEmailChange, onSend }) {
  const [emailError, setEmailError] = useState(undefined);
  const isSendDisabled = !email.trim();

  const handleClose = () => {
    setEmailError(undefined);
    onClose();
  };

  const handleSend = () => {
    const normalizedEmail = email.trim();
    if (normalizedEmail !== email) onEmailChange(normalizedEmail);
    if (!normalizedEmail) return;
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailError('This field must be a valid email address.');
      return;
    }
    setEmailError(undefined);
    onSend(normalizedEmail);
  };

  return (
    <Modal open={open} onClose={handleClose} heading="Send test email" size="small">
      <s-text-field
        label="Email"
        autocomplete="email"
        value={email}
        error={emailError}
        onInput={(e) => {
          if (emailError) setEmailError(undefined);
          onEmailChange(e.currentTarget.value);
        }}
      />
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={isSendDisabled}
        loading={loading}
        onClick={handleSend}
      >
        Send
      </s-button>
      <s-button slot="secondary-actions" onClick={handleClose}>
        Cancel
      </s-button>
    </Modal>
  );
}
