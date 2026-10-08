import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitSummary, limitTargetsLabel, isLimitAssigned } from '../limits.js';
import { LimitEditor } from '../components/LimitEditor.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { Modal, IndexFiltersBar, useWcId } from '../../shared/wc.jsx';

const TYPE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'order', label: 'Order' },
  { id: 'product', label: 'Product' },
  { id: 'review', label: 'Review' },
];

// Order limits library: every limit with what it sets and who it applies to.
// Create limit opens a menu of the three kinds (each with its description, like
// Add limit on a location page); the editor opens as a page here (OPEN_LIMIT_EDITOR).
export function OrderLimits() {
  const { state, dispatch } = useStore();
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
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
        {createMenu}
        <s-section>
          <EmptyBlock heading="Set rules for what buyers can order" action={create}>
            Require a minimum order, sell products in case packs, or review large orders before they go through. Apply a limit store-wide or to specific companies and locations.
          </EmptyBlock>
        </s-section>
      </s-page>
    );
  }

  const q = search.trim().toLowerCase();
  const limits = all
    .filter((l) => (type === 'all' || l.kind === type) && (!q || l.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const edit = (l) => dispatch({ type: 'OPEN_LIMIT_EDITOR', limit: l });

  return (
    <s-page heading="Order limits">
      <s-button slot="primary-action" variant="primary" commandFor={createId}>
        {create.content}
      </s-button>
      {createMenu}
      <s-stack gap="base">
        <s-paragraph color="subdued">Rules on what B2B buyers can check out, checked in the cart and at checkout.</s-paragraph>

        <s-section padding="none">
          <s-table>
            <IndexFiltersBar
              slot="filters"
              query={search}
              queryPlaceholder="Search limits by name"
              onQueryChange={setSearch}
              tabs={TYPE_TABS.map((t) => ({ id: `type-${t.id}`, content: t.label }))}
              selected={Math.max(0, TYPE_TABS.findIndex((t) => t.id === type))}
              onSelect={(i) => setType(TYPE_TABS[i].id)}
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
                        <s-text>{limitSummary(l, state.db)}</s-text>
                      </div>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text color={isLimitAssigned(l) ? undefined : 'subdued'}>{limitTargetsLabel(l, state.db)}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={isOff ? undefined : 'success'}>{isOff ? 'Inactive' : 'Active'}</s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-400" justifyContent="end">
                        <s-button
                          icon={isOff ? 'toggle-off' : 'toggle-on'}
                          variant="tertiary"
                          accessibilityLabel={isOff ? 'Turn on' : 'Turn off'}
                          interestFor={`${id}-toggle-tip`}
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch({ type: 'TOGGLE_LIMIT_STATUS', id: l.id });
                          }}
                        />
                        <s-tooltip id={`${id}-toggle-tip`}>{isOff ? 'Turn on' : 'Turn off'}</s-tooltip>
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
                            setConfirmDelete(l);
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
          <s-paragraph>
            Buyers it applies to ({limitTargetsLabel(confirmDelete, state.db)}) can check out without it right away. This can’t be undone.
          </s-paragraph>
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
    </s-page>
  );
}
