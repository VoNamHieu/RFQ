import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitSummary, limitTargetsLabel, isLimitAssigned, isD2CLimit, newConflicts, productRules, limitState, blockingOf, notesOf } from '../limits.js';
import { LimitEditor, DeleteLimitConflicts, deleteCheck, withCatalog } from '../components/LimitEditor.jsx';
import { LimitConflictList } from '../components/LimitConflictList.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { Modal, IndexFiltersBar, useWcId } from '../../shared/wc.jsx';
import { contractsHolding, lockedTip } from '../agreements.js';

// Tabs by who a limit is for, like the Pricing list; the kind is a filter.
const AUDIENCE = [
  { id: 'all', label: 'All' },
  { id: 'b2b', label: 'Companies' },
  { id: 'd2c', label: 'Customers' },
];
// Status badge, by limitState: turned off, not started yet, applying, or past its end date.
const STATE_TONE = { Active: 'success', Upcoming: 'info', Expired: undefined, Inactive: undefined };
const TYPE_CHOICES = [
  { label: 'All types', value: 'all' },
  ...Object.entries(LIMIT_KINDS).map(([value, k]) => ({ label: k.label, value })),
];

// Order limits library: every limit with what it sets and who it applies to.
// Create limit opens a menu of the three kinds (each with its description, like
// Add limit on a location page); the editor opens as a page here (OPEN_LIMIT_EDITOR).
export function OrderLimits() {
  const { state, dispatch } = useStore();
  const [audience, setAudience] = useState('all');
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);
  const rowId = useWcId('limit');
  const createId = useWcId('create-limit');

  if (state.limitEditor) return <LimitEditor />;

  const all = state.db.limits || [];
  const create = { content: 'Create limit', commandFor: createId };
  // Popover + ActionList with help text: each kind's description stays under its name.
  const createMenu = (
    <s-popover id={createId} maxInlineSize="320px">
      <s-box padding="small-200">
        <s-stack gap="none">
          {Object.entries(LIMIT_KINDS).map(([kind, k]) => (
            <s-clickable
              key={kind}
              padding="small-200"
              borderRadius="base"
              commandFor={createId}
              command="--hide"
              onClick={() => dispatch({ type: 'OPEN_LIMIT_EDITOR', kind })}
            >
              <s-paragraph>{k.label}</s-paragraph>
              <s-paragraph color="subdued" fontSize="small">
                {k.description}
              </s-paragraph>
            </s-clickable>
          ))}
        </s-stack>
      </s-box>
    </s-popover>
  );
  if (!all.length) {
    return (
      <s-page heading="Order limits">
        <s-button slot="primary-action" variant="primary" commandFor={createId}>
          {create.content}
        </s-button>
        <s-button slot="secondary-actions" onClick={() => dispatch({ type: 'NAVIGATE', view: 'limitTests' })}>
          Run tests
        </s-button>
        {createMenu}
        <s-section>
          <EmptyBlock heading="Set rules for what buyers can order" action={create}>
            Require a minimum order, sell products in case packs, or review large orders before they go through. Apply a limit to B2B companies and locations, or to D2C wholesale customers.
          </EmptyBlock>
        </s-section>
      </s-page>
    );
  }

  const q = search.trim().toLowerCase();
  const limits = all
    .filter((l) => audience === 'all' || (isD2CLimit(l) ? 'd2c' : 'b2b') === audience)
    .filter((l) => (type === 'all' || l.kind === type) && (!q || l.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const edit = (l) => dispatch({ type: 'OPEN_LIMIT_EDITOR', limit: l });
  // Turning a limit on (or off, when it covered a clash) can make limits conflict,
  // as saving can. Conflicts that stop orders block it until the limits change;
  // notes are shown first and don't.
  const toggle = (l) => {
    const on = l.status !== 'Active';
    const next = all.map((x) => (x.id === l.id ? { ...x, status: on ? 'Active' : 'Inactive' } : x));
    const found = newConflicts(withCatalog(state.db), next, on ? l.id : null);
    if (found.length) setConfirmToggle({ limit: l, on, blocking: blockingOf(found), notes: notesOf(found) });
    else dispatch({ type: 'TOGGLE_LIMIT_STATUS', id: l.id });
  };
  const delCheck = confirmDelete ? deleteCheck(state.db, confirmDelete.id) : null;

  return (
    <s-page heading="Order limits">
      <s-button slot="primary-action" variant="primary" commandFor={createId}>
        {create.content}
      </s-button>
      {/* The order-limit test console (#/b2b/order-limit-tests). */}
      <s-button slot="secondary-actions" onClick={() => dispatch({ type: 'NAVIGATE', view: 'limitTests' })}>
        Run tests
      </s-button>
      {createMenu}
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
              <s-table-header listSlot="labeled">Rule</s-table-header>
              <s-table-header listSlot="labeled">Applies to</s-table-header>
              <s-table-header listSlot="secondary">Status</s-table-header>
              <s-table-header listSlot="inline">
                <s-text accessibilityVisibility="exclusive">Actions</s-text>
              </s-table-header>
            </s-table-header-row>
            <s-table-body>
              {limits.map((l) => {
                const isOff = l.status !== 'Active';
                const id = `${rowId}-${l.id}`;
                // Live contracts hold it: it can't be turned off or deleted outside them.
                const held = contractsHolding(state.db, l.id);
                return (
                  <s-table-row key={l.id} clickDelegate={`${id}-open`}>
                    <s-table-cell>
                      <s-link id={`${id}-open`} onClick={() => edit(l)}>
                        {l.name}
                      </s-link>
                    </s-table-cell>
                    <s-table-cell>{LIMIT_KINDS[l.kind].label}</s-table-cell>
                    <s-table-cell>
                      <div style={{ whiteSpace: 'normal', maxWidth: 320 }}>
                        {/* A product limit with several rules reads as a count; open it for the rules. */}
                        <s-text>{l.kind === 'product' && productRules(l).length > 1 ? `${productRules(l).length} rules` : limitSummary(l, state.db)}</s-text>
                      </div>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text color={isLimitAssigned(l) ? undefined : 'subdued'}>{limitTargetsLabel(l, state.db)}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={STATE_TONE[limitState(l)]}>{limitState(l)}</s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-400" justifyContent="end">
                        <s-button
                          icon={isOff ? 'toggle-off' : 'toggle-on'}
                          variant="tertiary"
                          accessibilityLabel={isOff ? 'Turn on' : 'Turn off'}
                          disabled={!isOff && held.length > 0}
                          interestFor={`${id}-toggle-tip`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(l);
                          }}
                        />
                        <s-tooltip id={`${id}-toggle-tip`}>{isOff ? 'Turn on' : held.length ? lockedTip(held, 'turn off') : 'Turn off'}</s-tooltip>
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
                          disabled={held.length > 0}
                          interestFor={`${id}-delete-tip`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(l);
                          }}
                        />
                        <s-tooltip id={`${id}-delete-tip`}>{held.length ? lockedTip(held, 'delete') : 'Delete limit'}</s-tooltip>
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
            <s-paragraph>
              Buyers it applies to ({limitTargetsLabel(confirmDelete, state.db)}) can check out without it right away. This can’t be undone.
            </s-paragraph>
            <DeleteLimitConflicts check={delCheck} />
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            disabled={delCheck.blocking.length > 0}
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
        <Modal
          onClose={() => setConfirmToggle(null)}
          heading={`${confirmToggle.blocking.length ? 'Can’t turn' : 'Turn'} ${confirmToggle.on ? 'on' : 'off'} ${confirmToggle.limit.name}${confirmToggle.blocking.length ? '' : '?'}`}
        >
          <s-stack gap="small">
            {confirmToggle.blocking.length ? (
              <>
                <s-paragraph>
                  {confirmToggle.on
                    ? 'It would stop orders. Change it so these orders can go through, then turn it on:'
                    : 'Without it, other limits stop orders. Change those limits first:'}
                </s-paragraph>
                <LimitConflictList conflicts={confirmToggle.blocking} />
              </>
            ) : null}
            {confirmToggle.notes.length ? (
              <>
                <s-paragraph>{confirmToggle.on ? 'How it works with other limits:' : 'Without it:'}</s-paragraph>
                <LimitConflictList conflicts={confirmToggle.notes} />
              </>
            ) : null}
          </s-stack>
          {confirmToggle.blocking.length ? null : (
            <s-button
              slot="primary-action"
              variant="primary"
              onClick={() => {
                dispatch({ type: 'TOGGLE_LIMIT_STATUS', id: confirmToggle.limit.id });
                setConfirmToggle(null);
              }}
            >
              {confirmToggle.on ? 'Turn on' : 'Turn off'}
            </s-button>
          )}
          <s-button slot="secondary-actions" onClick={() => setConfirmToggle(null)}>
            {confirmToggle.blocking.length ? 'Close' : 'Cancel'}
          </s-button>
        </Modal>
      )}
    </s-page>
  );
}
