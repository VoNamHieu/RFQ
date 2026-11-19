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
// `tag`: beside the status, plain — a request of theirs waiting for the seller, the
// status staying as it is.
function ContractPart({ title, status, tag = null, flag = null, meta, open = false, children }) {
  const [isOpen, setOpen] = useState(open);
  return (
    <div className="pc-part">
      <button className="pc-part__head" onClick={() => setOpen(!isOpen)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} ${title.toLowerCase()} ${meta}`}>
        <span className="pc-stack">
          <span className="pc-title">
            <strong className="pc-part__title">{title}</strong>
            <span className={`badge${status === 'Active' ? ' badge--blue' : ''}`}>{status}</span>
            {tag ? <span className="badge">{tag}</span> : null}
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
// The company's Active contract at the buyer's location: its name as the
// title, Activities log (once its buyers answered it) and Version history as links, its
// number, version and dates, the weekly or monthly maximum its order limit sets with
// what's ordered (`quota`), then Pricing beside Order limits (TermBoxes).
// One saved with Buyer must approve can be asked to change (Request changes, with what
// should change) — not while a new version waits for them (`newVersion`: they answer
// that one on its own card). It stays Active all along: while the seller hasn't answered
// (they can send more meanwhile), "Change request awaiting review" beside it and its
// terms applying; declined, as before — the seller's reply is in its Activities log. A
// new version sent closes it.
// They can also ask to cancel it (Request cancellation, with why) — both under Request
// adjustment, as on an Upcoming contract: one kind at a time, no Request changes while a
// new version waits for them. Asked to cancel it, it stays Active ("Cancellation request
// awaiting review") until the seller answers: ended at their request, it leaves the B2B
// Portal; declined, it stays — their reply in its Activities log.
// The seller asked to end it (`endAsked`, saved with Buyer must approve — they can't end
// it on their own): "End requested by seller" and Action needed, with their reason, until
// they answer — Approve ending (it ends right away, with a version waiting for them) or
// Decline (with why, if they want; it stays in force). Meanwhile no requests.
export function ContractCard({ contract, session = null, onAnswered = () => {}, quota = null, open = false, waiting = null }) {
  // A new version of it waiting for them (`waiting`): picked in its Version dropdown —
  // shown first — or the version in force.
  const [shown, setShown] = useState('new');
  const [modal, setModal] = useState(null); // 'history' | 'activities' | 'changes' | 'cancel' | 'end-approve' | 'end-decline'
  const close = () => setModal(null);
  const [menu, setMenu] = useState(false); // Request adjustment's menu
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState(''); // why they want to cancel it
  const [why, setWhy] = useState(''); // why they decline ending it
  const endAsked = !!session && contract.endAsked ? contract.endAsked : null;
  // A new version waits for their answer (`newVersion`): they answer that one first —
  // Request adjustment here is disabled (one thing at a time).
  const versionWaits = !!session && !!contract.approval && !!contract.newVersion && !endAsked;
  const requestable = !!session && !!contract.approval && !endAsked && !versionWaits;
  const response = contract.response;
  const cancelRequested = requestable && response?.kind === 'cancel' && !contract.declined;
  const awaiting = requestable && response?.kind === 'changes' && !contract.declined;
  const canAskChanges = requestable && !cancelRequested;
  const canAskCancel = requestable && !cancelRequested && !awaiting;
  const send = (kind) => {
    answerContract(session, contract, kind, kind === 'changes' ? message.trim() : reason.trim());
    setMessage('');
    setReason('');
    close();
    onAnswered();
  };
  const pick = (m) => {
    setMenu(false);
    setModal(m);
  };
  const answerEnd = (kind) => {
    answerContract(session, contract, kind, kind === 'end-decline' ? why.trim() : '');
    setWhy('');
    close();
    onAnswered();
  };
  return (
    <ContractPart
      title={contract.name || 'Contract'}
      // Over (the B2B Portal keeps one they approved, or that was in force): how it ended.
      status={contract.status || 'Active'}
      tag={
        waiting
          ? `Version ${waiting.version} waiting for your approval`
          : endAsked
            ? 'End requested by seller'
            : cancelRequested
              ? 'Cancellation request awaiting review'
              : awaiting
                ? 'Change request awaiting review'
                : null
      }
      flag={endAsked || waiting?.action ? 'Action needed' : null}
      // Elsewhere in the company (`appliesTo`): where it applies.
      // Over: when ("Ended Aug 21, 2026").
      meta={[`${contract.start || '—'} – ${contract.end || 'No end date'}`, contract.appliesTo, contract.status && contract.closedOn ? `${contract.status} ${contract.closedOn}` : null].filter(Boolean).join(' · ')}
      open={open}
    >
      {waiting ? <VersionPicker current={contract} waiting={waiting} running shown={shown} onChange={setShown} /> : null}
      {waiting && shown === 'new' ? (
        <NotStartedCard bare proposal contract={waiting} session={session} onAnswered={onAnswered} />
      ) : (
      <>
      {/* The seller declined their request: a box with their reply, on top, which they can close. */}
      {contract.sellerMessage?.kind?.startsWith('declined') && session ? <DeclinedBanner number={contract.number} m={contract.sellerMessage} /> : null}
      <ContractName
        name={null}
        onLog={contract.activities?.length ? () => setModal('activities') : null}
        onHistory={contract.history?.length ? () => setModal('history') : null}
      />
      <Facts contract={contract} />
      {quota ? <Quota quota={quota} /> : null}
      <TermBoxes terms={contract} number={contract.number} />
      {awaiting || cancelRequested ? <p className="muted">Your current terms still apply until the seller replies.</p> : null}
      {versionWaits ? <p className="muted">{`Version ${contract.newVersion} is waiting for your answer.`}</p> : null}
      {/* The seller's message sent with it (not a decline: that's the box on top), said so, opened on its own. */}
      {contract.sellerMessage?.kind === 'sent' && !endAsked && session ? (
        <p className="muted">
          {`The seller sent a message with this version on ${contract.sellerMessage.at}. `}
          <a className="link pc-link" onClick={() => setModal('seller-message')}>
            Seller’s message
          </a>
        </p>
      ) : null}
      {endAsked ? (
        <div className="pc-stack">
          <span className="muted">
            {`The seller asked to end this contract on ${endAsked.at}. It stays in force until you answer.`}
            {/* Their reason, in its own modal. */}
            {endAsked.message ? (
              <>
                {' '}
                <a className="link pc-link" onClick={() => setModal('end-message')}>
                  Seller’s message
                </a>
              </>
            ) : null}
          </span>
        </div>
      ) : null}
      {endAsked ? (
        <div className="pc-foot">
          <button className="acct-btn" onClick={() => setModal('end-decline')}>
            Decline
          </button>
          <button className="button button--b2b button--sm" onClick={() => setModal('end-approve')}>
            Approve ending
          </button>
        </div>
      ) : canAskChanges || canAskCancel ? (
        <div className="pc-foot">
          <span className="pc-menu-wrap">
            <button className="acct-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              Request adjustment
            </button>
            {menu ? (
              <>
                <span className="pc-menu-scrim" onClick={() => setMenu(false)} />
                <span className="pc-menu" role="menu" aria-label="Contract requests">
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
        </div>
      ) : versionWaits ? (
        <div className="pc-foot">
          <button className="acct-btn" disabled aria-disabled="true">
            Request adjustment
          </button>
        </div>
      ) : null}

      {modal === 'history' ? <ContractHistory contract={contract} onClose={close} /> : null}
      {modal === 'activities' ? <ActivityLog number={contract.number} activities={contract.activities} onClose={close} /> : null}
      {modal === 'changes' ? <RequestChangesModal number={contract.number} message={message} setMessage={setMessage} onClose={close} onSend={() => send('changes')} /> : null}
      {modal === 'cancel' ? <RequestCancellationModal number={contract.number} reason={reason} setReason={setReason} onClose={close} onSend={() => send('cancel')} /> : null}
      {modal === 'end-message' && endAsked ? <SellerMessage number={contract.number} at={endAsked.at} message={endAsked.message} onClose={close} /> : null}
      {modal === 'seller-message' && contract.sellerMessage ? <SellerMessage number={contract.number} at={contract.sellerMessage.at} message={contract.sellerMessage.message} onClose={close} /> : null}
      {modal === 'end-approve' ? (
        <Modal
          title={`Approve ending ${contract.number}?`}
          onClose={close}
          footer={
            <>
              <button className="acct-btn" onClick={close}>
                Cancel
              </button>
              <button className="button button--b2b button--sm" onClick={() => answerEnd('end-approve')}>
                Approve ending
              </button>
            </>
          }
        >
          <p>Its prices and order limits stop applying right away.</p>
        </Modal>
      ) : null}
      {modal === 'end-decline' ? (
        <Modal
          title={`Decline ending ${contract.number}?`}
          onClose={close}
          footer={
            <>
              <button className="acct-btn" onClick={close}>
                Cancel
              </button>
              <button className="button button--b2b button--sm" onClick={() => answerEnd('end-decline')}>
                Decline
              </button>
            </>
          }
        >
          <p>The contract stays in force.</p>
          <div className="form-row">
            <label className="field-label">Message to the seller (optional)</label>
            <textarea className="textarea" rows="3" value={why} onChange={(e) => setWhy(e.target.value)} />
          </div>
        </Modal>
      ) : null}
      </>
      )}
    </ContractPart>
  );
}

// A contract's Version dropdown, while a new version of it waits for them: that one
// (to answer — shown first) or the version they approved (in force, or still starting
// on its date). One card per contract.
// Small, at the right: each option names its version.
function VersionPicker({ current, waiting, shown, onChange, running = false }) {
  return (
    <select className="select pc-version-pick" aria-label="Version" value={shown} onChange={(e) => onChange(e.target.value)}>
      <option value="new">{`Version ${waiting.version} · Waiting for your approval`}</option>
      <option value="current">{`Version ${current.version} · ${running ? 'In force' : `Starts ${current.start || 'on its date'}`}`}</option>
    </select>
  );
}

// ── Upcoming contract and Contract proposal ──────────────────────────────────
// A contract that hasn't started at the location, as its own part: its name (with
// Activities log once its buyers answered it), its number, version and dates, then
// Pricing beside Order limits (TermBoxes), and its actions at the bottom, right-aligned.
//   Upcoming contract (Scheduled): it's agreed and starts on its date (what the buyer
//     pays once it starts: Base pricing's View details → Preview prices); one that needs their approval can be
//     asked, under Request adjustment, to change (Request changes — not while a new
//     version waits for them, `newVersion`: they answer that one, on its own card) or
//     to cancel (Request cancellation, with why). Asked to change, it stays Scheduled,
//     with "Change request awaiting review" beside it until the seller answers; the
//     version they approved still starts on its date.
//   Contract proposal (Proposed): the seller sent it for the buyer to approve. They
//     answer it — Approve, or under Request adjustment Request changes (what should
//     change) or Request cancellation (why) — for the version they see. Approved, it's
//     activated straight away: Scheduled when it starts later, Active when it has started.
//     A new version of a contract they approved (`update`) is approved or declined
//     (under Request adjustment, Decline only, with a message to the seller if they
//     want): it closes and they keep the version they approved. While it waits, that
//     contract's Request adjustment is disabled ("Version 2 is waiting for your answer"):
//     one thing at a time — declined, the contract's comes back.
// As the real portal's (qs-b2b-portal FullPageExtension.jsx UpcomingContract).
function NotStartedCard({ contract, session, locationName, proposal = false, onAnswered, open = false, bare = false, waiting = null }) {
  // A new version of it waiting for them (`waiting`): picked in its Version dropdown —
  // shown first — or the version they approved.
  const [shown, setShown] = useState('new');
  const [modal, setModal] = useState(null); // 'activities' | 'changes' | 'cancel' | 'decline' | 'end-approve' | 'end-decline'
  const close = () => setModal(null);
  const [menu, setMenu] = useState(false); // Request adjustment's menu
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState(''); // why they want to cancel it
  const [note, setNote] = useState(''); // their message to the seller when they decline a new version
  const [why, setWhy] = useState(''); // why they decline cancelling it (the seller asked)
  const response = contract.response;
  // The seller asked to cancel this Upcoming contract (`endAsked`, as an Active one's
  // request to end it): "Cancellation requested by seller" and Action needed, with their
  // reason, until they answer — Approve cancellation (it won't start) or Decline (with
  // why, if they want; it still starts on its date). Meanwhile no requests.
  const endAsked = !proposal && !!session && contract.endAsked ? contract.endAsked : null;
  // The seller declined their request, with a note: Changes declined, or Cancellation
  // declined — the buttons come back as before.
  const declined = contract.declined;
  // A new version of this Upcoming contract waits for their answer (`newVersion`): they
  // answer that one first — Request adjustment here is disabled (one thing at a time).
  const versionWaits = !proposal && !!contract.approval && !!contract.newVersion && !endAsked;
  // A new version of a contract they approved (`update`): Approve, or Decline — its
  // Request adjustment has Decline only.
  const versionCard = proposal && !!contract.update;
  // Can they ask for changes: a proposal, or an Upcoming contract they approved.
  const changeable = proposal || (!!contract.approval && !versionWaits && !endAsked);
  // Their request for changes is with the seller: a proposal reads Awaiting review, with
  // no Approve; an Upcoming contract stays Scheduled, the request noted beside it.
  const awaiting = changeable && response?.kind === 'changes' && !declined;
  // They asked to cancel it: Cancellation requested, and no Approve. Cancelled by the
  // seller, it leaves the B2B Portal.
  const cancelRequested = response?.kind === 'cancel' && !declined;
  // Not a new version of the contract in force (`update`): that one isn't cancelled from here.
  const canCancel = (proposal || contract.approval) && !cancelRequested && !contract.update && !versionWaits && !endAsked;
  // While they asked to cancel it, no other request; while a request for changes waits,
  // more requests for changes but not one to cancel it — until the seller answers
  // (declines or rejects it, or sends it again).
  const canAskChanges = changeable && !cancelRequested && !versionCard;
  const canAskCancel = canCancel && !awaiting;
  // Answering a proposal: Approve — or, a new version of one they approved, Decline it.
  const answerable = proposal && response?.kind !== 'approve' && !awaiting && !cancelRequested;
  const canDecline = answerable && versionCard;
  const send = (kind) => {
    answerContract(session, contract, kind, kind === 'changes' ? message.trim() : kind === 'cancel' ? reason.trim() : kind === 'decline' ? note.trim() : '');
    setMessage('');
    setReason('');
    setNote('');
    close();
    onAnswered();
  };
  const pick = (m) => {
    setMenu(false);
    setModal(m);
  };
  const answerEnd = (kind) => {
    answerContract(session, contract, kind, kind === 'end-decline' ? why.trim() : '');
    setWhy('');
    close();
    onAnswered();
  };
  // Its status stays (Proposed, or Scheduled) whatever they asked; their request is the
  // tag beside it, in the same words as on an Active one — and on a proposal, the
  // seller's decline of it (they answer it again).
  const tag = endAsked
    ? 'Cancellation requested by seller'
    : cancelRequested
      ? 'Cancellation request awaiting review'
      : awaiting
        ? 'Change request awaiting review'
        : proposal && declined
          ? response?.kind === 'cancel'
            ? 'Cancellation request declined'
            : 'Change request declined'
          : null;
  const body = (
    <>
      {/* The seller declined their request: a box with their reply, on top, which they can close. */}
      {contract.sellerMessage?.kind?.startsWith('declined') ? <DeclinedBanner number={contract.number} m={contract.sellerMessage} /> : null}
      <ContractName name={contract.name} onLog={contract.activities?.length ? () => setModal('activities') : null} />
      <Facts contract={contract} />
      <TermBoxes terms={contract} number={contract.number} />
      {!proposal && awaiting ? <p className="muted">{`The version you approved still starts on ${contract.start || 'its start date'}.`}</p> : null}
      {versionWaits ? <p className="muted">{`Version ${contract.newVersion} is waiting for your answer.`}</p> : null}
      {/* The seller's message sent with it (not a decline: that's the box on top), said so, opened on its own. */}
      {contract.sellerMessage?.kind === 'sent' && !endAsked ? (
        <p className="muted">
          {`The seller sent a message with this version on ${contract.sellerMessage.at}. `}
          <a className="link pc-link" onClick={() => setModal('seller-message')}>
            Seller’s message
          </a>
        </p>
      ) : null}
      {endAsked ? (
        <div className="pc-stack">
          <span className="muted">
            {`The seller asked to cancel this contract on ${endAsked.at}. It still starts on ${contract.start || 'its start date'} unless you approve.`}
            {/* Their reason, in its own modal. */}
            {endAsked.message ? (
              <>
                {' '}
                <a className="link pc-link" onClick={() => setModal('end-message')}>
                  Seller’s message
                </a>
              </>
            ) : null}
          </span>
        </div>
      ) : null}
      {/* Its actions at the bottom, right-aligned, under what they answer. */}
      <div className="pc-foot">
        {endAsked ? (
          <>
            <button className="acct-btn" onClick={() => setModal('end-decline')}>
              Decline
            </button>
            <button className="button button--b2b button--sm" onClick={() => setModal('end-approve')}>
              Approve cancellation
            </button>
          </>
        ) : null}
        {/* Request changes and Request cancellation in one menu — a new version's Decline. */}
        {canAskChanges || canAskCancel || canDecline ? (
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
                  {canDecline ? (
                    <button role="menuitem" onClick={() => pick('decline')}>
                      Decline
                    </button>
                  ) : null}
                </span>
              </>
            ) : null}
          </span>
        ) : (versionWaits || versionCard) && !endAsked ? (
          <button className="acct-btn" disabled aria-disabled="true">
            Request adjustment
          </button>
        ) : null}
        {answerable ? (
          <button className="button button--b2b button--sm" onClick={() => send('approve')}>
            Approve
          </button>
        ) : null}
      </div>

      {modal === 'activities' ? <ActivityLog number={contract.number} activities={contract.activities} onClose={close} /> : null}
      {modal === 'changes' ? <RequestChangesModal number={contract.number} message={message} setMessage={setMessage} onClose={close} onSend={() => send('changes')} /> : null}
      {modal === 'cancel' ? <RequestCancellationModal number={contract.number} reason={reason} setReason={setReason} onClose={close} onSend={() => send('cancel')} /> : null}
      {modal === 'decline' ? (
        <Modal
          title={`Decline version ${contract.version} · ${contract.number}?`}
          onClose={close}
          footer={
            <>
              <button className="acct-btn" onClick={close}>
                Cancel
              </button>
              <button className="button button--b2b button--sm" onClick={() => send('decline')}>
                Decline
              </button>
            </>
          }
        >
          <p>{`You keep version ${contract.inForce || contract.version - 1}, the one you approved${contract.startDate ? `: it still starts on its date` : ': it stays in force'}. The seller sees your message.`}</p>
          <div className="form-row">
            <label className="field-label">Message to the seller (optional)</label>
            <textarea className="textarea" rows="3" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </Modal>
      ) : null}
      {modal === 'end-message' && endAsked ? <SellerMessage number={contract.number} at={endAsked.at} message={endAsked.message} onClose={close} /> : null}
      {modal === 'seller-message' && contract.sellerMessage ? <SellerMessage number={contract.number} at={contract.sellerMessage.at} message={contract.sellerMessage.message} onClose={close} /> : null}
      {modal === 'end-approve' ? (
        <Modal
          title={`Approve cancelling ${contract.number}?`}
          onClose={close}
          footer={
            <>
              <button className="acct-btn" onClick={close}>
                Cancel
              </button>
              <button className="button button--b2b button--sm" onClick={() => answerEnd('end-approve')}>
                Approve cancellation
              </button>
            </>
          }
        >
          <p>It won’t start, and none of its prices or order limits will apply.</p>
        </Modal>
      ) : null}
      {modal === 'end-decline' ? (
        <Modal
          title={`Decline cancelling ${contract.number}?`}
          onClose={close}
          footer={
            <>
              <button className="acct-btn" onClick={close}>
                Cancel
              </button>
              <button className="button button--b2b button--sm" onClick={() => answerEnd('end-decline')}>
                Decline
              </button>
            </>
          }
        >
          <p>{`It still starts on ${contract.start || 'its start date'}.`}</p>
          <div className="form-row">
            <label className="field-label">Message to the seller (optional)</label>
            <textarea className="textarea" rows="3" value={why} onChange={(e) => setWhy(e.target.value)} />
          </div>
        </Modal>
      ) : null}
    </>
  );
  // Inside its contract's card (a new version picked there): its content alone.
  if (bare) return body;
  return (
    <ContractPart
      title={proposal ? 'Contract proposal' : 'Upcoming contract'}
      status={proposal ? 'Proposed' : 'Scheduled'}
      tag={waiting ? `Version ${waiting.version} waiting for your approval` : tag}
      // Action needed: not answered yet, the seller declined their request, or the seller
      // asked to cancel it — or a new version of it waits for them.
      flag={endAsked || (proposal && (!response || declined)) || waiting?.action ? 'Action needed' : null}
      meta={[contract.number, `${contract.start || '—'} – ${contract.end || 'No end date'}`, contract.appliesTo].filter(Boolean).join(' · ')}
      open={open}
    >
      {waiting ? <VersionPicker current={contract} waiting={waiting} shown={shown} onChange={setShown} /> : null}
      {waiting && shown === 'new' ? (
        <NotStartedCard bare proposal contract={waiting} session={session} locationName={locationName} onAnswered={onAnswered} />
      ) : (
        body
      )}
    </ContractPart>
  );
}

// The seller declined their request (for changes, or to cancel it): a box on top of the
// card saying so, with the seller's reply. They can close it (✕); closed, it isn't shown
// again for that decline — on this browser (as the real portal's shopify.storage).
const DISMISSED_KEY = 'qsDismissedDeclines';
const dismissedDeclines = () => {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY)) || [];
  } catch {
    return [];
  }
};
function DeclinedBanner({ number, m }) {
  const key = `${number}@${m.time || m.at}`;
  const [hidden, setHidden] = useState(() => dismissedDeclines().includes(key));
  if (hidden) return null;
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedDeclines(), key]));
    } catch {
      /* not kept */
    }
  };
  return (
    <div className="pc-banner" role="status">
      <div className="pc-stack">
        <strong>{`${m.kind === 'declined-cancel' ? 'The seller declined your cancellation request' : 'The seller declined your request for changes'} · ${m.at}`}</strong>
        <p>{`“${m.message}”`}</p>
      </div>
      <button className="pc-banner__close" aria-label="Dismiss" onClick={close}>
        ✕
      </button>
    </div>
  );
}

// The seller's message with their request to end (or cancel) a contract: its reason, on
// its own (Seller's message on the card).
function SellerMessage({ number, at, message, onClose }) {
  return (
    <Modal
      title={`Seller’s message · ${number}`}
      onClose={onClose}
      footer={
        <button className="acct-btn" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="pc-stack">
        <span className="muted">{at ? `Message from the seller · ${at}` : 'Message from the seller'}</span>
        <p>{message}</p>
      </div>
    </Modal>
  );
}

// Request changes: what should change, sent as their answer to the version they see
// (the Contract card, or a proposal's Request adjustment).
function RequestChangesModal({ number, message, setMessage, onClose, onSend }) {
  return (
    <Modal
      title={`Request changes · ${number}`}
      onClose={onClose}
      footer={
        <>
          <button className="acct-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="button button--b2b button--sm" disabled={!message.trim()} onClick={onSend}>
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
  );
}

// Request cancellation: why they want to cancel it (a proposal, an Upcoming contract or
// the Contract).
function RequestCancellationModal({ number, reason, setReason, onClose, onSend }) {
  return (
    <Modal
      title={`Request cancellation · ${number}`}
      onClose={onClose}
      footer={
        <>
          <button className="acct-btn" onClick={onClose}>
            Close
          </button>
          <button className="button button--b2b button--sm" disabled={!reason.trim()} onClick={onSend}>
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
  );
}

export function UpcomingContractCard({ contract, session, locationName, onAnswered, open = false, waiting = null }) {
  return <NotStartedCard contract={contract} session={session} locationName={locationName} onAnswered={onAnswered} open={open} waiting={waiting} />;
}

export function ProposalCard({ contract, session, locationName, onAnswered, open = false }) {
  return <NotStartedCard contract={contract} session={session} locationName={locationName} onAnswered={onAnswered} open={open} proposal />;
}

// ── Activities log ────────────────────────────────────────────────────────────
// What each answer reads as in the log.
// `updated`: the seller changed it before activating it (agreements.js logProposalUpdate).
// The seller's request to end it, and their answer to it.
const ACTIVITY_TITLE = {
  approve: 'Approved',
  changes: 'Changes requested',
  cancel: 'Cancellation requested',
  updated: 'Updated by seller',
  decline: 'Declined',
  'end-request': 'End requested by seller',
  'end-approve': 'Ending approved',
  'end-decline': 'Ending declined',
  'end-withdrawn': 'End request withdrawn',
  'end-lapsed': 'Request lapsed',
};
// The same for the seller's request to cancel one that hadn't started (`cancel`).
const CANCEL_ASK_TITLE = {
  'end-request': 'Cancellation requested by seller',
  'end-approve': 'Cancellation approved',
  'end-decline': 'Cancellation declined',
  'end-withdrawn': 'Cancellation request withdrawn',
  'end-lapsed': 'Cancellation request lapsed: it started',
};
const titleOf = (a) => (a.cancel && CANCEL_ASK_TITLE[a.kind]) || ACTIVITY_TITLE[a.kind] || 'Request';
// A request opens on its own screen, and their reason for declining to end it.
const opensOwn = (a) => a.kind === 'changes' || a.kind === 'cancel' || ((a.kind === 'end-decline' || a.kind === 'decline') && !!a.message);

// A contract's Activities log (its link beside the name on its card): every answer
// its buyers sent, newest first — Approved, Changes requested, Cancellation requested —
// with the version, who and the date. A request opens (›) on its own screen: where it
// stands, its message and, when the seller declined it, their reply. One modal
// switching screens, as Version history. As the real portal's.
function ActivityLog({ number, activities, onClose }) {
  const [shown, setShown] = useState(null); // the activity open, by number
  // Numbered from the first one, so a new one doesn't renumber the rest.
  const numbered = activities.map((a, i) => ({ ...a, n: activities.length - i }));
  const q = numbered.find((a) => a.n === shown && opensOwn(a));
  return (
    <Modal
      title={q ? `${titleOf(q)} · ${number}` : `Activities log · ${number}`}
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
            const opens = opensOwn(a);
            const head = (
              <>
                <div className="pc-stack">
                  <strong>{titleOf(a)}</strong>
                  <span className="muted">
                    {a.kind === 'updated' || a.kind === 'end-request'
                      ? [a.version ? `Version ${a.version}` : null, a.note || 'Sent again'].filter(Boolean).join(' · ')
                      : [a.version ? `Version ${a.version}` : null, a.mine ? 'By you' : a.by ? `By ${a.by}` : null].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="muted">{a.at}</span>
                {opens ? <ChevronRightIcon /> : <span />}
              </>
            );
            return opens ? (
              <button key={a.n} className="pc-version pc-version--open" onClick={() => setShown(a.n)} aria-label={`Open ${titleOf(a).toLowerCase()} from ${a.at || ''}`}>
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
      {q.status ? (
        <div className="pc-title">
          <span className="muted">Status</span>
          <span className="badge">{q.status}</span>
        </div>
      ) : null}
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
