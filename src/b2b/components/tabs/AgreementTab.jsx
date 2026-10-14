import React, { useState } from 'react';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { useStore } from '../../store.jsx';
import { scopeLabel } from '../../pricing.js';
import {
  activeAgreement,
  nextAgreement,
  agreementScopeLabel,
  agreementTermLines,
  limitsAfterAgreement,
  agreementDatesLabel,
  expiringSoon,
  daysUntil,
  addYear,
  addDay,
  isLive,
  fmtDay,
  PAST_STATUSES,
} from '../../agreements.js';
import { newConflicts } from '../../limits.js';
import { LimitConflictList } from '../LimitConflictList.jsx';
import { ContractVersionModal } from '../ContractVersionModal.jsx';
import { withCatalog } from '../LimitEditor.jsx';
import { Modal, wcTone } from '../../../shared/wc.jsx';

const STATUS_TONE = { Active: 'success', Scheduled: 'info', Draft: undefined, Expired: undefined, Ended: undefined };

function Section({ title, children }) {
  return (
    <s-stack gap="small-200">
      <s-heading>{title}</s-heading>
      {children}
    </s-stack>
  );
}

function Line({ main, side, onClick }) {
  return (
    <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small">
      {onClick ? <s-link onClick={onClick}>{main}</s-link> : <s-text>{main}</s-text>}
      {side ? (
        <s-text color="subdued" fontSize="small">
          {side}
        </s-text>
      ) : null}
    </s-grid>
  );
}

// One contract, read like the contract it is: what it covers, who it applies to
// and its version history (a version opens as it was). `replacing`: the Active
// contract this next one takes over from.
function ContractCard({ ag, company, replacing, heading, onEdit, onEnd, onDelete, onView }) {
  const { state } = useStore();
  const terms = agreementTermLines(state.db, ag);
  const live = isLive(ag);
  const none = <s-paragraph color="subdued">None</s-paragraph>;
  const scope = agreementScopeLabel(company, ag);
  const status =
    ag.status === 'Active'
      ? `Version ${ag.version} · applies to ${scope} · ${agreementDatesLabel(ag)}`
      : ag.status === 'Scheduled'
        ? replacing
          ? `Version ${ag.version} · replaces ${replacing.number} on ${fmtDay(ag.startDate)} · applies to ${scope} · ${agreementDatesLabel(ag)}`
          : `Version ${ag.version} · applies to ${scope} · starts ${fmtDay(ag.startDate)}, not applied yet`
        : replacing
          ? `Draft · would replace ${replacing.number} from ${fmtDay(ag.startDate)} · would apply to ${scope} · not applied yet`
          : `Draft · would apply to ${scope} · ${agreementDatesLabel(ag)} · not applied yet`;

  return (
    <s-section heading={heading}>
      <s-stack gap="base">
        <s-grid gridTemplateColumns="1fr auto" alignItems="start" gap="small">
          <s-stack gap="small-400">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-heading fontSize="large">{`${ag.number} · ${ag.name || 'Untitled contract'}`}</s-heading>
              <s-badge tone={wcTone(STATUS_TONE[ag.status])}>{ag.status}</s-badge>
            </s-stack>
            <s-paragraph color="subdued">{status}</s-paragraph>
          </s-stack>
          <s-stack direction="inline" gap="small-200">
            {live ? (
              <s-button tone="critical" variant="tertiary" onClick={() => onEnd(ag)}>
                End contract
              </s-button>
            ) : (
              <s-button tone="critical" variant="tertiary" onClick={() => onDelete(ag)}>
                Delete draft
              </s-button>
            )}
            {live ? (
              <s-button onClick={() => onEdit(ag)}>Edit</s-button>
            ) : (
              <s-button variant="primary" onClick={() => onEdit(ag)}>
                Review and activate
              </s-button>
            )}
          </s-stack>
        </s-grid>

        <s-divider />
        <Section title="Base pricing">
          {terms.base.length ? terms.base.map((p) => <Line key={p.id} main={p.name} side={`Priority ${p.priority ?? 0} · ${scopeLabel(p)}`} />) : none}
        </Section>
        <Section title="Quantity pricing">
          {terms.quantity.length ? terms.quantity.map((p) => <Line key={p.id} main={p.name} side={scopeLabel(p)} />) : none}
        </Section>
        <Section title="Order limits">
          {terms.limits.length ? terms.limits.map(({ limit, summary }) => <Line key={limit.id} main={limit.name} side={summary} />) : none}
        </Section>

        {ag.history?.length ? (
          <>
            <s-divider />
            <Section title="Version history">
              {ag.history.map((h, i) => (
                <Line key={i} main={`Version ${h.version} · ${h.note}`} side={fmtDay(h.date)} onClick={h.snapshot ? () => onView(ag, h.version) : undefined} />
              ))}
            </Section>
          </>
        ) : null}
      </s-stack>
    </s-section>
  );
}

// A company's contracts: the Active one (or the next one, when none is Active), the
// next one set up beside it, and the past ones.
export function AgreementTab({ company }) {
  const { state, dispatch } = useStore();
  const [ending, setEnding] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null); // { ag, version }
  const [renewTo, setRenewTo] = useState(null); // the new end date while renewing
  const active = activeAgreement(state.db, company.id);
  const next = nextAgreement(state.db, company.id);
  const main = active || next;
  const past = (state.db.agreements || []).filter((a) => a.companyId === company.id && PAST_STATUSES.includes(a.status));
  const returnTo = { view: 'company', selectedCompany: company.id, companyTab: 'agreement' };
  const edit = (ag) => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', agreementId: ag.id, returnTo });
  const view = (ag, version) => setViewing({ ag, version });
  // The order-limit conflicts ending it would leave (its limits can stop covering a clash).
  const endConflicts = ending?.status === 'Active' ? newConflicts(withCatalog(state.db), limitsAfterAgreement(state.db, { off: ending })) : [];

  const pastCard = past.length ? (
    <s-section heading="Past contracts">
      <s-stack gap="small-200">
        {past.map((a) => (
          <Line key={a.id} main={`${a.number} · ${a.name}`} side={`${a.status} ${fmtDay(a.history?.[0]?.date)} · version ${a.version}`} onClick={() => view(a, a.version)} />
        ))}
      </s-stack>
    </s-section>
  ) : null;
  const viewModal = viewing && <ContractVersionModal ag={viewing.ag} version={viewing.version} onClose={() => setViewing(null)} />;

  if (!main) {
    return (
      <s-stack gap="base">
        <s-section>
          <EmptyBlock
            heading="No contract yet"
            action={{ content: 'Create contract', onAction: () => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', companyId: company.id, returnTo }) }}
          >
            {`Put ${company.name}’s pricing and order limits in one contract. Activating it applies them together, and every change is kept as a version.`}
          </EmptyBlock>
        </s-section>
        {pastCard}
        {viewModal}
      </s-stack>
    );
  }

  const days = active && expiringSoon(active, state.db) ? daysUntil(active.endDate) : null;
  const renewError = renewTo != null && !(renewTo > active.endDate) ? 'Must be after the current end date' : undefined;
  const cardProps = { company, onEdit: edit, onEnd: setEnding, onDelete: setDeleting, onView: view };

  return (
    <s-stack gap="base">
      {/* The renewal reminder: shown from RENEW_NOTICE_DAYS before the end date,
          unless a next contract is set to take over. */}
      {days != null && (
        <s-banner tone="warning" heading={`${active.number} ends ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`}>
          <s-paragraph>{`After ${fmtDay(active.endDate)}, ${company.name} goes back to the pricing and limits outside the contract. Renew it to keep these terms.`}</s-paragraph>
          <s-button slot="secondary-actions" onClick={() => setRenewTo(addYear(active.endDate))}>
            Renew
          </s-button>
        </s-banner>
      )}
      <ContractCard ag={main} {...cardProps} />
      {active && next && (
        <ContractCard
          ag={next}
          replacing={!active.endDate || next.startDate <= addDay(active.endDate) ? active : null}
          heading="Next contract"
          {...cardProps}
        />
      )}

      {pastCard}
      {viewModal}

      {renewTo != null && (
        <Modal onClose={() => setRenewTo(null)} heading={`Renew ${active.number}`}>
          <s-date-field
            label="New end date"
            value={renewTo}
            onChange={(e) => setRenewTo(e.currentTarget.value)}
            error={renewError}
            details={`The terms stay the same. Saved as version ${active.version + 1}.`}
          />
          <s-button
            slot="primary-action"
            variant="primary"
            disabled={!!renewError || !renewTo}
            onClick={() => {
              dispatch({ type: 'RENEW_AGREEMENT', id: active.id, endDate: renewTo });
              setRenewTo(null);
            }}
          >
            Renew
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setRenewTo(null)}>
            Cancel
          </s-button>
        </Modal>
      )}

      {ending && (
        <Modal onClose={() => setEnding(null)} heading={`End ${ending.number}?`}>
          <s-stack gap="small">
            <s-paragraph>
              {ending.status === 'Active'
                ? `Its pricing and order limits come off ${company.name} right away. Anything assigned outside the contract stays.${next?.status === 'Scheduled' ? ` ${next.number} still starts on ${fmtDay(next.startDate)}.` : ''}`
                : `It won’t start on ${fmtDay(ending.startDate)}, and nothing changes for ${company.name}${active ? `: ${active.number} stays in place` : ''}.`}
            </s-paragraph>
            {endConflicts.length ? (
              <>
                <s-paragraph>Without them, these order limits conflict:</s-paragraph>
                <LimitConflictList conflicts={endConflicts} />
              </>
            ) : null}
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              dispatch({ type: 'END_AGREEMENT', id: ending.id });
              setEnding(null);
            }}
          >
            End contract
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setEnding(null)}>
            Cancel
          </s-button>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)} heading={`Delete ${deleting.number}?`}>
          <s-paragraph>{`The draft is deleted. Nothing changes for ${company.name}.`}</s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              dispatch({ type: 'DELETE_AGREEMENT', id: deleting.id });
              setDeleting(null);
            }}
          >
            Delete draft
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setDeleting(null)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-stack>
  );
}
