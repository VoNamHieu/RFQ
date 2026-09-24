import React, { useState } from 'react';
import {
  Page, Card, BlockStack, InlineStack, InlineGrid, Text, Badge, Button, Link, Banner, Divider, Box, Modal,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { companyNeedsPrice } from '../pricing.js';
import { REG_STATUS, fullName, fmtDate } from '../registrations.js';
import { readRegistrationForm, BUILTIN_FIELDS, withoutOptionalNote } from '../../shared/registrationForm.js';

// Reviewing one registration: registration → identify buyer → approve (activate)
// → configure pricing. The application is shown in the form's own sections; the
// right column is the decision — approving always creates a new Company for the
// buyer (joining an existing one isn't offered here).

export function RegistrationDetail() {
  const { state, dispatch } = useStore();
  const reg = (state.db.registrations || []).find((r) => r.id === state.selectedRegistration);
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
  const approve = () => dispatch({ type: 'APPROVE_REGISTRATION', id: reg.id });

  return (
    <Page
      title={reg.company}
      titleMetadata={<Badge tone={status.tone}>{status.label}</Badge>}
      subtitle={`${name} · submitted ${fmtDate(reg.submittedAt)} from the ${reg.source.toLowerCase()}`}
      backAction={{ content: 'Registrations', onAction: back }}
      primaryAction={pending ? { content: 'Approve', onAction: approve } : undefined}
      secondaryActions={[
        ...(pending ? [{ content: 'Decline', destructive: true, onAction: () => setConfirm('decline') }] : []),
        { content: 'Delete', destructive: true, onAction: () => setConfirm('delete') },
      ]}
    >
      <InlineGrid columns={{ xs: 1, md: '2fr 1fr' }} gap="400" alignItems="start">
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingSm">Application</Text>
            {applicationSections(reg).map((sec, i) => (
              <React.Fragment key={sec.key}>
                {i > 0 && <Divider />}
                <Section title={sec.title}>
                  {sec.fields.map((f) => (f.kind === 'textarea' ? (
                    <BlockStack key={f.id} gap="100">
                      {sec.fields.length > 1 && <Text as="span" tone="subdued">{f.label}</Text>}
                      <Text as="p" tone={answerOf(reg, f) ? undefined : 'subdued'}>{answerOf(reg, f) || 'No answer'}</Text>
                    </BlockStack>
                  ) : (
                    <Row key={f.id} label={f.label} value={answerOf(reg, f)} />
                  )))}
                </Section>
              </React.Fragment>
            ))}
          </BlockStack>
        </Card>

        {pending ? (
          <Card>
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text as="h2" variant="headingSm">Company</Text>
                <Text as="p" tone="subdued">Approving gives {reg.firstName} B2B access through a new company.</Text>
              </BlockStack>
              <BlockStack gap="050">
                <Text as="p" fontWeight="medium">{reg.company}</Text>
                <Text as="p" variant="bodySm" tone="subdued">{`${name} as the main contact.`}</Text>
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

// The application laid out by the saved registration form — the same config the
// storefront renders — so whatever the merchant put on the form (phone, address,
// custom fields) is what gets reviewed. Headings become sections; answers to
// fields since taken off the form are kept under "Other answers".
function applicationSections(reg) {
  const fields = readRegistrationForm().fields.filter((f) => f.kind !== 'submit' && f.kind !== 'password');
  const sections = [];
  fields.forEach((f) => {
    if (f.kind === 'heading') {
      sections.push({ key: f.id, title: withoutOptionalNote(f.label), fields: [] });
    } else {
      if (!sections.length) sections.push({ key: 'top', title: null, fields: [] });
      sections[sections.length - 1].fields.push(f);
    }
  });
  const onForm = new Set(fields.map((f) => f.id));
  const extra = BUILTIN_FIELDS.filter((f) => !['heading', 'submit', 'password'].includes(f.kind)
    && !onForm.has(f.id) && answerOf(reg, f));
  if (extra.length) sections.push({ key: 'other', title: 'Other answers', fields: extra });
  return sections.filter((sec) => sec.fields.length);
}

// A buyer's answer to one field: storefront submissions carry `values` keyed by
// field id; seeded rows keep the built-in answers at the top level.
function answerOf(reg, f) {
  const v = reg.values?.[f.id] ?? reg[f.id];
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return v == null ? '' : String(v);
}

function Section({ title, children }) {
  return (
    <BlockStack gap="200">
      {title && <Text as="h3" variant="headingXs" tone="subdued">{title}</Text>}
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
