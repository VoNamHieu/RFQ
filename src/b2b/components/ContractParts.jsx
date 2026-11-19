import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { fmtDay, nextAgreements, overlaps, takenOver, joinAnd, agreementScopeLabel, cancelRequestOf, entryKey } from '../agreements.js';
import { Modal } from '../../shared/wc.jsx';

// Pieces a contract is shown with — on the company's Contract tab, in the contract
// editor and in a version (ContractVersionModal).

// A key fact under the contract's title: a small tile with an icon and label, and
// anything that goes with the value under it (`children`, e.g. Dates' renewal reminder).
export function Fact({ icon, label, value, children = null }) {
  return (
    <s-box background="subdued" borderRadius="base" padding="small">
      <s-stack gap="small-400">
        <s-stack direction="inline" gap="small-300" alignItems="center">
          <s-icon type={icon} color="subdued" size="small" />
          <s-text color="subdued" fontSize="small">
            {label}
          </s-text>
        </s-stack>
        <s-text fontWeight="semibold">{value}</s-text>
        {children}
      </s-stack>
    </s-box>
  );
}

// One kind of term (base pricing, quantity pricing, order limits) as a bordered
// list: a header with its count (and `action`: the contract editor's Add), then a
// row per term — name over its detail, a side badge (a base pricing's priority) and
// `actions` (the contract editor's Edit and Remove; `onOpen`: the name opens it too),
// `lead` before the name (a version's priority number) and under it `expanded` (a
// version's settings for it).
export function TermGroup({ icon, title, rows, action = null }) {
  return (
    <s-box border="base" borderRadius="base" overflow="hidden">
      <s-box background="subdued" paddingBlock="small-300" paddingInline="small">
        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="small-200">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon type={icon} color="subdued" />
            <s-text fontWeight="semibold">{title}</s-text>
            <s-badge>{String(rows.length)}</s-badge>
          </s-stack>
          {action || <span />}
        </s-grid>
      </s-box>
      {rows.length ? (
        rows.map((r) => (
          <React.Fragment key={r.key}>
            <s-divider />
            <s-box paddingBlock="small-200" paddingInline="small">
              <s-stack gap="small-200">
              <s-grid gridTemplateColumns={r.lead ? 'auto minmax(0, 1fr) auto' : 'minmax(0, 1fr) auto'} alignItems="center" gap="small">
                {r.lead || null}
                <s-stack gap="small-500">
                  {r.onOpen ? (
                    <s-link tone="neutral" onClick={r.onOpen}>
                      <s-text fontWeight="medium">{r.name}</s-text>
                    </s-link>
                  ) : (
                    <s-text fontWeight="medium">{r.name}</s-text>
                  )}
                  <s-text color="subdued" fontSize="small">
                    {r.detail}
                  </s-text>
                </s-stack>
                {r.side || r.actions ? (
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    {r.side ? <s-badge>{r.side}</s-badge> : null}
                    {r.actions}
                  </s-stack>
                ) : (
                  <span />
                )}
              </s-grid>
              {r.expanded || null}
              </s-stack>
            </s-box>
          </React.Fragment>
        ))
      ) : (
        <>
          <s-divider />
          <s-box paddingBlock="small-200" paddingInline="small">
            <s-text color="subdued">None</s-text>
          </s-box>
        </>
      )}
    </s-box>
  );
}

// Lists that grow over time (version history, past contracts) show the newest
// SHOWN; the link shows the rest, and hides them again.
export const SHOWN = 3;
export function ShowAllLink({ total, all, onToggle }) {
  return total > SHOWN ? <s-link onClick={onToggle}>{all ? 'Show less' : `Show all (${total})`}</s-link> : null;
}

// The version history as a timeline, newest first — with the versions sent to the
// buyers they didn't approve (agreements.js logSentVersion). An entry that kept a
// snapshot opens (`onView(version, entry)`). `current`: the version being read (its dot
// filled, not a link) — a number (its latest entry with a snapshot) or an entry's key
// (entryKey); by default the newest. `aside`: at the right of its heading (the contract
// page's Activities log link).
export function VersionTimeline({ history, onView, current = null, aside = null }) {
  const at = current == null ? 0 : typeof current === 'string' ? history.findIndex((h) => entryKey(h) === current) : history.findIndex((h) => h.version === current && h.snapshot);
  const [all, setAll] = useState(false);
  const shown = all ? history : history.slice(0, SHOWN);
  return (
    <s-stack gap="small">
      {aside ? (
        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
          <s-heading>Version history</s-heading>
          {aside}
        </s-grid>
      ) : (
        <s-heading>Version history</s-heading>
      )}
      <div>
        {shown.map((h, i) => {
          const last = i === shown.length - 1;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr)', columnGap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    marginTop: 5,
                    borderRadius: '50%',
                    flex: '0 0 auto',
                    background: i === at ? 'var(--p-color-bg-fill-brand)' : 'var(--p-color-bg-surface)',
                    border: `2px solid ${i === at ? 'var(--p-color-bg-fill-brand)' : 'var(--p-color-input-border)'}`,
                  }}
                />
                {last ? null : <span style={{ flex: 1, width: 2, marginBlock: 4, background: 'var(--p-color-border)' }} />}
              </div>
              <div style={{ paddingBottom: last ? 0 : 16, minWidth: 0 }}>
                <s-stack gap="small-500">
                  <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
                    {h.snapshot && !(current != null && i === at) ? (
                      <s-link onClick={() => onView(h.version, h)}>{`Version ${h.version}`}</s-link>
                    ) : (
                      <s-text fontWeight={current != null && i === at ? 'semibold' : 'medium'}>{`Version ${h.version}`}</s-text>
                    )}
                    <s-text color="subdued" fontSize="small">
                      {fmtDay(h.date)}
                    </s-text>
                  </s-grid>
                  <s-text color="subdued">{h.note}</s-text>
                </s-stack>
              </div>
            </div>
          );
        })}
      </div>
      {/* Lined up with the entries' text, past the dots. */}
      <div style={{ paddingLeft: 24 }}>
        <ShowAllLink total={history.length} all={all} onToggle={() => setAll(!all)} />
      </div>
    </s-stack>
  );
}

// Activities log (its link beside Version history on the contract page): everything
// between the merchant and the company's buyers on the contract, as their B2B Portal
// lists it (portalContracts.js activitiesOf), newest first, from the merchant's side —
// the buyers' answers (Approved, Changes requested, Cancellation requested) with the
// version, who and the date, and the merchant's updates before it was activated
// (Updated by you). A request opens on its own screen: where it stands, the buyer's
// message and the merchant's reply — a decline's, or the message sent with the
// contract. One modal switching screens, as the B2B Portal's.
// Your request to end it (End requested by you, with why) and their answer to it.
const ACTIVITY_TITLE = {
  approve: 'Approved',
  changes: 'Changes requested',
  cancel: 'Cancellation requested',
  updated: 'Updated by you',
  decline: 'Version declined',
  'end-request': 'End requested by you',
  'end-approve': 'Ending approved',
  'end-decline': 'Ending declined',
  'end-withdrawn': 'End request withdrawn',
  'end-lapsed': 'Request lapsed',
};
// The same for your request to cancel one that hadn't started (`cancel`).
const CANCEL_ASK_TITLE = {
  'end-request': 'Cancel requested by you',
  'end-approve': 'Cancellation approved',
  'end-decline': 'Cancellation declined',
  'end-withdrawn': 'Cancel request withdrawn',
  'end-lapsed': 'Cancel request lapsed: it started',
};
// A request opens on its own screen, and their reason for declining to end it.
const opensOwn = (a) => a.kind === 'changes' || a.kind === 'cancel' || ((a.kind === 'end-decline' || a.kind === 'decline') && !!a.message);
export function ActivitiesLogModal({ number, activities, onClose }) {
  const [shown, setShown] = useState(null); // the request open, by its place in the list
  const q = shown == null ? null : activities[shown];
  const title = (a) => (a.cancel && CANCEL_ASK_TITLE[a.kind]) || ACTIVITY_TITLE[a.kind] || 'Request';
  const by = (a) => a.buyer || a.email || '';
  // The Portal's statuses, from the merchant's side (as the Buyer note words them).
  const declined = (a) => a.status === 'Declined';
  const status = (a) => (a.status === 'Updated by seller' ? 'Updated by you' : a.status);
  const replyLabel = (a) => (declined(a) ? 'Your reply' : 'Your message');
  return (
    <Modal onClose={onClose} heading={q ? `${title(q)} · ${number}` : `Activities log · ${number}`}>
      {q ? (
        <s-stack gap="base">
          {status(q) ? (
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-text color="subdued">Status</s-text>
              <s-badge>{status(q)}</s-badge>
            </s-stack>
          ) : null}
          <s-stack gap="small-400">
            <s-text color="subdued">{[`Message from ${by(q) || 'the buyer'}`, fmtDay(q.at)].filter(Boolean).join(' · ')}</s-text>
            <s-paragraph>{q.message}</s-paragraph>
          </s-stack>
          {q.reply ? (
            <s-stack gap="small-400">
              <s-text color="subdued">{[replyLabel(q), fmtDay(q.reply.at)].filter(Boolean).join(' · ')}</s-text>
              <s-paragraph>{q.reply.message}</s-paragraph>
            </s-stack>
          ) : null}
        </s-stack>
      ) : (
        <s-stack gap="small">
          {activities.map((a, i) => {
            const opens = opensOwn(a);
            const sub =
              a.kind === 'updated' || a.kind === 'end-request'
                ? [a.version ? `Version ${a.version}` : null, a.note || 'Sent again']
                : [a.version ? `Version ${a.version}` : null, by(a) ? `By ${by(a)}` : null];
            return (
              <React.Fragment key={i}>
                {i ? <s-divider /> : null}
                <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="start">
                  <s-stack gap="small-500">
                    {opens ? <s-link onClick={() => setShown(i)}>{title(a)}</s-link> : <s-text fontWeight="medium">{title(a)}</s-text>}
                    <s-text color="subdued">{sub.filter(Boolean).join(' · ')}</s-text>
                  </s-stack>
                  <s-text color="subdued" fontSize="small">
                    {fmtDay(a.at)}
                  </s-text>
                </s-grid>
              </React.Fragment>
            );
          })}
        </s-stack>
      )}
      {q ? (
        <s-button slot="secondary-actions" onClick={() => setShown(null)}>
          Back to activities
        </s-button>
      ) : null}
      <s-button slot="secondary-actions" onClick={onClose}>
        Close
      </s-button>
    </Modal>
  );
}

// End contract, confirmed — from the company's Contract tab, the Contracts list and
// the contract editor (`onDone`: after it's ended). Ending an Active one takes its
// terms off right away (Scheduled ones at its locations still start); ending a
// Scheduled one, it never starts (the Active ones it would have taken over from stay).
// An Active one saved with Buyer must approve isn't ended here: its buyers are asked to
// end it, with why (REQUEST_END) — it ends once they approve. Nothing else waits then
// (one thing at a time).
export function EndContractModal({ ag, onClose, onDone }) {
  const { state, dispatch } = useStore();
  const [reason, setReason] = useState('');
  const company = state.db.companies.find((c) => c.id === ag.companyId);
  if (!company) return null;
  // Where its terms come off: the company, or the locations it has.
  const where = agreementScopeLabel(company, ag) === 'All locations' ? company.name : agreementScopeLabel(company, ag);
  // Its buyers asked to cancel it: it ends now, at their request — not asked again.
  if (ag.status === 'Active' && cancelRequestOf(ag)) {
    return (
      <Modal onClose={onClose} heading={`End ${ag.number}?`}>
        <s-paragraph>
          {`${company.name}’s buyers asked to cancel it. It ends now, at their request: its pricing and order limits come off ${where} right away. You can’t undo this.`}
        </s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          onClick={() => {
            dispatch({ type: 'CANCEL_AGREEMENT', id: ag.id });
            onClose();
            onDone?.();
          }}
        >
          End contract
        </s-button>
        <s-button slot="secondary-actions" onClick={onClose}>
          Cancel
        </s-button>
      </Modal>
    );
  }
  // Saved with Buyer must approve: they approve ending it — or cancelling one that hasn't
  // started (it won't start) — in their B2B Portal (REQUEST_END).
  if ((ag.status === 'Active' || ag.status === 'Scheduled') && ag.approval) {
    const cancel = ag.status === 'Scheduled';
    return (
      <Modal onClose={onClose} heading={`Ask to ${cancel ? 'cancel' : 'end'} ${ag.number}?`}>
        <s-stack gap="small">
          <s-paragraph>
            {cancel
              ? `${company.name}’s buyers approve cancelling it in their B2B Portal. Approved, it won’t start; if they don’t answer by ${fmtDay(ag.startDate)}, it starts as it is.`
              : `${company.name}’s buyers approve ending it in their B2B Portal. It stays in force until they do; then its pricing and order limits come off ${where} right away.`}
          </s-paragraph>
          <s-text-area label={cancel ? 'Why cancel it' : 'Why end it'} details="They see it in their B2B Portal." rows={3} value={reason} onInput={(e) => setReason(e.currentTarget.value)} />
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          disabled={!reason.trim()}
          onClick={() => {
            dispatch({ type: 'REQUEST_END', id: ag.id, message: reason });
            onClose();
          }}
        >
          Send to buyer
        </s-button>
        <s-button slot="secondary-actions" onClick={onClose}>
          Cancel
        </s-button>
      </Modal>
    );
  }
  const stillStarting = nextAgreements(state.db, company.id).filter((n) => n.status === 'Scheduled' && n.id !== ag.id && overlaps(company, n, ag));
  const staying = ag.status === 'Scheduled' ? takenOver(state.db, ag) : [];
  return (
    <Modal onClose={onClose} heading={`${ag.status === 'Scheduled' ? 'Cancel' : 'End'} ${ag.number}?`}>
      <s-stack gap="small">
        <s-paragraph>
          {ag.status === 'Active'
            ? `Its pricing and order limits come off ${where} right away. Anything assigned outside the contract stays.${stillStarting
                .map((n) => ` ${n.number} still starts on ${fmtDay(n.startDate)}.`)
                .join('')}`
            : `It won’t start on ${fmtDay(ag.startDate)}, and nothing changes for ${company.name}${
                staying.length ? `: ${joinAnd(staying.map((a) => a.number))} ${staying.length === 1 ? 'stays' : 'stay'} in place` : ''
              }.`}
        </s-paragraph>
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        onClick={() => {
          dispatch({ type: 'END_AGREEMENT', id: ag.id });
          onClose();
          onDone?.();
        }}
      >
        {ag.status === 'Scheduled' ? 'Cancel contract' : 'End contract'}
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

// Delete a Scheduled or Proposed contract, confirmed — from the company's Contract
// tab, the Contracts list and the contract editor. A Proposed one leaves its buyers'
// B2B Portal.
export function DeleteContractModal({ ag, onClose }) {
  const { state, dispatch } = useStore();
  const company = state.db.companies.find((c) => c.id === ag.companyId);
  return (
    <Modal onClose={onClose} heading={`Delete ${ag.number}?`}>
      <s-paragraph>
        {ag.status === 'Proposed'
          ? `Its buyers no longer see it, and it’s removed with its history. Nothing changes for ${company?.name || 'the company'}.`
          : `It won’t start on ${fmtDay(ag.startDate)} and is removed with its history. Nothing changes for ${company?.name || 'the company'}.`}
      </s-paragraph>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        onClick={() => {
          dispatch({ type: 'DELETE_AGREEMENT', id: ag.id });
          onClose();
        }}
      >
        Delete contract
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

// A pricing's priority as a small round number before its name — the order reads
// down the list.
export function PriorityNumber({ value }) {
  return (
    <span className="wc-priority" title={`Priority ${value}`} aria-label={`Priority ${value}`}>
      {value}
    </span>
  );
}
