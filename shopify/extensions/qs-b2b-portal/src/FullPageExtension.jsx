import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useRef, useState} from 'preact/hooks';
import {answerContract, getRegistrationStatus, loadOrders, loadPortal} from './api.js';

// The B2B Portal (customer-account.page.render), as the prototype's: who the buyer
// purchases for and the terms that apply (Business account), the contract they buy
// under, and their orders — the ones sent to the seller for review among them — in
// one list. A placed order opens Shopify's order page (with its Request a quote
// action); an order request opens its own page here.
export default async () => {
  render(<PortalPage />, document.body);
};

const numId = (gid) => String(gid || '').split('/').pop();

function money(price) {
  if (!price) return '—';
  return new Intl.NumberFormat(undefined, {style: 'currency', currency: price.currencyCode}).format(Number(price.amount));
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {dateStyle: 'medium'}).format(new Date(value));
}

function openQuotes(params = {}) {
  const query = new URLSearchParams(params).toString();
  shopify.navigation.navigate(`extension:qs-b2b-quotes/${query ? `?${query}` : ''}`);
}

function PortalPage() {
  const purchasingCompany = shopify.authenticatedAccount.purchasingCompany.value;
  const company = purchasingCompany?.company;
  const location = purchasingCompany?.location;

  const [account, setAccount] = useState(null); // {email, orders} from the Customer Account API
  const [portal, setPortal] = useState(null); // {business, contract, requests} from the app's backend
  const [registration, setRegistration] = useState(null);
  const [error, setError] = useState('');
  // An order request opened from Orders, by its id.
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let active = true;
    setAccount(null);
    setPortal(null);
    setError('');
    setOpenId(null);
    loadOrders()
      .then((value) => active && setAccount(value))
      .catch((err) => {
        if (!active) return;
        setAccount({email: null, orders: []});
        setError(err.message || 'We couldn’t load your orders.');
      });
    if (location) {
      loadPortal(location.id)
        .then((value) => active && setPortal(value))
        .catch(() => {
          if (!active) return;
          setPortal({business: null, contract: null, requests: []});
          setError('We couldn’t load your business account.');
        });
    }
    if (!company) {
      getRegistrationStatus().then((value) => active && setRegistration(value)).catch(() => active && setRegistration({status: 'none'}));
    }
    return () => {
      active = false;
    };
  }, [company?.id, location?.id]);

  // Once they approve a proposal it's activated (Scheduled or Active): the portal's data
  // again, so it moves to its Upcoming contract or Contract card.
  const refreshPortal = () => {
    if (location) loadPortal(location.id).then(setPortal).catch(() => {});
  };

  const loading = !account || (location && !portal);
  const items = loading ? [] : portalItems(account.orders, portal?.requests || [], location);
  const open = openId && items.find((it) => it.request?.id === openId);
  if (open) {
    return <RequestPage item={open} email={account.email} business={portal?.business} onBack={() => setOpenId(null)} />;
  }

  // Shopify gives the extension the company's and location's ids; their names come from the backend.
  const names = portal?.company ? `${portal.company}${portal.location ? ` · ${portal.location}` : ''}` : '';
  const subheading = company ? names : 'Quotes, business pricing and purchasing in one place';

  return (
    <s-page heading="B2B Portal" subheading={subheading} inlineSize="large">
      <s-button slot="primary-action" variant="primary" onClick={() => openQuotes()}>
        View all quotes
      </s-button>
      <s-button slot="secondary-actions" onClick={() => shopify.navigation.navigate('shopify:customer-account/orders')}>
        View orders
      </s-button>
      <s-button slot="secondary-actions" onClick={() => shopify.navigation.navigate('shopify:customer-account/profile')}>
        Business profile
      </s-button>

      <s-stack direction="block" gap="base">
        {error ? <s-banner tone="critical">{error}</s-banner> : null}

        {company
          ? <BusinessAccount names={names} business={portal?.business} loading={!portal} />
          : <BusinessRegistration registration={registration} />}

        {company && portal?.contract ? <Contract contract={portal.contract} /> : null}
        {company && portal?.upcoming ? <UpcomingContract key={portal.upcoming.number} contract={portal.upcoming} locationId={location?.id} locationName={portal.location} /> : null}
        {company && portal?.proposal ? (
          <UpcomingContract key={`${portal.proposal.number}-${portal.proposal.version}`} contract={portal.proposal} locationId={location?.id} locationName={portal.location} proposal onApproved={refreshPortal} />
        ) : null}

        <PortalOrders items={items} loading={loading} locationName={portal?.location} hasRequests={(portal?.requests || []).length > 0} onOpen={setOpenId} />
      </s-stack>
    </s-page>
  );
}

function BusinessAccount({names, business, loading}) {
  const terms = [
    {label: 'Pricing', value: business?.pricing},
    {label: 'Payment terms', value: business?.paymentTerms},
    {label: 'Ordering', value: business?.ordering},
  ].filter((term) => term.value);

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-heading>Business account</s-heading>
          {business?.pricingActive ? <s-badge>Company pricing active</s-badge> : null}
        </s-stack>
        {names ? <s-text color="subdued">{`Purchasing for ${names}`}</s-text> : null}
        {loading ? <s-spinner accessibilityLabel="Loading your business account" /> : null}
        {terms.length ? (
          <s-query-container>
            {/* One equal column per term, so they fill the row; stacked on narrow screens. */}
            <s-grid gridTemplateColumns={`@container (inline-size > 480px) ${terms.map(() => '1fr').join(' ')}, 1fr`} gap="base">
              {terms.map((term) => (
                <s-stack key={term.label} direction="block" gap="small-300">
                  <s-text color="subdued">{term.label}</s-text>
                  <s-text type="strong">{term.value}</s-text>
                </s-stack>
              ))}
            </s-grid>
          </s-query-container>
        ) : null}
      </s-stack>
    </s-section>
  );
}

// The company's contract with the seller (the B2B app → Contracts), read-only, laid
// out as Business account above it: its name, number, version and dates, then its
// pricing (each with its rule, and View details when that line doesn't say all of
// it) beside its order limits; Version history is its action.
function Contract({contract}) {
  const facts = [
    {label: 'Number', value: contract.number},
    {label: 'Version', value: String(contract.version)},
    ...(contract.start || contract.end
      ? [{label: 'Start date', value: contract.start || '—'}, {label: 'End date', value: contract.end || 'No end date'}]
      : [{label: 'Dates', value: contract.dates}]),
  ];
  // A pricing's line counts its rules ("2 rules") or leaves its own prices out: its
  // View details shows them all.
  const moreIn = (p) => {
    const d = contract.details?.[p];
    return !!d && (d.own.length > 0 || d.rows.map((r) => `${r.on}: ${r.adjust}`).join(' · ') !== contract.rules?.[p]);
  };
  const both = contract.pricing.length > 0 && contract.limits.length > 0;
  // An order limit's line in full (its View details), found by its line.
  const limitDetail = (t) => (contract.limitDetails || []).find((d) => d.text === t && d.rows.length);
  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-heading>Contract</s-heading>
            <s-badge>Active</s-badge>
          </s-stack>
          <s-stack direction="inline" gap="small-200">
            {contract.history?.length ? (
              <s-button command="--show" commandFor="contract-history">
                Version history
              </s-button>
            ) : null}
          </s-stack>
        </s-grid>
        <ContractName name={contract.name} logId={contract.activities?.length ? 'contract-activities' : null} />
        <s-query-container>
          <s-stack direction="block" gap="base">
            <s-grid gridTemplateColumns="@container (inline-size > 560px) 1fr 1fr 1fr 1fr, 1fr 1fr" gap="base">
              {facts.map((f) => (
                <s-stack key={f.label} direction="block" gap="small-300">
                  <s-text color="subdued">{f.label}</s-text>
                  <s-text type="strong">{f.value}</s-text>
                </s-stack>
              ))}
            </s-grid>
            <s-grid gridTemplateColumns={both ? '@container (inline-size > 640px) 1fr 1fr, 1fr' : '1fr'} gap="base">
              {contract.pricing.length > 0 ? (
                <s-stack direction="block" gap="small-200">
                  <s-text color="subdued">Pricing</s-text>
                  <s-box border="base" borderRadius="base" padding="base">
                    <s-stack direction="block" gap="base">
                      {/* Each pricing, its rule under it: "10–49 units: 5% off · 50+
                          units: 10% off", "2 rules". */}
                      {contract.pricing.map((p, i) => (
                        <s-stack key={p} direction="block" gap="base">
                          {i ? <s-divider /> : null}
                          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="center">
                            <s-stack direction="block" gap="small-300">
                              <s-text type="strong">{p}</s-text>
                              {contract.rules?.[p] ? <s-text color="subdued">{contract.rules[p]}</s-text> : null}
                            </s-stack>
                            {moreIn(p) ? (
                              <s-link command="--show" commandFor={`pricing-rules-${i}`}>
                                View details
                              </s-link>
                            ) : (
                              <s-box />
                            )}
                          </s-grid>
                        </s-stack>
                      ))}
                    </s-stack>
                  </s-box>
                </s-stack>
              ) : null}
              {contract.limits.length > 0 ? (
                <s-stack direction="block" gap="small-200">
                  <s-text color="subdued">Order limits</s-text>
                  <s-box border="base" borderRadius="base" padding="base">
                    <s-stack direction="block" gap="base">
                      {/* Each limit, its View details at the right as a pricing's. */}
                      {contract.limits.map((t, i) => (
                        <s-stack key={t} direction="block" gap="base">
                          {i ? <s-divider /> : null}
                          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="center">
                            <s-text>{t}</s-text>
                            {limitDetail(t) ? (
                              <s-link command="--show" commandFor={`limit-details-${i}`}>
                                View details
                              </s-link>
                            ) : (
                              <s-box />
                            )}
                          </s-grid>
                        </s-stack>
                      ))}
                    </s-stack>
                  </s-box>
                </s-stack>
              ) : null}
            </s-grid>
          </s-stack>
        </s-query-container>
      </s-stack>
      {contract.history?.length ? <ContractHistory contract={contract} /> : null}
      {contract.activities?.length ? <ActivityLog id="contract-activities" number={contract.number} activities={contract.activities} /> : null}
      {contract.limits.map((t, i) => (limitDetail(t) ? <LimitDetails key={t} id={`limit-details-${i}`} detail={limitDetail(t)} /> : null))}
      {contract.pricing.map((p, i) =>
        moreIn(p) ? (
          <PricingRules key={p} id={`pricing-rules-${i}`} name={p} details={contract.details[p]} prices={(contract.prices || []).filter((e) => e.pricing === p)} />
        ) : null,
      )}
    </s-section>
  );
}

// A pricing's rules in full (its View details on the contract card), as a table: what
// each rule covers and its price — "Collection A · 15% off", in the order they apply —
// then each product with its own price ("Home Jersey HAALAND · $79"). Its Preview
// prices turns the modal into its price screen (a modal can't open another one):
// what the buyer pays for the products this pricing prices, with Back to rules.
// From the backend (api/customer/portal.js contractRules, contractPrices).
// A contract that hasn't started at the location, on its own card under the Contract
// card, laid out as it: its heading and badge, its name, its number, version and
// dates, then its pricing (each with its rule) beside its order limits (each with View
// details, as the contract card's).
//   Upcoming contract (Scheduled, `proposal` false): read-only — it's agreed and
//     starts on its date. Preview prices shows what the buyer pays once it starts.
//   Contract proposal (Proposed): the seller sent it for the buyer to approve. They
//     answer it from the card — Approve, or Request changes (a modal asking what
//     should change) — for the version they see; their answers are in its Activities
//     log. Approved, it's activated straight away (Scheduled, or Active when it starts
//     today): `onApproved` loads the portal again, so it moves to that card.
// From the backend (api/customer/portal.js notStartedContracts).
function UpcomingContract({contract, locationId, locationName, proposal = false, onApproved}) {
  const ids = proposal ? 'proposal' : 'upcoming';
  const [response, setResponse] = useState(contract.response || null);
  // The seller declined their request for changes, with a reply: Request rejected (until
  // they answer again).
  const [declined, setDeclined] = useState(contract.declined || null);
  // Their request for changes is with the seller: Awaiting review, and no Approve.
  const awaiting = proposal && response?.kind === 'changes' && !declined;
  // They asked to cancel it (Request cancellation, with why — a proposal, or an
  // upcoming one that needs their approval): Cancellation requested, and no Approve.
  // The seller can delete it only then.
  const cancelRequested = response?.kind === 'cancel';
  const canCancel = (proposal || contract.approval) && !cancelRequested;
  // Every answer they sent on it, newest first — approvals, and requests for changes or
  // cancellation with where they stand (its Activities log).
  const [activities, setActivities] = useState(contract.activities || []);
  const [sending, setSending] = useState(null); // 'approve' | 'changes' | 'cancel' while sent
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState(''); // why they want to cancel it
  const [error, setError] = useState(null); // {kind, text} of a send that failed
  const changesModal = useRef(null);
  const cancelModal = useRef(null);
  const send = async (kind) => {
    setSending(kind);
    setError(null);
    try {
      const text = kind === 'changes' ? message.trim() : kind === 'cancel' ? reason.trim() : '';
      const result = await answerContract(locationId, contract.number, contract.version, kind, text);
      setResponse(result.response);
      setDeclined(null);
      // Their new answer joins the log on top and closes the request awaiting review.
      setActivities((list) => [
        {...result.response, version: contract.version, status: kind === 'approve' ? null : 'Awaiting review', reply: null},
        ...list.map((q) => (q.status === 'Awaiting review' ? {...q, status: 'Closed'} : q)),
      ]);
      // Approved, it's been activated: it moves to its Upcoming contract or Contract card.
      if (kind === 'approve') onApproved?.();
      if (kind === 'changes') {
        setMessage('');
        changesModal.current?.hideOverlay?.();
      }
      if (kind === 'cancel') {
        setReason('');
        cancelModal.current?.hideOverlay?.();
      }
    } catch (err) {
      // The backend says why (a new version was sent, it expired…) as {error}.
      let text = 'We couldn’t send your answer. Try again.';
      try {
        text = JSON.parse(err.message).error || text;
      } catch {
        // not JSON
      }
      setError({kind, text});
    } finally {
      setSending(null);
    }
  };
  const facts = [
    {label: 'Number', value: contract.number},
    {label: 'Version', value: String(contract.version)},
    {label: 'Start date', value: contract.start || '—'},
    {label: 'End date', value: contract.end || 'No end date'},
  ];
  const both = contract.pricing.length > 0 && contract.limits.length > 0;
  // An order limit's line in full (its View details), found by its line.
  const limitDetail = (t) => (contract.limitDetails || []).find((d) => d.text === t && d.rows.length);
  const box = (label, rows) => (
    <s-stack direction="block" gap="small-200">
      <s-text color="subdued">{label}</s-text>
      <s-box border="base" borderRadius="base" padding="base">
        <s-stack direction="block" gap="base">
          {rows.map((r, i) => (
            <s-stack key={r.key} direction="block" gap="base">
              {i ? <s-divider /> : null}
              {r.content}
            </s-stack>
          ))}
        </s-stack>
      </s-box>
    </s-stack>
  );
  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="center">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-heading>{proposal ? 'Contract proposal' : 'Upcoming contract'}</s-heading>
            {/* Once they ask for changes, that's where it stands until the seller answers:
                Request rejected if they declined it, until the buyer answers again. Once
                they ask to cancel it, Cancellation requested. */}
            <s-badge>
              {cancelRequested
                ? 'Cancellation requested'
                : !proposal
                  ? 'Scheduled'
                  : awaiting
                    ? 'Awaiting review'
                    : declined
                      ? 'Request rejected'
                      : 'Proposed'}
            </s-badge>
          </s-stack>
          <s-stack direction="inline" gap="small-200">
            {!proposal ? (
              <s-button command="--show" commandFor="upcoming-prices">
                Preview prices
              </s-button>
            ) : null}
            {proposal ? (
              <s-button command="--show" commandFor="proposal-changes" disabled={!!sending}>
                Request changes
              </s-button>
            ) : null}
            {canCancel ? (
              <s-button tone="critical" command="--show" commandFor={`${ids}-cancel`} disabled={!!sending}>
                Request cancellation
              </s-button>
            ) : null}
            {proposal && response?.kind !== 'approve' && !awaiting && !cancelRequested ? (
              <s-button variant="primary" loading={sending === 'approve'} disabled={!!sending} onClick={() => send('approve')}>
                Approve
              </s-button>
            ) : null}
          </s-stack>
        </s-grid>
        <ContractName name={contract.name} logId={activities.length ? `${ids}-activities` : null} />
        {error?.kind === 'approve' ? <s-banner tone="critical">{error.text}</s-banner> : null}
        <s-query-container>
          <s-stack direction="block" gap="base">
            <s-grid gridTemplateColumns="@container (inline-size > 560px) 1fr 1fr 1fr 1fr, 1fr 1fr" gap="base">
              {facts.map((f) => (
                <s-stack key={f.label} direction="block" gap="small-300">
                  <s-text color="subdued">{f.label}</s-text>
                  <s-text type="strong">{f.value}</s-text>
                </s-stack>
              ))}
            </s-grid>
            {contract.pricing.length || contract.limits.length ? (
              <s-grid gridTemplateColumns={both ? '@container (inline-size > 640px) 1fr 1fr, 1fr' : '1fr'} gap="base">
                {contract.pricing.length
                  ? box(
                      'Pricing',
                      contract.pricing.map((p) => ({
                        key: p,
                        content: (
                          <s-stack direction="block" gap="small-300">
                            <s-text type="strong">{p}</s-text>
                            {contract.rules?.[p] ? <s-text color="subdued">{contract.rules[p]}</s-text> : null}
                          </s-stack>
                        ),
                      })),
                    )
                  : null}
                {contract.limits.length
                  ? box(
                      'Order limits',
                      contract.limits.map((t, i) => ({
                        key: t,
                        content: (
                          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="center">
                            <s-text>{t}</s-text>
                            {limitDetail(t) ? (
                              <s-link command="--show" commandFor={`${ids}-limit-${i}`}>
                                View details
                              </s-link>
                            ) : (
                              <s-box />
                            )}
                          </s-grid>
                        ),
                      })),
                    )
                  : null}
              </s-grid>
            ) : null}
          </s-stack>
        </s-query-container>
      </s-stack>
      {!proposal ? <ContractPrices id="upcoming-prices" contract={contract} locationName={locationName} /> : null}
      {contract.limits.map((t, i) => (limitDetail(t) ? <LimitDetails key={t} id={`${ids}-limit-${i}`} detail={limitDetail(t)} /> : null))}
      {proposal ? (
        <s-modal ref={changesModal} id="proposal-changes" heading={`Request changes · ${contract.number}`}>
          <s-stack direction="block" gap="base">
            {error?.kind === 'changes' ? <s-banner tone="critical">{error.text}</s-banner> : null}
            <s-text-area label="What should change?" value={message} rows={4} onInput={(e) => setMessage(e.target.value)} />
          </s-stack>
          <s-button slot="primary-action" variant="primary" loading={sending === 'changes'} disabled={!message.trim() || !!sending} onClick={() => send('changes')}>
            Send
          </s-button>
          <s-button slot="secondary-actions" command="--hide" commandFor="proposal-changes">
            Cancel
          </s-button>
        </s-modal>
      ) : null}
      {/* Kept while it closes after sending (its button is gone by then). */}
      {proposal || contract.approval ? (
        <s-modal ref={cancelModal} id={`${ids}-cancel`} heading={`Request cancellation · ${contract.number}`}>
          <s-stack direction="block" gap="base">
            {error?.kind === 'cancel' ? <s-banner tone="critical">{error.text}</s-banner> : null}
            <s-text-area label="Why do you want to cancel it?" value={reason} rows={4} onInput={(e) => setReason(e.target.value)} />
          </s-stack>
          <s-button slot="primary-action" variant="primary" tone="critical" loading={sending === 'cancel'} disabled={!reason.trim() || !!sending} onClick={() => send('cancel')}>
            Send
          </s-button>
          <s-button slot="secondary-actions" command="--hide" commandFor={`${ids}-cancel`}>
            Close
          </s-button>
        </s-modal>
      ) : null}
      {activities.length ? <ActivityLog id={`${ids}-activities`} number={contract.number} activities={activities} /> : null}
    </s-section>
  );
}

// A contract card's name line: the contract's name and, once its buyers answered it,
// Activities log as a link at the right of it (`logId`: the log's modal).
function ContractName({name, logId}) {
  if (!logId) return <s-text color="subdued">{name}</s-text>;
  return (
    <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="center">
      <s-text color="subdued">{name}</s-text>
      <s-link command="--show" commandFor={logId}>
        Activities log
      </s-link>
    </s-grid>
  );
}

// What each answer reads as in the Activities log.
const ACTIVITY_TITLE = {approve: 'Approved', changes: 'Changes requested', cancel: 'Cancellation requested'};

// A contract's Activities log (its link beside the name on the Contract proposal,
// Upcoming contract and Contract cards): every answer its buyers sent, newest first —
// Approved, Changes requested, Cancellation requested — with the version, who and the
// date. A request opens (›) on its own screen: where it stands, its message and, when
// the seller declined it, their reply. One modal switching screens, as Version history
// (a modal can't open another).
// From the backend (api/customer/portal.js activitiesOf).
function ActivityLog({id, number, activities}) {
  const [shown, setShown] = useState(null); // the activity open, by number
  // Numbered from the first one, so a new one doesn't renumber the rest.
  const numbered = activities.map((a, i) => ({...a, n: activities.length - i}));
  const q = numbered.find((a) => a.n === shown && a.kind !== 'approve');
  return (
    <s-modal id={id} heading={q ? `${ACTIVITY_TITLE[q.kind] || 'Request'} · ${number}` : `Activities log · ${number}`} onAfterHide={() => setShown(null)}>
      {q ? (
        <RequestScreen request={q} />
      ) : (
        <s-stack direction="block" gap="base">
          {numbered.map((a, i) => {
            const opens = a.kind !== 'approve';
            const row = (
              <s-grid gridTemplateColumns="minmax(0, 1fr) auto auto" gap="base" alignItems="center">
                <s-stack direction="block" gap="small-300">
                  <s-text type="strong">{ACTIVITY_TITLE[a.kind] || 'Request'}</s-text>
                  <s-text color="subdued">{[a.version ? `Version ${a.version}` : null, a.mine ? 'By you' : a.by ? `By ${a.by}` : null].filter(Boolean).join(' · ')}</s-text>
                </s-stack>
                {a.at ? <s-text color="subdued">{a.at}</s-text> : <s-box />}
                {opens ? <s-icon type="chevron-right" /> : <s-box />}
              </s-grid>
            );
            return (
              <s-stack key={a.n} direction="block" gap="base">
                {i ? <s-divider /> : null}
                {opens ? (
                  <s-clickable onClick={() => setShown(a.n)} accessibilityLabel={`Open ${(ACTIVITY_TITLE[a.kind] || 'request').toLowerCase()} from ${a.at || ''}`}>
                    {row}
                  </s-clickable>
                ) : (
                  row
                )}
              </s-stack>
            );
          })}
        </s-stack>
      )}
      {q ? (
        <s-button slot="secondary-actions" onClick={() => setShown(null)}>
          Back to activities
        </s-button>
      ) : null}
      <s-button slot="secondary-actions" command="--hide" commandFor={id}>
        Close
      </s-button>
    </s-modal>
  );
}

// One request on its own screen: where it stands, their message (who sent it and
// when) and the seller's reply when they declined it.
function RequestScreen({request: q}) {
  const from = q.mine ? 'Your message' : `Message from ${q.by || 'your team'}`;
  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-text color="subdued">Status</s-text>
        <s-badge>{q.status}</s-badge>
      </s-stack>
      <s-stack direction="block" gap="small-300">
        <s-text color="subdued">{q.at ? `${from} · ${q.at}` : from}</s-text>
        <s-text>{q.message}</s-text>
      </s-stack>
      {q.reply ? (
        <s-stack direction="block" gap="small-300">
          <s-text color="subdued">{q.reply.at ? `Seller’s reply · ${q.reply.at}` : 'Seller’s reply'}</s-text>
          <s-text>{q.reply.message}</s-text>
        </s-stack>
      ) : null}
    </s-stack>
  );
}

// The contract's Version history (its button on the contract card): its versions,
// newest first — "Version 3", its note, how many changes, its date — each with a ›
// that opens that version on its own screen: What changed and Configuration as tabs.
// One modal switching screens, as a modal can't open another.
function ContractHistory({contract}) {
  const [shown, setShown] = useState(null); // the version open
  const v = contract.history.find((h) => h.version === shown && h.view);
  return (
    <s-modal
      id="contract-history"
      heading={v ? `${contract.number} · ${v.view.name}` : `Version history · ${contract.number}`}
      size="large"
      onAfterHide={() => setShown(null)}
    >
      {v ? (
        <VersionScreen key={v.version} version={v} />
      ) : (
        <s-stack direction="block" gap="base">
          {contract.history.map((h, i) => {
            const n = changeCount(h.view?.changed);
            const head = (
              <s-grid gridTemplateColumns="minmax(0, 1fr) auto auto" gap="base" alignItems="center">
                <s-stack direction="block" gap="small-300">
                  <s-text type="strong">{`Version ${h.version}`}</s-text>
                  {h.note ? <s-text color="subdued">{h.note}</s-text> : null}
                  {n ? (
                    <s-text color="subdued" type="small">
                      {`${n} change${n === 1 ? '' : 's'}`}
                    </s-text>
                  ) : null}
                </s-stack>
                <s-text color="subdued">{h.date}</s-text>
                {h.view ? <s-icon type="chevron-right" /> : <s-box />}
              </s-grid>
            );
            return (
              <s-stack key={i} direction="block" gap="base">
                {i ? <s-divider /> : null}
                {h.view ? (
                  <s-clickable onClick={() => setShown(h.version)} accessibilityLabel={`Open version ${h.version}`}>
                    {head}
                  </s-clickable>
                ) : (
                  head
                )}
              </s-stack>
            );
          })}
        </s-stack>
      )}
      {v ? (
        <s-button slot="secondary-actions" onClick={() => setShown(null)}>
          Back to versions
        </s-button>
      ) : null}
      <s-button slot="secondary-actions" command="--hide" commandFor="contract-history">
        Close
      </s-button>
    </s-modal>
  );
}

// How many changes a version made: each contract fact, each term added or removed,
// and each line of a changed term (its rename alone counts one).
const changeCount = (changed) =>
  changed ? changed.contract.length + changed.terms.reduce((n, t) => n + (t.change === 'Changed' ? Math.max(t.lines.length, 1) : 1), 0) : 0;

// One version on its own screen: What changed and Configuration as tabs.
function VersionScreen({version}) {
  const [tab, setTab] = useState('changes');
  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="small-200">
        <s-press-button pressed={tab === 'changes'} onClick={() => setTab('changes')}>
          What changed
        </s-press-button>
        <s-press-button pressed={tab === 'config'} onClick={() => setTab('config')}>
          Configuration
        </s-press-button>
      </s-stack>
      {tab === 'changes' ? <VersionChanged changed={version.view.changed} /> : <VersionView version={version} />}
    </s-stack>
  );
}

// One version as the B2B admin's version view (ContractVersionModal) shows it: a box
// with its status, dates, where it applied and which version, then its Terms — Base
// pricing, Quantity pricing and Order limits, each with how many — a row per term
// (a pricing's priority number first, lowest first) with what it does in one line,
// and a chevron that opens its settings.
function VersionView({version}) {
  const view = version.view;
  const [opened, setOpened] = useState([]); // `${group}-${row}` showing their settings
  const toggle = (key) => setOpened((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  return (
    <s-stack direction="block" gap="base">
      <s-box border="base" borderRadius="base" padding="base">
        <s-query-container>
          <s-grid gridTemplateColumns="@container (inline-size > 480px) 3fr 2fr, 1fr" gap="base">
            <VersionInfo label="Status">
              <s-badge>{view.status}</s-badge>
            </VersionInfo>
            <VersionInfo label="Dates">
              <s-text type="strong">{view.dates}</s-text>
            </VersionInfo>
            <VersionInfo label="Applies to">
              <s-text type="strong">{view.appliesTo}</s-text>
            </VersionInfo>
            <VersionInfo label="Version">
              <s-text type="strong">{`Version ${version.version}${view.latest ? ' (latest)' : ''}`}</s-text>
            </VersionInfo>
          </s-grid>
        </s-query-container>
      </s-box>
      <s-heading>Terms</s-heading>
      {view.groups.map((g, gi) => (
        <s-box key={g.title} border="base" borderRadius="base" overflow="hidden">
          <s-box background="subdued" paddingBlock="small-300" paddingInline="small">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-icon type={g.icon} />
              <s-text type="strong">{g.title}</s-text>
              <s-badge>{String(g.terms.length)}</s-badge>
            </s-stack>
          </s-box>
          {g.terms.length ? (
            g.terms.map((t, ti) => {
              const key = `${gi}-${ti}`;
              const open = opened.includes(key);
              return (
                <s-stack key={key} direction="block" gap="none">
                  <s-divider />
                  <s-box paddingBlock="small-200" paddingInline="small">
                    <s-stack direction="block" gap="small-200">
                      <s-grid gridTemplateColumns={t.priority != null ? 'auto minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto'} gap="small" alignItems="center">
                        {t.priority != null ? (
                          <s-box border="base" borderRadius="max" paddingInline="small-200" accessibilityLabel={`Priority ${t.priority}`}>
                            <s-text>{String(t.priority)}</s-text>
                          </s-box>
                        ) : null}
                        <s-stack direction="block" gap="small-500">
                          <s-text>{t.name}</s-text>
                          <s-text color="subdued" type="small">
                            {t.summary}
                          </s-text>
                        </s-stack>
                        {t.settings.length ? (
                          <s-clickable onClick={() => toggle(key)} accessibilityLabel={`${open ? 'Hide' : 'Show'} settings of ${t.name}`}>
                            <s-icon type={open ? 'chevron-up' : 'chevron-down'} />
                          </s-clickable>
                        ) : (
                          <s-box />
                        )}
                      </s-grid>
                      {open ? <TermSettings sections={t.settings} /> : null}
                    </s-stack>
                  </s-box>
                </s-stack>
              );
            })
          ) : (
            <s-stack direction="block" gap="none">
              <s-divider />
              <s-box paddingBlock="small-200" paddingInline="small">
                <s-text color="subdued">None</s-text>
              </s-box>
            </s-stack>
          )}
        </s-box>
      ))}
    </s-stack>
  );
}

// What a version changed against the one before it (its What changed tab): the
// contract's own changes (name, dates, where it applies), then a row per term it
// added, removed or changed, with its group, how it changed and how many lines. A
// changed term opens (collapsible) to the settings lines that changed, the old value
// struck through. The first version has none to compare with.
function VersionChanged({changed}) {
  const [opened, setOpened] = useState([]); // changed terms showing their lines
  const flip = (i) => setOpened((is) => (is.includes(i) ? is.filter((x) => x !== i) : [...is, i]));
  const row = (children, key, first) => (
    <s-stack key={key} direction="block" gap="none">
      {first ? null : <s-divider />}
      <s-box paddingBlock="small-200" paddingInline="small">
        {children}
      </s-box>
    </s-stack>
  );
  if (!changed) return <s-text color="subdued">The contract’s first version.</s-text>;
  if (!changed.contract.length && !changed.terms.length) return <s-text color="subdued">No changes to the contract’s terms.</s-text>;
  return (
    <s-box border="base" borderRadius="base" overflow="hidden">
      {changed.contract.map((c, i) =>
        row(
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200">
            <s-text>{c.label}</s-text>
            <s-stack direction="inline" gap="small-200">
              <s-text color="subdued" type="redundant">
                {c.before}
              </s-text>
              <s-text type="strong">{c.value}</s-text>
            </s-stack>
          </s-grid>,
          c.label,
          i === 0,
        ),
      )}
      {changed.terms.map((t, i) => {
        const open = opened.includes(i);
        const lines = t.lines.length;
        const head = (
          <s-grid gridTemplateColumns={lines ? 'auto minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto'} gap="small" alignItems="center">
            {lines ? <s-icon type={open ? 'chevron-down' : 'chevron-right'} /> : null}
            <s-stack direction="block" gap="small-500">
              <s-text>{t.name}</s-text>
              <s-text color="subdued" type="small">
                {t.was ? `${t.group} · was ${t.was}` : t.group}
              </s-text>
            </s-stack>
            <s-badge tone={t.change === 'Removed' ? 'critical' : 'auto'}>{lines ? `${t.change} · ${lines}` : t.change}</s-badge>
          </s-grid>
        );
        return row(
          <s-stack direction="block" gap="small-200">
            {lines ? (
              <s-clickable onClick={() => flip(i)} accessibilityLabel={`${open ? 'Hide' : 'Show'} what changed in ${t.name}`}>
                {head}
              </s-clickable>
            ) : (
              head
            )}
            {open ? t.lines.map((l, j) => <ChangedLine key={j} line={l} />) : null}
          </s-stack>,
          `t-${i}`,
          i === 0 && !changed.contract.length,
        );
      })}
    </s-box>
  );
}

// A settings line a version changed: its text (a line without a value — a quantity
// pricing's Products — its old text struck through above it) and, under it, its section and how
// it changed; its value on the right, the old one struck through before it.
function ChangedLine({line}) {
  const removed = line.change === 'Removed';
  const whole = line.value == null;
  return (
    <s-box border="base" borderRadius="base" paddingBlock="small-300" paddingInline="small">
      <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200">
        <s-stack direction="block" gap="small-500">
          {whole && line.before ? (
            <s-text color="subdued" type="redundant">
              {line.before}
            </s-text>
          ) : null}
          <s-text type={removed ? 'redundant' : undefined}>{line.text}</s-text>
          <s-text color="subdued" type="small">
            {[line.section, line.note, line.change].filter(Boolean).join(' · ')}
          </s-text>
        </s-stack>
        {whole ? (
          <s-box />
        ) : (
          <s-stack direction="inline" gap="small-200">
            {line.before ? (
              <s-text color="subdued" type="redundant">
                {line.before}
              </s-text>
            ) : null}
            <s-text type={removed ? 'redundant' : 'strong'}>{line.value}</s-text>
          </s-stack>
        )}
      </s-grid>
    </s-box>
  );
}

// A fact in a version's box: a small label over its value.
function VersionInfo({label, children}) {
  return (
    <s-stack direction="block" gap="small-400">
      <s-text color="subdued" type="small">
        {label}
      </s-text>
      {children}
    </s-stack>
  );
}

// A pricing's or limit's settings, as the admin's: a block per section (Pricing
// rules, Product overrides…), a header, then each line with its note under it and
// its value on the right. A long section shows its first SETTINGS_SHOWN lines; Show
// all shows the rest.
const SETTINGS_SHOWN = 5;
function TermSettings({sections}) {
  const [all, setAll] = useState([]); // sections showing every line
  const flip = (label) => setAll((labels) => (labels.includes(label) ? labels.filter((l) => l !== label) : [...labels, label]));
  return (
    <s-stack direction="block" gap="small">
      {sections.map((sec) => (
        <s-box key={sec.label} border="base" borderRadius="base" overflow="hidden">
          <s-box background="subdued" paddingBlock="small-300" paddingInline="small">
            <s-text type="strong">{sec.label}</s-text>
          </s-box>
          {(all.includes(sec.label) ? sec.items : sec.items.slice(0, SETTINGS_SHOWN)).map((it, i) => (
            <s-stack key={i} direction="block" gap="none">
              <s-divider />
              <s-box paddingBlock="small-300" paddingInline="small">
                <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200">
                  <s-stack direction="block" gap="small-500">
                    <s-text>{it.text}</s-text>
                    {it.note ? (
                      <s-text color="subdued" type="small">
                        {it.note}
                      </s-text>
                    ) : null}
                  </s-stack>
                  {it.value ? <s-text type="strong">{it.value}</s-text> : <s-box />}
                </s-grid>
              </s-box>
            </s-stack>
          ))}
          {sec.items.length > SETTINGS_SHOWN ? (
            <s-stack direction="block" gap="none">
              <s-divider />
              <s-box paddingBlock="small-300" paddingInline="small">
                <s-link onClick={() => flip(sec.label)}>{all.includes(sec.label) ? 'Show less' : `Show all (${sec.items.length})`}</s-link>
              </s-box>
            </s-stack>
          ) : null}
        </s-box>
      ))}
    </s-stack>
  );
}

// An order limit in full (its View details on the contract card), as a table as a
// pricing's: what each of its rules applies to — the product types, collections or
// products by name, their kind under — and the limit ("Max 20 without review"); an
// order limit's settings per order, week or month.
function LimitDetails({id, detail}) {
  return (
    <s-modal id={id} heading={detail.name} size="large">
      <s-stack direction="block" gap="small-200">
        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base">
          <s-text color="subdued">Applies to</s-text>
          <s-text color="subdued">Limit</s-text>
        </s-grid>
        {detail.rows.map((r, j) => (
          <s-stack key={j} direction="block" gap="small-200">
            <s-divider />
            <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base">
              <s-stack direction="block" gap="small-500">
                <s-text>{r.on}</s-text>
                {r.note ? (
                  <s-text color="subdued" type="small">
                    {r.note}
                  </s-text>
                ) : null}
              </s-stack>
              <s-text type="strong">{r.limit}</s-text>
            </s-grid>
          </s-stack>
        ))}
      </s-stack>
      <s-button slot="secondary-actions" command="--hide" commandFor={id}>
        Close
      </s-button>
    </s-modal>
  );
}

function PricingRules({id, name, details, prices}) {
  const [showPrices, setShowPrices] = useState(false);
  const table = [...details.rows, ...details.own.map((o) => ({on: o.title, adjust: o.adjust}))];
  return (
    <s-modal id={id} heading={showPrices ? `Preview prices · ${name}` : name} size="large" onAfterHide={() => setShowPrices(false)}>
      {showPrices ? (
        <PriceList entries={prices} empty="This pricing covers no products." />
      ) : (
        <s-stack direction="block" gap="small-200">
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base">
            <s-text color="subdued">Applies to</s-text>
            <s-text color="subdued">Price</s-text>
          </s-grid>
          {table.map((r, j) => (
            <s-stack key={`${j}-${r.on}`} direction="block" gap="small-200">
              <s-divider />
              <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base">
                <s-text>{r.on}</s-text>
                <s-text type="strong">{r.adjust}</s-text>
              </s-grid>
            </s-stack>
          ))}
        </s-stack>
      )}
      {/* Beside Close: Preview prices, or Back to rules from the price screen. */}
      {showPrices ? (
        <s-button slot="secondary-actions" onClick={() => setShowPrices(false)}>
          Back to rules
        </s-button>
      ) : prices.length ? (
        <s-button slot="secondary-actions" onClick={() => setShowPrices(true)}>
          Preview prices
        </s-button>
      ) : null}
      <s-button slot="secondary-actions" command="--hide" commandFor={id}>
        Close
      </s-button>
    </s-modal>
  );
}

// A product in Preview prices: what the buyer pays and, under it, the store price
// struck through and how much off.
function PriceRow({e}) {
  return (
    <s-grid gridTemplateColumns="auto minmax(0, 1fr) auto" gap="base" alignItems="center">
      {e.image ? <s-product-thumbnail src={e.image} alt="" size="small" /> : <s-box />}
      <s-text>{e.title}</s-text>
      <s-stack direction="block" gap="small-300" alignItems="end">
        <s-text type="strong">{money(e.pays)}</s-text>
        {e.off ? (
          <s-stack direction="inline" gap="small-200">
            <s-text color="subdued" type="redundant">{money(e.store)}</s-text>
            <s-text color="subdued">{e.off > 0 ? `${e.off}% off` : `${-e.off}% over`}</s-text>
          </s-stack>
        ) : null}
      </s-stack>
    </s-grid>
  );
}

// Preview prices: each product with what the buyer pays and, under it, how much
// that is off the store price — search and sort as the B2B app's (its contract
// editor's). The contract's Preview prices and a pricing's (its View details).
const PREVIEW_SORTS = [
  {label: 'Product A–Z', value: 'title-asc'},
  {label: 'Product Z–A', value: 'title-desc'},
  {label: 'Store price: low to high', value: 'store-asc'},
  {label: 'Store price: high to low', value: 'store-desc'},
  {label: 'You pay: low to high', value: 'pays-asc'},
  {label: 'You pay: high to low', value: 'pays-desc'},
  {label: 'Biggest discount', value: 'off-desc'},
];

function PriceList({entries, empty}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('title-asc');
  const q = query.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => e.title.toLowerCase().includes(q) || (e.sku || '').toLowerCase().includes(q)) : entries;
  const amount = (m) => Number(m.amount);
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'title-desc': return b.title.localeCompare(a.title);
      case 'store-asc': return amount(a.store) - amount(b.store);
      case 'store-desc': return amount(b.store) - amount(a.store);
      case 'pays-asc': return amount(a.pays) - amount(b.pays);
      case 'pays-desc': return amount(b.pays) - amount(a.pays);
      case 'off-desc': return b.off - a.off;
      default: return a.title.localeCompare(b.title);
    }
  });

  return (
    <s-stack direction="block" gap="base">
      <s-query-container>
        <s-grid gridTemplateColumns="@container (inline-size > 480px) 1fr 240px, 1fr" gap="base">
          <s-text-field label="Search products" value={query} onInput={(e) => setQuery(/** @type {HTMLInputElement} */ (e.currentTarget).value)} />
          <s-select label="Sort by" value={sort} onChange={(e) => setSort(/** @type {HTMLSelectElement} */ (e.currentTarget).value)}>
            {PREVIEW_SORTS.map((o) => (
              <s-option key={o.value} value={o.value}>
                {o.label}
              </s-option>
            ))}
          </s-select>
        </s-grid>
      </s-query-container>
      {sorted.length ? (
        <s-stack direction="block" gap="base">
          {sorted.map((e, i) => (
            <s-stack key={e.id} direction="block" gap="base">
              {i ? <s-divider /> : null}
              <PriceRow e={e} />
            </s-stack>
          ))}
        </s-stack>
      ) : (
        <s-text color="subdued">{entries.length ? `No products match “${query.trim()}”.` : empty}</s-text>
      )}
    </s-stack>
  );
}

// The Upcoming contract's Preview prices, for the buyer's location: what they'll pay
// once it starts. From the backend (api/customer/portal.js upcomingContract).
function ContractPrices({id, contract, locationName}) {
  return (
    <s-modal id={id} heading={`Preview prices · ${contract.number}`} size="large">
      <s-stack direction="block" gap="base">
        <s-paragraph color="subdued">
          {`What you will pay${locationName ? ` at ${locationName}` : ''} for each product in this contract once it starts.`}
        </s-paragraph>
        <PriceList entries={contract.prices || []} empty="The contract’s pricing covers no products." />
      </s-stack>
      <s-button slot="secondary-actions" command="--hide" commandFor={id}>
        Close
      </s-button>
    </s-modal>
  );
}

// ── Orders ───────────────────────────────────────────────────────────────────
// The buyer's orders at this location and their order requests — orders over their
// limit sent to the seller for review — in one list, newest first, one card each
// (its products' images, status, number and total). An approved request waits for
// the buyer to complete checkout from the invoice the seller sent; paid, it's an
// order, marked as approved after review. The status views (All, Waiting for
// review, Fulfilled…, each with its count) show one status.
const STATUS_ORDER = ['Waiting for review', 'Awaiting checkout', 'Unfulfilled', 'Paid', 'Fulfilled', 'Declined', 'Cancelled'];
const statusRank = (status) => (STATUS_ORDER.includes(status) ? STATUS_ORDER.indexOf(status) : STATUS_ORDER.length);
const REQUEST_STATUS = {waiting: 'Waiting for review', invoiced: 'Awaiting checkout', approved: 'Unfulfilled', declined: 'Declined'};

function orderStatus(o) {
  if (o.cancelledAt) return 'Cancelled';
  if (o.fulfillmentStatus === 'FULFILLED') return 'Fulfilled';
  if (o.financialStatus === 'PAID') return 'Paid';
  return 'Unfulfilled';
}

function portalItems(orders, requests, location) {
  const here = (o) => !location || numId(o.purchasingEntity?.location?.id) === numId(location.id);
  const placed = orders.filter(here);
  // A paid request is its order: the order card says it was approved after review.
  const approvedFor = (o) => requests.find((r) => r.order && numId(r.order.id) === numId(o.id));
  return [
    ...placed.map((o) => {
      const request = approvedFor(o);
      return {
        key: o.id,
        title: `Order ${o.name}`,
        number: o.name,
        date: o.processedAt,
        status: orderStatus(o),
        total: o.totalPrice,
        images: o.lineItems.nodes.map((l) => l.image?.url || null),
        count: o.lineItems.nodes.length,
        note: request ? `Approved after review${request.reason ? ` · ${request.reason}` : ''}` : null,
        order: o,
      };
    }),
    ...requests
      .filter((r) => !(r.order && placed.some((o) => numId(o.id) === numId(r.order.id))))
      .map((r) => ({
        key: r.id,
        title: r.order ? `Order ${r.order.name}` : 'Order request',
        number: r.name,
        date: r.createdAt,
        status: REQUEST_STATUS[r.status] || REQUEST_STATUS.waiting,
        total: r.total,
        images: r.lines.map((l) => l.image),
        count: r.lines.length,
        note: r.reason,
        request: r,
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function PortalOrders({items, loading, locationName, hasRequests, onOpen}) {
  const [view, setView] = useState('all');
  // The statuses there are, in order; a view whose last order left falls back to All.
  const statuses = [...new Set(items.map((it) => it.status))].sort((a, b) => statusRank(a) - statusRank(b));
  const current = statuses.includes(view) ? view : 'all';
  const shown = current === 'all' ? items : items.filter((it) => it.status === current);
  const viewButton = (id, label, n) => (
    <s-press-button key={id} pressed={current === id} onClick={() => setView(id)}>
      {`${label} ${n}`}
    </s-press-button>
  );
  const open = (it) => (it.request ? onOpen(it.request.id) : shopify.navigation.navigate(`shopify:customer-account/orders/${numId(it.order.id)}`));

  return (
    <s-section heading="Orders">
      <s-stack direction="block" gap="base">
        {loading ? <s-spinner accessibilityLabel="Loading orders" /> : null}
        {!loading && items.length === 0 ? <s-text color="subdued">No orders yet. Orders placed for your account will appear here.</s-text> : null}
        {!loading && items.length > 0 ? (
          <s-stack direction="block" gap="base">
            <s-text color="subdued">
              {`Open an order and choose Request a quote to reuse its products in a new quote request.${hasRequests ? ' Orders over your limit wait for the seller’s review before they’re placed.' : ''}`}
            </s-text>
            {statuses.length > 1 ? (
              <s-stack direction="inline" gap="small-200">
                {viewButton('all', 'All', items.length)}
                {statuses.map((st) => viewButton(st, st, items.filter((it) => it.status === st).length))}
              </s-stack>
            ) : null}
            <s-query-container>
              <s-grid gridTemplateColumns="@container (inline-size > 600px) 1fr 1fr 1fr, 1fr" gap="base">
                {shown.map((it) => (
                  <OrderCard key={it.key} item={it} locationName={locationName} onOpen={() => open(it)} />
                ))}
              </s-grid>
            </s-query-container>
          </s-stack>
        ) : null}
      </s-stack>
    </s-section>
  );
}

// Up to four product images, the rest as "+N", as on Shopify's order cards.
function OrderImages({images, count}) {
  const shown = images.filter(Boolean).slice(0, 4);
  if (!shown.length) return null;
  return (
    <s-image-group totalItems={count}>
      {shown.map((src, i) => <s-image key={i} src={src} alt="" aspectRatio="1" objectFit="cover" borderRadius="base" />)}
    </s-image-group>
  );
}

function OrderCard({item, locationName, onOpen}) {
  const invoice = item.request?.invoiceUrl;
  return (
    <s-box border="base" borderRadius="base" padding="base">
      <s-stack direction="block" gap="base">
        <s-clickable onClick={onOpen} accessibilityLabel={`Open ${item.title}`}>
          <s-stack direction="block" gap="small-200">
            <OrderImages images={item.images} count={item.count} />
            <s-heading>{item.status}</s-heading>
            <s-text color="subdued">{`${item.number} · ${money(item.total)} ${item.total?.currencyCode || ''}`}</s-text>
            {locationName ? <s-text color="subdued">{locationName}</s-text> : null}
          </s-stack>
        </s-clickable>
        {invoice ? <s-button href={invoice} target="_blank">Complete checkout</s-button> : null}
      </s-stack>
    </s-box>
  );
}

// ── An order request's page ──────────────────────────────────────────────────
// Laid out like Shopify's order page: where it stands, its products and totals, then
// contact, address and payment. It was sent, not placed; an approved one is checked
// out from the seller's invoice.
const STATUS_DETAIL = {
  'Waiting for review': 'It’s over your limit, so the seller reviews it before it’s placed. You’ll get an email when they decide.',
  'Awaiting checkout': 'The seller approved it and emailed you an invoice. Complete checkout to place the order.',
  Unfulfilled: 'We’re preparing these items for shipping.',
  Declined: 'The seller declined it, so it wasn’t placed and you weren’t charged.',
};

function RequestPage({item, email, business, onBack}) {
  const r = item.request;
  const toCheckout = ['Waiting for review', 'Awaiting checkout'].includes(item.status);
  const shipTo = business?.shipTo || null;
  const info = [
    email && {label: 'Contact', lines: [email]},
    shipTo && {label: 'Ship to', lines: shipTo},
    business?.paymentTerms && {label: 'Payment', lines: [business.paymentTerms]},
    r.note && {label: 'Your note', lines: [r.note]},
  ].filter(Boolean);
  return (
    <s-page heading={item.title} subheading={`Sent ${formatDate(item.date)}`} inlineSize="large">
      <s-button slot="breadcrumb-actions" accessibilityLabel="Back to B2B Portal" onClick={onBack} />
      {r.invoiceUrl ? (
        <s-button slot="primary-action" variant="primary" href={r.invoiceUrl} target="_blank">
          Complete checkout
        </s-button>
      ) : null}

      <s-stack direction="block" gap="base">
        <s-section heading={item.status}>
          <s-stack direction="block" gap="small-200">
            <s-text color="subdued">{STATUS_DETAIL[item.status]}</s-text>
            {item.note ? <s-text color="subdued">{item.note}</s-text> : null}
            {r.message ? (
              <s-box background="subdued" borderRadius="base" padding="base">
                <s-stack direction="block" gap="small-300">
                  <s-text type="strong">Message from the seller</s-text>
                  <s-text>{r.message}</s-text>
                </s-stack>
              </s-box>
            ) : null}
          </s-stack>
        </s-section>

        <s-section>
          <s-stack direction="block" gap="base">
            {r.lines.map((l, i) => (
              <s-grid key={i} gridTemplateColumns="auto 1fr auto" gap="base" alignItems="center">
                {l.image ? <s-product-thumbnail src={l.image} alt="" totalItems={l.quantity} /> : <s-text>{`×${l.quantity}`}</s-text>}
                <s-text>{l.variantTitle ? `${l.title} (${l.variantTitle})` : l.title}</s-text>
                <s-text>{money(l.total)}</s-text>
              </s-grid>
            ))}
            <s-divider />
            <s-grid gridTemplateColumns="1fr auto" gap="small-200">
              <s-text>Subtotal</s-text>
              <s-text>{money(r.subtotal)}</s-text>
              {toCheckout ? <s-text>Shipping</s-text> : null}
              {toCheckout ? <s-text color="subdued">Calculated at checkout</s-text> : null}
              {toCheckout ? <s-text>Taxes</s-text> : null}
              {toCheckout ? <s-text color="subdued">Calculated at checkout</s-text> : null}
              <s-text type="strong">Total</s-text>
              <s-text type="strong">{`${r.total.currencyCode} ${money(r.total)}`}</s-text>
            </s-grid>
          </s-stack>
        </s-section>

        {info.length ? (
          <s-section>
            <s-stack direction="block" gap="base">
              {info.map((x) => (
                <s-grid key={x.label} gridTemplateColumns="8em 1fr" gap="base">
                  <s-text color="subdued">{x.label}</s-text>
                  <s-stack direction="block" gap="none">
                    {x.lines.map((line, i) => <s-text key={i}>{line}</s-text>)}
                  </s-stack>
                </s-grid>
              ))}
            </s-stack>
          </s-section>
        ) : null}
      </s-stack>
    </s-page>
  );
}

function BusinessRegistration({registration}) {
  if (!registration) {
    return <s-section><s-spinner accessibilityLabel="Loading business account status" /></s-section>;
  }

  if (registration.status === 'pending') {
    return (
      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-heading>Business account</s-heading>
            <s-badge>Pending review</s-badge>
          </s-stack>
          <s-text>{registration.application?.legalName || 'Your business application'} is being reviewed.</s-text>
          <s-stack direction="inline" gap="base">
            <s-button onClick={() => shopify.navigation.navigate('extension:qs-b2b-registration')}>View application</s-button>
          </s-stack>
        </s-stack>
      </s-section>
    );
  }

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-heading>Buying for a business?</s-heading>
        <s-text>Apply for company pricing, volume pricing, and B2B purchasing.</s-text>
        <s-stack direction="inline" gap="base">
          <s-button variant="primary" onClick={() => shopify.navigation.navigate('extension:qs-b2b-registration')}>
            Apply for business account
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
