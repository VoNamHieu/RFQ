import React, { useState } from 'react';
import { Tabs, useWcId } from '../../../shared/wc.jsx';

// "Notification templates" card: every notification email in one list, a tab per
// group (Registrations, and in the version with order limits and contracts, Order
// requests and Contracts). Each row: its title and when it's sent, who gets it
// (recipientOf), and its on/off switch and edit icon. The switch is disabled until a
// sender email is connected.
export function NotificationTemplatesCard({
  groups,
  notifications,
  isConnected,
  recipientOf,
  onToggleNotification,
  onEditNotification,
}) {
  const uid = useWcId('oth-notif');
  const [groupId, setGroupId] = useState(groups[0]?.id);
  const groupIndex = Math.max(0, groups.findIndex((g) => g.id === groupId));
  const items = groups[groupIndex].items;
  const isToggleDisabled = !isConnected;

  return (
    <s-section padding="none">
      <s-box padding="base" paddingBlockEnd="none">
        <s-heading>Notification templates</s-heading>
      </s-box>
      <Tabs
        tabs={groups.map((g) => ({ id: g.id, content: g.label, badge: String(g.items.length) }))}
        selected={groupIndex}
        onSelect={(i) => setGroupId(groups[i].id)}
      />
      <s-divider />

      {items.map((item, i) => {
        const isEnabled = notifications[item.key];
        const to = recipientOf(item);
        const editTip = `${uid}-${item.key}-edit`;

        return (
          <div key={item.key}>
            <s-box padding="base">
              {/* Three columns once the section column (beside the settings menu)
                  is wider than 520px, stacked below it. Values with commas are
                  quoted, or the comma in minmax() reads as the fallback's. */}
              <s-grid
                gridTemplateColumns='@container oth-content (inline-size > 520px) "minmax(0, 3fr) minmax(0, 2fr) auto", "1fr"'
                gap="small-200"
                alignItems="center"
              >
                <s-stack gap="small-500">
                  <s-text fontWeight="semibold">{item.title}</s-text>
                  <s-text color="subdued">{item.description}</s-text>
                </s-stack>
                <s-stack direction="inline" gap="small-200">
                  {to.badges.map((b) => (
                    <s-badge key={b} tone={b === 'Customer' ? 'info' : undefined}>
                      {b}
                    </s-badge>
                  ))}
                </s-stack>
                {/* On/off switch (disabled while disconnected) and an unstyled edit icon button (Icon tone base). */}
                <s-stack direction="inline" gap="small-300" alignItems="center" justifyContent="end">
                  <s-switch
                    accessibilityLabel={`Turn ${item.title} on or off`}
                    checked={isEnabled}
                    disabled={isToggleDisabled}
                    onChange={(e) => {
                      if (e.currentTarget.checked !== isEnabled) onToggleNotification(item.key);
                    }}
                  />
                  <s-clickable inlineSize="20px" accessibilityLabel={`Edit ${item.title}`} interestFor={editTip} onClick={() => onEditNotification(item)}>
                    <s-icon type="edit" />
                  </s-clickable>
                  <s-tooltip id={editTip}>Click to edit</s-tooltip>
                </s-stack>
              </s-grid>
            </s-box>
            {i < items.length - 1 ? <s-divider /> : null}
          </div>
        );
      })}
    </s-section>
  );
}
