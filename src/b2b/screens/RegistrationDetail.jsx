import React, { useState } from 'react';
import {
  Page, Card, BlockStack, InlineStack, InlineGrid, Text, Badge, Button, Link, Banner, RadioButton, Select, Divider, Box, Modal,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { companyNeedsPrice } from '../pricing.js';
import { REG_STATUS, fullName, fmtDate, matchCompany } from '../registrations.js';

// Reviewing one registration: registration → identify buyer → match Company →
// approve (activate) → configure pricing. The application is shown in the
// form's own sections; the right column is the decision — which Company the
// buyer joins (a suggested match, another existing Company, or a new one).

export function RegistrationDetail() {
  const { state, dispatch } = useStore();
  const companies = state.db.companies;
  const reg = (state.db.registrations || []).find((r) => r.id === state.selectedRegistration);
  const match = reg && reg.status === 'pending' ? matchCompany(reg, companies) : null;

  const [target, setTarget] = useState(match ? 'existing' : 'new'); // 'existing' | 'new'
  const [existingId, setExistingId] = useState(match?.company.id || companies[0]?.id || '');
  const [confirm, setConfirm] = useState(null); // 'decline' | 'delete'

  const back = () => dispatch({ type: 'NAVIGATE', view: 'registrations' });
  if (!reg) {
    return (
      <Page title="Registration" backAction={{ content: 'Registrations', onAction: back }}>
        <Card><Text as="p" tone="subdued">This registration no longer exists.</Text></Card>
      </Page>
    );
  }

  const name = fullName(reg);
  const status = REG_STATUS[reg.status];
  const pending = reg.status === 'pending';
  const canApprove = target === 'new' || !!companies.find((c) => c.id === existingId);
  const approve = () => dispatch({ type: 'APPROVE_REGISTRATION', id: reg.id, companyId: target === 'existing' ? existingId : null });

  return (
    <Page
      title={reg.company}
      titleMetadata={<Badge tone={status.tone}>{status.label}</Badge>}
      subtitle={`${name} · submitted ${fmtDate(reg.submittedAt)} from the ${reg.source.toLowerCase()}`}
      backAction={{ content: 'Registrations', onAction: back }}
      primaryAction={pending ? { content: 'Approve', onAction: approve, disabled: !canApprove } : undefined}
      secondaryActions={[
        ...(pending ? [{ content: 'Decline', destructive: true, onAction: () => setConfirm('decline') }] : []),
        { content: 'Delete', destructive: true, onAction: () => setConfirm('delete') },
      ]}
    >
      <InlineGrid columns={{ xs: 1, md: '2fr 1fr' }} gap="400" alignItems="start">
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingSm">Application</Text>
            <Section title="Contact information">
              <Row label="First name" value={reg.firstName} />
              <Row label="Last name" value={reg.lastName} />
              <Row label="Business email" value={reg.email} />
            </Section>
            <Divider />
            <Section title="Business information">
              <Row label="Company name" value={reg.company} />
              <Row label="Country" value={reg.country} />
              <Row label="Tax / VAT ID" value={reg.taxId} />
            </Section>
            <Divider />
            <Section title="Tell us about your business">
              <Text as="p" tone={reg.message ? undefined : 'subdued'}>{reg.message || 'No message'}</Text>
            </Section>
          </BlockStack>
        </Card>

        {pending ? (
          <Card>
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text as="h2" variant="headingSm">Company</Text>
                <Text as="p" tone="subdued">Approving gives {reg.firstName} B2B access through a company.</Text>
              </BlockStack>
              {match && (
                <Banner tone="info" title={`Suggested: ${match.company.name}`}>
                  {match.reason}.
                </Banner>
              )}
              <BlockStack gap="200">
                <RadioButton
                  label="Add to an existing company" id="rg-existing" name="rg-target"
                  checked={target === 'existing'} onChange={() => setTarget('existing')}
                  helpText={`${reg.firstName} joins as a buyer.`}
                />
                {target === 'existing' && (
                  <Box paddingInlineStart="600">
                    <Select label="Company" labelHidden value={existingId} onChange={setExistingId}
                      options={companies.map((c) => ({ label: c.name, value: c.id }))} />
                  </Box>
                )}
                <RadioButton
                  label="Create a new company" id="rg-new" name="rg-target"
                  checked={target === 'new'} onChange={() => setTarget('new')}
                  helpText={`“${reg.company}” with ${name} as the main contact.`}
                />
              </BlockStack>
              <Text as="p" variant="bodySm" tone="subdued">You’ll set up the company’s pricing after approving.</Text>
            </BlockStack>
          </Card>
        ) : reg.status === 'approved' ? (
          <ApprovedCard reg={reg} />
        ) : (
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">Decision</Text>
              <Text as="p">Declined on {fmtDate(reg.decidedAt)}.</Text>
              <Text as="p" tone="subdued">{reg.firstName} doesn’t get B2B access or pricing.</Text>
            </BlockStack>
          </Card>
        )}
      </InlineGrid>

      {confirm && (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title={confirm === 'decline' ? `Decline ${reg.company}’s registration?` : `Delete ${reg.company}’s registration?`}
          primaryAction={{
            content: confirm === 'decline' ? 'Decline' : 'Delete',
            destructive: true,
            onAction: () => {
              dispatch({ type: confirm === 'decline' ? 'DECLINE_REGISTRATIONS' : 'DELETE_REGISTRATIONS', ids: [reg.id] });
              setConfirm(null);
            },
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirm(null) }]}
        >
          <Modal.Section>
            <Text as="p">
              {confirm === 'decline'
                ? `${name} won’t get B2B access or pricing. The registration moves to Declined.`
                : `This removes the submission from Registrations.${reg.status === 'approved' ? ' The company it was approved into is kept.' : ''}`}
            </Text>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}

// After approval: which Company the buyer landed in, and the next step —
// pricing, if the Company doesn't resolve a price yet.
function ApprovedCard({ reg }) {
  const { state, dispatch } = useStore();
  const company = state.db.companies.find((c) => c.id === reg.companyId);
  const openCompany = (tab) => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab });
  const needsPrice = company && companyNeedsPrice(company, state.db.policies, state.db.defaults);
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">Company</Text>
        {company ? (
          <>
            <BlockStack gap="050">
              <Link removeUnderline onClick={() => openCompany('contacts')}>{company.name}</Link>
              <Text as="span" variant="bodySm" tone="subdued">Approved {fmtDate(reg.decidedAt)}</Text>
            </BlockStack>
            {needsPrice ? (
              <Banner tone="warning" title="No pricing yet">
                <BlockStack gap="200">
                  <Text as="p">{reg.firstName} can sign in, but pays storefront prices until this company has pricing.</Text>
                  <InlineStack><Button onClick={() => openCompany('pricing')}>Set up pricing</Button></InlineStack>
                </BlockStack>
              </Banner>
            ) : (
              <InlineStack><Button onClick={() => openCompany('pricing')}>Open company</Button></InlineStack>
            )}
          </>
        ) : (
          <Text as="p" tone="subdued">Approved {fmtDate(reg.decidedAt)}. The company has since been removed.</Text>
        )}
      </BlockStack>
    </Card>
  );
}

function Section({ title, children }) {
  return (
    <BlockStack gap="200">
      <Text as="h3" variant="headingXs" tone="subdued">{title}</Text>
      {children}
    </BlockStack>
  );
}

function Row({ label, value }) {
  return (
    <InlineGrid columns="160px minmax(0, 1fr)" gap="200">
      <Text as="span" tone="subdued">{label}</Text>
      <Text as="span" tone={value ? undefined : 'subdued'} breakWord>{value || '—'}</Text>
    </InlineGrid>
  );
}
