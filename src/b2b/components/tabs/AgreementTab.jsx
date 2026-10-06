import React, { useState } from 'react';
import { Card, BlockStack, InlineStack, Text, Badge, Button, Divider, Modal } from '@shopify/polaris';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { useStore } from '../../store.jsx';
import { scopeLabel } from '../../pricing.js';
import { currentAgreement, agreementScopeLabel, agreementTermLines } from '../../agreements.js';

const STATUS_TONE = { Active: 'success', Draft: undefined, Ended: undefined };
const fmtDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

function Section({ title, children }) {
  return (
    <BlockStack gap="200">
      <Text as="h3" variant="headingSm">{title}</Text>
      {children}
    </BlockStack>
  );
}

function Line({ main, side }) {
  return (
    <InlineStack align="space-between" blockAlign="center" gap="300" wrap={false}>
      <Text as="span" variant="bodyMd">{main}</Text>
      {side ? <Text as="span" tone="subdued" variant="bodySm">{side}</Text> : null}
    </InlineStack>
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
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">Past agreements</Text>
        {past.map((a) => (
          <Line key={a.id} main={`${a.number} · ${a.name}`} side={`Ended ${fmtDate(a.history?.[0]?.date)} · version ${a.version}`} />
        ))}
      </BlockStack>
    </Card>
  ) : null;

  if (!ag) {
    return (
      <BlockStack gap="400">
        <Card>
          <EmptyBlock
            heading="No agreement yet"
            action={{ content: 'Create agreement', onAction: () => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', companyId: company.id, returnTo }) }}
          >
            {`Put ${company.name}’s pricing and order limits in one agreement. Activating it applies them together, and every change is kept as a version.`}
          </EmptyBlock>
        </Card>
        {pastCard}
      </BlockStack>
    );
  }

  const terms = agreementTermLines(state.db, ag);
  const isActive = ag.status === 'Active';

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="start" gap="300">
            <BlockStack gap="100">
              {/* align="start": nested stacks inherit the header's space-between otherwise */}
              <InlineStack align="start" gap="200" blockAlign="center">
                <Text as="h2" variant="headingMd">{`${ag.number} · ${ag.name || 'Untitled agreement'}`}</Text>
                <Badge tone={STATUS_TONE[ag.status]}>{ag.status}</Badge>
              </InlineStack>
              <Text as="p" tone="subdued">
                {isActive
                  ? `Version ${ag.version} · applies to ${agreementScopeLabel(company, ag)} · active since ${fmtDate(ag.history?.[ag.history.length - 1]?.date)}`
                  : `Draft · would apply to ${agreementScopeLabel(company, ag)} · not applied yet`}
              </Text>
            </BlockStack>
            <InlineStack gap="200">
              {isActive ? (
                <Button tone="critical" variant="tertiary" onClick={() => setConfirmEnd(true)}>End agreement</Button>
              ) : (
                <Button tone="critical" variant="tertiary" onClick={() => dispatch({ type: 'DELETE_AGREEMENT', id: ag.id })}>Delete draft</Button>
              )}
              {isActive ? <Button onClick={edit}>Edit</Button> : <Button variant="primary" onClick={edit}>Review and activate</Button>}
            </InlineStack>
          </InlineStack>

          <Divider />
          <Section title="Base pricing">
            {terms.base.length ? terms.base.map((p) => <Line key={p.id} main={p.name} side={`Priority ${p.priority ?? 0} · ${scopeLabel(p)}`} />) : <Text as="p" tone="subdued">None</Text>}
          </Section>
          <Section title="Quantity pricing">
            {terms.quantity.length ? terms.quantity.map((p) => <Line key={p.id} main={p.name} side={scopeLabel(p)} />) : <Text as="p" tone="subdued">None</Text>}
          </Section>
          <Section title="Order limits">
            {terms.limits.length ? terms.limits.map(({ limit, summary }) => <Line key={limit.id} main={limit.name} side={summary} />) : <Text as="p" tone="subdued">None</Text>}
          </Section>
        </BlockStack>
      </Card>

      {ag.history?.length ? (
        <Card>
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">Version history</Text>
            {ag.history.map((h, i) => (
              <Line key={i} main={`Version ${h.version} · ${h.note}`} side={fmtDate(h.date)} />
            ))}
          </BlockStack>
        </Card>
      ) : null}

      {pastCard}

      {confirmEnd && (
        <Modal
          open
          onClose={() => setConfirmEnd(false)}
          title={`End ${ag.number}?`}
          primaryAction={{ content: 'End agreement', destructive: true, onAction: () => { setConfirmEnd(false); dispatch({ type: 'END_AGREEMENT', id: ag.id }); } }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmEnd(false) }]}
        >
          <Modal.Section>
            <Text as="p">{`Its pricing and order limits come off ${company.name} right away. Anything assigned outside the agreement stays.`}</Text>
          </Modal.Section>
        </Modal>
      )}
    </BlockStack>
  );
}
