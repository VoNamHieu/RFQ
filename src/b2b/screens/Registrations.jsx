import React, { useEffect, useState } from 'react';
import { useStore } from '../store.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { Modal, IndexFiltersBar } from '../../shared/wc.jsx';
import registrationArt from '../assets/registration-empty.webp';
import noRequestArt from '../assets/no-request.webp';
import { REG_STATUS, fullName, fmtDate, registrationDuplicates, isD2CRegistration } from '../registrations.js';
import { DevStrip } from '../../shared/DevStrip.jsx';
import { CdPageHead, StatusDot } from '../components/companyLayout.jsx';

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

  // The page's top, in the company page's look: the title (with its grey line once there
  // are registrations) and Edit form / Create form on the right.
  const header = (
    <CdPageHead
      title="Registrations"
      subtitle={all.length ? 'Buyers who applied through your registration form' : null}
      actions={all.length ? <s-button onClick={formAction.onAction}>{formAction.content}</s-button> : null}
    />
  );

  if (all.length === 0) {
    return (
      <div className="cd-page">
        {header}
        {devTools}
        <div className="cd-card">
          <div className="cd-card__body">
            {hasForm ? (
              <EmptyBlock heading="No registrations yet" action={formAction} image={registrationArt}>
                When buyers apply for B2B access through your registration form, their applications show up here for you to review.
              </EmptyBlock>
            ) : (
              <EmptyBlock heading="No registration forms yet" action={formAction} image={registrationArt}>
                Create a registration form to start collecting B2B customer applications.
              </EmptyBlock>
            )}
          </div>
        </div>
      </div>
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

  // While rows are selected the column headings give way to "N selected" and the bulk
  // actions, as in the company list (.cd-bulk-bar), so the table doesn't move.
  const bulk = selected.length > 0;
  const heading = (label) => (bulk ? <span className="cd-bulk-hidden">{label}</span> : label);
  const bulkBar = (
    <span className="cd-bulk-bar">
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
    </span>
  );
  // A row's checkbox doesn't open the registration.
  const own = (e) => e.stopPropagation();

  // The list in a bordered card: tabs, search and sort on top, then a plain table.
  return (
    <div className="cd-page">
      {header}
      {devTools}
      <div className="cd-card">
        <div className="cd-card__filters">
          <IndexFiltersBar
            query={state.registrationSearch}
            queryPlaceholder="Search by name, email, company or tax ID"
            onQueryChange={(v) => dispatch({ type: 'SET_REGISTRATION_SEARCH', value: v })}
            tabs={tabs}
            selected={FILTERS.findIndex((f) => f.id === filter)}
            onSelect={(i) => dispatch({ type: 'SET_REGISTRATION_FILTER', filter: FILTERS[i].id })}
            sortOptions={SORT_OPTIONS}
            sortSelected={`${sortField} ${sortDir}`}
            onSort={(val) => dispatch({ type: 'SET_REGISTRATION_SORT', value: val || 'submitted desc' })}
          />
        </div>
        {rows.length ? (
          <div className="cd-table-scroll">
            <table className="cd-table">
              <thead>
                <tr>
                  <th className="cd-check">
                    <s-checkbox
                      accessibilityLabel={allSelected ? 'Deselect all registrations' : 'Select all registrations'}
                      checked={allSelected}
                      indeterminate={bulk && !allSelected}
                      onChange={(e) => selectAll(e.currentTarget.checked)}
                    />
                  </th>
                  <th>{bulk ? bulkBar : 'Applicant'}</th>
                  <th>{heading('Company')}</th>
                  <th>{heading('Country')}</th>
                  <th>{heading('Submitted from')}</th>
                  <th>{heading('Submitted')}</th>
                  <th>{heading('Company match')}</th>
                  <th>{heading('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {/* The row opens the registration; the applicant's name is the keyboard target (the click bubbles up). */}
                {rows.map((r) => {
                  const status = REG_STATUS[r.status];
                  const linked = r.companyId && companies.find((c) => c.id === r.companyId);
                  return (
                    <tr key={r.id} className="cd-row-link" onClick={() => open(r.id)}>
                      <td className="cd-check" onClick={own}>
                        <s-checkbox
                          accessibilityLabel={`Select ${fullName(r)}`}
                          checked={selectedIds.includes(r.id)}
                          onChange={(e) => selectRow(r.id, e.currentTarget.checked)}
                        />
                      </td>
                      <td>
                        <button type="button" className="cd-link-button">
                          {fullName(r)}
                        </button>
                        <span className="cd-sub">{r.email}</span>
                      </td>
                      <td>
                        {/* Pending matches: an existing contact (same or other company) or a same-name company — the merchant decides.
                            Info tone — it's something the app found, not an error. */}
                        <span className="cd-inline">
                          {isD2CRegistration(r) ? <span className="cd-muted">No company · D2C</span> : <span>{r.company}</span>}
                          {dupOf(r)?.kind === 'company' ? <s-badge tone="info">Duplicate</s-badge> : null}
                          {dupOf(r)?.kind === 'contact' || dupOf(r)?.kind === 'same' ? <s-badge tone="info">Existing contact</s-badge> : null}
                          {isD2CRegistration(r) && dupOf(r)?.kind === 'customer' ? <s-badge tone="info">Existing customer</s-badge> : null}
                        </span>
                      </td>
                      <td>{r.country || '—'}</td>
                      <td className="cd-nowrap">{r.source}</td>
                      <td className="cd-nowrap">{fmtDate(r.submittedAt)}</td>
                      <td>
                        {linked ? (
                          linked.name
                        ) : (
                          <span className="cd-muted">
                            {r.status !== 'pending'
                              ? r.customerId ? 'D2C customer' : '—'
                              : dupOf(r)?.kind === 'company'
                                ? `Matches ${dupOf(r).company.name}`
                                : dupOf(r)?.kind === 'contact' || dupOf(r)?.kind === 'same'
                                  ? `Contact at ${dupOf(r).contactOf.name}`
                                  : isD2CRegistration(r)
                                    ? dupOf(r)?.customer ? 'Existing customer' : 'New customer'
                                    : 'New company'}
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusDot tone={status.tone}>{status.label}</StatusDot>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cd-card__body">
            {q ? (
              <EmptyBlock image={noRequestArt} imageAlt="" heading="No registrations match your search" />
            ) : (
              <EmptyBlock heading={hasForm ? EMPTY_TAB[filter] : 'No registration forms yet'} action={formAction}>
                {hasForm ? 'Applications from your registration form show up here.' : 'Create a registration form to start collecting B2B customer applications.'}
              </EmptyBlock>
            )}
          </div>
        )}
      </div>

      {confirm && (
        <ConfirmBulk
          kind={confirm.kind}
          regs={all.filter((r) => confirm.ids.includes(r.id))}
          duplicates={all.filter((r) => confirm.ids.includes(r.id) && dupOf(r)?.blocking).length}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// Confirms a bulk action and lists the registrations it applies to.
function ConfirmBulk({ kind, regs, duplicates = 0, onConfirm, onClose }) {
  const n = regs.length;
  const noun = n === 1 ? 'registration' : `${n} registrations`;
  // Buyers with a company name get a new company; D2C buyers (none) become customers.
  const d2c = regs.filter(isD2CRegistration).length;
  const approveBody = !d2c
    ? 'A new company is created for each buyer. You can set up pricing afterwards.'
    : d2c === n
      ? `${n === 1 ? 'The buyer becomes a' : 'Each buyer becomes a'} D2C customer in Shopify, in no company.`
      : 'Buyers with a company name get a new company; the others become D2C customers in Shopify, in no company.';
  const copy = {
    approve: {
      title: `Approve ${noun}?`,
      action: 'Approve',
      body: `${approveBody}${
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
      body: 'This removes the submissions from Registrations. Companies and customers already created from approved registrations are kept.',
    },
  }[kind];
  return (
    <Modal onClose={onClose} heading={copy.title}>
      <s-stack gap="small">
        <s-paragraph>{copy.body}</s-paragraph>
        <s-unordered-list>
          {regs.map((r) => (
            <s-list-item key={r.id}>
              {fullName(r)} · {isD2CRegistration(r) ? 'D2C' : r.company}
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
    <DevStrip id="registrations" spaced>
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
    </DevStrip>
  );
}
