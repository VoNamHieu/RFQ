import React, { useState } from 'react';
import { answerContract } from '../data/products.js';
import { money } from '../utils.js';
import { CloseIcon, ChevronRightIcon, ChevronDownIcon } from './icons.jsx';

// The B2B Portal's contracts, as the real portal's (qs-b2b-portal
// extensions/qs-b2b-portal FullPageExtension.jsx): in one Contracts section, each a
// framed part that opens and closes — the Active contract the buyer's location buys
// under (Contract), the next one scheduled there (Upcoming contract) and one the
// seller sent for the buyer to approve (Contract proposal) — with their modals: the
// pricing and limit lists (TermBoxes), Preview prices, Version history, Activities log,
// Request changes and Request cancellation. Business account's terms outside its
// contract use the same boxes. The data is the B2B app's (b2b/portalContracts.js,
// data/products.js contractsForSession).

// A modal laid out as the storefront's others: title and ✕, body, buttons at the foot.
function Modal({ title, large = false, onClose, footer, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal${large ? ' modal--large' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{title}</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        <div className="modal__foot">{footer}</div>
      </div>
    </div>
  );
}

// Number, version, start and end date, each a small label over its value.
function Facts({ contract }) {
  const facts = [
    { label: 'Number', value: contract.number },
    { label: 'Version', value: String(contract.version) },
    { label: 'Start date', value: contract.start || '—' },
    { label: 'End date', value: contract.end || 'No end date' },
  ];
  return (
    <div className="pc-facts">
      {facts.map((f) => (
        <div className="pc-fact" key={f.label}>
          <span className="muted">{f.label}</span>
          <strong>{f.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Quota ─────────────────────────────────────────────────────────────────────
// A weekly or monthly maximum's quota (products.js quotaInForce) on the Contract card,
// under its number and dates (or on Business account, whatever sets it): what the
// location has ordered this period against the maximum, as a progress bar, and what's
// left of it (red once a maximum that blocks is used up). `note` beside "Ordered this
// week" (Business account: the contract that sets it).
const whole = (n) => money(n).replace(/\.00$/, '');
export function Quota({ quota: q, note = null }) {
  const used = `${whole(q.spent)} of ${whole(q.cap)}`;
  return (
    <div className={`pc-quota${!q.review && q.left <= 0 ? ' is-over' : ''}`}>
      <div className="pc-quota__head">
        <span>
          {`Ordered this ${q.period}`}
          {note ? <span className="muted">{` ${note}`}</span> : null}
        </span>
        <span className="muted">{used}</span>
      </div>
      <span className="pc-quota__track" role="progressbar" aria-valuemin={0} aria-valuemax={q.cap} aria-valuenow={Math.min(q.spent, q.cap)} aria-label={`${used} ordered this ${q.period}`}>
        <i style={{ width: `${Math.min(100, (q.spent / q.cap) * 100)}%` }} />
      </span>
      <span className="muted">{`${whole(q.left)} left this ${q.period}${q.review ? ' before review' : ''}`}</span>
    </div>
  );
}

// ── A contract's part ─────────────────────────────────────────────────────────
// A contract in Contracts, framed: its header — title, where it stands (a badge), its
// number and dates, and a chevron — opens and closes the rest. `open`: open at first.
// `flag`: a second badge (red) — Action needed on a proposal that needs the buyer.
function ContractPart({ title, status, flag = null, meta, open = false, children }) {
  const [isOpen, setOpen] = useState(open);
  return (
    <div className="pc-part">
      <button className="pc-part__head" onClick={() => setOpen(!isOpen)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} ${title.toLowerCase()} ${meta}`}>
        <span className="pc-stack">
          <span className="pc-title">
            <strong className="pc-part__title">{title}</strong>
            <span className="badge">{status}</span>
            {flag ? <span className="badge badge--red">{flag}</span> : null}
          </span>
          <span className="muted">{meta}</span>
        </span>
        <ChevronDownIcon className={isOpen ? 'pc-up' : undefined} />
      </button>
      {isOpen ? <div className="pc-part__body">{children}</div> : null}
    </div>
  );
}

// A card's name line: the contract's name and, at the right of it, Activities log once
// its buyers answered it (`onLog`) and Version history when it has one (`onHistory`),
// as links. Without `name` (its title already), the links alone.
function ContractName({ name, onLog, onHistory = null }) {
  if (!onLog && !onHistory) return name ? <p className="muted">{name}</p> : null;
  return (
    <div className="pc-line">
      {name ? <p className="muted">{name}</p> : <span />}
      <span className="pc-links">
        {onLog ? (
          <a className="link pc-link" onClick={onLog}>
            Activities log
          </a>
        ) : null}
        {onHistory ? (
          <a className="link pc-link" onClick={onHistory}>
            Version history
          </a>
        ) : null}
      </span>
    </div>
  );
}

// ── Pricing and Order limits ──────────────────────────────────────────────────
// A contract's pricings by kind (portalContracts.js contractRules): its base and its
// quantity pricings — each kind one line on the card, listed in its View details
// (PricingList).
function pricingKinds(terms) {
  const base = (terms.pricing || []).filter((p) => (terms.basePricing || []).includes(p));
  const quantity = (terms.pricing || []).filter((p) => !base.includes(p) && (terms.quantityPricing || []).includes(p));
  return { base, quantity };
}

// A contract's terms, or what the location buys under outside its contract (Business
// account's `regular`), always as two boxes: Pricing — "Base pricing" and "Quantity
// pricing" — beside Order limits — "Order limit" and "Product limit". Each line's View
// details lists what it has (PricingList, LimitList), or says it has none.
// `number`: the contract's, for the lists' headings.
export function TermBoxes({ terms, number = null }) {
  const [open, setOpen] = useState(null); // 'base' | 'quantity' | 'order' | 'product'
  const close = () => setOpen(null);
  // A pricing with nothing to show (no rule) isn't listed.
  const shows = (p) => !!terms.details?.[p];
  const kinds = pricingKinds(terms);
  const cards = terms.limitDetails || [];
  const box = (label, lines) => (
    <div className="pc-box-wrap">
      <span className="muted">{label}</span>
      <div className="pc-box">
        {lines.map(([title, id]) => (
          <div className="pc-box-row pc-line" key={id}>
            <strong>{title}</strong>
            <a className="link pc-link" onClick={() => setOpen(id)}>
              View details
            </a>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <>
      <div className="pc-boxes pc-boxes--two">
        {box('Pricing', [
          ['Base pricing', 'base'],
          ['Quantity pricing', 'quantity'],
        ])}
        {box('Order limits', [
          ['Order limit', 'order'],
          ['Product limit', 'product'],
        ])}
      </div>
      {open === 'base' ? <PricingList title="Base pricing" number={number} names={kinds.base.filter(shows)} terms={terms} previews onClose={close} /> : null}
      {open === 'quantity' ? <PricingList title="Quantity pricing" number={number} names={kinds.quantity.filter(shows)} terms={terms} onClose={close} /> : null}
      {open === 'order' ? <LimitList title="Order limits" number={number} cards={cards.filter((c) => c.kind === 'order')} onClose={close} /> : null}
      {open === 'product' ? <LimitList title="Product limits" number={number} cards={cards.filter((c) => c.kind !== 'order')} onClose={close} /> : null}
    </>
  );
}

// The base or quantity pricings (the View details of a "Base pricing" or "Quantity
// pricing" line), listed as the Activities log lists answers: each with its rule,
// opening (›) its rules on their own screen — a quantity pricing's in full as the
// admin's version view words them (SettingsTable). With `previews` (base pricing),
// Preview prices: on the list, the final price of every product they price; on a
// pricing, its own. One modal switching screens.
function PricingList({ title, number, names, terms, previews = false, onClose }) {
  const [open, setOpen] = useState(null); // the pricing open, by its place in `names`
  const [showPrices, setShowPrices] = useState(false);
  const name = open == null ? null : names[open];
  const details = name ? terms.details?.[name] : null;
  const prices = previews ? (terms.prices || []).filter((e) => (name ? e.pricing === name : names.includes(e.pricing))) : [];
  const back = () => {
    setOpen(null);
    setShowPrices(false);
  };
  return (
    <Modal
      large={!!name || showPrices}
      title={showPrices ? `Preview prices · ${name || title}` : name || (number ? `${title} · ${number}` : title)}
      onClose={onClose}
      footer={
        <>
          {showPrices ? (
            <button className="acct-btn" onClick={() => setShowPrices(false)}>
              {name ? 'Back to rules' : `Back to ${title.toLowerCase()}`}
            </button>
          ) : null}
          {name && !showPrices ? (
            <button className="acct-btn" onClick={back}>
              {`Back to ${title.toLowerCase()}`}
            </button>
          ) : null}
          {!showPrices && prices.length ? (
            <button className="acct-btn" onClick={() => setShowPrices(true)}>
              Preview prices
            </button>
          ) : null}
          <button className="acct-btn" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {showPrices ? (
        <PriceList entries={prices} empty="This pricing covers no products." />
      ) : name && details ? (
        details.sections ? <SettingsTable sections={details.sections} /> : <RulesTable details={details} />
      ) : !names.length ? (
        <p className="muted">{`No ${title.toLowerCase()}.`}</p>
      ) : (
        <div className="pc-list">
          {names.map((p, i) => {
            const opens = !!terms.details?.[p];
            const head = (
              <>
                <div className="pc-stack">
                  <strong>{p}</strong>
                  {terms.rules?.[p] ? <span className="muted">{terms.rules[p]}</span> : null}
                </div>
                {opens ? <ChevronRightIcon /> : <span />}
              </>
            );
            return opens ? (
              <button key={`${i}-${p}`} className="pc-row pc-row--open" onClick={() => setOpen(i)} aria-label={`Open ${p}`}>
                {head}
              </button>
            ) : (
              <div key={`${i}-${p}`} className="pc-row">
                {head}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// A kind of limits (the View details of an "Order limit" or "Product limit" line),
// listed as the Activities log lists answers: each limit's name and line — and the
// contract whose limit applies instead — opening (›) its rules on their own screen.
// Without any, it says so.
function LimitList({ title, number = null, cards, onClose }) {
  const [open, setOpen] = useState(null); // the limit open, by its place in `cards`
  const card = open == null ? null : cards[open];
  return (
    <Modal
      large={!!card}
      title={card ? card.name : number ? `${title} · ${number}` : title}
      onClose={onClose}
      footer={
        <>
          {card ? (
            <button className="acct-btn" onClick={() => setOpen(null)}>
              {`Back to ${title.toLowerCase()}`}
            </button>
          ) : null}
          <button className="acct-btn" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {card ? (
        <LimitTable detail={card} />
      ) : cards.length ? (
        <div className="pc-list">
          {cards.map((c, i) => {
            const opens = !!c.rows?.length;
            const head = (
              <>
                <div className="pc-stack">
                  <strong>{c.name}</strong>
                  <span className="muted">{c.text}</span>
                  {c.replacedBy ? <span className="muted">{`Replaced by contract ${c.replacedBy}`}</span> : null}
                </div>
                {opens ? <ChevronRightIcon /> : <span />}
              </>
            );
            return opens ? (
              <button key={`${i}-${c.name}`} className="pc-row pc-row--open" onClick={() => setOpen(i)} aria-label={`Open ${c.name}`}>
                {head}
              </button>
            ) : (
              <div key={`${i}-${c.name}`} className="pc-row">
                {head}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">{`No ${title.toLowerCase()}.`}</p>
      )}
    </Modal>
  );
}

// A limit's rules as a table: what each applies to (its kind under) and the limit.
function LimitTable({ detail }) {
  return (
    <div className="pc-table">
      <div className="pc-line pc-table-head">
        <span className="muted">Applies to</span>
        <span className="muted">Limit</span>
      </div>
      {detail.rows.map((r, j) => (
        <div className="pc-line pc-table-row" key={j}>
          <div className="pc-stack">
            <span>{r.on}</span>
            {r.note ? <span className="muted pc-small">{r.note}</span> : null}
          </div>
          <strong>{r.limit}</strong>
        </div>
      ))}
    </div>
  );
}

// A pricing's rules as a table: what each covers and its price, then its own prices.
function RulesTable({ details }) {
  const table = [...details.rows, ...details.own.map((o) => ({ on: o.title, adjust: o.adjust }))];
  return (
    <div className="pc-table">
      <div className="pc-line pc-table-head">
        <span className="muted">Applies to</span>
        <span className="muted">Price</span>
      </div>
      {table.map((r, j) => (
        <div className="pc-line pc-table-row" key={`${j}-${r.on}`}>
          <span>{r.on}</span>
          <strong>{r.adjust}</strong>
        </div>
      ))}
    </div>
  );
}

// A quantity pricing's rules in full, as the B2B app's version view words them
// (termSettings): its products, its quantity ranges with their discount, and the price
// the discount comes off — each a label over its lines.
function SettingsTable({ sections }) {
  return (
    <div className="pc-stack pc-stack--gap">
      {sections.map((s) => (
        <div className="pc-table" key={s.label}>
          <div className="pc-table-head">
            <span className="muted">{s.label}</span>
          </div>
          {s.items.map((it, j) => (
            <div className="pc-line pc-table-row" key={`${j}-${it.text}`}>
              <div className="pc-stack">
                <span>{it.text}</span>
                {it.note ? <span className="muted">{it.note}</span> : null}
              </div>
              {it.value ? <strong>{it.value}</strong> : <span />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Contract ──────────────────────────────────────────────────────────────────
// The company's Active contract at the buyer's location, read-only: its name as the
// title, Activities log (once its buyers answered it) and Version history as links, its
// number, version and dates, the weekly or monthly maximum its order limit sets with
// what's ordered (`quota`), then Pricing beside Order limits (TermBoxes).
export function ContractCard({ contract, quota = null, open = false }) {
  const [modal, setModal] = useState(null); // 'history' | 'activities'
  const close = () => setModal(null);
  return (
    <ContractPart title={contract.name || 'Contract'} status="Active" meta={`${contract.start || '—'} – ${contract.end || 'No end date'}`} open={open}>
      <ContractName
        name={null}
        onLog={contract.activities?.length ? () => setModal('activities') : null}
        onHistory={contract.history?.length ? () => setModal('history') : null}
      />
      <Facts contract={contract} />
      {quota ? <Quota quota={quota} /> : null}
      <TermBoxes terms={contract} number={contract.number} />

      {modal === 'history' ? <ContractHistory contract={contract} onClose={close} /> : null}
      {modal === 'activities' ? <ActivityLog number={contract.number} activities={contract.activities} onClose={close} /> : null}
    </ContractPart>
  );
}

// ── Upcoming contract and Contract proposal ──────────────────────────────────
// A contract that hasn't started at the location, as its own part: its name (with
// Activities log once its buyers answered it), its number, version and dates, then
// Pricing beside Order limits (TermBoxes), and its actions at the bottom, right-aligned.
//   Upcoming contract (Scheduled): it's agreed and starts on its date. Preview prices
//     shows what the buyer pays once it starts; one that needs their approval can be
//     asked to cancel (Request cancellation, with why).
//   Contract proposal (Proposed): the seller sent it for the buyer to approve. They
//     answer it — Approve, or under Request adjustment Request changes (what should
//     change) or Request cancellation (why) — for the version they see. Approved, it's
//     activated straight away: Scheduled when it starts later, Active when it has started.
// As the real portal's (qs-b2b-portal FullPageExtension.jsx UpcomingContract).
function NotStartedCard({ contract, session, locationName, proposal = false, onAnswered, open = false }) {
  const [modal, setModal] = useState(null); // 'prices' | 'activities' | 'changes' | 'cancel'
  const close = () => setModal(null);
  const [menu, setMenu] = useState(false); // Request adjustment's menu
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState(''); // why they want to cancel it
  const response = contract.response;
  // The seller declined their request, with a note: Changes declined, or Cancellation
  // rejected — the buttons come back as before.
  const declined = contract.declined;
  // Their request for changes is with the seller: Awaiting review, and no Approve.
  const awaiting = proposal && response?.kind === 'changes' && !declined;
  // They asked to cancel it: Cancellation requested, and no Approve. Cancelled by the
  // seller, it leaves the B2B Portal.
  const cancelRequested = response?.kind === 'cancel' && !declined;
  // Not a new version of the contract in force (`update`): that one isn't cancelled from here.
  const canCancel = (proposal || contract.approval) && !cancelRequested && !contract.update;
  // While they asked to cancel it, no other request; while a request for changes waits,
  // more requests for changes but not one to cancel it — until the seller answers
  // (declines or rejects it, or sends it again).
  const canAskChanges = proposal && !cancelRequested;
  const canAskCancel = canCancel && !awaiting;
  const send = (kind) => {
    answerContract(session, contract, kind, kind === 'changes' ? message.trim() : kind === 'cancel' ? reason.trim() : '');
    setMessage('');
    setReason('');
    close();
    onAnswered();
  };
  const pick = (m) => {
    setMenu(false);
    setModal(m);
  };
  const status = cancelRequested
    ? 'Cancellation requested'
    : declined && response?.kind === 'cancel'
      ? 'Cancellation rejected'
      : !proposal
        ? 'Scheduled'
        : awaiting
          ? 'Awaiting review'
          : declined
            ? 'Changes declined'
            : 'Proposed';
  return (
    <ContractPart
      title={proposal ? 'Contract proposal' : 'Upcoming contract'}
      status={status}
      // Action needed: not answered yet, or the seller declined their request.
      flag={proposal && (!response || declined) ? 'Action needed' : null}
      meta={`${contract.number} · ${contract.start || '—'} – ${contract.end || 'No end date'}`}
      open={open}
    >
      <ContractName name={contract.name} onLog={contract.activities?.length ? () => setModal('activities') : null} />
      <Facts contract={contract} />
      <TermBoxes terms={contract} number={contract.number} />
      {/* Its actions at the bottom, right-aligned, under what they answer. */}
      <div className="pc-foot">
        {!proposal ? (
          <button className="acct-btn" onClick={() => setModal('prices')}>
            Preview prices
          </button>
        ) : null}
        {/* Request changes and Request cancellation in one menu. */}
        {canAskChanges || canAskCancel ? (
          <span className="pc-menu-wrap">
            <button className="acct-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              Request adjustment
            </button>
            {menu ? (
              <>
                <span className="pc-menu-scrim" onClick={() => setMenu(false)} />
                <span className="pc-menu" role="menu" aria-label={proposal ? 'Contract proposal requests' : 'Upcoming contract requests'}>
                  {canAskChanges ? (
                    <button role="menuitem" onClick={() => pick('changes')}>
                      Request changes
                    </button>
                  ) : null}
                  {canAskCancel ? (
                    <button role="menuitem" className="pc-menu--critical" onClick={() => pick('cancel')}>
                      Request cancellation
                    </button>
                  ) : null}
                </span>
              </>
            ) : null}
          </span>
        ) : null}
        {proposal && response?.kind !== 'approve' && !awaiting && !cancelRequested ? (
          <button className="button button--b2b button--sm" onClick={() => send('approve')}>
            Approve
          </button>
        ) : null}
      </div>

      {modal === 'prices' ? <ContractPrices contract={contract} locationName={locationName} onClose={close} /> : null}
      {modal === 'activities' ? <ActivityLog number={contract.number} activities={contract.activities} onClose={close} /> : null}
      {modal === 'changes' ? (
        <Modal
          title={`Request changes · ${contract.number}`}
          onClose={close}
          footer={
            <>
              <button className="acct-btn" onClick={close}>
                Cancel
              </button>
              <button className="button button--b2b button--sm" disabled={!message.trim()} onClick={() => send('changes')}>
                Send
              </button>
            </>
          }
        >
          <div className="form-row">
            <label className="field-label">What should change?</label>
            <textarea className="textarea" rows="4" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </Modal>
      ) : null}
      {modal === 'cancel' ? (
        <Modal
          title={`Request cancellation · ${contract.number}`}
          onClose={close}
          footer={
            <>
              <button className="acct-btn" onClick={close}>
                Close
              </button>
              <button className="button button--b2b button--sm" disabled={!reason.trim()} onClick={() => send('cancel')}>
                Send
              </button>
            </>
          }
        >
          <div className="form-row">
            <label className="field-label">Why do you want to cancel it?</label>
            <textarea className="textarea" rows="4" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </Modal>
      ) : null}
    </ContractPart>
  );
}

export function UpcomingContractCard({ contract, session, locationName, onAnswered, open = false }) {
  return <NotStartedCard contract={contract} session={session} locationName={locationName} onAnswered={onAnswered} open={open} />;
}

export function ProposalCard({ contract, session, locationName, onAnswered, open = false }) {
  return <NotStartedCard contract={contract} session={session} locationName={locationName} onAnswered={onAnswered} open={open} proposal />;
}

// ── Activities log ────────────────────────────────────────────────────────────
// What each answer reads as in the log.
// `updated`: the seller changed it before activating it (agreements.js logProposalUpdate).
const ACTIVITY_TITLE = { approve: 'Approved', changes: 'Changes requested', cancel: 'Cancellation requested', updated: 'Updated by seller' };

// A contract's Activities log (its link beside the name on its card): every answer
// its buyers sent, newest first — Approved, Changes requested, Cancellation requested —
// with the version, who and the date. A request opens (›) on its own screen: where it
// stands, its message and, when the seller declined it, their reply. One modal
// switching screens, as Version history. As the real portal's.
function ActivityLog({ number, activities, onClose }) {
  const [shown, setShown] = useState(null); // the activity open, by number
  // Numbered from the first one, so a new one doesn't renumber the rest.
  const numbered = activities.map((a, i) => ({ ...a, n: activities.length - i }));
  const q = numbered.find((a) => a.n === shown && a.kind !== 'approve' && a.kind !== 'updated');
  return (
    <Modal
      title={q ? `${ACTIVITY_TITLE[q.kind] || 'Request'} · ${number}` : `Activities log · ${number}`}
      onClose={onClose}
      footer={
        <>
          {q ? (
            <button className="acct-btn" onClick={() => setShown(null)}>
              Back to activities
            </button>
          ) : null}
          <button className="acct-btn" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {q ? (
        <RequestScreen request={q} />
      ) : (
        <div className="pc-list">
          {numbered.map((a) => {
            // A request opens on its own screen; an approval or a seller's change doesn't.
            const opens = a.kind !== 'approve' && a.kind !== 'updated';
            const head = (
              <>
                <div className="pc-stack">
                  <strong>{ACTIVITY_TITLE[a.kind] || 'Request'}</strong>
                  <span className="muted">
                    {a.kind === 'updated'
                      ? [a.version ? `Version ${a.version}` : null, a.note || 'Sent again'].filter(Boolean).join(' · ')
                      : [a.version ? `Version ${a.version}` : null, a.mine ? 'By you' : a.by ? `By ${a.by}` : null].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="muted">{a.at}</span>
                {opens ? <ChevronRightIcon /> : <span />}
              </>
            );
            return opens ? (
              <button key={a.n} className="pc-version pc-version--open" onClick={() => setShown(a.n)} aria-label={`Open ${(ACTIVITY_TITLE[a.kind] || 'request').toLowerCase()} from ${a.at || ''}`}>
                {head}
              </button>
            ) : (
              <div key={a.n} className="pc-version">
                {head}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// One request on its own screen: where it stands, their message (who sent it and
// when) and the seller's reply when they declined it.
function RequestScreen({ request: q }) {
  const from = q.mine ? 'Your message' : `Message from ${q.by || 'your team'}`;
  return (
    <div className="pc-stack pc-stack--gap">
      <div className="pc-title">
        <span className="muted">Status</span>
        <span className="badge">{q.status}</span>
      </div>
      <div className="pc-stack">
        <span className="muted">{q.at ? `${from} · ${q.at}` : from}</span>
        <p>{q.message}</p>
      </div>
      {q.reply ? (
        <div className="pc-stack">
          <span className="muted">{q.reply.at ? `Seller’s reply · ${q.reply.at}` : 'Seller’s reply'}</span>
          <p>{q.reply.message}</p>
        </div>
      ) : null}
    </div>
  );
}

// ── Version history ───────────────────────────────────────────────────────────
// Its versions, newest first — "Version 3", its note, how many changes, its date —
// each with a › that opens that version on its own screen: What changed and
// Configuration as tabs. One modal switching screens.
function ContractHistory({ contract, onClose }) {
  const [shown, setShown] = useState(null);
  const v = contract.history.find((h) => h.version === shown && h.view);
  return (
    <Modal
      large
      title={v ? `${contract.number} · ${v.view.name}` : `Version history · ${contract.number}`}
      onClose={onClose}
      footer={
        <>
          {v ? (
            <button className="acct-btn" onClick={() => setShown(null)}>
              Back to versions
            </button>
          ) : null}
          <button className="acct-btn" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {v ? (
        <VersionScreen key={v.version} version={v} />
      ) : (
        <div className="pc-list">
          {contract.history.map((h, i) => {
            const n = changeCount(h.view?.changed);
            const head = (
              <>
                <div className="pc-stack">
                  <strong>{`Version ${h.version}`}</strong>
                  {h.note ? <span className="muted">{h.note}</span> : null}
                  {n ? <span className="muted pc-small">{`${n} change${n === 1 ? '' : 's'}`}</span> : null}
                </div>
                <span className="muted">{h.date}</span>
                {h.view ? <ChevronRightIcon /> : <span />}
              </>
            );
            return h.view ? (
              <button key={i} className="pc-version pc-version--open" onClick={() => setShown(h.version)} aria-label={`Open version ${h.version}`}>
                {head}
              </button>
            ) : (
              <div key={i} className="pc-version">
                {head}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// How many changes a version made: each contract fact, each term added or removed,
// and each line of a changed term (its rename alone counts one).
const changeCount = (changed) =>
  changed ? changed.contract.length + changed.terms.reduce((n, t) => n + (t.change === 'Changed' ? Math.max(t.lines.length, 1) : 1), 0) : 0;

function VersionScreen({ version }) {
  const [tab, setTab] = useState('changes');
  return (
    <div className="pc-stack pc-stack--gap">
      <div className="pc-tabs">
        <button className={`pc-tab${tab === 'changes' ? ' is-active' : ''}`} onClick={() => setTab('changes')}>
          What changed
        </button>
        <button className={`pc-tab${tab === 'config' ? ' is-active' : ''}`} onClick={() => setTab('config')}>
          Configuration
        </button>
      </div>
      {tab === 'changes' ? <VersionChanged changed={version.view.changed} /> : <VersionView version={version} />}
    </div>
  );
}

// One version as the B2B admin's version view shows it: a box with its status,
// dates, where it applied and which version, then its Terms — Base pricing, Quantity
// pricing and Order limits, each with how many — a row per term (a pricing's
// priority first) with what it does in one line, and a chevron that opens its
// settings.
function VersionView({ version }) {
  const view = version.view;
  const [opened, setOpened] = useState([]);
  const toggle = (key) => setOpened((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  const info = [
    ['Status', <span className="badge">{view.status}</span>],
    ['Dates', <strong>{view.dates}</strong>],
    ['Applies to', <strong>{view.appliesTo}</strong>],
    ['Version', <strong>{`Version ${version.version}${view.latest ? ' (latest)' : ''}`}</strong>],
  ];
  return (
    <div className="pc-stack pc-stack--gap">
      <div className="pc-box pc-info">
        {info.map(([label, value]) => (
          <div className="pc-stack" key={label}>
            <span className="muted pc-small">{label}</span>
            {value}
          </div>
        ))}
      </div>
      <h4 className="pc-h4">Terms</h4>
      {view.groups.map((g, gi) => (
        <div className="pc-group" key={g.title}>
          <div className="pc-group-head">
            <strong>{g.title}</strong>
            <span className="badge">{String(g.terms.length)}</span>
          </div>
          {g.terms.length ? (
            g.terms.map((t, ti) => {
              const key = `${gi}-${ti}`;
              const open = opened.includes(key);
              return (
                <div className="pc-group-row" key={key}>
                  <div className="pc-term">
                    {t.priority != null ? <span className="pc-priority" aria-label={`Priority ${t.priority}`}>{t.priority}</span> : null}
                    <div className="pc-stack">
                      <span>{t.name}</span>
                      <span className="muted pc-small">{t.summary}</span>
                    </div>
                    {t.settings.length ? (
                      <button className="pc-chevron" onClick={() => toggle(key)} aria-label={`${open ? 'Hide' : 'Show'} settings of ${t.name}`}>
                        <ChevronDownIcon className={open ? 'pc-up' : undefined} />
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                  {open ? <TermSettings sections={t.settings} /> : null}
                </div>
              );
            })
          ) : (
            <div className="pc-group-row">
              <span className="muted">None</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// What a version changed against the one before it: the contract's own changes
// (name, dates, where it applies), then a row per term it added, removed or changed;
// a changed one opens to the lines that changed, the old value struck through.
function VersionChanged({ changed }) {
  const [opened, setOpened] = useState([]);
  const flip = (i) => setOpened((is) => (is.includes(i) ? is.filter((x) => x !== i) : [...is, i]));
  if (!changed) return <p className="muted">The contract’s first version.</p>;
  if (!changed.contract.length && !changed.terms.length) return <p className="muted">No changes to the contract’s terms.</p>;
  return (
    <div className="pc-group">
      {changed.contract.map((c) => (
        <div className="pc-group-row pc-line" key={c.label}>
          <span>{c.label}</span>
          <span className="pc-values">
            <s className="muted">{c.before}</s>
            <strong>{c.value}</strong>
          </span>
        </div>
      ))}
      {changed.terms.map((t, i) => {
        const open = opened.includes(i);
        const lines = t.lines.length;
        const head = (
          <>
            {lines ? open ? <ChevronDownIcon /> : <ChevronRightIcon /> : null}
            <div className="pc-stack">
              <span>{t.name}</span>
              <span className="muted pc-small">{t.was ? `${t.group} · was ${t.was}` : t.group}</span>
            </div>
            <span className={`badge${t.change === 'Removed' ? ' badge--red' : ''}`}>{lines ? `${t.change} · ${lines}` : t.change}</span>
          </>
        );
        return (
          <div className="pc-group-row" key={`t-${i}`}>
            {lines ? (
              <button className="pc-changed pc-changed--open" onClick={() => flip(i)} aria-label={`${open ? 'Hide' : 'Show'} what changed in ${t.name}`}>
                {head}
              </button>
            ) : (
              <div className="pc-changed">{head}</div>
            )}
            {open ? t.lines.map((l, j) => <ChangedLine key={j} line={l} />) : null}
          </div>
        );
      })}
    </div>
  );
}

// A settings line a version changed: its text and, under it, its section and how it
// changed; its value on the right, the old one struck through before it.
function ChangedLine({ line }) {
  const removed = line.change === 'Removed';
  const whole = line.value == null;
  return (
    <div className="pc-box pc-changed-line pc-line">
      <div className="pc-stack">
        {whole && line.before ? <s className="muted">{line.before}</s> : null}
        {removed ? <s>{line.text}</s> : <span>{line.text}</span>}
        <span className="muted pc-small">{[line.section, line.note, line.change].filter(Boolean).join(' · ')}</span>
      </div>
      {whole ? null : (
        <span className="pc-values">
          {line.before ? <s className="muted">{line.before}</s> : null}
          {removed ? <s>{line.value}</s> : <strong>{line.value}</strong>}
        </span>
      )}
    </div>
  );
}

// A pricing's or limit's settings, as the admin's: a block per section, each line with
// its note under it and its value on the right; a long section shows its first 5, Show
// all the rest.
const SETTINGS_SHOWN = 5;
function TermSettings({ sections }) {
  const [all, setAll] = useState([]);
  const flip = (label) => setAll((labels) => (labels.includes(label) ? labels.filter((l) => l !== label) : [...labels, label]));
  return (
    <div className="pc-stack pc-stack--gap pc-settings">
      {sections.map((sec) => (
        <div className="pc-group" key={sec.label}>
          <div className="pc-group-head">
            <strong>{sec.label}</strong>
          </div>
          {(all.includes(sec.label) ? sec.items : sec.items.slice(0, SETTINGS_SHOWN)).map((it, i) => (
            <div className="pc-group-row pc-line" key={i}>
              <div className="pc-stack">
                <span>{it.text}</span>
                {it.note ? <span className="muted pc-small">{it.note}</span> : null}
              </div>
              {it.value ? <strong>{it.value}</strong> : null}
            </div>
          ))}
          {sec.items.length > SETTINGS_SHOWN ? (
            <div className="pc-group-row">
              <a className="link" onClick={() => flip(sec.label)}>
                {all.includes(sec.label) ? 'Show less' : `Show all (${sec.items.length})`}
              </a>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── Preview prices ────────────────────────────────────────────────────────────
const PREVIEW_SORTS = [
  { label: 'Product A–Z', value: 'title-asc' },
  { label: 'Product Z–A', value: 'title-desc' },
  { label: 'Store price: low to high', value: 'store-asc' },
  { label: 'Store price: high to low', value: 'store-desc' },
  { label: 'You pay: low to high', value: 'pays-asc' },
  { label: 'You pay: high to low', value: 'pays-desc' },
  { label: 'Biggest discount', value: 'off-desc' },
];

// A product in Preview prices: what the buyer pays and, under it, the store price
// struck through and how much off.
function PriceRow({ e }) {
  return (
    <div className="pc-price">
      {e.image ? <img className="pc-thumb" src={e.image} alt="" /> : <span className="pc-thumb" />}
      <span>{e.title}</span>
      <div className="pc-stack pc-stack--end">
        <strong>{money(e.pays)}</strong>
        {e.off ? (
          <span className="pc-values">
            <s className="muted">{money(e.store)}</s>
            <span className="muted">{e.off > 0 ? `${e.off}% off` : `${-e.off}% over`}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

// Each product with what the buyer pays, search and sort as the B2B app's.
function PriceList({ entries, empty }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('title-asc');
  const q = query.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => e.title.toLowerCase().includes(q) || (e.sku || '').toLowerCase().includes(q)) : entries;
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'title-desc': return b.title.localeCompare(a.title);
      case 'store-asc': return a.store - b.store;
      case 'store-desc': return b.store - a.store;
      case 'pays-asc': return a.pays - b.pays;
      case 'pays-desc': return b.pays - a.pays;
      case 'off-desc': return b.off - a.off;
      default: return a.title.localeCompare(b.title);
    }
  });
  return (
    <div className="pc-stack pc-stack--gap">
      <div className="pc-filters">
        <div>
          <label className="field-label">Search products</label>
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Sort by</label>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {PREVIEW_SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {sorted.length ? (
        <div className="pc-list">
          {sorted.map((e) => (
            <PriceRow key={e.id} e={e} />
          ))}
        </div>
      ) : (
        <p className="muted">{entries.length ? `No products match “${query.trim()}”.` : empty}</p>
      )}
    </div>
  );
}

// The Upcoming contract's Preview prices for the buyer's location: what they'll pay
// once it starts.
function ContractPrices({ contract, locationName, onClose }) {
  return (
    <Modal
      large
      title={`Preview prices · ${contract.number}`}
      onClose={onClose}
      footer={
        <button className="acct-btn" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="pc-stack pc-stack--gap">
        <p className="muted">
          {`What you will pay${locationName ? ` at ${locationName}` : ''} for each product in this contract once it starts.`}
        </p>
        <PriceList entries={contract.prices || []} empty="The contract’s pricing covers no products." />
      </div>
    </Modal>
  );
}
