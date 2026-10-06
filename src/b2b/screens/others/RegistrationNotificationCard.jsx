import React from 'react';
import { useWcId } from '../../../shared/wc.jsx';

// "Registration form notification" card (production:
// features/Email/components/RegistrationNotificationCard). A collapsible list of
// the four registration emails, each with an Active/Inactive badge, an on/off
// toggle icon and an edit icon. Dimmed and inert until a sender email is connected.
export function RegistrationNotificationCard({
  notifications,
  isConnected,
  collapsed,
  items,
  onToggleCollapse,
  onToggleNotification,
  onEditNotification,
}) {
  const uid = useWcId('oth-notif');

  return (
    <s-section>
      <s-stack gap="small">
        <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small-200">
          <s-heading>Registration form notification</s-heading>
          <s-button
            variant="tertiary"
            icon={collapsed ? 'caret-down' : 'caret-up'}
            accessibilityLabel="Toggle registration form notification card"
            onClick={onToggleCollapse}
          />
        </s-grid>

        {!collapsed ? (
          <s-stack gap="small">
            {items.map((item, index) => {
              const isEnabled = notifications[item.key];
              const isInteractionDisabled = !isConnected;
              const toggleTooltipContent = isInteractionDisabled
                ? 'Connect sender email to activate'
                : isEnabled
                  ? 'Click to deactivate'
                  : 'Click to activate';
              const editTooltipContent = isInteractionDisabled ? 'Connect sender email to activate' : 'Click to edit';
              const toggleTip = `${uid}-${item.key}-toggle`;
              const editTip = `${uid}-${item.key}-edit`;

              return (
                <div key={item.key} style={{ opacity: isInteractionDisabled ? 0.5 : 1 }}>
                  <s-stack gap="small">
                    {/* InlineGrid columns={{ xs: '1fr', md: '1fr auto' }}: md = the app frame's 768px
                        breakpoint, ~720px of page content (Others' `oth-page` container). */}
                    <s-grid gridTemplateColumns="@container oth-page (inline-size > 719px) 1fr auto, 1fr" gap="small-200" alignItems="center">
                      <s-stack gap="small-400">
                        <s-stack direction="inline" gap="small-200" alignItems="center">
                          <s-heading>{item.title}</s-heading>
                          <s-badge tone={isEnabled ? 'success' : undefined}>{isEnabled ? 'Active' : 'Inactive'}</s-badge>
                        </s-stack>
                        <s-paragraph color="subdued">{item.description}</s-paragraph>
                      </s-stack>
                      {/* Unstyled icon buttons (Icon tone base), inert while disconnected. */}
                      <s-stack direction="inline" gap="small-400" alignItems="center" justifyContent="end">
                        <s-clickable
                          inlineSize="20px"
                          accessibilityLabel={`Toggle ${item.title}`}
                          interestFor={toggleTip}
                          onClick={() => {
                            if (isInteractionDisabled) return;
                            onToggleNotification(item.key);
                          }}
                        >
                          <s-icon type={isEnabled ? 'toggle-on' : 'toggle-off'} />
                        </s-clickable>
                        <s-tooltip id={toggleTip}>{toggleTooltipContent}</s-tooltip>
                        <s-clickable
                          inlineSize="20px"
                          accessibilityLabel={`Edit ${item.title}`}
                          interestFor={editTip}
                          onClick={() => {
                            if (isInteractionDisabled) return;
                            onEditNotification(item);
                          }}
                        >
                          <s-icon type="edit" />
                        </s-clickable>
                        <s-tooltip id={editTip}>{editTooltipContent}</s-tooltip>
                      </s-stack>
                    </s-grid>
                    {index < items.length - 1 ? <s-divider /> : null}
                  </s-stack>
                </div>
              );
            })}
          </s-stack>
        ) : null}
      </s-stack>
    </s-section>
  );
}
