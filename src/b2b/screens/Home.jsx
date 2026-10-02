import React, { useState } from 'react';
import {
  Page, Card, InlineGrid, BlockStack, InlineStack, Box, Text, Button, Badge, Icon, ProgressBar, List, Divider, FooterHelp, Link,
} from '@shopify/polaris';
import {
  TeamIcon, ProductIcon, NoteIcon, ClipboardIcon, InfoIcon, XIcon, ChevronUpIcon, ChevronDownIcon,
} from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { companyNeedsPrice, kindOf, policyStatus, policyUsageCount } from '../pricing.js';
import { versionFlags, activeVersion } from '../../shared/versions.js';
import quotesArt from '../assets/quote-block.webp';

// Prototype: show the dev toggles in production too (flip to import.meta.env.DEV to hide in prod).
const SHOW_DEV_TOOLS = true;
const CLOSED_QUOTE = ['Deal Closed', 'Deal Rejected', 'Trashed'];

// Wholesale B2B → app home, laid out on Shopify's App Home guidance
// (shopify.dev/docs/apps/design, Homepage pattern, Built for Shopify 3.1.4 / 4.2.3):
// a single-column, default-width page that says whether the app is set up and
// working — a dismissible, collapsible setup guide (one step open at a time),
// what needs attention now, key numbers for each core feature with one clear
// action each, and help links in the page footer, out of the way.
export function Home() {
  const { state, dispatch } = useStore();
  // Dev-only previews, one at a time: 'empty' (a brand-new merchant), 'noQuotes' (RFQ app
  // installed, no quotes yet).
  const [devPreview, setDevPreview] = useState(null);
  const togglePreview = (mode) => setDevPreview((m) => (m === mode ? null : mode));
  const devEmpty = devPreview === 'empty';
  const db = devEmpty
    ? { ...state.db, companies: [], policies: [], registrations: [], quotes: [], hasRegistrationForm: false, registrationFormPublished: false, rfqAppInstalled: false }
    : devPreview === 'noQuotes'
    ? { ...state.db, quotes: [], rfqAppInstalled: true }
    : state.db;
  const genuinelyEmpty = !state.db.companies.length && !state.db.policies.length && !state.db.hasRegistrationForm;
  const flags = versionFlags();

  const { companies, policies } = db;
  const hasForm = !!db.hasRegistrationForm;
  const formPublished = hasForm && !!db.registrationFormPublished;
  // Turned off in the form builder: still set up, but buyers can't apply meanwhile.
  const formOff = hasForm && !!db.registrationFormOff;
  const formLive = formPublished && !formOff;
  const locations = companies.reduce((n, c) => n + (c.locations || []).length, 0);
  const needPrice = companies.filter((c) => companyNeedsPrice(c, policies, db.defaults)).length;
  const activePricing = policies.filter((p) => policyStatus(p, db).label !== 'Inactive').length;
  // Assigned to nobody — a pricing the merchant turned off on purpose isn't flagged.
  const unassignedPricing = policies.filter((p) => p.status !== 'Inactive' && policyUsageCount(p, db) === 0).length;
  const quantityPricing = policies.filter((p) => kindOf(p) === 'quantity').length;
  const pending = (db.registrations || []).filter((r) => r.status === 'pending').length;
  const openQuotes = (db.quotes || []).filter((q) => !CLOSED_QUOTE.includes(q.status));
  const dealsClosed = (db.quotes || []).filter((q) => q.status === 'Deal Closed').length;
  // Quotes come from the companion O:Request a Quote app, which may not be installed.
  const rfqInstalled = !!db.rfqAppInstalled;

  const toast = (m) => dispatch({ type: 'TOAST', message: m });
  const nav = (view, patch) => dispatch({ type: 'NAVIGATE', view, patch });
  const viewCompanies = (filter = 'all') => { dispatch({ type: 'SET_LIST_FILTER', filter }); nav('customers'); };
  // The setup wizard belongs to the B2B Company list: land there, then open it on top.
  const addCompany = () => { viewCompanies(); dispatch({ type: 'OPEN_ADD_COMPANY' }); };
  // Pricing screen opens straight on its type chooser (base / quantity).
  const createPricing = () => nav('pricing', { pricingChooser: true });
  const openForm = () => nav('form', { formEntry: hasForm ? 'editor' : 'create' });
  const viewRegistrations = (filter) => { if (filter) dispatch({ type: 'SET_REGISTRATION_FILTER', filter }); nav('registrations'); };
  const openRfq = () => { window.location.href = activeVersion() === 'latest' ? '/' : `/?v=${activeVersion()}`; };

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const steps = [
    {
      title: 'Add your first B2B company',
      done: companies.length > 0,
      desc: companies.length ? `You've added ${plural(companies.length, 'company', 'companies')}.` : 'Add a company so its buyers can shop at B2B prices.',
      action: companies.length ? { content: 'View companies', onAction: () => viewCompanies() } : { content: 'Add company', onAction: addCompany },
    },
    {
      title: 'Set up pricing',
      done: policies.length > 0,
      desc: policies.length ? `You've created ${plural(policies.length, 'pricing', 'pricings')}.` : 'Create and assign pricing so buyers see the right prices.',
      action: policies.length ? { content: 'View pricing', onAction: () => nav('pricing') } : { content: 'Create pricing', onAction: createPricing },
    },
    {
      title: 'Publish your registration form',
      done: formPublished,
      desc: formPublished ? 'Buyers can apply for B2B access from your storefront.' : 'Let buyers submit their business details from your storefront.',
      action: { content: formPublished ? 'Edit form' : hasForm ? 'Preview form' : 'Create form', onAction: openForm },
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const setupComplete = doneCount === steps.length;

  // What needs the merchant now — each row one action, most blocking first.
  const attention = [
    needPrice && {
      title: `${plural(needPrice, 'company needs', 'companies need')} B2B pricing`,
      meta: 'No pricing applies to at least one of their locations.',
      action: { content: 'Assign pricing', onAction: () => viewCompanies('need') },
    },
    pending && {
      title: `${plural(pending, 'registration', 'registrations')} waiting for review`,
      meta: 'Buyers applied for B2B access through your registration form.',
      action: { content: 'Review registrations', onAction: () => viewRegistrations('pending') },
    },
    hasForm && !formPublished && {
      title: "Your registration form isn't published",
      meta: "Buyers can't apply until it's available on your storefront.",
      action: { content: 'Publish form', onAction: openForm },
    },
    unassignedPricing && {
      title: `${plural(unassignedPricing, 'pricing setup isn’t', 'pricing setups aren’t')} assigned`,
      meta: 'Pricing stays inactive until it’s assigned to a company, location or customer.',
      action: { content: 'View pricing', onAction: () => nav('pricing', { pricingStatus: 'inactive' }) },
    },
  ].filter(Boolean);

  const guideVisible = !state.homeGuideHidden;

  return (
    <Page
      title={setupComplete ? 'Wholesale B2B Solution' : 'Get your B2B selling workflow ready'}
      subtitle={setupComplete
        ? 'Your B2B companies, pricing and registrations at a glance.'
        : 'Complete a few setup steps to start accepting B2B registrations and selling with custom pricing.'}
      secondaryActions={[
        { content: 'Add company', onAction: addCompany },
        { content: 'Create pricing', onAction: createPricing },
      ]}
    >
      <BlockStack gap="400">
        {SHOW_DEV_TOOLS && (
          <Box background="bg-surface-secondary" borderColor="border" borderWidth="025" borderRadius="200" padding="200">
            <InlineStack gap="200" blockAlign="center" wrap>
              <Badge tone="info">Dev</Badge>
              <Text as="span" variant="bodySm" tone="subdued">
                {devEmpty
                  ? 'Previewing the empty state — companies, pricing and the form actually exist.'
                  : devPreview === 'noQuotes'
                  ? 'Previewing the Quotes card with the RFQ app installed but no quotes yet.'
                  : genuinelyEmpty
                  ? 'No companies, pricing or form exist, so the home is showing its empty state.'
                  : 'Preview other states: a brand-new merchant, or the Quotes card before any quote arrives.'}
              </Text>
              <Button size="slim" pressed={devEmpty} disabled={genuinelyEmpty} onClick={() => togglePreview('empty')}>
                {devEmpty ? 'Show data' : 'Preview empty state'}
              </Button>
              <Button size="slim" pressed={devPreview === 'noQuotes'} onClick={() => togglePreview('noQuotes')}>
                {devPreview === 'noQuotes' ? 'Show quotes' : 'Preview empty quotes'}
              </Button>
            </InlineStack>
          </Box>
        )}

        {guideVisible && (
          <SetupGuide key={devPreview || 'data'} steps={steps} doneCount={doneCount}
            onDismiss={() => dispatch({ type: 'SET_HOME_GUIDE', hidden: true })} />
        )}

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">Needs attention</Text>
            {attention.length ? (
              <BlockStack gap="0">
                {attention.map((a, i) => (
                  <div key={a.title}>
                    {i ? <Divider /> : null}
                    <Box paddingBlock="300">
                      <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
                        <BlockStack gap="050">
                          <Text as="p" variant="bodyMd" fontWeight="semibold">{a.title}</Text>
                          <Text as="p" variant="bodySm" tone="subdued">{a.meta}</Text>
                        </BlockStack>
                        <Box minWidth="fit-content"><Button onClick={a.action.onAction}>{a.action.content}</Button></Box>
                      </InlineStack>
                    </Box>
                  </div>
                ))}
              </BlockStack>
            ) : (
              <Text as="p" tone="subdued">You're all caught up. Nothing needs your attention right now.</Text>
            )}
          </BlockStack>
        </Card>

        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd">Your B2B at a glance</Text>
            {flags.analytics && <Button variant="plain" onClick={() => nav('analytics')}>View analytics</Button>}
          </InlineStack>
          <style>{FEATURE_CARD_CSS}</style>
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="300">
            <FeatureCard icon={TeamIcon} title="Companies" value={companies.length}
              caption={`${locations} ${locations <= 1 ? 'location' : 'locations'}`}
              desc="B2B companies with their locations, buyers and payment terms."
              action={companies.length ? { content: 'View companies', onAction: () => viewCompanies() } : { content: 'Add company', onAction: addCompany }} />
            <FeatureCard icon={ProductIcon} title="B2B pricing" value={activePricing}
              caption={policies.length ? `active · ${plural(quantityPricing, 'quantity break', 'quantity breaks')}` : 'active'}
              desc="Base prices and quantity breaks for companies and customers."
              action={policies.length ? { content: 'View pricing', onAction: () => nav('pricing') } : { content: 'Create pricing', onAction: createPricing }} />
            <FeatureCard icon={NoteIcon} title="Registrations" value={pending} caption="pending review"
              badge={formOff ? <Badge>Form off</Badge> : formLive ? <Badge tone="success">Form live</Badge> : hasForm ? <Badge tone="attention">Form draft</Badge> : <Badge>No form</Badge>}
              desc="B2B applications from the registration form on your storefront."
              action={hasForm ? { content: 'View registrations', onAction: () => viewRegistrations() } : { content: 'Create form', onAction: openForm }} />
            {rfqInstalled ? (
              <FeatureCard icon={ClipboardIcon} title="Quotes" value={openQuotes.length}
                caption={`open · ${plural(dealsClosed, 'deal', 'deals')} closed`}
                desc="Quote requests from the RFQ app, tracked on each company."
                action={{ content: 'Open RFQ app', onAction: openRfq }} />
            ) : (
              <FeatureCard icon={ClipboardIcon} title="Quotes" badge={<Badge>Not installed</Badge>} art={quotesArt}
                desc="Install O:Request a Quote to collect quote requests and turn accepted quotes into B2B pricing."
                action={{ content: 'Install app', onAction: () => toast('Opening App Store') }} />
            )}
          </InlineGrid>
        </BlockStack>

        {!setupComplete && (
          <Card>
            <InlineStack gap="300" blockAlign="start" wrap={false}>
              <Box><Icon source={InfoIcon} tone="info" /></Box>
              <BlockStack gap="100">
                <Text as="h2" variant="headingSm">What happens next</Text>
                <Text as="p">Once you complete the setup, you can:</Text>
                <List type="bullet">
                  <List.Item>Review registration requests from your storefront</List.Item>
                  <List.Item>Approve and assign buyers to companies</List.Item>
                  <List.Item>Reuse your B2B pricing across products and customer groups</List.Item>
                </List>
              </BlockStack>
            </InlineStack>
          </Card>
        )}

        <FooterHelp>
          Learn more about <Link onClick={() => toast('Opening guide')}>Wholesale B2B Solution</Link> or{' '}
          <Link onClick={() => toast('Opening support')}>contact support</Link>.
        </FooterHelp>
      </BlockStack>
    </Page>
  );
}

// Shopify's setup-guide composition: progress "X of Y", collapsible, dismissible,
// one step open at a time (the first unfinished one by default); a click on a
// step's title opens it instead.
function SetupGuide({ steps, doneCount, onDismiss }) {
  const firstOpen = steps.findIndex((s) => !s.done);
  const [open, setOpen] = useState(firstOpen);
  const [collapsed, setCollapsed] = useState(false);
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <Card>
      <BlockStack gap="300">
        {/* Header: title with its controls on one line, then the description, then progress. */}
        <BlockStack gap="100">
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <Text as="h2" variant="headingMd">Setup guide</Text>
            <InlineStack gap="100" wrap={false}>
              <Button variant="tertiary" icon={XIcon} accessibilityLabel="Dismiss setup guide" onClick={onDismiss} />
              <Button variant="tertiary" icon={collapsed ? ChevronDownIcon : ChevronUpIcon}
                accessibilityLabel={collapsed ? 'Expand setup guide' : 'Collapse setup guide'} onClick={() => setCollapsed((v) => !v)} />
            </InlineStack>
          </InlineStack>
          <Text as="p" tone="subdued">Use this guide to get your B2B store up and running.</Text>
        </BlockStack>
        <BlockStack gap="150">
          <Text as="p" variant="bodySm" tone="subdued">{`${doneCount} of ${steps.length} tasks completed`}</Text>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            <div style={{ flex: 1, minWidth: 0 }}><ProgressBar progress={pct} tone="success" size="small" /></div>
            <Text as="span" variant="bodySm" tone="subdued">{`${pct}%`}</Text>
          </InlineStack>
        </BlockStack>
        {!collapsed && (
          <BlockStack gap="100">
            {steps.map((s, i) => (
              <SetupStep key={s.title} step={s} open={i === open} current={i === firstOpen} onOpen={() => setOpen(i)} />
            ))}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}

// One setup-guide row. Open: description + the step's action (primary while the
// step is unfinished). Closed: just the title, which opens it.
function SetupStep({ step, open, current, onOpen }) {
  return (
    <Box padding="300" borderRadius="200" background={open ? 'bg-surface-secondary' : undefined}>
      <InlineStack gap="300" blockAlign="start" wrap={false}>
        <StepMark state={step.done ? 'done' : current ? 'active' : 'todo'} />
        <BlockStack gap="100">
          {open ? (
            <Text as="h3" variant="bodyMd" fontWeight="semibold">{step.title}</Text>
          ) : (
            <Button variant="monochromePlain" textAlign="left" onClick={onOpen}>{step.title}</Button>
          )}
          {open && (
            <>
              <Text as="p" variant="bodySm" tone="subdued">{step.desc}</Text>
              <Box paddingBlockStart="200">
                <Button variant={step.done ? undefined : 'primary'} onClick={step.action.onAction}>{step.action.content}</Button>
              </Box>
            </>
          )}
        </BlockStack>
      </InlineStack>
    </Box>
  );
}

function StepMark({ state }) {
  if (state === 'done') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-label="Done" style={{ flexShrink: 0 }}>
        <circle cx="10" cy="10" r="10" fill="var(--p-color-bg-fill-success, #29845a)" />
        <path d="M6 10.4l2.6 2.6L14 7.6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const stroke = state === 'active' ? 'var(--p-color-icon, #4a4a4a)' : 'var(--p-color-border-secondary, #c7c7c7)';
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-label="Not done" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="8.75" stroke={stroke} strokeWidth="1.5" fill="none" strokeDasharray={state === 'todo' ? '3 3' : undefined} />
    </svg>
  );
}

// Feature cards share one row height; these rules let each card fill it (the Card's own
// surface becomes a flex column) so the action can sit on the card's bottom edge.
const FEATURE_CARD_CSS = `
.qs-feature-card { display: flex; flex-direction: column; }
.qs-feature-card > * { flex: 1 1 auto; }
.qs-feature-card > * > * { display: flex; flex-direction: column; }
.qs-feature-card__body { flex: 1 1 auto; display: flex; flex-direction: column; gap: var(--p-space-300); }
.qs-feature-card__action { margin-top: auto; }
`;

// A core feature: its key number, what it's for, and one action. Every card keeps the same
// rows — while a feature has no number yet its slot shows the feature's art (or stays empty),
// and the button is pinned to the bottom — so titles, numbers, descriptions and buttons line
// up across the row.
function FeatureCard({ icon, title, badge, value, caption, desc, action, art }) {
  const noValue = value == null;
  return (
    <div className="qs-feature-card">
      <Card>
        <div className="qs-feature-card__body">
          <InlineStack align="space-between" blockAlign="center" gap="200">
            <InlineStack gap="200" blockAlign="center" wrap={false}>
              <Box><Icon source={icon} tone="base" /></Box>
              <Text as="h3" variant="headingSm">{title}</Text>
            </InlineStack>
            {badge}
          </InlineStack>
          <div style={{ position: 'relative' }}>
            <div aria-hidden={noValue || undefined} style={noValue ? { visibility: 'hidden' } : undefined}>
              <BlockStack gap="050">
                <Text as="p" variant="heading2xl">{noValue ? '0' : String(value)}</Text>
                <Text as="p" variant="bodySm" tone="subdued">{caption || '\u00a0'}</Text>
              </BlockStack>
            </div>
            {/* Art fills exactly the number's slot, centered, so the rows stay aligned. */}
            {noValue && art && (
              <img src={art} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} />
            )}
          </div>
          <Text as="p" variant="bodySm" tone="subdued">{desc}</Text>
          <div className="qs-feature-card__action">
            <Button fullWidth onClick={action.onAction}>{action.content}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
