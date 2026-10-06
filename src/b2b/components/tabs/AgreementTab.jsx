import React, { useState } from 'react';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { useStore } from '../../store.jsx';
import { scopeLabel } from '../../pricing.js';
import { currentAgreement, agreementScopeLabel, agreementTermLines } from '../../agreements.js';
import { Modal, wcTone } from '../../../shared/wc.jsx';

const STATUS_TONE = { Active: 'success', Draft: undefined, Ended: undefined };
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
  const ag = currentAgreement(state.db, company.id);
  const past = (state.db.agreements || []).filter((a) => a.companyId === company.id && a.status === 'Ended');
  const returnTo = { view: 'company', selectedCompany: company.id, companyTab: 'agreement' };
  const edit = () => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', agreementId: ag.id, returnTo });

  const pastCard = past.length ? (
    <s-section heading="Past agreements">
      <s-stack gap="small-200">
        {past.map((a) => (
          <Line key={a.id} main={`${a.number} · ${a.name}`} side={`Ended ${fmtDate(a.history?.[0]?.date)} · version ${a.version}`} />
        ))}
      </s-stack>
    </s-section>
  ) : null;

  if (!ag) {
    return (
      <s-stack gap="base">
        <s-section>
          <EmptyBlock
            heading="No agreement yet"
            action={{ content: 'Create agreement', onAction: () => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', companyId: company.id, returnTo }) }}
          >
            {`Put ${company.name}’s pricing and order limits in one agreement. Activating it applies them together, and every change is kept as a version.`}
          </EmptyBlock>
        </s-section>
        {pastCard}
      </s-stack>
    );
  }

  const terms = agreementTermLines(state.db, ag);
  const isActive = ag.status === 'Active';
  const none = <s-paragraph color="subdued">None</s-paragraph>;

  return (
    <s-stack gap="base">
      <s-section>
        <s-stack gap="base">
          <s-grid gridTemplateColumns="1fr auto" alignItems="start" gap="small">
            <s-stack gap="small-400">
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-heading fontSize="large">{`${ag.number} · ${ag.name || 'Untitled agreement'}`}</s-heading>
                <s-badge tone={wcTone(STATUS_TONE[ag.status])}>{ag.status}</s-badge>
              </s-stack>
              <s-paragraph color="subdued">
                {isActive
                  ? `Version ${ag.version} · applies to ${agreementScopeLabel(company, ag)} · active since ${fmtDate(ag.history?.[ag.history.length - 1]?.date)}`
                  : `Draft · would apply to ${agreementScopeLabel(company, ag)} · not applied yet`}
              </s-paragraph>
            </s-stack>
            <s-stack direction="inline" gap="small-200">
              {isActive ? (
                <s-button tone="critical" variant="tertiary" onClick={() => setConfirmEnd(true)}>
                  End agreement
                </s-button>
              ) : (
                <s-button tone="critical" variant="tertiary" onClick={() => dispatch({ type: 'DELETE_AGREEMENT', id: ag.id })}>
                  Delete draft
                </s-button>
              )}
              {isActive ? (
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

      {confirmEnd && (
        <Modal onClose={() => setConfirmEnd(false)} heading={`End ${ag.number}?`}>
          <s-paragraph>{`Its pricing and order limits come off ${company.name} right away. Anything assigned outside the agreement stays.`}</s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              setConfirmEnd(false);
              dispatch({ type: 'END_AGREEMENT', id: ag.id });
            }}
          >
            End agreement
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmEnd(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-stack>
  );
}
