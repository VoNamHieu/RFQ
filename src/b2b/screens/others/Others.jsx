import React, { useState } from 'react';
import { Email } from './Email.jsx';
import { OTHERS_HELP_URL } from './data.js';
import './others.css';

// Others page, laid out like the RFQ app's Configuration page: a settings menu on the
// left, the picked section on the right. Email notifications is the only section.
const MENU = [{ key: 'email', title: 'Email notifications', icon: 'email' }];

// While a notification template is being edited (?template=<key> in the app) the page
// has no title and no menu; the editor takes the full width.
export function Others() {
  const [selected, setSelected] = useState(MENU[0].key);
  const [activeNotificationEditor, setActiveNotificationEditor] = useState(null);
  const isTemplateEditorOpen = Boolean(activeNotificationEditor);

  const content = (
    <Email
      activeNotificationEditor={activeNotificationEditor}
      onOpenEditor={setActiveNotificationEditor}
      onCloseEditor={() => setActiveNotificationEditor(null)}
    />
  );

  return (
    <s-page heading={isTemplateEditorOpen ? undefined : 'Settings'}>
      {/* `oth-page` = the page's content width (the template editor's breakpoint);
          `oth-content` = the section column's (the notification rows'). */}
      <s-query-container containerName="oth-page">
        <s-grid
          gridTemplateColumns={isTemplateEditorOpen ? '1fr' : '@container (inline-size > 744px) "220px minmax(0, 1fr)", "minmax(0, 1fr)"'}
          gap="base"
          alignItems="start"
        >
          {isTemplateEditorOpen ? null : (
            <s-section padding="none">
              <s-box padding="small-200">
                <div className="oth-menu" role="listbox" aria-label="Settings">
                  {MENU.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      role="option"
                      aria-selected={m.key === selected}
                      aria-current={m.key === selected ? 'true' : undefined}
                      className="oth-menu__item"
                      onClick={() => setSelected(m.key)}
                    >
                      <span className="oth-menu__icon">
                        <s-icon type={m.icon} />
                      </span>
                      <span>{m.title}</span>
                    </button>
                  ))}
                </div>
              </s-box>
            </s-section>
          )}
          <s-query-container containerName="oth-content">
            <s-box paddingBlockEnd="base">{content}</s-box>
          </s-query-container>
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
