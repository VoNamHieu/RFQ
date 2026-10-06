import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { IndexFiltersBar, Modal, useWcId } from '../../../shared/wc.jsx';
import { fullApp, useToast } from './ui.jsx';
import './lead.css';

// Production: components/Settings/LeadScoring.jsx (list only — the create page
// /app_settings/lead-scoring/create and the detail page …/detail/:id with its
// Criteria/Settings tabs and AI Scoring modal are separate routes).

const FILTERS = ['all', 'on', 'off'];

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export function LeadScoring({ list, onListChange }) {
  const toast = useToast();
  const id = useWcId('qcfg-lead');
  const [selectedTab, setSelectedTab] = useState(0);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const toggleTimer = useRef(null);
  useEffect(() => () => clearTimeout(toggleTimer.current), []);

  const rows = useMemo(() => {
    const f = FILTERS[selectedTab];
    let result = list;
    if (f === 'on') result = result.filter((r) => r.is_active);
    if (f === 'off') result = result.filter((r) => !r.is_active);
    if (query) result = result.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));
    return result;
  }, [list, selectedTab, query]);

  const selectedIds = selection.filter((sid) => rows.some((r) => r.id === sid));
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  const create = () => toast(fullApp('the lead score builder'));

  if (list.length === 0) {
    return (
      <s-section>
        <EmptyBlock
          heading="Manage your lead scoring"
          action={{ content: 'Create score', onAction: create }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          Track and control lead scoring in one place
        </EmptyBlock>
      </s-section>
    );
  }

  const confirmDelete = () => {
    const ids = bulkDeleting ? selectedIds : [deleteTarget];
    onListChange(list.filter((r) => !ids.includes(r.id)));
    setSelection([]);
    setDeleteTarget(null);
    setBulkDeleting(false);
    toast('Deleted successfully');
  };

  const toggle = (rid) => {
    if (togglingId !== null) return;
    setSelection([]);
    setTogglingId(rid);
    toggleTimer.current = setTimeout(() => {
      setTogglingId(null);
      onListChange(list.map((r) => (r.id === rid ? { ...r, is_active: !r.is_active } : r)));
      toast('Updated successfully');
    }, 400);
  };

  return (
    <>
      <s-section padding="none">
        {/* The filter bar sits above the table (not in its `filters` slot) so the search
            field stays mounted when a search empties the list and the table is swapped
            for IndexTable's empty-search state. */}
        <div className="qcfg-lead-filters">
          <IndexFiltersBar
            query={query}
            onQueryChange={setQuery}
            queryPlaceholder="Search by score name, score type"
            tabs={['All', 'On', 'Off'].map((t, i) => ({
              id: `${id}-tab-${i}`,
              content: t,
            }))}
            selected={selectedTab}
            onSelect={setSelectedTab}
          >
            {selectedIds.length > 0 ? (
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text color="subdued">{selectedIds.length} selected</s-text>
                <s-button tone="critical" onClick={() => setBulkDeleting(true)}>
                  Delete
                </s-button>
              </s-stack>
            ) : null}
          </IndexFiltersBar>
        </div>
        {rows.length > 0 ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="inline">
                <s-checkbox
                  accessibilityLabel={allSelected ? 'Deselect all lead scores' : 'Select all lead scores'}
                  checked={allSelected}
                  indeterminate={selectedIds.length > 0 && !allSelected}
                  onChange={(e) => setSelection(e.currentTarget.checked ? rows.map((r) => r.id) : [])}
                />
              </s-table-header>
              <s-table-header listSlot="primary">Score name</s-table-header>
              <s-table-header listSlot="secondary">Status</s-table-header>
              <s-table-header listSlot="labeled">Created date</s-table-header>
              <s-table-header listSlot="labeled">Score type</s-table-header>
              <s-table-header listSlot="inline">Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((rule) => {
                const checkId = `${id}-check-${rule.id}`;
                const toggleLabel = rule.is_active ? 'Turn off' : 'Turn on';
                return (
                  // Clicking a row toggles its selection (IndexTable rows without a url).
                  <s-table-row key={rule.id} clickDelegate={checkId}>
                    <s-table-cell>
                      <s-checkbox
                        id={checkId}
                        accessibilityLabel={`Select ${rule.name}`}
                        checked={selectedIds.includes(rule.id)}
                        onChange={(e) => {
                          const on = e.currentTarget.checked;
                          setSelection((cur) => (on ? [...new Set([...cur, rule.id])] : cur.filter((x) => x !== rule.id)));
                        }}
                      />
                    </s-table-cell>
                    <s-table-cell>
                      <s-text fontWeight="medium" interestFor={`${id}-name-${rule.id}`}>
                        <span className="qcfg-truncate">{rule.name}</span>
                      </s-text>
                      <s-tooltip id={`${id}-name-${rule.id}`}>{rule.name}</s-tooltip>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={rule.is_active ? 'success' : undefined}>{rule.is_active ? 'On' : 'Off'}</s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text color="subdued">{formatDate(rule.created_at)}</s-text>
                    </s-table-cell>
                    <s-table-cell>Fit Score</s-table-cell>
                    <s-table-cell>
                      {/* Production: bare 20px icons (unstyled <button>s) with tooltips, gap 100. */}
                      <div className="qcfg-lead-actions">
                        {togglingId === rule.id ? (
                          <span className="qcfg-lead-spinner">
                            <s-spinner accessibilityLabel={toggleLabel} />
                          </span>
                        ) : (
                          <>
                            <s-clickable
                              accessibilityLabel={toggleLabel}
                              interestFor={`${id}-toggle-${rule.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(rule.id);
                              }}
                            >
                              <s-icon type={rule.is_active ? 'toggle-on' : 'toggle-off'} />
                            </s-clickable>
                            <s-tooltip id={`${id}-toggle-${rule.id}`}>{toggleLabel}</s-tooltip>
                          </>
                        )}
                        <s-clickable
                          accessibilityLabel="Edit"
                          interestFor={`${id}-edit-${rule.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toast(fullApp(`the "${rule.name}" lead score`));
                          }}
                        >
                          <s-icon type="edit" />
                        </s-clickable>
                        <s-tooltip id={`${id}-edit-${rule.id}`}>Edit</s-tooltip>
                        <s-clickable
                          accessibilityLabel="Delete"
                          interestFor={`${id}-delete-${rule.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(rule.id);
                          }}
                        >
                          <s-icon type="delete" />
                        </s-clickable>
                        <s-tooltip id={`${id}-delete-${rule.id}`}>Delete</s-tooltip>
                      </div>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        ) : (
          // IndexTable's default empty state: EmptySearchResult withIllustration.
          <s-box padding="large-300">
            <s-stack gap="small" alignItems="center">
              <svg className="qcfg-lead-empty-art" viewBox="0 0 60 60" aria-hidden="true">
                <circle cx="26" cy="26" r="17" fill="#f1f1f1" stroke="#8a8a8a" strokeWidth="3" />
                <path d="M38.5 38.5 52 52" stroke="#8a8a8a" strokeWidth="5" strokeLinecap="round" />
              </svg>
              <div style={{ textAlign: 'center' }}>
                <s-heading fontSize="large-200">No lead scores found</s-heading>
              </div>
              <div style={{ textAlign: 'center' }}>
                <s-text color="subdued">Try changing the filters or search term</s-text>
              </div>
            </s-stack>
          </s-box>
        )}
      </s-section>

      <Modal
        open={deleteTarget !== null || bulkDeleting}
        heading="Delete lead score"
        onClose={() => {
          setDeleteTarget(null);
          setBulkDeleting(false);
        }}
      >
        <s-paragraph>This can't be undone. This lead score will no longer be available in your admin.</s-paragraph>
        <s-button slot="primary-action" variant="primary" tone="critical" onClick={confirmDelete}>
          Delete
        </s-button>
        <s-button
          slot="secondary-actions"
          onClick={() => {
            setDeleteTarget(null);
            setBulkDeleting(false);
          }}
        >
          Cancel
        </s-button>
      </Modal>
    </>
  );
}
