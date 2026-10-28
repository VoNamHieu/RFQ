import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitTargetsLabel, isLimitAssigned, isD2CLimit, limitOverlaps, limitState } from '../limits.js';
import { LimitEditor, withCatalog, deleteLimitText } from '../components/LimitEditor.jsx';
import { LimitOverlapMessage } from '../components/LimitOverlapList.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { Modal, IndexFiltersBar, useWcId, PageHeader } from '../../shared/wc.jsx';
import { contractsHolding, fmtDay, isContractTerm, contractsLabel } from '../agreements.js';
import { useContractLock, DraftsLosingIt } from '../components/ContractLock.jsx';
import { versionFlags } from '../../shared/versions.js';

// Tabs by who a limit is for, like the Pricing list; the kind is a filter. Contract
// limits have their own tab (Upcoming): Companies lists the regular B2B ones.
const AUDIENCE = [
  { id: 'all', label: 'All' },
  { id: 'b2b', label: 'Companies' },
  { id: 'd2c', label: 'Customers' },
  ...(versionFlags().agreements ? [{ id: 'contract', label: 'Contract' }] : []),
];
// Status badge, by limitState: turned off, not started yet, applying, or past its end date.
const STATE_TONE = { Active: 'success', Upcoming: 'info', Expired: undefined, Inactive: undefined };
const TYPE_CHOICES = [
  { label: 'All types', value: 'all' },
  ...Object.entries(LIMIT_KINDS).map(([value, k]) => ({ label: k.label, value })),
];

// Full-page "Select limit type" step shown before the editor, like Select
// pricing type: pick a kind's card, then set it up. The back action returns to the list.
function LimitTypeChooser({ onBack, onPick, backLabel = 'Order limits' }) {
  return (
    <>
    <PageHeader heading="Select limit type" backAction={{ content: backLabel, onAction: onBack }} />
    <s-page>
      <s-query-container>
        <s-grid gridTemplateColumns="@container (inline-size > 490px) 1fr 1fr, 1fr" gap="base">
          {Object.entries(LIMIT_KINDS).map(([kind, k]) => (
            <s-section key={kind}>
              <s-stack gap="base">
                <s-stack gap="small-300">
                  <s-heading fontSize="large">{k.label}</s-heading>
                  <s-paragraph color="subdued">{k.description}</s-paragraph>
                </s-stack>
                <s-stack direction="inline">
                  <s-button onClick={() => onPick(kind)}>Create limit</s-button>
                </s-stack>
              </s-stack>
            </s-section>
          ))}
        </s-grid>
      </s-query-container>
    </s-page>
    </>
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
  const [showLock, lockModal] = useContractLock();
  const [confirmToggle, setConfirmToggle] = useState(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const rowId = useWcId('limit');

  if (state.limitEditor) return <LimitEditor />;
  // From the contract editor's "Create contract limit" (state.limitChooser): the kind,
  // then a contract limit (set and locked) that goes into that contract; back returns there.
  const fromContract = state.limitChooser;
  if (fromContract) {
    return (
      <LimitTypeChooser
        backLabel="Contract"
        onBack={() => dispatch({ type: 'NAVIGATE', view: 'limits', patch: { limitChooser: null, ...(fromContract.returnTo || {}) } })}
        onPick={(kind) =>
          dispatch({ type: 'OPEN_LIMIT_EDITOR', kind, preset: { forContracts: true }, returnTo: fromContract.returnTo, addToAgreement: true })
        }
      />
    );
  }
  // "Create limit" opens the type chooser first; picking a card opens the editor
  // (where it's set as a regular or contract limit).
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

  const all = state.db.limits || [];
  const create = { content: 'Create limit', onAction: () => setChooserOpen(true) };
  if (!all.length) {
    return (
      <s-page heading="Order limits">
        <s-button slot="primary-action" variant="primary" onClick={create.onAction}>
          {create.content}
        </s-button>
        <s-button slot="secondary-actions" onClick={() => dispatch({ type: 'NAVIGATE', view: 'limitTests' })}>
          Run tests
        </s-button>
        <s-section>
          <EmptyBlock heading="Set rules for what buyers can order" action={create}>
            Require a minimum order, sell products in case packs, or review large orders before they go through. Apply a limit to B2B companies and locations, or to D2C wholesale customers.
          </EmptyBlock>
        </s-section>
      </s-page>
    );
  }

  const q = search.trim().toLowerCase();
  const tabOf = (l) => (isContractTerm(l) ? 'contract' : isD2CLimit(l) ? 'd2c' : 'b2b');
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

  return (
    <s-page heading="Order limits">
      <s-button slot="primary-action" variant="primary" onClick={create.onAction}>
        {create.content}
      </s-button>
      {/* The order-limit test console (#/b2b/order-limit-tests). */}
      <s-button slot="secondary-actions" onClick={() => dispatch({ type: 'NAVIGATE', view: 'limitTests' })}>
        Run tests
      </s-button>
      <s-stack gap="base">
        <s-paragraph color="subdued">Rules on what B2B buyers and D2C wholesale customers can check out, checked in the cart and at checkout.</s-paragraph>

        <s-section padding="none">
          <s-table>
            <IndexFiltersBar
              slot="filters"
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
            <s-table-header-row>
              <s-table-header listSlot="primary">Name</s-table-header>
              <s-table-header listSlot="labeled">Type</s-table-header>
              <s-table-header listSlot="labeled">Applies to</s-table-header>
              <s-table-header listSlot="labeled">Latest updates</s-table-header>
              <s-table-header listSlot="secondary">Status</s-table-header>
              <s-table-header listSlot="inline">
                <s-text accessibilityVisibility="exclusive">Actions</s-text>
              </s-table-header>
            </s-table-header-row>
            <s-table-body>
              {limits.map((l) => {
                const isOff = l.status !== 'Active';
                const id = `${rowId}-${l.id}`;
                // A contract limit: the contracts using it, no Turn off. Running
                // contracts hold it: deleting it goes through them, so Delete opens
                // the lock box instead.
                const forContracts = isContractTerm(l);
                const held = forContracts ? contractsHolding(state.db, l.id) : [];
                const locked = (verb) => showLock({ name: l.name, count: held.length, verb });
                return (
                  <s-table-row key={l.id} clickDelegate={`${id}-open`}>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <s-link id={`${id}-open`} onClick={() => edit(l)}>
                          {l.name}
                        </s-link>
                        {forContracts ? <s-badge>Contract limit</s-badge> : null}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>{LIMIT_KINDS[l.kind].label}</s-table-cell>
                    <s-table-cell>
                      {forContracts ? (
                        <s-text>{contractsLabel(state.db, l.id)}</s-text>
                      ) : (
                        <s-text color={isLimitAssigned(l) ? undefined : 'subdued'}>{limitTargetsLabel(l, state.db)}</s-text>
                      )}
                    </s-table-cell>
                    <s-table-cell>{l.updatedAt || l.createdAt ? fmtDay(l.updatedAt || l.createdAt) : '—'}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={STATE_TONE[limitState(l)]}>{limitState(l)}</s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-400" justifyContent="end">
                        {forContracts ? null : (
                          <>
                            <s-button
                              icon={isOff ? 'toggle-off' : 'toggle-on'}
                              variant="tertiary"
                              accessibilityLabel={isOff ? 'Turn on' : 'Turn off'}
                              interestFor={`${id}-toggle-tip`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(l);
                              }}
                            />
                            <s-tooltip id={`${id}-toggle-tip`}>{isOff ? 'Turn on' : 'Turn off'}</s-tooltip>
                          </>
                        )}
                        <s-button
                          icon="edit"
                          variant="tertiary"
                          accessibilityLabel="Edit limit"
                          interestFor={`${id}-edit-tip`}
                          onClick={(e) => {
                            e.stopPropagation();
                            edit(l);
                          }}
                        />
                        <s-tooltip id={`${id}-edit-tip`}>Edit limit</s-tooltip>
                        <s-button
                          icon="delete"
                          variant="tertiary"
                          tone="critical"
                          accessibilityLabel="Delete limit"
                          interestFor={`${id}-delete-tip`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (held.length) locked('delete');
                            else setConfirmDelete(l);
                          }}
                        />
                        <s-tooltip id={`${id}-delete-tip`}>Delete limit</s-tooltip>
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
          {limits.length === 0 ? (
            <s-box padding="base">
              <div style={{ textAlign: 'center' }}>
                <s-text color="subdued">No limits match these filters.</s-text>
              </div>
            </s-box>
          ) : null}
        </s-section>
      </s-stack>

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} heading={`Delete ${confirmDelete.name}?`}>
          <s-stack gap="small">
            <s-paragraph>{deleteLimitText(confirmDelete, state.db)}</s-paragraph>
            <DraftsLosingIt db={state.db} id={confirmDelete.id} />
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

      {lockModal}
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
    </s-page>
  );
}
