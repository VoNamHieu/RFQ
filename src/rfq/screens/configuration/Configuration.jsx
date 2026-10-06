import React, { useEffect, useRef, useState } from 'react';
import { MenuButton, Modal, SaveBar } from '../../../shared/wc.jsx';
import './configuration.css';
import {
  ACCOUNT_TRANSLATIONS,
  INITIAL_ACCOUNT_CONDITIONS,
  INITIAL_DISCOUNTS,
  INITIAL_EMAIL_ACCOUNT,
  INITIAL_LEAD_SCORES,
  INITIAL_MEMBERS,
  INITIAL_SETTINGS,
  INITIAL_SHIPPING,
  INITIAL_TAX,
} from './data.js';
import { clone, same, useToast } from './ui.jsx';
import { EmailTemplateSection } from './EmailTemplate.jsx';
import { MembersSection } from './Members.jsx';
import { CostManagement } from './CostManagement.jsx';
import { CustomerAccount } from './CustomerAccount.jsx';
import { FormattingStandards } from './Formatting.jsx';
import { LeadScoring } from './LeadScoring.jsx';
import {
  AbandonedReminderSection,
  CssSection,
  IntegrationsSection,
  NotificationSection,
  PdfTemplateSection,
  QuoteReminderSection,
} from './SimpleSections.jsx';

// Production: /app_settings → pages/AppSettings.jsx → components/Settings/index.jsx.
// A Listbox menu on the left (Layout.Section oneThird) selects which settings
// section shows on the right; one contextual save bar covers the inline settings.

const ESSENTIAL = { tone: 'success', label: 'Essential' };
const POPULAR = { tone: 'info', label: 'Popular' };

const MENU = [
  { key: 'email-template', title: 'Email notification', icon: 'email', badge: ESSENTIAL },
  { key: 'pdf-template', title: 'PDF Template', icon: 'file', badge: ESSENTIAL },
  { key: 'members-and-permission', title: 'Members and Permission', icon: 'team', badge: ESSENTIAL },
  { key: 'sync-data', title: 'Integrations', icon: 'connect', badge: ESSENTIAL },
  { key: 'cost-management', title: 'Cost management', icon: 'cash-dollar', badge: POPULAR },
  { key: 'customer-account', title: 'Customer Account', icon: 'profile' },
  { key: 'formatting-standards', title: 'Formatting standards', icon: 'edit' },
  { key: 'lead-scoring', title: 'Lead scoring', icon: 'target' },
  { key: 'abandoned-reminder', title: 'Abandoned quotes', icon: 'cart-abandoned' },
  { key: 'quote-reminder', title: 'Quote Reminder', icon: 'clock' },
  { key: 'other-notification', title: 'Other Notification', icon: 'notification', badge: POPULAR },
  { key: 'css-box', title: 'CSS', icon: 'code' },
];

const LANGUAGES = [
  { key: 'en', icon: '🇬🇧', content: 'English' },
  { key: 'es', icon: '🇪🇸', content: 'Español' },
  { key: 'ja', icon: '🇯🇵', content: 'Japanese' },
  { key: 'zh', icon: '🇨🇳', content: 'Chinese' },
];

const sectionKeyFor = (section) => (section === 'costManagement' ? 'cost-management' : MENU[0].key);

const isAbandonedInvalid = (s) => !!s.enabled && s.mode === 'auto' && s.time_unit === 'minutes' && Number(s.time_value) < 15;

export function Configuration({ section }) {
  const toast = useToast();
  const [selected, setSelected] = useState(() => sectionKeyFor(section));
  const [language, setLanguage] = useState('en');
  const contentRef = useRef(null);

  // Settings covered by the page save bar: `saved` is what the server has, `draft` what's on screen.
  const [saved, setSaved] = useState(() => clone(INITIAL_SETTINGS));
  const [draft, setDraft] = useState(() => clone(INITIAL_SETTINGS));
  const [assignmentError, setAssignmentError] = useState(false);
  const [abandonedValidation, setAbandonedValidation] = useState(false);

  // Records changed immediately through their own actions (API calls in production).
  const [emailAccount, setEmailAccount] = useState(INITIAL_EMAIL_ACCOUNT);
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [leadScores, setLeadScores] = useState(INITIAL_LEAD_SCORES);
  const [discounts, setDiscounts] = useState(INITIAL_DISCOUNTS);
  const [shipping, setShipping] = useState(INITIAL_SHIPPING);
  const [tax, setTax] = useState(INITIAL_TAX);
  const [accountConditions, setAccountConditions] = useState(INITIAL_ACCOUNT_CONDITIONS);
  const [accountTranslations, setAccountTranslations] = useState(ACCOUNT_TRANSLATIONS);

  const dirty = !same(saved, draft);

  const discard = () => {
    setDraft(clone(saved));
    setAssignmentError(false);
    setAbandonedValidation(false);
  };

  // The nav item "Cost management" opens this page on its section; "Others" on the first one.
  // On narrow screens the section sits below the menu, so bring it into view.
  // Landing via the nav (`/app_settings?section=cost-management&tab=discount`) reopens the
  // Cost management section on its Discount tab even if it was already selected.
  const [navVisit, setNavVisit] = useState(0);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
    } else {
      setSelected(sectionKeyFor(section));
      setNavVisit((n) => n + 1);
      discard();
    }
    if (section === 'costManagement') {
      const raf = requestAnimationFrame(() => contentRef.current?.scrollIntoView({ block: 'nearest' }));
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  // Production awaits `shopify.saveBar.leaveConfirmation()` before switching while the
  // save bar is open (the admin's "Leave page with unsaved changes?" dialog).
  const [pendingKey, setPendingKey] = useState(null);

  const goTo = (key) => {
    // Switching sections drops unsaved edits so a save bar never leaks into another section.
    discard();
    setSelected(key);
  };

  const select = (key) => {
    if (key === selected) return;
    if (dirty && selected !== 'customer-account') {
      setPendingKey(key);
      return;
    }
    goTo(key);
  };

  const patch = (key, value) => {
    setDraft((d) => ({ ...d, [key]: typeof value === 'function' ? value(d[key]) : value }));
  };

  const save = () => {
    const a = draft.assignment;
    const assignmentInvalid = a.type === 'customize' && (!a.condition.length || !a.condition.some((c) => Number(c.status) === 1));
    const abandonedInvalid = isAbandonedInvalid(draft.abandoned);
    setAssignmentError(assignmentInvalid);
    setAbandonedValidation(abandonedInvalid);
    if (assignmentInvalid || abandonedInvalid) return;
    const next = {
      ...draft,
      custom_quote: { prefix: draft.custom_quote.prefix.trim(), suffix: draft.custom_quote.suffix.trim() },
      pdf_name_format: { quote: draft.pdf_name_format.quote.trim(), invoice: draft.pdf_name_format.invoice.trim() },
    };
    setSaved(clone(next));
    setDraft(clone(next));
    toast('Settings saved!');
  };

  const current = LANGUAGES.find((l) => l.key === language) || LANGUAGES[0];

  const renderSection = () => {
    switch (selected) {
      case 'email-template':
        return (
          <EmailTemplateSection
            email={draft.email}
            vendor={draft.vendor}
            onEmailChange={(v) => patch('email', v)}
            onVendorChange={(v) => patch('vendor', v)}
            account={emailAccount}
            onAccountChange={setEmailAccount}
          />
        );
      case 'pdf-template':
        return <PdfTemplateSection />;
      case 'members-and-permission':
        return (
          <MembersSection
            members={members}
            onMembersChange={setMembers}
            assignment={draft.assignment}
            // Production clears the "To save this setting…" banner only on save, discard,
            // dismiss or the empty-state "Add condition" — not on every edit.
            onAssignmentChange={(v) => patch('assignment', v)}
            assignmentError={assignmentError}
            onDismissAssignmentError={() => setAssignmentError(false)}
            hasNoLeadScoreRule={leadScores.length === 0}
            leadScoreRule={leadScores[0]}
          />
        );
      case 'sync-data':
        return <IntegrationsSection />;
      case 'cost-management':
        return (
          <CostManagement
            key={`cost-${navVisit}`}
            discounts={discounts}
            onDiscountsChange={setDiscounts}
            shipping={shipping}
            onShippingSave={setShipping}
            tax={tax}
            onTaxSave={setTax}
          />
        );
      case 'customer-account':
        return (
          <CustomerAccount
            conditions={accountConditions}
            onConditionsSave={setAccountConditions}
            translations={accountTranslations}
            onTranslationsSave={setAccountTranslations}
          />
        );
      case 'formatting-standards':
        return <FormattingStandards draft={draft} patch={patch} />;
      case 'lead-scoring':
        return <LeadScoring list={leadScores} onListChange={setLeadScores} />;
      case 'abandoned-reminder':
        return (
          <AbandonedReminderSection
            settings={draft.abandoned}
            onChange={(v) => {
              setAbandonedValidation(false);
              patch('abandoned', v);
            }}
            showValidation={abandonedValidation}
            emailConnected={!!emailAccount}
            onConnectEmail={() => select('email-template')}
          />
        );
      case 'quote-reminder':
        return <QuoteReminderSection value={draft.quote_reminder} onChange={(v) => patch('quote_reminder', v)} />;
      case 'other-notification':
        return <NotificationSection />;
      case 'css-box':
        return <CssSection value={draft.custom_css} onChange={(v) => patch('custom_css', v)} />;
      default:
        return null;
    }
  };

  return (
    <s-page heading="Configuration">
      <MenuButton
        slot="secondary-actions"
        accessibilityLabel="Language"
        items={LANGUAGES.map((l) => ({
          content: `${l.icon}  ${l.content}`,
          // Production switches the app's i18n language; there is no toast.
          onAction: () => setLanguage(l.key),
        }))}
      >
        {`${current.icon}  ${current.content}`}
      </MenuButton>

      <s-query-container>
        <s-grid
          gridTemplateColumns='@container (inline-size > 744px) "minmax(0, 1fr) minmax(0, 2fr)", "minmax(0, 1fr)"'
          gap="base"
          alignItems="start"
        >
          <s-section padding="none">
            <s-box padding="small-200">
              <div className="qcfg-menu" role="listbox" aria-label="Menu settings">
                {MENU.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    role="option"
                    aria-selected={m.key === selected}
                    aria-current={m.key === selected ? 'true' : undefined}
                    className="qcfg-menu__item"
                    onClick={() => select(m.key)}
                  >
                    <span className="qcfg-menu__icon">
                      <s-icon type={m.icon} />
                    </span>
                    <span>{m.title}</span>
                    {m.badge ? (
                      <span className="qcfg-menu__badge">
                        <s-badge tone={m.badge.tone}>{m.badge.label}</s-badge>
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </s-box>
          </s-section>

          <div ref={contentRef} style={{ minWidth: 0, scrollMarginTop: 72 }}>
            <s-stack gap="base">{renderSection()}</s-stack>
          </div>
        </s-grid>
      </s-query-container>

      {dirty && selected !== 'customer-account' ? <SaveBar message="Unsaved changes" onSave={save} onDiscard={discard} /> : null}

      {pendingKey ? (
        <Modal onClose={() => setPendingKey(null)} heading="Leave page with unsaved changes?">
          <s-paragraph>Leaving this page will delete all unsaved changes.</s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              const key = pendingKey;
              setPendingKey(null);
              goTo(key);
            }}
          >
            Leave page
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setPendingKey(null)}>
            Stay
          </s-button>
        </Modal>
      ) : null}
    </s-page>
  );
}
