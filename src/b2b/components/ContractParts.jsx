import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { fmtDay, nextAgreements, overlaps, takenOver, joinAnd, agreementScopeLabel } from '../agreements.js';
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

// The version history as a timeline, newest first. A version that kept a snapshot
// opens as it was. `current`: the version being read (its dot filled, not a link);
// by default the newest.
export function VersionTimeline({ history, onView, current = null }) {
  const at = current == null ? 0 : history.findIndex((h) => h.version === current && h.snapshot);
  const [all, setAll] = useState(false);
  const shown = all ? history : history.slice(0, SHOWN);
  return (
    <s-stack gap="small">
      <s-heading>Version history</s-heading>
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
                      <s-link onClick={() => onView(h.version)}>{`Version ${h.version}`}</s-link>
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

// End contract, confirmed — from the company's Contract tab, the Contracts list and
// the contract editor (`onDone`: after it's ended). Ending an Active one takes its
// terms off right away (Scheduled ones at its locations still start); ending a
// Scheduled one, it never starts (the Active ones it would have taken over from stay).
export function EndContractModal({ ag, onClose, onDone }) {
  const { state, dispatch } = useStore();
  const company = state.db.companies.find((c) => c.id === ag.companyId);
  if (!company) return null;
  // Where its terms come off: the company, or the locations it has.
  const where = agreementScopeLabel(company, ag) === 'All locations' ? company.name : agreementScopeLabel(company, ag);
  const stillStarting = nextAgreements(state.db, company.id).filter((n) => n.status === 'Scheduled' && n.id !== ag.id && overlaps(company, n, ag));
  const staying = ag.status === 'Scheduled' ? takenOver(state.db, ag) : [];
  return (
    <Modal onClose={onClose} heading={`End ${ag.number}?`}>
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
        End contract
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
