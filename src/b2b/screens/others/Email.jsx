import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store.jsx';
import { SaveBar } from '../../../shared/wc.jsx';
import { EmailConnectionCard } from './EmailConnectionCard.jsx';
import { EmailTemplateEditor } from './EmailTemplateEditor.jsx';
import { RegistrationNotificationCard } from './RegistrationNotificationCard.jsx';
import {
  DEFAULT_NOTIFICATION_STATE,
  DEMO_EMAIL_SETTINGS,
  DEMO_EMAIL_TEMPLATES,
  NOTIFICATION_EMAIL_TEMPLATES,
  REGISTRATION_NOTIFICATION_ITEMS,
} from './data.js';

// Email section of the Others page (production: features/Email/components/Email):
// the sender connection card + the registration notification toggles, with a
// contextual save bar for unsaved toggle changes. A notification's edit icon
// opens its template editor in place of the cards (the app keeps it in the
// ?template=<key> query param of the same page); the page owns that key.

const mapSettingsToNotifications = (settings) => ({
  allow_auto_response_email: Boolean(settings.allow_auto_response_email),
  allow_admin_notification_email: Boolean(settings.allow_admin_notification_email),
  allow_approval_notification_email: Boolean(settings.allow_approval_notification_email),
  allow_rejection_notification_email: Boolean(settings.allow_rejection_notification_email),
});

const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

// features/Email/schema/emailTemplate.schema.ts (Admin email only).
const EMAIL_INVALID_MESSAGE = 'Please enter a valid email address';
const ADMIN_RECIPIENT_REQUIRED_MESSAGE = 'Admin recipient is required';
const SINGLE_EMAIL = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
const splitEmails = (value) =>
  value
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

function validateEmailTemplateForm(notificationKey, formState) {
  if (notificationKey !== 'allow_admin_notification_email') return { isValid: true, errors: {} };
  const errors = {};
  const admin = (formState.adminRecipient ?? '').trim();
  if (!admin || splitEmails(admin).length === 0) errors.adminRecipient = ADMIN_RECIPIENT_REQUIRED_MESSAGE;
  else if (splitEmails(admin).some((email) => !SINGLE_EMAIL.test(email))) errors.adminRecipient = EMAIL_INVALID_MESSAGE;
  ['bcc', 'cc', 'replyTo'].forEach((key) => {
    const value = (formState[key] ?? '').trim();
    if (value && splitEmails(value).some((email) => !SINGLE_EMAIL.test(email))) errors[key] = EMAIL_INVALID_MESSAGE;
  });
  return { isValid: Object.keys(errors).length === 0, errors };
}

const trimObjectProperties = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));

const cloneTemplates = () =>
  Object.fromEntries(Object.entries(DEMO_EMAIL_TEMPLATES).map(([k, v]) => [k, { ...v }]));

// Simulated API latency for connect / disconnect / send test email.
const LATENCY = 600;

export function Email({ activeNotificationEditor = null, onOpenEditor, onCloseEditor }) {
  const { dispatch } = useStore();
  const toast = (message) => dispatch({ type: 'TOAST', message });

  const initialNotifications = mapSettingsToNotifications(DEMO_EMAIL_SETTINGS);
  const [isConnected, setIsConnected] = useState(Boolean(DEMO_EMAIL_SETTINGS.is_connected));
  const [connectedEmail, setConnectedEmail] = useState(DEMO_EMAIL_SETTINGS.email ?? '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectError, setConnectError] = useState(null);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [savedNotifications, setSavedNotifications] = useState(initialNotifications);
  const [notificationCollapsed, setNotificationCollapsed] = useState(false);

  // Template editor state: the editable copy and what the "server" holds.
  const [notificationTemplateState, setNotificationTemplateState] = useState(cloneTemplates);
  const [savedTemplateState, setSavedTemplateState] = useState(cloneTemplates);
  const [templateFieldErrors, setTemplateFieldErrors] = useState({});
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn) => timers.current.push(setTimeout(fn, LATENCY));

  const handleConnect = (smtpForm) => {
    setConnectError(null);
    setIsConnecting(true);
    later(() => {
      setIsConnecting(false);
      // Demo: the SMTP login only succeeds for an email-style username.
      if (!looksLikeEmail(smtpForm.emailUser)) {
        setConnectError('Unable to connect to the SMTP server. Check your username, password and server settings, then try again.');
        return;
      }
      setNotifications(savedNotifications);
      setIsConnected(true);
      setConnectedEmail(smtpForm.emailUser.trim());
      toast('Connected email successfully');
    });
  };

  const handleDisconnect = () =>
    new Promise((resolve) => {
      setIsDisconnecting(true);
      setConnectError(null);
      later(() => {
        setNotifications(DEFAULT_NOTIFICATION_STATE);
        setSavedNotifications(DEFAULT_NOTIFICATION_STATE);
        setConnectedEmail('');
        setIsConnected(false);
        setIsDisconnecting(false);
        resolve(true);
      });
    });

  // Toggle via click on an icon button (fires once) — flip that key.
  const handleToggleNotification = (key) => setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));

  // Opening the editor loads the template from the server again, so edits left
  // unsaved on a previous visit are gone.
  const handleEditNotification = (item) => {
    setTemplateFieldErrors({});
    setNotificationTemplateState((previous) => ({ ...previous, [item.key]: { ...savedTemplateState[item.key] } }));
    onOpenEditor?.(item.key);
  };

  const handleTemplateFieldChange = (templateKey, field, value) => {
    setTemplateFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setNotificationTemplateState((previous) => ({
      ...previous,
      [templateKey]: { ...previous[templateKey], [field]: value },
    }));
  };

  const handleSaveTemplate = () => {
    if (!activeNotificationEditor) return;
    const normalizedFormState = trimObjectProperties(notificationTemplateState[activeNotificationEditor]);
    setNotificationTemplateState((previous) => ({ ...previous, [activeNotificationEditor]: normalizedFormState }));

    const validationResult = validateEmailTemplateForm(activeNotificationEditor, normalizedFormState);
    if (!validationResult.isValid) {
      setTemplateFieldErrors(validationResult.errors);
      return;
    }
    if (JSON.stringify(normalizedFormState) === JSON.stringify(savedTemplateState[activeNotificationEditor])) {
      setTemplateFieldErrors({});
      return;
    }
    setTemplateFieldErrors({});
    setSavedTemplateState((previous) => ({ ...previous, [activeNotificationEditor]: { ...normalizedFormState } }));
    toast('Email template saved');
  };

  const handleDiscardTemplate = () => {
    if (!activeNotificationEditor) return;
    setTemplateFieldErrors({});
    setNotificationTemplateState((previous) => ({
      ...previous,
      [activeNotificationEditor]: { ...savedTemplateState[activeNotificationEditor] },
    }));
  };

  const handleSendTestEmail = (email, onSuccess) => {
    if (!activeNotificationEditor) return;
    setIsSendingTestEmail(true);
    later(() => {
      setIsSendingTestEmail(false);
      toast('Test email successfully');
      onSuccess();
    });
  };

  const isNotificationsDirty = JSON.stringify(notifications) !== JSON.stringify(savedNotifications);
  const isTemplateDirty = activeNotificationEditor
    ? JSON.stringify(notificationTemplateState[activeNotificationEditor]) !==
      JSON.stringify(savedTemplateState[activeNotificationEditor])
    : false;
  const shouldOpenSaveBar = activeNotificationEditor ? isTemplateDirty : isConnected && isNotificationsDirty;

  const handleSaveToggleChanges = () => {
    if (!isNotificationsDirty) return;
    setSavedNotifications(notifications);
    toast('Saved successfully');
  };

  const handleDiscardToggleChanges = () => setNotifications(savedNotifications);

  const activeTemplate = activeNotificationEditor ? NOTIFICATION_EMAIL_TEMPLATES[activeNotificationEditor] : null;

  return (
    <>
      {shouldOpenSaveBar ? (
        <SaveBar
          message="You have unsaved changes"
          onSave={activeNotificationEditor ? handleSaveTemplate : handleSaveToggleChanges}
          onDiscard={activeNotificationEditor ? handleDiscardTemplate : handleDiscardToggleChanges}
          saveDisabled={activeNotificationEditor ? false : isConnecting || isDisconnecting}
        />
      ) : null}
      {activeNotificationEditor && activeTemplate ? (
        <EmailTemplateEditor
          key={activeNotificationEditor}
          connectedEmail={connectedEmail}
          formState={notificationTemplateState[activeNotificationEditor]}
          fieldErrors={templateFieldErrors}
          isTemplateDirty={isTemplateDirty}
          isSendingTestEmail={isSendingTestEmail}
          onBack={() => {
            setTemplateFieldErrors({});
            onCloseEditor?.();
          }}
          onFormFieldChange={(field, value) => handleTemplateFieldChange(activeNotificationEditor, field, value)}
          onSendTestEmail={handleSendTestEmail}
          template={activeTemplate}
        />
      ) : (
        <s-stack gap="base">
          <EmailConnectionCard
            isConnected={isConnected}
            connectedEmail={connectedEmail}
            isConnecting={isConnecting}
            isDisconnecting={isDisconnecting}
            connectError={connectError}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onDismissConnectError={() => setConnectError(null)}
          />
          <RegistrationNotificationCard
            notifications={notifications}
            isConnected={isConnected}
            collapsed={notificationCollapsed}
            items={REGISTRATION_NOTIFICATION_ITEMS}
            onToggleCollapse={() => setNotificationCollapsed((prev) => !prev)}
            onToggleNotification={handleToggleNotification}
            onEditNotification={handleEditNotification}
          />
        </s-stack>
      )}
    </>
  );
}
