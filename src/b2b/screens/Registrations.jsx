import React, { useEffect, useState } from 'react';
import {
  Page, Card, IndexTable, IndexFilters, useSetIndexFiltersMode, useIndexResourceState, Badge, Text, BlockStack, InlineStack, Box, Button, Modal, List,
} from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import registrationArt from '../assets/registration-empty.webp';
import { REG_STATUS, fullName, fmtDate, matchCompany } from '../registrations.js';

// Wholesale B2B → Registrations: what buyers submitted through the storefront
// registration form, waiting for the merchant to review. Opening a row leads to
// the review (match Company → approve / decline); selecting rows allows bulk
// approve / decline / delete. The form itself is one click away ("Edit form").

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending review' },
  { id: 'approved', label: 'Approved' },
  { id: 'declined', label: 'Declined' },
];
const EMPTY_TAB = {
  pending: 'No registrations to review',
  approved: 'No approved registrations',
  declined: 'No declined registrations',
  all: 'No registrations yet',
};
// Prototype: show the dev toggles in production too (flip to import.meta.env.DEV to hide in prod).
const SHOW_DEV_TOOLS = true;

const SORT_OPTIONS = [
  { label: 'Submitted', value: 'submitted desc', directionLabel: 'Newest first' },
  { label: 'Submitted', value: 'submitted asc', directionLabel: 'Oldest first' },
  { label: 'Applicant', value: 'name asc', directionLabel: 'A to Z' },
  { label: 'Applicant', value: 'name desc', directionLabel: 'Z to A' },
  { label: 'Company', value: 'company asc', directionLabel: 'A to Z' },
  { label: 'Company', value: 'company desc', directionLabel: 'Z to A' },
  { label: 'Country', value: 'country asc', directionLabel: 'A to Z' },
  { label: 'Country', value: 'country desc', directionLabel: 'Z to A' },
];
const SORT_BY = {
  submitted: (a, b) => a.submittedAt.localeCompare(b.submittedAt),
  name: (a, b) => fullName(a).localeCompare(fullName(b)),
  company: (a, b) => a.company.localeCompare(b.company),
  country: (a, b) => (a.country || '').localeCompare(b.country || '') || a.company.localeCompare(b.company),
};

export function Registrations() {
  const { state, dispatch } = useStore();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [confirm, setConfirm] = useState(null); // { kind: 'approve' | 'decline' | 'delete', ids }
  const [devNoForm, setDevNoForm] = useState(false); // dev-only: preview the empty state before any form exists
  const all = devNoForm ? [] : state.db.registrations || [];
  const hasForm = !!state.db.hasRegistrationForm && !devNoForm;
  const companies = state.db.companies;
  const editForm = () => dispatch({ type: 'NAVIGATE', view: 'form', patch: { formEntry: 'editor' } });
  // Empty list / tab: straight into the form builder's create flow (template → editor).
  const createForm = () => dispatch({ type: 'NAVIGATE', view: 'form', patch: { formEntry: 'create' } });
  // No requests to show: create the form if there isn't one yet, otherwise edit it.
  const formAction = hasForm
    ? { content: 'Edit form', onAction: editForm }
    : { content: 'Create form', onAction: createForm };
  const open = (id) => dispatch({ type: 'OPEN_REGISTRATION', id });
  const devTools = SHOW_DEV_TOOLS && (
    <DevTools disabled={!state.db.hasRegistrationForm} on={devNoForm} onToggle={() => setDevNoForm((v) => !v)} />
  );

  const filter = FILTERS.some((f) => f.id === state.registrationFilter) ? state.registrationFilter : 'pending';
  const count = (id) => (id === 'all' ? all.length : all.filter((r) => r.status === id).length);
  const tabs = FILTERS.map((f, i) => ({ id: `r-${f.id}`, content: `${f.label} (${count(f.id)})`, index: i }));

  const [sortField, sortDir] = (state.registrationSort || 'submitted desc').split(' ');
  const q = (state.registrationSearch || '').trim().toLowerCase();
  const rows = all
    .filter((r) => filter === 'all' || r.status === filter)
    .filter((r) => !q || [fullName(r), r.email, r.company, r.country, r.taxId].join(' ').toLowerCase().includes(q))
    .sort(SORT_BY[sortField] || SORT_BY.submitted);
  if (sortDir === 'desc') rows.reverse();

  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(rows.map((r) => ({ id: r.id })));
  // A new tab / search shows different rows — don't carry a selection across.
  useEffect(() => { clearSelection(); }, [filter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  if (all.length === 0) {
    return (
      <Page fullWidth title="Registrations">
        {devTools}
        <Card>
          {hasForm ? (
            <EmptyBlock heading="No registrations yet" action={formAction} image={registrationArt}>
              When buyers apply for B2B access through your registration form, their applications show up here for you to review.
            </EmptyBlock>
          ) : (
            <EmptyBlock heading="No registration forms yet" action={formAction} image={registrationArt}>
              Create a registration form to start collecting B2B customer applications.
            </EmptyBlock>
          )}
        </Card>
      </Page>
    );
  }

  // Bulk actions: approve / decline apply to the pending rows in the selection.
  const selected = rows.filter((r) => selectedResources.includes(r.id));
  const pendingIds = selected.filter((r) => r.status === 'pending').map((r) => r.id);
  const ask = (kind, ids) => setConfirm({ kind, ids });
  const promotedBulkActions = pendingIds.length
    ? [
      { content: pendingIds.length === selected.length ? 'Approve' : `Approve ${pendingIds.length} pending`, onAction: () => ask('approve', pendingIds) },
      { content: pendingIds.length === selected.length ? 'Decline' : `Decline ${pendingIds.length} pending`, onAction: () => ask('decline', pendingIds) },
    ]
    : [];
  const bulkActions = [{ content: 'Delete registrations', destructive: true, onAction: () => ask('delete', selected.map((r) => r.id)) }];

  const runConfirm = () => {
    const type = { approve: 'APPROVE_REGISTRATIONS', decline: 'DECLINE_REGISTRATIONS', delete: 'DELETE_REGISTRATIONS' }[confirm.kind];
    dispatch({ type, ids: confirm.ids });
    setConfirm(null);
    clearSelection();
  };

  return (
    <Page
      fullWidth
      title="Registrations"
      subtitle="Buyers who applied for B2B access through your registration form"
      secondaryActions={[{ content: 'Edit form', onAction: editForm }]}
    >
      {devTools}
      <Card padding="0">
        <IndexFilters
          queryValue={state.registrationSearch}
          queryPlaceholder="Search by name, email, company or tax ID"
          onQueryChange={(v) => dispatch({ type: 'SET_REGISTRATION_SEARCH', value: v })}
          onQueryClear={() => dispatch({ type: 'SET_REGISTRATION_SEARCH', value: '' })}
          tabs={tabs}
          selected={FILTERS.findIndex((f) => f.id === filter)}
          onSelect={(i) => dispatch({ type: 'SET_REGISTRATION_FILTER', filter: FILTERS[i].id })}
          sortOptions={SORT_OPTIONS}
          sortSelected={[`${sortField} ${sortDir}`]}
          onSort={(val) => dispatch({ type: 'SET_REGISTRATION_SORT', value: val[0] || 'submitted desc' })}
          filters={[]}
          appliedFilters={[]}
          onClearAll={() => {}}
          mode={mode}
          setMode={setMode}
          cancelAction={{ onAction: () => dispatch({ type: 'SET_REGISTRATION_SEARCH', value: '' }) }}
          canCreateNewView={false}
        />
        <IndexTable
          resourceName={{ singular: 'registration', plural: 'registrations' }}
          itemCount={rows.length}
          selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          promotedBulkActions={promotedBulkActions}
          bulkActions={bulkActions}
          headings={[
            { title: 'Applicant' },
            { title: 'Company' },
            { title: 'Country' },
            { title: 'Submitted from' },
            { title: 'Submitted' },
            { title: 'Company match' },
            { title: 'Status' },
          ]}
          emptyState={
            q ? (
              <Box padding="400">
                <Text as="p" alignment="center" tone="subdued">No registrations match your search.</Text>
              </Box>
            ) : (
              <EmptyBlock heading={hasForm ? EMPTY_TAB[filter] : 'No registration forms yet'} action={formAction}>
                {hasForm ? 'Applications from your registration form show up here.' : 'Create a registration form to start collecting B2B customer applications.'}
              </EmptyBlock>
            )
          }
        >
          {rows.map((r, i) => {
            const status = REG_STATUS[r.status];
            const linked = r.companyId && companies.find((c) => c.id === r.companyId);
            const match = r.status === 'pending' ? matchCompany(r, companies) : null;
            return (
              <IndexTable.Row id={r.id} key={r.id} position={i} selected={selectedResources.includes(r.id)} onClick={() => open(r.id)}>
                <IndexTable.Cell>
                  <BlockStack gap="050">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">{fullName(r)}</Text>
                    <Text as="span" variant="bodySm" tone="subdued">{r.email}</Text>
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>{r.company}</IndexTable.Cell>
                <IndexTable.Cell>{r.country || '—'}</IndexTable.Cell>
                <IndexTable.Cell><Text as="span" variant="bodySm">{r.source}</Text></IndexTable.Cell>
                <IndexTable.Cell><Text as="span" variant="bodySm">{fmtDate(r.submittedAt)}</Text></IndexTable.Cell>
                <IndexTable.Cell>
                  {linked ? (
                    <Text as="span" variant="bodySm">{linked.name}</Text>
                  ) : match ? (
                    <Text as="span" variant="bodySm">
                      {match.company.name} <Text as="span" variant="bodySm" tone="subdued">· suggested</Text>
                    </Text>
                  ) : (
                    <Text as="span" variant="bodySm" tone="subdued">{r.status === 'pending' ? 'New company' : '—'}</Text>
                  )}
                </IndexTable.Cell>
                <IndexTable.Cell><Badge tone={status.tone}>{status.label}</Badge></IndexTable.Cell>
              </IndexTable.Row>
            );
          })}
        </IndexTable>
      </Card>

      {confirm && (
        <ConfirmBulk
          kind={confirm.kind}
          regs={all.filter((r) => confirm.ids.includes(r.id))}
          companies={companies}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </Page>
  );
}

// Confirms a bulk action and spells out what happens to each registration —
// for approve, which Company each buyer ends up in.
function ConfirmBulk({ kind, regs, companies, onConfirm, onClose }) {
  const n = regs.length;
  const noun = n === 1 ? 'registration' : `${n} registrations`;
  const copy = {
    approve: {
      title: `Approve ${noun}?`,
      action: 'Approve',
      body: 'Each buyer joins their suggested company, or a new company is created for them. You can set up pricing afterwards.',
    },
    decline: {
      title: `Decline ${noun}?`,
      action: 'Decline',
      body: `${n === 1 ? 'This buyer won’t' : 'These buyers won’t'} get B2B access or pricing.`,
    },
    delete: {
      title: `Delete ${noun}?`,
      action: 'Delete',
      body: 'This removes the submissions from Registrations. Companies already created from approved registrations are kept.',
    },
  }[kind];
  return (
    <Modal
      open
      onClose={onClose}
      title={copy.title}
      primaryAction={{ content: copy.action, destructive: kind !== 'approve', onAction: onConfirm }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p">{copy.body}</Text>
          <List type="bullet">
            {regs.map((r) => {
              const match = kind === 'approve' ? matchCompany(r, companies) : null;
              return (
                <List.Item key={r.id}>
                  {fullName(r)} · {r.company}
                  {kind === 'approve' && (
                    <Text as="span" tone="subdued"> → {match ? match.company.name : 'new company'}</Text>
                  )}
                </List.Item>
              );
            })}
          </List>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// Dev-only strip (same pattern as Analytics): preview the empty state as it looks
// before any registration form exists (it offers Create form). The "form exists,
// no requests" case needs no toggle — delete the registrations to see it.
function DevTools({ disabled, on, onToggle }) {
  return (
    <Box paddingBlockEnd="400">
      <Box background="bg-surface-secondary" borderColor="border" borderWidth="025" borderRadius="200" padding="200">
        <InlineStack gap="200" blockAlign="center" wrap>
          <Badge tone="info">Dev</Badge>
          <Text as="span" variant="bodySm" tone="subdued">
            {disabled
              ? 'No registration form exists, so the empty state already offers Create form.'
              : on
              ? 'Previewing the empty state with no registration form — it offers Create form.'
              : 'Preview the empty state before a registration form exists.'}
          </Text>
          <Button size="slim" pressed={on} disabled={disabled} onClick={onToggle}>
            {on ? 'Show data' : 'Preview no form'}
          </Button>
        </InlineStack>
      </Box>
    </Box>
  );
}
