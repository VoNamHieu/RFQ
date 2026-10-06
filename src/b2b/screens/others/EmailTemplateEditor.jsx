import React, { useState } from 'react';
import { useStore } from '../../store.jsx';
import { useWcId } from '../../../shared/wc.jsx';
import { RichTextEditor } from './RichTextEditor.jsx';
import { SendTestEmailModal } from './SendTestEmailModal.jsx';

// Notification email template editor (production: features/Email/components/
// AutoResponseEmailEditor). The Others page renders it in place of the cards when
// a notification's edit icon is clicked (?template=<key> in the app): a back
// button + the template title + "Send test email", then a 310px left panel
// (title, "Dynamic value" picker, detail, collapsible Preheader fields) beside
// the Subject and the rich-text Email body.

export function EmailTemplateEditor({
  connectedEmail,
  fieldErrors = {},
  formState,
  isSaving = false,
  isTemplateDirty = false,
  isSendingTestEmail = false,
  onBack,
  onFormFieldChange,
  onSendTestEmail,
  template,
}) {
  const { dispatch } = useStore();
  const toast = (message) => dispatch({ type: 'TOAST', message });
  const uid = useWcId('oth-tpl');
  const dynamicPopoverId = `${uid}-dynamic`;

  const [isPreheaderCollapsed, setIsPreheaderCollapsed] = useState(false);
  const [isSendTestModalOpen, setIsSendTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState(connectedEmail);

  const handleOpenSendTestModal = () => {
    setTestEmail(connectedEmail);
    setIsSendTestModalOpen(true);
  };

  const handleCopyDynamicValue = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast('Copied to clipboard');
    } catch {
      toast('Cannot copy value');
    }
  };

  return (
    <s-stack gap="base">
      <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small-200">
        <s-stack direction="inline" gap="small-400" alignItems="center">
          <s-button
            variant="tertiary"
            icon="chevron-left"
            accessibilityLabel="Back to email notification settings"
            onClick={onBack}
          />
          <s-heading fontSize="large-200">{template.title}</s-heading>
        </s-stack>
        <s-button variant="primary" disabled={isSaving || isTemplateDirty} onClick={handleOpenSendTestModal}>
          Send test email
        </s-button>
      </s-stack>

      {/* InlineGrid columns={{ xs: '1fr', md: '310px 1fr' }} — md is the app frame's
          768px breakpoint, i.e. ~720px of page content (the `oth-page` container). */}
      <s-grid
        gridTemplateColumns="@container oth-page (inline-size > 719px) 310px 1fr, 1fr"
        gap="base"
        alignItems="start"
      >
        <s-section padding="none">
          <s-box padding="base">
            <s-stack gap="small-400">
              <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small-200">
                <s-heading>{template.title}</s-heading>
                <s-clickable commandFor={dynamicPopoverId} accessibilityLabel="Dynamic value">
                  <span className="oth-dynamic-trigger">Dynamic value</span>
                </s-clickable>
              </s-grid>
              <s-popover id={dynamicPopoverId}>
                <div className="oth-dynamic-pane">
                  <s-box padding="small">
                    <s-heading>Dynamic value</s-heading>
                  </s-box>
                  <s-box paddingInline="small-300" paddingBlockEnd="small-300">
                    <s-stack gap="none">
                      {template.dynamicValues.map((item) => (
                        <s-clickable
                          key={item.value}
                          commandFor={dynamicPopoverId}
                          command="--hide"
                          paddingInline="small-200"
                          paddingBlock="small-300"
                          borderRadius="base"
                          onClick={() => handleCopyDynamicValue(item.value)}
                        >
                          <div className="oth-action-item">
                            <s-text>{`${item.value}: ${item.description}`}</s-text>
                            <s-icon type="duplicate" />
                          </div>
                        </s-clickable>
                      ))}
                    </s-stack>
                  </s-box>
                </div>
              </s-popover>
              <s-paragraph color="subdued">{template.detail}</s-paragraph>
            </s-stack>
          </s-box>

          <s-divider />

          <s-box padding="base">
            <s-stack gap="small">
              <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small-200">
                <s-heading>Preheader</s-heading>
                <s-button
                  variant="tertiary"
                  icon={isPreheaderCollapsed ? 'caret-down' : 'caret-up'}
                  accessibilityLabel="Toggle preheader section"
                  onClick={() => setIsPreheaderCollapsed((previous) => !previous)}
                />
              </s-grid>

              {!isPreheaderCollapsed ? (
                <s-stack gap="small">
                  {template.preheaderFields.map((field) => (
                    <s-stack key={field.key} gap="small-400">
                      <s-text-field
                        autocomplete={field.autoComplete ?? 'off'}
                        label={field.label}
                        placeholder={field.placeholder}
                        value={formState[field.key] ?? ''}
                        required={!!field.required}
                        error={fieldErrors[field.key] || undefined}
                        disabled={isSaving}
                        onInput={(e) => onFormFieldChange(field.key, e.currentTarget.value)}
                      />
                      {field.helpText ? (
                        <s-paragraph fontSize="small" color="subdued">
                          {field.helpText}
                        </s-paragraph>
                      ) : null}
                    </s-stack>
                  ))}
                </s-stack>
              ) : null}
            </s-stack>
          </s-box>
        </s-section>

        <div className="oth-editor-content">
          <s-section>
            <s-stack gap="small">
              <s-text-field
                autocomplete="off"
                label="Subject"
                value={formState.subject ?? ''}
                disabled={isSaving}
                onInput={(e) => onFormFieldChange('subject', e.currentTarget.value)}
              />
              <s-stack gap="small-400">
                <s-paragraph>Email body</s-paragraph>
                <RichTextEditor
                  value={formState.emailBody ?? ''}
                  readOnly={isSaving}
                  onChange={(html) => onFormFieldChange('emailBody', html)}
                />
              </s-stack>
            </s-stack>
          </s-section>
        </div>
      </s-grid>

      <SendTestEmailModal
        open={isSendTestModalOpen}
        email={testEmail}
        loading={isSendingTestEmail}
        onClose={() => setIsSendTestModalOpen(false)}
        onEmailChange={setTestEmail}
        onSend={(email) => onSendTestEmail(email, () => setIsSendTestModalOpen(false))}
      />
    </s-stack>
  );
}
