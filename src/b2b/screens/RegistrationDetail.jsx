import React, { useState } from 'react';
import {
  Page, Card, BlockStack, InlineStack, InlineGrid, Text, Badge, Button, Link, Banner, Divider, Modal, Select, ChoiceList,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { companyNeedsPrice } from '../pricing.js';
import { REG_STATUS, fullName, fmtDate, registrationDuplicates } from '../registrations.js';
import { readRegistrationForm, BUILTIN_FIELDS, withoutOptionalNote } from '../../shared/registrationForm.js';
import { ROLE_OPTIONS } from '../components/LocationModals.jsx';

// Reviewing one registration: registration → identify buyer → approve (activate)
// → configure pricing. The application is shown in the form's own sections; the
// right column is the decision — approving creates a new Company for the buyer.
// Matches with existing records (see registrationDuplicates) turn the decision into
// a choice: 1. same email, same company → Merge or Decline; 2. same email, another
// company → Merge into it or create the new one (the contact moves — an email
// belongs to one Company only); 3. same company name, new email → Merge or create a
// new company anyway. Every Merge picks a location and a role. A Shopify customer
// with the email is just noted — Approve reuses it.

export function RegistrationDetail() {
  const { state, dispatch } = useStore();
  const reg = (state.db.registrations || []).find((r) => r.id === state.selectedRegistration);
  const [confirm, setConfirm] = useState(null); // 'decline' | 'delete'
  // Match decision: 'merge' | 'create' (cases 2–3), and where a merge lands. The
  // decision buttons (Decline + the primary one) sit at the bottom of the side card.
  const [choice, setChoice] = useState('merge');
  const [mergeCompanyId, setMergeCompanyId] = useState(null);
  const [mergeLocationId, setMergeLocationId] = useState(null);
  const [mergeRole, setMergeRole] = useState(null);

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
  const dup = pending ? registrationDuplicates(state.db, reg) : null;
  // Merge: into which Company (the email's first), at which location, with which role.
  // An email that's already a contact keeps its role (no Role choice); only a new
  // email (case 3) picks one. An existing contact starts from their current location.
  const merge = (() => {
    if (!dup?.blocking) return null;
    const company = dup.mergeTargets.find((c) => c.id === mergeCompanyId) || dup.mergeTargets[0];
    const email = (reg.email || '').trim().toLowerCase();
    const current = (company.contacts || []).find((ct) => (ct.email || '').trim().toLowerCase() === email) || null;
    const locations = company.locations || [];
    const location =
      locations.find((l) => l.id === mergeLocationId) || locations.find((l) => l.name === current?.locations) || locations[0] || null;
    const email0 = (reg.email || '').trim().toLowerCase();
    const existingRole = dup.contactOf
      ? (dup.contactOf.contacts || []).find((ct) => (ct.email || '').trim().toLowerCase() === email0)?.role
      : null;
    const role = existingRole || mergeRole || 'Ordering only';
    return { company, current, location, role };
  })();
  const doMerge = () =>
    dispatch({ type: 'MERGE_REGISTRATION', id: reg.id, companyId: merge.company.id, locationId: merge.location?.id, role: merge.role });
  const primary = !pending
    ? undefined
    : !dup.blocking
      ? { content: 'Approve', onAction: approve }
      : choice === 'create' && dup.kind !== 'same'
          ? { content: `Create ${reg.company}`, onAction: () => dispatch({ type: 'APPROVE_REGISTRATION', id: reg.id, createNew: true }) }
          : { content: 'Merge', onAction: doMerge };

  return (
    <Page
      title={reg.company}
      titleMetadata={<Badge tone={status.tone}>{status.label}</Badge>}
      subtitle={`${name} · submitted ${fmtDate(reg.submittedAt)} from the ${reg.source.toLowerCase()}`}
      backAction={{ content: 'Registrations', onAction: back }}
      secondaryActions={[{ content: 'Delete', destructive: true, onAction: () => setConfirm('delete') }]}
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

        {pending && dup.blocking ? (
          <MatchCard
            reg={reg}
            dup={dup}
            choice={choice}
            onChoice={setChoice}
            merge={merge}
            onCompany={(id) => { setMergeCompanyId(id); setMergeLocationId(null); setMergeRole(null); }}
            onLocation={setMergeLocationId}
            onRole={setMergeRole}
            actions={<DecisionActions primary={primary} onDecline={() => setConfirm('decline')} />}
          />
        ) : pending ? (
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
              {dup.customer ? (
                <Banner tone="info">
                  {`Uses the existing Shopify customer ${dup.customer.name} (${reg.email}). Their order history is kept.`}
                </Banner>
              ) : null}
              <Text as="p" variant="bodySm" tone="subdued">You’ll set up the company’s pricing after approving.</Text>
              <DecisionActions primary={primary} onDecline={() => setConfirm('decline')} />
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

// A registration matching existing records — what matches, and the choice:
//   1 'same'    same email, same company  → Merge (or the card's Decline)
//   2 'contact' same email, other company → Merge into it, or create the new company
//                                           (the contact moves — one company per email)
//   3 'company' same name, new email      → Merge into it, or create a new company
// A Merge picks the company (when there are two to choose from), location and role.
function MatchCard({ reg, dup, choice, onChoice, merge, onCompany, onLocation, onRole, actions }) {
  const name = fullName(reg);
  const title =
    dup.kind === 'same'
      ? `${name} is already a contact at ${dup.contactOf.name}`
      : dup.kind === 'contact'
        ? `${reg.email} is already a contact at ${dup.contactOf.name}`
        : dup.sameName.length > 1
          ? `${dup.sameName.length} companies named “${dup.company.name}” already exist`
          : `A company named “${dup.company.name}” already exists`;
  const mergeFields = (
    <BlockStack gap="200">
      {/* Several to pick from (e.g. companies sharing a name): "Company · main contact". */}
      {dup.mergeTargets.length > 1 ? (
        <Select
          label="Company"
          options={dup.mergeTargets.map((c) => ({ label: `${c.name} · ${c.mainContact || 'No main contact'}`, value: c.id }))}
          value={merge.company.id}
          onChange={onCompany}
        />
      ) : null}
      {/* Already a contact there → they keep their location (and role); only someone
          new to this company picks where they land. */}
      {!merge.current && (merge.company.locations || []).length ? (
        <Select
          label="Location"
          options={merge.company.locations.map((l) => ({ label: l.name, value: l.id }))}
          value={merge.location?.id || ''}
          onChange={onLocation}
        />
      ) : null}
      {/* A new email picks a role; an existing contact keeps theirs. */}
      {!dup.contactOf ? (
        <Select label="Role" options={ROLE_OPTIONS.map((r) => ({ label: r, value: r }))} value={merge.role} onChange={onRole} />
      ) : null}
      {dup.contactOf && dup.contactOf.id !== merge.company.id ? (
        <Banner tone="warning">
          {`${name} is removed from ${dup.contactOf.name}. An email can only belong to one company.`}
        </Banner>
      ) : null}
    </BlockStack>
  );
  const mergeHelp = merge.current
    ? `${reg.firstName} stays at ${merge.company.name}${merge.current.locations ? ` · ${merge.current.locations}` : ''} as ${merge.role}. No new company is created.`
    : dup.contactOf
      ? `${reg.firstName} joins ${merge.company.name} as ${merge.role}. No new company is created.`
      : `${reg.firstName} joins ${merge.company.name} as a contact. No new company is created.`;
  const other =
    dup.kind === 'contact'
        ? {
            label: `Create ${reg.company}`,
            value: 'create',
            renderChildren: (on) =>
              on ? (
                <Banner tone="warning">
                  {`${name} is removed from ${dup.contactOf.name} and becomes the main contact of ${reg.company}. An email can only belong to one company.`}
                </Banner>
              ) : null,
          }
        : {
            label: `Create a new company named ${reg.company}`,
            value: 'create',
            helpText: `Shopify allows several companies with the same name. ${reg.firstName} becomes its main contact.`,
          };
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">Company</Text>
        <Banner tone="warning" title={title}>
          <Text as="p">{dup.kind === 'same' ? 'Merge it into their company, or decline it.' : 'Choose how to handle this registration.'}</Text>
        </Banner>
        {dup.kind === 'same' ? (
          // One path: merge (or Decline, below).
          <BlockStack gap="200">
            <Text as="p">{mergeHelp}</Text>
            {dup.mergeTargets.length > 1 || !merge.current ? mergeFields : null}
          </BlockStack>
        ) : (
        <ChoiceList
          title="Handle as"
          titleHidden
          selected={[choice]}
          onChange={([v]) => onChoice(v)}
          choices={[
            {
              label: 'Merge',
              value: 'merge',
              helpText: mergeHelp,
              // Nothing to pick when they're already a contact there and there's one company.
              renderChildren: (on) => (on && (dup.mergeTargets.length > 1 || !merge.current) ? mergeFields : null),
            },
            other,
          ]}
        />
        )}
        {actions}
      </BlockStack>
    </Card>
  );
}

// The decision, side by side at the bottom of the side card: Decline, then the
// primary action (Approve / Merge / Create …).
function DecisionActions({ primary, onDecline }) {
  return (
    <BlockStack gap="300">
      <Divider />
      <InlineStack align="end" gap="200">
        <Button tone="critical" onClick={onDecline}>Decline</Button>
        <Button variant="primary" onClick={primary.onAction}>{primary.content}</Button>
      </InlineStack>
    </BlockStack>
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
