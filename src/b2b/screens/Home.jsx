import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { companyNeedsPrice, kindOf, policyStatus, policyUsageCount } from '../pricing.js';
import { versionFlags, withVersion } from '../../shared/versions.js';
import quotesArt from '../assets/quote-block.webp';
import { heldOrders, heldReason, HeldOrderActions } from '../components/HeldOrders.jsx';
import { money } from '../format.js';

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
  // Orders an order limit's review threshold held back, waiting on the merchant.
  const held = flags.orderLimits ? heldOrders(db) : [];

  const toast = (m) => dispatch({ type: 'TOAST', message: m });
  const nav = (view, patch) => dispatch({ type: 'NAVIGATE', view, patch });
  const viewCompanies = (filter = 'all') => { dispatch({ type: 'SET_LIST_FILTER', filter }); nav('customers'); };
  // The setup wizard belongs to the B2B Company list: land there, then open it on top.
  const addCompany = () => { viewCompanies(); dispatch({ type: 'OPEN_ADD_COMPANY' }); };
  // Pricing screen opens straight on its type chooser (base / quantity).
  const createPricing = () => nav('pricing', { pricingChooser: true });
  const openForm = () => nav('form', { formEntry: hasForm ? 'editor' : 'create' });
  const viewRegistrations = (filter) => { if (filter) dispatch({ type: 'SET_REGISTRATION_FILTER', filter }); nav('registrations'); };
  const openRfq = () => { window.location.href = withVersion('/'); };

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

  // What needs the merchant now — each row one action, most blocking first. Held
  // orders have their own section below it.
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
    <s-page heading={setupComplete ? 'Wholesale B2B Solution' : 'Get your B2B selling workflow ready'}>
      <s-button slot="secondary-actions" onClick={addCompany}>Add company</s-button>
      <s-button slot="secondary-actions" onClick={createPricing}>Create pricing</s-button>
      <s-stack gap="base">
        <s-text color="subdued">
          {setupComplete
            ? 'Your B2B companies, pricing and registrations at a glance.'
            : 'Complete a few setup steps to start accepting B2B registrations and selling with custom pricing.'}
        </s-text>

        {SHOW_DEV_TOOLS && (
          <s-box background="subdued" border="base" borderRadius="base" padding="small-200">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-badge tone="info">Dev</s-badge>
              <s-text fontSize="small" color="subdued">
                {devEmpty
                  ? 'Previewing the empty state — companies, pricing and the form actually exist.'
                  : devPreview === 'noQuotes'
                  ? 'Previewing the Quotes card with the RFQ app installed but no quotes yet.'
                  : genuinelyEmpty
                  ? 'No companies, pricing or form exist, so the home is showing its empty state.'
                  : 'Preview other states: a brand-new merchant, or the Quotes card before any quote arrives.'}
              </s-text>
              <s-press-button pressed={devEmpty} disabled={genuinelyEmpty} onClick={() => togglePreview('empty')}>
                {devEmpty ? 'Show data' : 'Preview empty state'}
              </s-press-button>
              <s-press-button pressed={devPreview === 'noQuotes'} onClick={() => togglePreview('noQuotes')}>
                {devPreview === 'noQuotes' ? 'Show quotes' : 'Preview empty quotes'}
              </s-press-button>
            </s-stack>
          </s-box>
        )}

        {guideVisible && (
          <SetupGuide key={devPreview || 'data'} steps={steps} doneCount={doneCount}
            onDismiss={() => dispatch({ type: 'SET_HOME_GUIDE', hidden: true })} />
        )}

        <s-section heading="Needs attention">
          {attention.length ? (
            <s-stack gap="none">
              {attention.map((a, i) => (
                <React.Fragment key={a.title}>
                  {i ? <s-divider /> : null}
                  <s-box paddingBlock="small">
                    <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="center">
                      <s-stack gap="small-500">
                        <s-paragraph fontWeight="semibold">{a.title}</s-paragraph>
                        <s-paragraph fontSize="small" color="subdued">{a.meta}</s-paragraph>
                      </s-stack>
                      {a.action ? <s-button onClick={a.action.onAction}>{a.action.content}</s-button> : null}
                    </s-grid>
                  </s-box>
                </React.Fragment>
              ))}
            </s-stack>
          ) : (
            <s-paragraph color="subdued">You're all caught up. Nothing needs your attention right now.</s-paragraph>
          )}
        </s-section>

        {/* Buyers are waiting on these; each order has its own decision. */}
        {held.length ? (
          <s-section heading={`${plural(held.length, 'order', 'orders')} waiting for your review`}>
            <s-paragraph fontSize="small" color="subdued">
              They’re over a review threshold, so the buyers couldn’t check out. Approving one creates the order.
            </s-paragraph>
            <HeldOrderList
              items={held}
              db={db}
              onOpen={(company, location) =>
                location
                  ? dispatch({ type: 'OPEN_LOCATION', companyId: company.id, locationId: location.id })
                  : dispatch({ type: 'OPEN_COMPANY', id: company.id, tab: 'orders' })}
            />
          </s-section>
        ) : null}

        <s-stack gap="small">
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="center">
            <s-heading fontSize="large">Your B2B at a glance</s-heading>
            {flags.analytics && <s-link onClick={() => nav('analytics')}>View analytics</s-link>}
          </s-grid>
          <style>{FEATURE_CARD_CSS}</style>
          <s-query-container>
            <s-grid
              gridTemplateColumns="@container (inline-size > 400px) 1fr 1fr, (inline-size > 720px) 1fr 1fr 1fr 1fr, 1fr"
              gap="small"
            >
              <FeatureCard icon="team" title="Companies" value={companies.length}
                caption={`${locations} ${locations <= 1 ? 'location' : 'locations'}`}
                desc="B2B companies with their locations, buyers and payment terms."
                action={companies.length ? { content: 'View companies', onAction: () => viewCompanies() } : { content: 'Add company', onAction: addCompany }} />
              <FeatureCard icon="product" title="B2B pricing" value={activePricing}
                caption={policies.length ? `active · ${plural(quantityPricing, 'quantity break', 'quantity breaks')}` : 'active'}
                desc="Base prices and quantity breaks for companies and customers."
                action={policies.length ? { content: 'View pricing', onAction: () => nav('pricing') } : { content: 'Create pricing', onAction: createPricing }} />
              <FeatureCard icon="note" title="Registrations" value={pending} caption="pending review"
                badge={formOff ? <s-badge>Form off</s-badge> : formLive ? <s-badge tone="success">Form live</s-badge> : hasForm ? <s-badge tone="caution">Form draft</s-badge> : <s-badge>No form</s-badge>}
                desc="B2B applications from the registration form on your storefront."
                action={hasForm ? { content: 'View registrations', onAction: () => viewRegistrations() } : { content: 'Create form', onAction: openForm }} />
              {rfqInstalled ? (
                <FeatureCard icon="clipboard" title="Quotes" value={openQuotes.length}
                  caption={`open · ${plural(dealsClosed, 'deal', 'deals')} closed`}
                  desc="Quote requests from the RFQ app, tracked on each company."
                  action={{ content: 'Open RFQ app', onAction: openRfq }} />
              ) : (
                <FeatureCard icon="clipboard" title="Quotes" badge={<s-badge>Not installed</s-badge>} art={quotesArt}
                  desc="Install O:Request a Quote to collect quote requests and turn accepted quotes into B2B pricing."
                  action={{ content: 'Install app', onAction: () => toast('Opening App Store') }} />
              )}
            </s-grid>
          </s-query-container>
        </s-stack>

        {!setupComplete && (
          <s-section>
            <s-grid gridTemplateColumns="auto minmax(0, 1fr)" gap="small" alignItems="start">
              <s-icon type="info" tone="info" />
              <s-stack gap="small-400">
                <s-heading>What happens next</s-heading>
                <s-paragraph>Once you complete the setup, you can:</s-paragraph>
                <s-unordered-list>
                  <s-list-item>Review registration requests from your storefront</s-list-item>
                  <s-list-item>Approve and assign buyers to companies</s-list-item>
                  <s-list-item>Reuse your B2B pricing across products and customer groups</s-list-item>
                </s-unordered-list>
              </s-stack>
            </s-grid>
          </s-section>
        )}

        <s-box paddingBlock="large">
          {/* text-align on an s-paragraph doesn't reach its shadow <p>; a native block centers inline s-text. */}
          <div style={{ textAlign: 'center' }}>
            <s-text>Learn more about </s-text>
            <s-link onClick={() => toast('Opening guide')}>Wholesale B2B Solution</s-link>
            <s-text> or </s-text>
            <s-link onClick={() => toast('Opening support')}>contact support</s-link>
            <s-text>.</s-text>
          </div>
        </s-box>
      </s-stack>
    </s-page>
  );
}

// Shopify's setup-guide composition: progress "X of Y", collapsible, dismissible,
// one step open at a time (the first unfinished one by default); a click on a
// step's title opens it instead.
// Held orders in their own section under Needs attention: which company and
// location, how much, why it's held, and Approve / Decline right there.
const HELD_SHOWN = 5;
const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
function HeldOrderList({ items, db, onOpen }) {
  const shown = items.slice(0, HELD_SHOWN);
  return (
    <s-box paddingBlockStart="small">
      <s-stack gap="small-200">
        <s-box border="base" borderRadius="base">
          {shown.map(({ order, company, location }, i) => (
            <React.Fragment key={`${company.id}${order.id}`}>
              {i ? <s-divider /> : null}
              <s-box padding="small">
                <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small" alignItems="center">
                  <s-stack gap="small-500">
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-link onClick={() => onOpen(company, location)}>{order.id}</s-link>
                      <s-text>{`${company.name}${location ? ` · ${location.name}` : ''}`}</s-text>
                      <s-text fontWeight="semibold">{money(order.amount)}</s-text>
                    </s-stack>
                    <s-paragraph fontSize="small" color="subdued">{`${order.buyer} · ${shortDate(order.date)} · ${heldReason(order, db)}`}</s-paragraph>
                  </s-stack>
                  <HeldOrderActions companyId={company.id} order={order} />
                </s-grid>
              </s-box>
            </React.Fragment>
          ))}
        </s-box>
        {items.length > shown.length ? (
          <s-paragraph fontSize="small" color="subdued">{`And ${items.length - shown.length} more in each company’s Orders tab.`}</s-paragraph>
        ) : null}
      </s-stack>
    </s-box>
  );
}

function SetupGuide({ steps, doneCount, onDismiss }) {
  const firstOpen = steps.findIndex((s) => !s.done);
  const [open, setOpen] = useState(firstOpen);
  const [collapsed, setCollapsed] = useState(false);
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <s-section>
      <s-stack gap="small">
        {/* Header: title with its controls on one line, then the description, then progress. */}
        <s-stack gap="small-400">
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-400" alignItems="center">
            <s-heading fontSize="large">Setup guide</s-heading>
            <s-stack direction="inline" gap="small-400">
              <s-button variant="tertiary" icon="x" accessibilityLabel="Dismiss setup guide" onClick={onDismiss} />
              <s-button variant="tertiary" icon={collapsed ? 'chevron-down' : 'chevron-up'}
                accessibilityLabel={collapsed ? 'Expand setup guide' : 'Collapse setup guide'} onClick={() => setCollapsed((v) => !v)} />
            </s-stack>
          </s-grid>
          <s-paragraph color="subdued">Use this guide to get your B2B store up and running.</s-paragraph>
        </s-stack>
        <s-stack gap="small-300">
          <s-paragraph fontSize="small" color="subdued">{`${doneCount} of ${steps.length} tasks completed`}</s-paragraph>
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small" alignItems="center">
            <s-progress value={pct} max={100} tone="success" accessibilityLabel="Setup progress" />
            <s-text fontSize="small" color="subdued">{`${pct}%`}</s-text>
          </s-grid>
        </s-stack>
        {!collapsed && (
          <s-stack gap="small-400">
            {steps.map((s, i) => (
              <SetupStep key={s.title} step={s} open={i === open} current={i === firstOpen} onOpen={() => setOpen(i)} />
            ))}
          </s-stack>
        )}
      </s-stack>
    </s-section>
  );
}

// One setup-guide row. Open: description + the step's action (primary while the
// step is unfinished). Closed: just the title, which opens it.
function SetupStep({ step, open, current, onOpen }) {
  return (
    <s-box padding="small" borderRadius="base" background={open ? 'subdued' : 'transparent'}>
      <s-grid gridTemplateColumns="auto minmax(0, 1fr)" gap="small" alignItems="start">
        <StepMark state={step.done ? 'done' : current ? 'active' : 'todo'} />
        <s-stack gap="small-400">
          {open ? (
            <s-paragraph fontWeight="semibold">{step.title}</s-paragraph>
          ) : (
            <s-paragraph>
              <s-link tone="neutral" onClick={onOpen}>{step.title}</s-link>
            </s-paragraph>
          )}
          {open && (
            <>
              <s-paragraph fontSize="small" color="subdued">{step.desc}</s-paragraph>
              <s-box paddingBlockStart="small-200">
                <s-button variant={step.done ? undefined : 'primary'} onClick={step.action.onAction}>{step.action.content}</s-button>
              </s-box>
            </>
          )}
        </s-stack>
      </s-grid>
    </s-box>
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

// Feature cards share one row height; these rules let each card fill it so the
// action can sit on the card's bottom edge. The card surface is app-drawn (an
// s-section can't be stretched to its grid row from outside its shadow root).
const FEATURE_CARD_CSS = `
.qs-feature-card {
  display: flex; flex-direction: column; gap: var(--p-space-300); height: 100%;
  padding: 16px; border-radius: 12px; background: var(--p-color-bg-surface);
  box-shadow: 0 1px 0 0 rgba(26, 26, 26, 0.07), inset 0 1px 0 0 rgba(204, 204, 204, 0.5),
    inset 1px 0 0 0 rgba(0, 0, 0, 0.07), inset -1px 0 0 0 rgba(0, 0, 0, 0.07), inset 0 -1px 0 0 rgba(0, 0, 0, 0.13);
}
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
      <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-icon type={icon} />
          <s-heading>{title}</s-heading>
        </s-stack>
        {badge}
      </s-stack>
      <div style={{ position: 'relative' }}>
        <div aria-hidden={noValue || undefined} style={noValue ? { visibility: 'hidden' } : undefined}>
          <s-stack gap="small-500">
            <s-heading fontSize="large-400" accessibilityRole="presentation">{noValue ? '0' : String(value)}</s-heading>
            <s-paragraph fontSize="small" color="subdued">{caption || ' '}</s-paragraph>
          </s-stack>
        </div>
        {/* Art fills exactly the number's slot, centered, so the rows stay aligned. */}
        {noValue && art && (
          <img src={art} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center' }} />
        )}
      </div>
      <s-paragraph fontSize="small" color="subdued">{desc}</s-paragraph>
      <div className="qs-feature-card__action">
        <s-button inlineSize="fill" onClick={action.onAction}>{action.content}</s-button>
      </div>
    </div>
  );
}
