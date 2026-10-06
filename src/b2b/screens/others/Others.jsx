import React, { useState } from 'react';
import { Email } from './Email.jsx';
import { OTHERS_HELP_URL, OTHERS_SIDEBAR_ITEMS } from './data.js';
import './others.css';

// Others page (production: pages/Others/Others + components/OthersSidebar).
// Layout: a one-third sidebar (sticky card listing the page's sections — today
// just "Email notification") beside the Email section, then the footer help.
// While a notification template is being edited (?template=<key> in the app)
// the page has no title and no sidebar; the editor takes the full width.

function OthersSidebar({ items }) {
  return (
    <div className="oth-sidebar">
      <s-section padding="none">
        <s-box padding="small">
          <s-stack gap="small-400">
            {items.map((item) => (
              <s-stack key={item.id} direction="inline" gap="small-200" alignItems="center">
                <s-icon type={item.icon} />
                <s-text>{item.label}</s-text>
              </s-stack>
            ))}
          </s-stack>
        </s-box>
      </s-section>
    </div>
  );
}

export function Others() {
  const [activeNotificationEditor, setActiveNotificationEditor] = useState(null);
  const isTemplateEditorOpen = Boolean(activeNotificationEditor);

  const email = (
    <s-box paddingBlockEnd="base">
      <Email
        activeNotificationEditor={activeNotificationEditor}
        onOpenEditor={setActiveNotificationEditor}
        onCloseEditor={() => setActiveNotificationEditor(null)}
      />
    </s-box>
  );

  return (
    <s-page heading={isTemplateEditorOpen ? undefined : 'Others'}>
      {/* `oth-page` = the page's content width; nested grids use it for Polaris'
          viewport breakpoints. Polaris Layout: the oneThird section sits left of
          the main section and wraps above it once the page is narrower than both
          minimum widths. */}
      <s-query-container containerName="oth-page">
        {/* Same tree either way, so the Email section keeps its state. */}
        <s-grid
          gridTemplateColumns={isTemplateEditorOpen ? '1fr' : '@container (inline-size > 736px) 1fr 2fr, 1fr'}
          gap="base"
          alignItems="start"
        >
          {isTemplateEditorOpen ? null : <OthersSidebar items={OTHERS_SIDEBAR_ITEMS} />}
          {email}
        </s-grid>
      </s-query-container>

      <s-box paddingBlock="large">
        <div style={{ textAlign: 'center' }}>
          <s-text>Learn more about </s-text>
          <s-link href={OTHERS_HELP_URL} target="_blank">
            others
          </s-link>
        </div>
      </s-box>
    </s-page>
  );
}
