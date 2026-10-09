import React, { useState } from 'react';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { useStore } from '../../store.jsx';
import { scopeLabel } from '../../pricing.js';
import { currentAgreement, agreementScopeLabel, agreementTermLines, limitsAfterAgreement, agreementDatesLabel, expiringSoon, daysUntil, addYear, isLive, fmtDay, PAST_STATUSES } from '../../agreements.js';
import { newConflicts } from '../../limits.js';
import { LimitConflictList } from '../LimitConflictList.jsx';
import { Modal, wcTone } from '../../../shared/wc.jsx';

const STATUS_TONE = { Active: 'success', Scheduled: 'info', Draft: undefined, Expired: undefined, Ended: undefined };
const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

function Section({ title, children }) {
  return (
    <s-stack gap="small-200">
      <s-heading>{title}</s-heading>
      {children}
    </s-stack>
  );
}

function Line({ main, side }) {
  return (
    <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small">
      <s-text>{main}</s-text>
      {side ? (
        <s-text color="subdued" fontSize="small">
          {side}
        </s-text>
      ) : null}
    </s-grid>
  );
}

// A company's agreement, read like the contract it is: what it covers, who it
// applies to, and its version history.
export function AgreementTab({ company }) {
  const { state, dispatch } = useStore();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [renewTo, setRenewTo] = useState(null); // the new end date while renewing
  const ag = currentAgreement(state.db, company.id);
  const past = (state.db.agreements || []).filter((a) => a.companyId === company.id && PAST_STATUSES.includes(a.status));
  const returnTo = { view: 'company', selectedCompany: company.id, companyTab: 'agreement' };
  const edit = () => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', agreementId: ag.id, returnTo });
  // The order-limit conflicts ending it would leave (its limits can stop covering a clash).
  const endConflicts = confirmEnd && ag?.status === 'Active' ? newConflicts(state.db, limitsAfterAgreement(state.db, { off: ag })) : [];

  const pastCard = past.length ? (
    <s-section heading="Past contracts">
      <s-stack gap="small-200">
        {past.map((a) => (
          <Line key={a.id} main={`${a.number} · ${a.name}`} side={`${a.status} ${fmtDate(a.history?.[0]?.date)} · version ${a.version}`} />
        ))}
      </s-stack>
    </s-section>
  ) : null;

  if (!ag) {
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
      </s-stack>
    );
  }

  const terms = agreementTermLines(state.db, ag);
  const live = isLive(ag);
  const none = <s-paragraph color="subdued">None</s-paragraph>;
  const days = expiringSoon(ag) ? daysUntil(ag.endDate) : null;
  const renewError = renewTo != null && !(renewTo > ag.endDate) ? 'Must be after the current end date' : undefined;

  return (
    <s-stack gap="base">
      {/* The renewal reminder: shown from RENEW_NOTICE_DAYS before the end date. */}
      {days != null && (
        <s-banner tone="warning" heading={`${ag.number} ends ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`}>
          <s-paragraph>{`After ${fmtDay(ag.endDate)}, ${company.name} goes back to the pricing and limits outside the contract. Renew it to keep these terms.`}</s-paragraph>
          <s-button slot="secondary-actions" onClick={() => setRenewTo(addYear(ag.endDate))}>
            Renew
          </s-button>
        </s-banner>
      )}
      <s-section>
        <s-stack gap="base">
          <s-grid gridTemplateColumns="1fr auto" alignItems="start" gap="small">
            <s-stack gap="small-400">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-heading fontSize="large">{`${ag.number} · ${ag.name || 'Untitled contract'}`}</s-heading>
                <s-badge tone={wcTone(STATUS_TONE[ag.status])}>{ag.status}</s-badge>
              </s-stack>
              <s-paragraph color="subdued">
                {ag.status === 'Active'
                  ? `Version ${ag.version} · applies to ${agreementScopeLabel(company, ag)} · ${agreementDatesLabel(ag)}`
                  : ag.status === 'Scheduled'
                    ? `Version ${ag.version} · applies to ${agreementScopeLabel(company, ag)} · starts ${fmtDay(ag.startDate)}, not applied yet`
                    : `Draft · would apply to ${agreementScopeLabel(company, ag)} · ${agreementDatesLabel(ag)} · not applied yet`}
              </s-paragraph>
            </s-stack>
            <s-stack direction="inline" gap="small-200">
              {live ? (
                <s-button tone="critical" variant="tertiary" onClick={() => setConfirmEnd(true)}>
                  End contract
                </s-button>
              ) : (
                <s-button tone="critical" variant="tertiary" onClick={() => dispatch({ type: 'DELETE_AGREEMENT', id: ag.id })}>
                  Delete draft
                </s-button>
              )}
              {live ? (
                <s-button onClick={edit}>Edit</s-button>
              ) : (
                <s-button variant="primary" onClick={edit}>
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
        </s-stack>
      </s-section>

      {ag.history?.length ? (
        <s-section heading="Version history">
          <s-stack gap="small-200">
            {ag.history.map((h, i) => (
              <Line key={i} main={`Version ${h.version} · ${h.note}`} side={fmtDate(h.date)} />
            ))}
          </s-stack>
        </s-section>
      ) : null}

      {pastCard}

      {renewTo != null && (
        <Modal onClose={() => setRenewTo(null)} heading={`Renew ${ag.number}`}>
          <s-date-field
            label="New end date"
            value={renewTo}
            onChange={(e) => setRenewTo(e.currentTarget.value)}
            error={renewError}
            details={`The terms stay the same. Saved as version ${ag.version + 1}.`}
          />
          <s-button
            slot="primary-action"
            variant="primary"
            disabled={!!renewError || !renewTo}
            onClick={() => {
              dispatch({ type: 'RENEW_AGREEMENT', id: ag.id, endDate: renewTo });
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

      {confirmEnd && (
        <Modal onClose={() => setConfirmEnd(false)} heading={`End ${ag.number}?`}>
          <s-stack gap="small">
            <s-paragraph>
              {ag.status === 'Active'
                ? `Its pricing and order limits come off ${company.name} right away. Anything assigned outside the contract stays.`
                : `It won’t start on ${fmtDay(ag.startDate)}, and nothing changes for ${company.name}.`}
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
              setConfirmEnd(false);
              dispatch({ type: 'END_AGREEMENT', id: ag.id });
            }}
          >
            End contract
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmEnd(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-stack>
  );
}
