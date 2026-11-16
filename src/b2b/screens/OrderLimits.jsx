import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitTargetsLabel, isLimitAssigned, isD2CLimit, limitOverlaps, limitState } from '../limits.js';
import { LimitEditor, withCatalog, deleteLimitText } from '../components/LimitEditor.jsx';
import { LimitOverlapMessage } from '../components/LimitOverlapList.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { Modal, IndexFiltersBar, useWcId } from '../../shared/wc.jsx';
import { CdPageHead, StatusDot } from '../components/companyLayout.jsx';
import { fmtDay, isContractTerm } from '../agreements.js';
import { termsBack } from './ContractsAndLimits.jsx';

// Tabs by who a limit is for, like the Pricing list; the kind is a filter.
const AUDIENCE = [
  { id: 'all', label: 'All' },
  { id: 'b2b', label: 'Companies' },
  { id: 'd2c', label: 'Customers' },
];
// Status dot, by limitState: turned off, not started yet, applying, or past its end date.
const STATE_TONE = { Active: 'success', Upcoming: 'info', Expired: undefined, Inactive: undefined };
const TYPE_CHOICES = [
  { label: 'All types', value: 'all' },
  ...Object.entries(LIMIT_KINDS).map(([value, k]) => ({ label: k.label, value })),
];

// Full-page "Select limit type" step shown before the editor, like Select
// pricing type: pick a kind's card, then set it up. The back action returns to the list.
function LimitTypeChooser({ onBack, onPick, backLabel = 'Order limits' }) {
  // The company page's look: back on top, the title, then a card per kind.
  return (
    <div className="cd-page">
      <CdPageHead title="Select limit type" back={{ label: backLabel, onAction: onBack }} />
      <div className="cd-card-grid">
        {Object.entries(LIMIT_KINDS).map(([kind, k]) => (
          <div key={kind} className="cd-card">
            <div className="cd-card__body cd-terms-card">
              <div>
                <h2 className="cd-section__title">{k.label}</h2>
                <p className="cd-section__subtitle">{k.description}</p>
              </div>
              <s-stack direction="inline">
                <s-button onClick={() => onPick(kind)}>Create limit</s-button>
              </s-stack>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Order limits library: every limit with what it sets and who it applies to.
// Create limit opens the type chooser; the editor opens as a page here (OPEN_LIMIT_EDITOR).
export function OrderLimits() {
  const { state, dispatch } = useStore();
  const [audience, setAudience] = useState('all');
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const rowId = useWcId('limit');

  if (state.limitEditor) return <LimitEditor />;
  // From the contract editor's Add → Create new (state.limitChooser): the kind, then a
  // limit of the contract's own that goes into it; back returns there.
  const fromContract = state.limitChooser;
  if (fromContract) {
    return (
      <LimitTypeChooser
        backLabel="Contract"
        onBack={() => dispatch({ type: 'NAVIGATE', view: 'limits', patch: { limitChooser: null, ...(fromContract.returnTo || {}) } })}
        onPick={(kind) =>
          dispatch({ type: 'OPEN_LIMIT_EDITOR', kind, preset: { forContracts: true }, returnTo: fromContract.returnTo, contractTerm: true })
        }
      />
    );
  }
  // "Create limit" opens the type chooser first; picking a card opens the editor.
  if (chooserOpen) {
    return (
      <LimitTypeChooser
        onBack={() => setChooserOpen(false)}
        onPick={(kind) => {
          setChooserOpen(false);
          dispatch({ type: 'OPEN_LIMIT_EDITOR', kind });
        }}
      />
    );
  }

  // A contract's own limit is only in its contract (edited in the contract editor).
  const all = (state.db.limits || []).filter((l) => !isContractTerm(l));
  const create = { content: 'Create limit', onAction: () => setChooserOpen(true) };
  // A list of Orders & rules: back to it (or to the company or location page it was
  // opened from). Run tests opens the order-limit test console (#/b2b/order-limit-tests).
  // In the company page's look: back, the title with Run tests and Create limit.
  const header = (
    <CdPageHead
      title="Order limits"
      subtitle="Rules on what B2B buyers and D2C wholesale customers can check out, checked in the cart and at checkout."
      back={termsBack(state, dispatch, 'limits')}
      actions={
        <>
          <s-button onClick={() => dispatch({ type: 'NAVIGATE', view: 'limitTests' })}>Run tests</s-button>
          <s-button variant="primary" onClick={create.onAction}>
            {create.content}
          </s-button>
        </>
      }
    />
  );
  if (!all.length) {
    return (
      <div className="cd-page">
        {header}
        <div className="cd-card">
          <div className="cd-card__body">
            <EmptyBlock heading="Set rules for what buyers can order" action={create}>
              Require a minimum order, sell products in case packs, or review large orders before they go through. Apply a limit to B2B companies and locations, or to D2C wholesale customers.
            </EmptyBlock>
          </div>
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const tabOf = (l) => (isD2CLimit(l) ? 'd2c' : 'b2b');
  const limits = all
    .filter((l) => audience === 'all' || tabOf(l) === audience)
    .filter((l) => (type === 'all' || l.kind === type) && (!q || l.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const edit = (l) => dispatch({ type: 'OPEN_LIMIT_EDITOR', limit: l });
  // Turning a limit on: the other limits it overlaps are shown first, as when
  // saving it — notes, it still turns on. Turning one off needs no check.
  const toggle = (l) => {
    const found = l.status === 'Active' ? [] : limitOverlaps(withCatalog(state.db), { ...l, status: 'Active' }).filter((o) => !o.soft);
    if (found.length) setConfirmToggle({ limit: l, overlaps: found });
    else dispatch({ type: 'TOGGLE_LIMIT_STATUS', id: l.id });
  };

  // The list in a bordered card: tabs, search and the type filter on top, a plain table.
  return (
    <div className="cd-page">
      {header}
      <div className="cd-card">
        <div className="cd-card__filters">
          <IndexFiltersBar
            query={search}
            queryPlaceholder="Search limits by name"
            onQueryChange={setSearch}
            tabs={AUDIENCE.map((a) => ({ id: `aud-${a.id}`, content: a.label }))}
            selected={Math.max(0, AUDIENCE.findIndex((a) => a.id === audience))}
            onSelect={(i) => setAudience(AUDIENCE[i].id)}
            filters={[{ key: 'kind', label: 'Limit type', choices: TYPE_CHOICES, value: type, defaultValue: 'all' }]}
            onFilterChange={(key, v) => setType(v)}
            onClearAll={() => setType('all')}
          />
        </div>
        {limits.length ? (
          <div className="cd-table-scroll">
            <table className="cd-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Applies to</th>
                  <th>Latest updates</th>
                  <th>Status</th>
                  <th className="cd-actions">
                    <span className="cd-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {limits.map((l) => {
                  const isOff = l.status !== 'Active';
                  const id = `${rowId}-${l.id}`;
                  const st = limitState(l);
                  return (
                    // The row opens the editor; its name is the keyboard target (the click bubbles up).
                    <tr key={l.id} className="cd-row-link" onClick={() => edit(l)}>
                      <td>
                        <button type="button" className="cd-link-button">
                          {l.name}
                        </button>
                      </td>
                      <td className="cd-nowrap">{LIMIT_KINDS[l.kind].label}</td>
                      <td className={isLimitAssigned(l) ? undefined : 'cd-muted'}>{limitTargetsLabel(l, state.db)}</td>
                      <td className="cd-nowrap">{l.updatedAt || l.createdAt ? fmtDay(l.updatedAt || l.createdAt) : '—'}</td>
                      <td>
                        <StatusDot tone={STATE_TONE[st]}>{st}</StatusDot>
                      </td>
                      <td className="cd-actions cd-num" onClick={(e) => e.stopPropagation()}>
                        <span className="cd-row-actions">
                          <s-button
                            icon={isOff ? 'toggle-off' : 'toggle-on'}
                            variant="tertiary"
                            accessibilityLabel={isOff ? 'Turn on' : 'Turn off'}
                            interestFor={`${id}-toggle-tip`}
                            onClick={() => toggle(l)}
                          />
                          <s-tooltip id={`${id}-toggle-tip`}>{isOff ? 'Turn on' : 'Turn off'}</s-tooltip>
                          <s-button
                            icon="edit"
                            variant="tertiary"
                            accessibilityLabel="Edit limit"
                            interestFor={`${id}-edit-tip`}
                            onClick={() => edit(l)}
                          />
                          <s-tooltip id={`${id}-edit-tip`}>Edit limit</s-tooltip>
                          <s-button
                            icon="delete"
                            variant="tertiary"
                            tone="critical"
                            accessibilityLabel="Delete limit"
                            interestFor={`${id}-delete-tip`}
                            onClick={() => setConfirmDelete(l)}
                          />
                          <s-tooltip id={`${id}-delete-tip`}>Delete limit</s-tooltip>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cd-card__empty">No limits match these filters.</div>
        )}
      </div>

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} heading={`Delete ${confirmDelete.name}?`}>
          <s-stack gap="small">
            <s-paragraph>{deleteLimitText(confirmDelete, state.db)}</s-paragraph>
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              dispatch({ type: 'DELETE_LIMIT', id: confirmDelete.id });
              setConfirmDelete(null);
            }}
          >
            Delete limit
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmDelete(null)}>
            Cancel
          </s-button>
        </Modal>
      )}

      {confirmToggle && (
        <Modal onClose={() => setConfirmToggle(null)} heading={`Turn on ${confirmToggle.limit.name}?`}>
          <LimitOverlapMessage subject="it" />
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              dispatch({ type: 'TOGGLE_LIMIT_STATUS', id: confirmToggle.limit.id });
              setConfirmToggle(null);
            }}
          >
            Turn on
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmToggle(null)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </div>
  );
}
