import React, { useEffect, useState } from 'react';
import { useStore } from '../store.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { Modal, IndexFiltersBar, useWcId, wcTone } from '../../shared/wc.jsx';
import registrationArt from '../assets/registration-empty.webp';
import noRequestArt from '../assets/no-request.webp';
import { REG_STATUS, fullName, fmtDate, registrationDuplicates } from '../registrations.js';

// Wholesale B2B → Registrations: what buyers submitted through the storefront
// registration form, waiting for the merchant to review. Opening a row leads to
// the review (approve into a new Company / decline); selecting rows allows bulk
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
  const rowId = useWcId('registration');
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
  // Existing-record matches for a pending registration (null otherwise).
  const dupOf = (r) => (r.status === 'pending' ? registrationDuplicates(state.db, r) : null);
  const devTools = SHOW_DEV_TOOLS && (
    <DevTools disabled={!state.db.hasRegistrationForm} on={devNoForm} onToggle={() => setDevNoForm((v) => !v)} />
  );

  const filter = FILTERS.some((f) => f.id === state.registrationFilter) ? state.registrationFilter : 'pending';
  const count = (id) => (id === 'all' ? all.length : all.filter((r) => r.status === id).length);
  const tabs = FILTERS.map((f) => ({ id: `r-${f.id}`, content: `${f.label} (${count(f.id)})` }));

  const [sortField, sortDir] = (state.registrationSort || 'submitted desc').split(' ');
  const q = (state.registrationSearch || '').trim().toLowerCase();
  const rows = all
    .filter((r) => filter === 'all' || r.status === filter)
    .filter((r) => !q || [fullName(r), r.email, r.company, r.country, r.taxId].join(' ').toLowerCase().includes(q))
    .sort(SORT_BY[sortField] || SORT_BY.submitted);
  if (sortDir === 'desc') rows.reverse();

  // Row selection (the leading checkbox column) — ids of the selected registrations.
  const [selectedIds, setSelectedIds] = useState([]);
  const clearSelection = () => setSelectedIds([]);
  // A new tab / search shows different rows — don't carry a selection across.
  useEffect(() => { clearSelection(); }, [filter, q]); // eslint-disable-line react-hooks/exhaustive-deps

  if (all.length === 0) {
    return (
      <s-page heading="Registrations" inlineSize="large">
        {devTools}
        <s-section>
          {hasForm ? (
            <EmptyBlock heading="No registrations yet" action={formAction} image={registrationArt}>
              When buyers apply for B2B access through your registration form, their applications show up here for you to review.
            </EmptyBlock>
          ) : (
            <EmptyBlock heading="No registration forms yet" action={formAction} image={registrationArt}>
              Create a registration form to start collecting B2B customer applications.
            </EmptyBlock>
          )}
        </s-section>
      </s-page>
    );
  }

  // Bulk actions: approve / decline apply to the pending rows in the selection.
  const selected = rows.filter((r) => selectedIds.includes(r.id));
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const pendingIds = selected.filter((r) => r.status === 'pending').map((r) => r.id);
  const ask = (kind, ids) => setConfirm({ kind, ids });
  const promotedBulkActions = pendingIds.length
    ? [
      { content: pendingIds.length === selected.length ? 'Approve' : `Approve ${pendingIds.length} pending`, onAction: () => ask('approve', pendingIds) },
      { content: pendingIds.length === selected.length ? 'Decline' : `Decline ${pendingIds.length} pending`, onAction: () => ask('decline', pendingIds) },
    ]
    : [];
  const bulkActions = [{ content: 'Delete registrations', destructive: true, onAction: () => ask('delete', selected.map((r) => r.id)) }];
  // Checkbox handlers always SET from the checkbox's state (change can fire twice).
  const selectAll = (on) => setSelectedIds(on ? rows.map((r) => r.id) : []);
  const selectRow = (id, on) =>
    setSelectedIds((ids) => (on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id)));

  const runConfirm = () => {
    const type = { approve: 'APPROVE_REGISTRATIONS', decline: 'DECLINE_REGISTRATIONS', delete: 'DELETE_REGISTRATIONS' }[confirm.kind];
    dispatch({ type, ids: confirm.ids });
    setConfirm(null);
    clearSelection();
  };

  return (
    <s-page heading="Registrations" inlineSize="large">
      <s-button slot="secondary-actions" onClick={editForm}>
        Edit form
      </s-button>
      <s-box paddingBlockEnd="small">
        <s-paragraph color="subdued">Buyers who applied for B2B access through your registration form</s-paragraph>
      </s-box>
      {devTools}
      <s-section padding="none">
        <s-table>
          <IndexFiltersBar
            slot="filters"
            query={state.registrationSearch}
            queryPlaceholder="Search by name, email, company or tax ID"
            onQueryChange={(v) => dispatch({ type: 'SET_REGISTRATION_SEARCH', value: v })}
            tabs={tabs}
            selected={FILTERS.findIndex((f) => f.id === filter)}
            onSelect={(i) => dispatch({ type: 'SET_REGISTRATION_FILTER', filter: FILTERS[i].id })}
            sortOptions={SORT_OPTIONS}
            sortSelected={`${sortField} ${sortDir}`}
            onSort={(val) => dispatch({ type: 'SET_REGISTRATION_SORT', value: val || 'submitted desc' })}
          >
            {selected.length > 0 ? (
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text fontWeight="semibold">{`${selected.length} selected`}</s-text>
                {promotedBulkActions.map((a) => (
                  <s-button key={a.content} onClick={a.onAction}>
                    {a.content}
                  </s-button>
                ))}
                {bulkActions.map((a) => (
                  <s-button key={a.content} tone={a.destructive ? 'critical' : undefined} onClick={a.onAction}>
                    {a.content}
                  </s-button>
                ))}
              </s-stack>
            ) : null}
          </IndexFiltersBar>
          <s-table-header-row>
            <s-table-header listSlot="inline">
              <s-checkbox
                accessibilityLabel={allSelected ? 'Deselect all registrations' : 'Select all registrations'}
                checked={allSelected}
                indeterminate={selected.length > 0 && !allSelected}
                disabled={rows.length === 0}
                onChange={(e) => selectAll(e.currentTarget.checked)}
              />
            </s-table-header>
            <s-table-header listSlot="primary">Applicant</s-table-header>
            <s-table-header listSlot="labeled">Company</s-table-header>
            <s-table-header listSlot="labeled">Country</s-table-header>
            <s-table-header listSlot="labeled">Submitted from</s-table-header>
            <s-table-header listSlot="labeled">Submitted</s-table-header>
            <s-table-header listSlot="labeled">Company match</s-table-header>
            <s-table-header listSlot="secondary">Status</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {rows.map((r) => {
              const status = REG_STATUS[r.status];
              const linked = r.companyId && companies.find((c) => c.id === r.companyId);
              const linkId = `${rowId}-${r.id}`;
              return (
                <s-table-row key={r.id} clickDelegate={linkId}>
                  <s-table-cell>
                    <s-checkbox
                      accessibilityLabel={`Select ${fullName(r)}`}
                      checked={selectedIds.includes(r.id)}
                      onChange={(e) => selectRow(r.id, e.currentTarget.checked)}
                    />
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack gap="small-500">
                      <s-link id={linkId} onClick={() => open(r.id)}>
                        {fullName(r)}
                      </s-link>
                      <s-text fontSize="small" color="subdued">{r.email}</s-text>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    {/* Pending matches: an existing contact (same or other company) or a same-name company — the merchant decides.
                        Info tone — it's something the app found, not an error, and yellow would blur
                        into the Pending review status badge on the same row. */}
                    <s-stack direction="inline" gap="small-300" alignItems="center">
                      <s-text>{r.company}</s-text>
                      {dupOf(r)?.kind === 'company' ? <s-badge tone="info">Duplicate</s-badge> : null}
                      {dupOf(r)?.kind === 'contact' || dupOf(r)?.kind === 'same' ? <s-badge tone="info">Existing contact</s-badge> : null}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{r.country || '—'}</s-table-cell>
                  <s-table-cell>
                    <s-text fontSize="small">{r.source}</s-text>
                  </s-table-cell>
                  <s-table-cell>
                    <s-text fontSize="small">{fmtDate(r.submittedAt)}</s-text>
                  </s-table-cell>
                  <s-table-cell>
                    {linked ? (
                      <s-text fontSize="small">{linked.name}</s-text>
                    ) : (
                      <s-text fontSize="small" color="subdued">
                        {r.status !== 'pending'
                          ? '—'
                          : dupOf(r)?.kind === 'company'
                            ? `Matches ${dupOf(r).company.name}`
                            : dupOf(r)?.kind === 'contact' || dupOf(r)?.kind === 'same'
                              ? `Contact at ${dupOf(r).contactOf.name}`
                              : 'New company'}
                      </s-text>
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={wcTone(status.tone)}>{status.label}</s-badge>
                  </s-table-cell>
                </s-table-row>
              );
            })}
          </s-table-body>
        </s-table>
        {rows.length === 0 ? (
          q ? (
            <EmptyBlock image={noRequestArt} imageAlt="" heading="No registrations match your search" />
          ) : (
            <EmptyBlock heading={hasForm ? EMPTY_TAB[filter] : 'No registration forms yet'} action={formAction}>
              {hasForm ? 'Applications from your registration form show up here.' : 'Create a registration form to start collecting B2B customer applications.'}
            </EmptyBlock>
          )
        ) : null}
      </s-section>

      {confirm && (
        <ConfirmBulk
          kind={confirm.kind}
          regs={all.filter((r) => confirm.ids.includes(r.id))}
          duplicates={all.filter((r) => confirm.ids.includes(r.id) && dupOf(r)?.blocking).length}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </s-page>
  );
}

// Confirms a bulk action and lists the registrations it applies to.
function ConfirmBulk({ kind, regs, duplicates = 0, onConfirm, onClose }) {
  const n = regs.length;
  const noun = n === 1 ? 'registration' : `${n} registrations`;
  const copy = {
    approve: {
      title: `Approve ${noun}?`,
      action: 'Approve',
      body: `A new company is created for each buyer. You can set up pricing afterwards.${
        duplicates ? ` ${duplicates} ${duplicates === 1 ? 'registration matches' : 'registrations match'} an existing company or contact and ${duplicates === 1 ? 'is' : 'are'} skipped — open ${duplicates === 1 ? 'it' : 'them'} to resolve.` : ''
      }`,
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
    <Modal onClose={onClose} heading={copy.title}>
      <s-stack gap="small">
        <s-paragraph>{copy.body}</s-paragraph>
        <s-unordered-list>
          {regs.map((r) => (
            <s-list-item key={r.id}>
              {fullName(r)} · {r.company}
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-stack>
      <s-button slot="primary-action" variant="primary" tone={kind !== 'approve' ? 'critical' : undefined} onClick={onConfirm}>
        {copy.action}
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

// Dev-only strip (same pattern as Analytics): preview the empty state as it looks
// before any registration form exists (it offers Create form). The "form exists,
// no requests" case needs no toggle — delete the registrations to see it.
function DevTools({ disabled, on, onToggle }) {
  return (
    <s-box paddingBlockEnd="base">
      <s-box background="subdued" border="base" borderRadius="base" padding="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone="info">Dev</s-badge>
          <s-text fontSize="small" color="subdued">
            {disabled
              ? 'No registration form exists, so the empty state already offers Create form.'
              : on
              ? 'Previewing the empty state with no registration form — it offers Create form.'
              : 'Preview the empty state before a registration form exists.'}
          </s-text>
          <s-press-button pressed={on} disabled={disabled} onClick={onToggle}>
            {on ? 'Show data' : 'Preview no form'}
          </s-press-button>
        </s-stack>
      </s-box>
    </s-box>
  );
}
