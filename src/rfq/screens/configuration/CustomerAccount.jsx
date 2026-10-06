import React, { useEffect, useRef, useState } from 'react';
import { Modal, SaveBar, Tabs } from '../../../shared/wc.jsx';
import { ConditionForm, applyConditionStatus, validateCondition } from './AccountConditionForm.jsx';
import { newCondition } from './data.js';
import { AccountTranslations, TRANSLATION_SECTIONS } from './AccountTranslations.jsx';
import { clone, same, useToast } from './ui.jsx';
import './account.css';

// Production: components/CustomerAccount/index.jsx rendered with `embedded` inside the
// Configuration page (no Page wrapper, its own save bar — the page save bar is off while
// this section is selected). Tabs: Settings.jsx / PermissionSettings.jsx (list, with
// CreateCondition.jsx / EditCondition.jsx rendered in place of the list) / Translations.jsx;
// ModalDeleteCondition.jsx. The merchant is on the Pro Plus (B2B) plan, so nothing is
// pricing-blocked (PRICING_NEW_CUSTOMER_ACCOUNT) and the "B2B" customer type is enabled.

const TABS = [
  { id: 'settings', content: 'Setting' },
  { id: 'permissions', content: 'Permission' },
  { id: 'translations', content: 'Translation' },
];

const CONDITION_TYPE = { default: 'All', tag: 'Tag', country: 'Country', type: 'Type' };

// Polaris EmptySearchResult illustration (IndexTable's default empty state).
const EMPTY_SEARCH_SVG =
  "data:image/svg+xml,%3csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3e%3cpath fill-rule='evenodd' d='M41.87 24a17.87 17.87 0 11-35.74 0 17.87 17.87 0 0135.74 0zm-3.15 18.96a24 24 0 114.24-4.24L59.04 54.8a3 3 0 11-4.24 4.24L38.72 42.96z' fill='%238C9196'/%3e%3c/svg%3e";

// utils trimObjectProperties
const trimDeep = (v) => {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(trimDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trimDeep(x)]));
  return v;
};

export function CustomerAccount({ conditions, onConditionsSave, translations, onTranslationsSave }) {
  const toast = useToast();
  const [tab, setTab] = useState(0);
  const [current, setCurrent] = useState(() => clone(conditions));
  const [currentTranslations, setCurrentTranslations] = useState(() => clone(translations));
  const [page, setPage] = useState({ type: 'list' }); // list | create | edit (id)
  const [conditionErrors, setConditionErrors] = useState({}); // { [id]: { title, tag, country, buttonVisibility, buttonConditions } }
  const [translationErrors, setTranslationErrors] = useState({});
  // App Bridge `shopify.saveBar.leaveConfirmation()` → the admin's leave dialog.
  const [pendingLeave, setPendingLeave] = useState(null);

  const dirty = !same(current, conditions) || !same(currentTranslations, translations);

  const discard = () => {
    setCurrent(clone(conditions));
    setCurrentTranslations(clone(translations));
    setConditionErrors({});
    setTranslationErrors({});
  };

  const confirmLeave = (action) => {
    if (dirty) setPendingLeave(() => action);
    else action();
  };

  const changeTab = (i) => {
    if (i === tab) return;
    confirmLeave(() => {
      setTab(i);
      setPage({ type: 'list' });
    });
  };

  // Status switches, creates and deletes go straight to the server in production; unsaved
  // edits on other conditions stay on screen.
  const commit = (next) => {
    onConditionsSave(next);
    setCurrent((cur) => {
      const byId = Object.fromEntries(cur.map((c) => [c.id, c]));
      return next.map((c) => (byId[c.id] ? { ...byId[c.id], status: c.status } : c));
    });
  };

  const save = () => {
    if (TABS[tab].id === 'permissions') {
      const errs = {};
      current.forEach((c) => {
        const e = validateCondition(c);
        if (Object.values(e).some(Boolean)) errs[c.id] = e;
      });
      setConditionErrors(errs);
      if (Object.keys(errs).length) return;
    } else {
      const errs = {};
      TRANSLATION_SECTIONS.forEach((s) =>
        s.labels.forEach(({ key }) => {
          if (!String(currentTranslations[key] ?? '').trim()) errs[key] = 'This field is required';
        }),
      );
      setTranslationErrors(errs);
      if (Object.keys(errs).length) return;
    }
    const nextConditions = trimDeep(current);
    const nextTranslations = trimDeep(currentTranslations);
    onConditionsSave(nextConditions);
    onTranslationsSave(nextTranslations);
    setCurrent(clone(nextConditions));
    setCurrentTranslations(clone(nextTranslations));
    toast('Update successfully!');
  };

  return (
    <>
      <s-stack gap="base">
        <div>
          <Tabs tabs={TABS} selected={tab} onSelect={changeTab} flush />
          <s-box paddingBlockStart="small">
            {TABS[tab].id === 'permissions' ? (
              <PermissionSettings
                saved={conditions}
                current={current}
                setCurrent={setCurrent}
                commit={commit}
                page={page}
                setPage={setPage}
                confirmLeave={confirmLeave}
                conditionErrors={conditionErrors}
                setConditionErrors={setConditionErrors}
              />
            ) : null}
            {TABS[tab].id === 'translations' ? (
              <AccountTranslations
                value={currentTranslations}
                errors={translationErrors}
                onChange={(key, v) => {
                  setTranslationErrors((e) => ({ ...e, [key]: undefined }));
                  setCurrentTranslations((t) => ({ ...t, [key]: v }));
                }}
                sections={TRANSLATION_SECTIONS}
              />
            ) : null}
            {TABS[tab].id === 'settings' ? <AccountSettingsTab /> : null}
          </s-box>
        </div>
        <div className="qcfg-acct-learn">
          <s-text>
            Learn more about{' '}
            <s-link href="https://help.omegatheme.com/en/article/9-customer-account-1iltq8x/" target="_blank">
              Customer Account
            </s-link>
          </s-text>
        </div>
      </s-stack>

      {dirty ? <SaveBar message="Unsaved changes" onSave={save} onDiscard={discard} /> : null}

      {pendingLeave ? (
        <Modal onClose={() => setPendingLeave(null)} heading="Leave page with unsaved changes?">
          <s-paragraph>Leaving this page will delete all unsaved changes.</s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              const action = pendingLeave;
              setPendingLeave(null);
              discard();
              action();
            }}
          >
            Leave page
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setPendingLeave(null)}>
            Stay
          </s-button>
        </Modal>
      ) : null}
    </>
  );
}

// Settings.jsx
function AccountSettingsTab() {
  const toast = useToast();
  return (
    <s-section>
      <s-stack gap="small-400">
        <s-heading fontSize="large">Setting new customer account</s-heading>
        <s-paragraph>Activate the quote list feature for new customer account pages.</s-paragraph>
      </s-stack>
      {/* Box paddingBlockStart 200 › Button, then an (empty) Box paddingBlockStart 200 for the plan gate */}
      <s-box paddingBlockStart="small-200" paddingBlockEnd="small-200">
        <s-button onClick={() => toast('Opens the Shopify checkout and accounts editor in a new tab')}>Setting new customer account</s-button>
      </s-box>
    </s-section>
  );
}

// PermissionSettings.jsx
function PermissionSettings({ saved, current, setCurrent, commit, page, setPage, confirmLeave, conditionErrors, setConditionErrors }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const searchRef = useRef(null);

  // IndexFilters `autoFocusSearchField` (mode Filtering): the search field has focus on load.
  useEffect(() => {
    if (page.type !== 'list') return undefined;
    const raf = requestAnimationFrame(() => searchRef.current?.focus?.({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [page.type]);

  const rows = current.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()));

  if (page.type === 'create') {
    return (
      <CreateConditionPage
        existing={saved}
        onCancel={() => setPage({ type: 'list' })}
        onCreated={(next) => {
          commit(next);
          setPage({ type: 'list' });
        }}
      />
    );
  }

  if (page.type === 'edit') {
    const value = current.find((c) => c.id === page.id);
    if (!value) return null;
    const errors = conditionErrors[value.id] || {};
    return (
      <ConditionForm
        mode="edit"
        value={value}
        errors={errors}
        onErrorsChange={(e) => setConditionErrors((all) => ({ ...all, [value.id]: e }))}
        onChange={(next) => setCurrent((cur) => cur.map((c) => (c.id === value.id ? next : c)))}
        // EditCondition: `updateConditionStatusFn` only changes the edited list (save bar).
        onStatusChange={(status) => setCurrent((cur) => applyConditionStatus(cur, value.id, status))}
        onCancel={() => confirmLeave(() => setPage({ type: 'list' }))}
      />
    );
  }

  return (
    <>
      <s-section>
        <s-stack gap="base">
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="small-200">
            <s-heading>Permission setting</s-heading>
            <s-button variant="primary" onClick={() => setPage({ type: 'create' })}>
              Add condition
            </s-button>
          </s-grid>
          <s-box border="base" borderRadius="base" overflow="hidden">
            <s-table>
              <div slot="filters">
                <s-grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="small-200">
                  <s-search-field
                    ref={searchRef}
                    label="Search"
                    labelAccessibilityVisibility="exclusive"
                    placeholder="Searching in all"
                    autocomplete="off"
                    value={query}
                    onInput={(e) => setQuery(e.currentTarget.value)}
                  />
                  <s-button variant="tertiary" onClick={() => setQuery('')}>
                    Cancel
                  </s-button>
                </s-grid>
              </div>
              <s-table-header-row>
                <s-table-header listSlot="primary">Title</s-table-header>
                <s-table-header listSlot="labeled">Condition</s-table-header>
                <s-table-header listSlot="secondary">Status</s-table-header>
                <s-table-header listSlot="inline" format="numeric">
                  Action
                </s-table-header>
              </s-table-header-row>
              <s-table-body>
                {rows.map((c) => (
                  <s-table-row key={c.id}>
                    <s-table-cell>{c.title}</s-table-cell>
                    <s-table-cell>{CONDITION_TYPE[c.condition_type]}</s-table-cell>
                    <s-table-cell>
                      <s-switch
                        accessibilityLabel={`${c.title} status`}
                        checked={!!Number(c.status)}
                        onChange={(e) => {
                          const status = e.currentTarget.checked ? 1 : 0;
                          if (status === Number(saved.find((x) => x.id === c.id)?.status)) return;
                          commit(applyConditionStatus(saved, c.id, status));
                          toast('Settings saved!');
                        }}
                      />
                    </s-table-cell>
                    <s-table-cell>
                      <div className="qcfg-row-actions">
                        <s-button variant="tertiary" icon="edit" accessibilityLabel={`Edit ${c.title}`} onClick={() => setPage({ type: 'edit', id: c.id })} />
                        <s-button
                          variant="tertiary"
                          icon="delete"
                          accessibilityLabel={`Delete ${c.title}`}
                          disabled={c.condition_type === 'default'}
                          onClick={() => setDeleteId(c.id)}
                        />
                      </div>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
            {rows.length === 0 ? (
              <div className="qcfg-acct-empty">
                <img src={EMPTY_SEARCH_SVG} alt="Empty search results" width="60" height="60" draggable="false" />
                <s-heading fontSize="large-200">No conditions found</s-heading>
                <s-text color="subdued">Try changing the filters or search term</s-text>
              </div>
            ) : null}
          </s-box>
        </s-stack>
      </s-section>

      {/* ModalDeleteCondition.jsx */}
      <Modal open={deleteId !== null} size="small" heading="Delete this condition?" onClose={() => setDeleteId(null)}>
        <s-text>Deleting this condition account will revoke their access to the app.</s-text>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          onClick={() => {
            commit(saved.filter((c) => c.id !== deleteId));
            setDeleteId(null);
            toast('Deleted');
          }}
        >
          Delete
        </s-button>
        <s-button slot="secondary-actions" onClick={() => setDeleteId(null)}>
          Cancel
        </s-button>
      </Modal>
    </>
  );
}

// CreateCondition.jsx — local form; "Create" posts it, then the list is reloaded.
function CreateConditionPage({ existing, onCancel, onCreated }) {
  const toast = useToast();
  const [value, setValue] = useState(() => newCondition());
  const [errors, setErrors] = useState({});

  const create = () => {
    const e = validateCondition(value);
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    const nextId = Math.max(0, ...existing.map((c) => c.id)) + 1;
    const created = { ...trimDeep(value), id: nextId, status: value.status ? 1 : 0 };
    const list = [...existing, { ...created, status: 0 }];
    onCreated(created.status ? applyConditionStatus(list, nextId, 1) : list);
    toast('Settings saved!');
  };

  return (
    <ConditionForm
      mode="create"
      value={value}
      errors={errors}
      onErrorsChange={setErrors}
      onChange={setValue}
      onStatusChange={(status) => setValue((v) => ({ ...v, status: !!status }))}
      onCancel={onCancel}
      onCreate={create}
    />
  );
}
