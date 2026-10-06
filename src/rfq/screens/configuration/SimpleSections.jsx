import React, { useEffect, useState } from 'react';
import { useWcId } from '../../../shared/wc.jsx';
import { INTEGRATIONS, NOTIFICATION_CHANNELS } from './data.js';
import { DataRows, InnerCard, Options, RadioGroup, fullApp, useToast } from './ui.jsx';
import './simple.css';

// Production hooks/useScreen: `window.innerWidth <= 768` (SCREEN_SM) switches the
// integration / notification rows to their wrapped mobile layout.
const MOBILE_QUERY = '(max-width: 768px)';
function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

// ---------------------------------------------------------------------------
// PDF Template (components/Settings/PdfTemplate.jsx)
// ---------------------------------------------------------------------------
export function PdfTemplateSection() {
  const toast = useToast();
  const rows = [
    { key: 'quote', title: 'Quote PDF', description: 'Template used to convert quote to PDF file', target: 'the Quote PDF template editor' },
    { key: 'invoice', title: 'Invoice PDF', description: 'Template used to convert a draft order to PDF file', target: 'the Invoice PDF template editor' },
  ].map((r) => ({
    key: r.key,
    content: (
      <>
        <s-text fontWeight="bold">{r.title}</s-text>
        <s-text>{r.description}</s-text>
      </>
    ),
    actions: <s-button icon="edit" accessibilityLabel={`Edit ${r.title}`} onClick={() => toast(fullApp(r.target))} />,
  }));
  return (
    <s-section>
      <s-stack gap="small-200">
        <s-heading fontSize="large">PDF Template</s-heading>
        <div className="qcfg-simple-pdf">
          <DataRows headings={['Name', 'Action']} rows={rows} />
        </div>
      </s-stack>
    </s-section>
  );
}

// ---------------------------------------------------------------------------
// Integrations (components/Integration/index.jsx)
// ---------------------------------------------------------------------------
// Integration/index.jsx `IntegrationItem` (Card padding="200") and Notification/index.jsx
// `IntegrationItem` (Card padding="300", bg-surface-info when featured).
function SystemRow({ img, title, badges, description, featured, padding = 'small-200', onSelect }) {
  const mobile = useIsMobile();
  const body = (
    <div className={`qcfg-simple-item${mobile ? ' qcfg-simple-item--mobile' : ''}`}>
      <div className="qcfg-simple-item__main">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-thumbnail size="small" src={img} alt={title} />
          <s-stack gap="small-500">
            <s-stack direction="inline" gap="small-400" alignItems="center">
              <s-heading>{title}</s-heading>
              {badges}
            </s-stack>
            {description ? (
              <s-text fontSize="small" color="subdued">
                {description}
              </s-text>
            ) : null}
          </s-stack>
        </s-stack>
      </div>
      <div className="qcfg-simple-item__action">
        <s-button variant="primary" onClick={onSelect}>
          Select
        </s-button>
      </div>
    </div>
  );
  if (featured) return <div className="qcfg-simple-featured">{body}</div>;
  return <InnerCard padding={padding}>{body}</InnerCard>;
}

// BannerUpvote: dismissing it stores `show_banner` on the server, so it stays hidden.
let upvoteBannerDismissed = false;

export function IntegrationsSection() {
  const toast = useToast();
  const [showUpvote, setShowUpvote] = useState(() => !upvoteBannerDismissed);
  const renderItem = (item) => (
    <SystemRow
      key={item.type}
      img={item.img}
      title={item.title}
      badges={
        <>
          {item.integrated ? <s-badge tone="success">Integrate success</s-badge> : null}
          {item.inactive ? <s-badge>Inactive</s-badge> : null}
        </>
      }
      onSelect={() => toast(fullApp(`the ${item.title} integration`))}
    />
  );
  return (
    <s-section>
      <s-stack gap="base">
        {showUpvote ? (
          <s-banner
            heading="Upvote unavailable system"
            tone="info"
            dismissible
            onDismiss={() => {
              upvoteBannerDismissed = true;
              setShowUpvote(false);
            }}
          >
            <s-paragraph>Can not find the 3rd party system? Upvote your system in this list.</s-paragraph>
            <s-button slot="secondary-actions" onClick={() => toast(fullApp('the integration upvote list'))}>
              See list
            </s-button>
          </s-banner>
        ) : null}
        <s-stack gap="small-200">
          <s-heading fontSize="large">Integrations</s-heading>
          <s-paragraph fontSize="small">Select a system that you wish to automatically sync quote &amp; customer data to</s-paragraph>
        </s-stack>
        <s-stack gap="small-200">{INTEGRATIONS.shopify.map(renderItem)}</s-stack>
        <s-stack gap="small-200">{INTEGRATIONS.email.map(renderItem)}</s-stack>
        <s-stack gap="small-200">{INTEGRATIONS.crm.map(renderItem)}</s-stack>
      </s-stack>
    </s-section>
  );
}

// ---------------------------------------------------------------------------
// Other Notification (components/Notification/index.jsx)
// ---------------------------------------------------------------------------
export function NotificationSection() {
  const toast = useToast();
  return (
    <s-section>
      <s-stack gap="base">
        <s-stack gap="small-200">
          <s-heading fontSize="large">Notification</s-heading>
          <s-paragraph fontSize="small">Select a system that you wish to send notification to</s-paragraph>
        </s-stack>
        <s-stack gap="small-200">
          {NOTIFICATION_CHANNELS.map((c) => (
            <SystemRow
              key={c.type}
              img={c.logo}
              title={c.title}
              featured={c.featured}
              padding="small"
              badges={c.featured ? <s-badge tone="info">New</s-badge> : null}
              description={c.featured ? 'Get quote submit, accept and reject alerts right on WhatsApp.' : null}
              onSelect={() => toast(fullApp(`the ${c.title} notification settings`))}
            />
          ))}
        </s-stack>
      </s-stack>
    </s-section>
  );
}

// ---------------------------------------------------------------------------
// Quote Reminder (components/Settings/QuoteReminder.jsx)
// ---------------------------------------------------------------------------
export function QuoteReminderSection({ value, onChange }) {
  return (
    <s-section>
      <s-stack gap="small-200">
        <s-heading fontSize="large">Quote Reminder</s-heading>
        <s-paragraph>A reminder will be sent to your email if there is a quote remains unchecked after a period of time</s-paragraph>
        <s-stack gap="small-400">
          <s-paragraph>Select time range</s-paragraph>
          <RadioGroup
            name="quote_reminder"
            label="Select time range"
            labelHidden
            value={value}
            onChange={(v) => onChange(Number(v))}
            options={[
              { value: 0, label: 'No, do not remind' },
              { value: 3, label: '3 hours after submission' },
              { value: 6, label: '6 hours after submission' },
              { value: 12, label: '12 hours after submission' },
            ]}
          />
        </s-stack>
      </s-stack>
    </s-section>
  );
}

// ---------------------------------------------------------------------------
// Abandoned quotes (components/Settings/AbandonedReminderSettings.jsx)
// ---------------------------------------------------------------------------
const UNIT_OPTIONS = [
  { label: 'Minutes', value: 'minutes' },
  { label: 'Hours', value: 'hours' },
  { label: 'Days', value: 'days' },
  { label: 'Weeks', value: 'weeks' },
];
const defaultValueForUnit = (unit) => (unit === 'minutes' ? 15 : 1);

export function AbandonedReminderSection({ settings, onChange, showValidation, emailConnected, onConnectEmail }) {
  const toast = useToast();
  const id = useWcId('qcfg-abandoned');
  const [showEmailBanner, setShowEmailBanner] = useState(true);
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const { enabled, mode, time_value, time_unit } = settings;

  const emailNotConnected = !emailConnected;
  const effectiveEnabled = enabled && !emailNotConnected;
  const radiosDisabled = emailNotConnected || !enabled;

  const set = (patch) => onChange({ ...settings, ...patch });

  const handleModeChange = (next) => {
    if (next === 'auto' && mode !== 'auto') set({ mode: 'auto', time_value: defaultValueForUnit(time_unit) });
    else set({ mode: next });
  };

  const handleTimeValue = (value) => {
    if (value === '') return set({ time_value: '' });
    const digits = value.replace(/\D/g, '');
    const n = Number(digits);
    return set({ time_value: digits === '' || n === 0 ? 1 : n });
  };

  const minutesError =
    showValidation && enabled && mode === 'auto' && time_unit === 'minutes' && Number(time_value) < 15 ? 'Time must be at least 15 minutes' : undefined;

  const toggleLabel = effectiveEnabled ? 'Turn off' : 'Turn on';

  let banner = null;
  if (emailNotConnected) {
    banner = showEmailBanner ? (
      <s-banner tone="warning" dismissible onDismiss={() => setShowEmailBanner(false)}>
        <s-link onClick={onConnectEmail}>Connect</s-link> an email account to enable the abandoned-quote reminder.
      </s-banner>
    ) : null;
  } else if (showInfoBanner) {
    banner = (
      <s-banner tone="info" dismissible onDismiss={() => setShowInfoBanner(false)}>
        After a proposal is sent, if customers neither accept nor reject the quote, it is considered abandoned.
      </s-banner>
    );
  }

  return (
    <s-section>
      <s-stack gap="base">
        <InnerCard>
          <s-stack gap="small-400">
            <s-grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="small-200">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-heading fontSize="large">Abandoned Quote</s-heading>
                {effectiveEnabled ? <s-badge tone="success">On</s-badge> : <s-badge>Off</s-badge>}
              </s-stack>
              <s-text interestFor={`${id}-toggle`}>
                <s-button
                  variant="tertiary"
                  icon={effectiveEnabled ? 'toggle-on' : 'toggle-off'}
                  accessibilityLabel="Toggle abandoned quote reminder"
                  disabled={emailNotConnected}
                  onClick={() => set({ enabled: !enabled })}
                />
              </s-text>
              <s-tooltip id={`${id}-toggle`}>{toggleLabel}</s-tooltip>
            </s-grid>

            <s-stack gap="small-400">
              <s-paragraph>Reminder action</s-paragraph>
              <RadioGroup
                name="abandoned_reminder_mode"
                label="Reminder action"
                labelHidden
                value={mode}
                disabled={radiosDisabled}
                onChange={handleModeChange}
                options={[
                  { value: 'manual', label: 'Manually send reminder email' },
                  { value: 'auto', label: 'Automatically send reminder email' },
                ]}
              />
              {effectiveEnabled && mode === 'auto' ? (
                <s-box paddingInlineStart="large-200">
                  <s-stack gap="small-400">
                    <s-paragraph>Send reminder after</s-paragraph>
                    <div className="qcfg-simple-sendafter">
                      <div>
                        <s-number-field
                          label="Send reminder after"
                          labelAccessibilityVisibility="exclusive"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={String(time_value ?? '')}
                          error={minutesError}
                          onInput={(e) => handleTimeValue(e.currentTarget.value)}
                        />
                      </div>
                      <div>
                        <s-select
                          label="Send reminder after"
                          labelAccessibilityVisibility="exclusive"
                          value={time_unit}
                          onChange={(e) => {
                            const unit = e.currentTarget.value;
                            if (unit !== time_unit) set({ time_unit: unit, time_value: defaultValueForUnit(unit) });
                          }}
                        >
                          <Options options={UNIT_OPTIONS} />
                        </s-select>
                      </div>
                    </div>
                    <s-paragraph color="subdued">Time to wait before sending the reminder email. Timing begins after saving.</s-paragraph>
                  </s-stack>
                </s-box>
              ) : null}
            </s-stack>
            {banner}
          </s-stack>
        </InnerCard>

        <InnerCard>
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="small-200">
            <s-stack gap="small-400">
              <s-heading>Quote reminder email</s-heading>
              <s-paragraph color="subdued">Email sent to customers when a proposal remains unanswered</s-paragraph>
            </s-stack>
            <s-button
              variant="tertiary"
              icon="edit"
              accessibilityLabel="Quote reminder email"
              disabled={emailNotConnected}
              onClick={() => toast(fullApp('the quote reminder email editor'))}
            />
          </s-grid>
        </InnerCard>
      </s-stack>
    </s-section>
  );
}

// ---------------------------------------------------------------------------
// CSS (Card + QuoteSettings/GeneralSettings/CustomCSS.jsx — Monaco editor in production)
// ---------------------------------------------------------------------------
export function CssSection({ value, onChange }) {
  return (
    <s-section>
      <s-stack gap="small-200">
        <s-heading fontSize="large">CSS</s-heading>
        <div className="qcfg-css-editor">
          <textarea
            aria-label="Custom CSS"
            spellCheck={false}
            value={value}
            placeholder="/*write your custom CSS here*/"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const el = e.currentTarget;
                const { selectionStart: s, selectionEnd: end } = el;
                const next = `${el.value.slice(0, s)}  ${el.value.slice(end)}`;
                onChange(next);
                requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
              }
            }}
          />
        </div>
      </s-stack>
    </s-section>
  );
}
