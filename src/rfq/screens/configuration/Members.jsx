import React, { useMemo, useState } from 'react';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { Modal, useWcId } from '../../../shared/wc.jsx';
import emptyAssign from './assets/emptyAssign.webp';
import emptySalesperson from './assets/emptySalesperson.webp';
import { COUNTRY_OPTIONS, COUNTRY_STATES, DEALHUB_PERMISSIONS, SHOP } from './data.js';
import { NestedRadios, Options, fullApp, same, useToast } from './ui.jsx';
import './members.css';

// Production: components/SalespersonBfs/ListSalespersonBfs.jsx (DealHub branch — the
// current salesperson version), AssignmentSettings.jsx and ModalAddConditionsBfs.jsx
// (+ ModalAddConditions/ConditionTypeQuote.jsx, ConditionTypeLeadScore.jsx).

const LIMIT_CONDITION_ASSIGNMENT = 10;

export function MembersSection({
  members,
  onMembersChange,
  assignment,
  onAssignmentChange,
  assignmentError,
  onDismissAssignmentError,
  hasNoLeadScoreRule,
  leadScoreRule,
}) {
  const toast = useToast();
  const id = useWcId('qcfg-members');
  const [deleteId, setDeleteId] = useState(null);
  const [cooldown, setCooldown] = useState([]);
  const [resending, setResending] = useState(null);

  const total = members.length;
  const permissionText = (keys) => (DEALHUB_PERMISSIONS.every((k) => keys.includes(k)) ? 'Full permissions' : 'Limited permissions');
  const statusBadge = (m) => {
    if (m.is_pending) return { label: 'Pending', tone: 'caution' };
    if (Number(m.status)) return { label: 'Active', tone: 'success' };
    return { label: 'Inactive', tone: undefined };
  };

  const openMember = (m) => toast(fullApp(`${m.name || m.email}'s member settings`));
  const addMember = () => toast(fullApp('the Add member form'));

  const resend = (m) => {
    setResending(m.id);
    setTimeout(() => {
      setResending(null);
      setCooldown((c) => [...new Set([...c, m.id])]);
      toast('Invite sent');
    }, 500);
  };

  return (
    <s-section>
      {assignmentError ? (
        <s-box paddingBlockEnd="base">
          <s-banner tone="critical" heading="To save this setting, 1 changes need to be made:" dismissible onDismiss={onDismissAssignmentError}>
            <s-unordered-list>
              <s-list-item>Add at least 1 condition</s-list-item>
            </s-unordered-list>
            <s-button slot="secondary-actions" onClick={() => toast('Opens a support chat in the full app')}>
              Contact support
            </s-button>
          </s-banner>
        </s-box>
      ) : null}

      {total > 0 ? (
        <>
          <s-box paddingBlockEnd="base">
            <s-heading fontSize="large">Members and permission</s-heading>
          </s-box>
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="small-200">
            <s-text fontSize="large" fontWeight="medium">{`Members ${total}`}</s-text>
            <s-link onClick={addMember}>Add member</s-link>
          </s-grid>

          <div className="qcfg-members-list" role="list">
            {members.map((m) => {
              const badge = statusBadge(m);
              const onCooldown = cooldown.includes(m.id);
              return (
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <div key={m.id} role="listitem" className="qcfg-members-item" onClick={() => openMember(m)}>
                  {/* Production: <Avatar size="lg" initials={shop initials}> — no name, so every row shares one colour. */}
                  <s-avatar initials={SHOP.initials} size="large" />
                  <div className="qcfg-members-item__body">
                    <div className="qcfg-members-item__name">
                      <s-link
                        onClick={(e) => {
                          e.stopPropagation();
                          openMember(m);
                        }}
                      >
                        {m.name || m.email}
                      </s-link>
                      <s-paragraph fontSize="small" color="subdued">{`Created at ${m.created_at}`}</s-paragraph>
                    </div>
                    <div className="qcfg-members-item__status">
                      <s-badge tone={badge.tone}>{badge.label}</s-badge>
                    </div>
                    <div className="qcfg-members-item__permission">
                      <s-text>{permissionText(m.permissions)}</s-text>
                    </div>
                    <div className="qcfg-members-item__actions">
                      {m.is_pending ? (
                        <>
                          <s-text interestFor={`${id}-resend-${m.id}`}>
                            <s-button
                              variant="tertiary"
                              icon="send"
                              accessibilityLabel="Resend invite"
                              loading={resending === m.id}
                              disabled={onCooldown}
                              onClick={(e) => {
                                e.stopPropagation();
                                resend(m);
                              }}
                            />
                          </s-text>
                          <s-tooltip id={`${id}-resend-${m.id}`}>{onCooldown ? 'You can resend in a few minutes' : 'Resend invite'}</s-tooltip>
                        </>
                      ) : null}
                      <s-button
                        variant="tertiary"
                        icon="delete"
                        accessibilityLabel="Delete"
                        interestFor={`${id}-delete-${m.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(m.id);
                        }}
                      />
                      <s-tooltip id={`${id}-delete-${m.id}`}>Delete</s-tooltip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <AssignmentSettings
            members={members}
            assignment={assignment}
            onChange={onAssignmentChange}
            hasNoLeadScoreRule={hasNoLeadScoreRule}
            leadScoreRule={leadScoreRule}
            onAddCondition={onDismissAssignmentError}
          />
        </>
      ) : (
        <EmptyBlock heading="Add your team for better performance" image={emptySalesperson} action={{ content: 'Add member', onAction: addMember }}>
          You can add as many member account as you want and give them permission to add, delete and update quotes.
        </EmptyBlock>
      )}

      <Modal open={deleteId !== null} heading="Delete this member?" onClose={() => setDeleteId(null)}>
        <s-paragraph>Deleting this member account will revoke their access to the app.</s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          onClick={() => {
            onMembersChange(members.filter((m) => m.id !== deleteId));
            setDeleteId(null);
            toast('Member deleted');
          }}
        >
          Delete
        </s-button>
        <s-button slot="secondary-actions" onClick={() => setDeleteId(null)}>
          Cancel
        </s-button>
      </Modal>
    </s-section>
  );
}

// ---------------------------------------------------------------------------
// Assignment settings
// ---------------------------------------------------------------------------
const ASSIGN_CHOICES = [
  { value: 'admin', label: 'Auto assign to admin', helpText: 'The system assigns quotes to the administrator upon creation.' },
  { value: 'random', label: 'System Randomly Assign', helpText: 'The system assigns random quotes to members when creating a quote.' },
  { value: 'free', label: 'From least busy to most busy member', helpText: 'The system assigns quotes to members with fewer quotes automatically.' },
  { value: 'customize', label: 'Customize quote assignments', helpText: 'You can customize your quote assignments' },
];

const CONDITION_NAME = { product: 'Product-based', customer: 'Customer-based', quote: 'Quote-based', lead_score: 'Score-based' };

function AssignmentSettings({ members, assignment, onChange, hasNoLeadScoreRule, leadScoreRule, onAddCondition }) {
  const id = useWcId('qcfg-assign');
  const { type, condition = [] } = assignment;
  const [modal, setModal] = useState(null); // { index: number | null }
  const [deleteIndex, setDeleteIndex] = useState(null);

  const setCondition = (next) => onChange({ ...assignment, condition: next });
  const openAdd = () => {
    if (condition.length < LIMIT_CONDITION_ASSIGNMENT) {
      onAddCondition?.();
      setModal({ index: null });
    }
  };

  return (
    <s-box paddingBlockStart="large">
      <s-choice-list
        name={`${id}-type`}
        label="Quote assignment"
        labelAccessibilityVisibility="exclusive"
        onChange={(e) => {
          const next = e.currentTarget.values?.[0];
          if (next && next !== type) onChange({ ...assignment, type: next });
        }}
      >
        {ASSIGN_CHOICES.map((c) => (
          <s-choice key={c.value} value={c.value} selected={c.value === type}>
            {c.label}
            <s-text slot="details">{c.helpText}</s-text>
          </s-choice>
        ))}
      </s-choice-list>

      {type === 'customize' ? (
        condition.length ? (
          <s-box paddingBlockStart="base">
            <div className="qcfg-members-table">
              <s-table>
                <s-table-header-row>
                  <s-table-header listSlot="primary">Title</s-table-header>
                  <s-table-header listSlot="labeled">Update at</s-table-header>
                  <s-table-header listSlot="labeled">Condition</s-table-header>
                  <s-table-header listSlot="secondary">Status</s-table-header>
                  <s-table-header listSlot="inline">
                    <span aria-hidden="true" />
                  </s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {condition.map((c, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <s-table-row key={index}>
                      <s-table-cell>
                        <s-link onClick={() => setModal({ index })}>{`Condition ${index + 1}`}</s-link>
                      </s-table-cell>
                      <s-table-cell>{c.updated_at}</s-table-cell>
                      <s-table-cell>{CONDITION_NAME[c.condition_type]}</s-table-cell>
                      <s-table-cell>
                        <s-switch
                          accessibilityLabel={`Condition ${index + 1} status`}
                          checked={Number(c.status) === 1}
                          disabled={hasNoLeadScoreRule && c.condition_type === 'lead_score'}
                          onChange={(e) => {
                            const on = e.currentTarget.checked ? 1 : 0;
                            if (on === Number(c.status)) return;
                            setCondition(condition.map((x, i) => (i === index ? { ...x, status: on } : x)));
                          }}
                        />
                      </s-table-cell>
                      <s-table-cell>
                        <s-button variant="tertiary" icon="delete" accessibilityLabel={`Delete condition ${index + 1}`} onClick={() => setDeleteIndex(index)} />
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
            </div>
            <s-box paddingBlockStart="base">
              <s-stack alignItems="end">
                <s-button variant="primary" disabled={condition.length >= LIMIT_CONDITION_ASSIGNMENT} onClick={openAdd}>
                  Add condition
                </s-button>
              </s-stack>
            </s-box>
          </s-box>
        ) : (
          <EmptyBlock heading="Manage your conditions" image={emptyAssign} action={{ content: 'Add condition', onAction: openAdd }}>
            No condition added yet. Start by adding a new condition using the Add condition function below.
          </EmptyBlock>
        )
      ) : null}

      {modal ? (
        <ConditionModal
          members={members}
          initial={modal.index === null ? null : condition[modal.index]}
          hasNoLeadScoreRule={hasNoLeadScoreRule}
          leadScoreRule={leadScoreRule}
          onClose={() => setModal(null)}
          onSave={(data) => {
            if (modal.index === null) setCondition([...condition, data]);
            else setCondition(condition.map((x, i) => (i === modal.index ? data : x)));
            setModal(null);
          }}
        />
      ) : null}

      <Modal open={deleteIndex !== null} heading="Delete this condition?" onClose={() => setDeleteIndex(null)}>
        <s-paragraph>Deleting this condition account will revoke their access to the app.</s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          onClick={() => {
            setCondition(condition.filter((_, i) => i !== deleteIndex));
            setDeleteIndex(null);
          }}
        >
          Delete
        </s-button>
        <s-button slot="secondary-actions" onClick={() => setDeleteIndex(null)}>
          Cancel
        </s-button>
      </Modal>
    </s-box>
  );
}

// ---------------------------------------------------------------------------
// Add / edit condition modal
// ---------------------------------------------------------------------------
const PRODUCT_TYPES = [
  { value: 'tag', label: 'Product Tag' },
  { value: 'vendor', label: 'Product Vendor' },
  { value: 'collection', label: 'Collection' },
];
const CONTAIN_OPTIONS = [
  { value: 'contain', label: 'Contains' },
  { value: 'not_contain', label: 'Not Contains' },
];
const CUSTOMER_TYPES = [
  { value: 'customer', label: 'Shopify Customer' },
  { value: 'tag', label: 'Shopify Customer has tag' },
  { value: 'not_tag', label: 'Shopify Customer has not tag' },
  { value: 'non_customer', label: 'Non Shopify Customer' },
];
const QUOTE_TYPES = [
  { value: 'country', label: 'Country' },
  { value: 'number_of_product', label: 'Number of products' },
  { value: 'quote_value', label: 'Quote value' },
];
const INSET_OPTIONS = [
  { value: 'inset', label: 'Inset' },
  { value: 'not_inset', label: 'Not Inset' },
];
const GREATER_OPTIONS = [
  { value: 'greater', label: 'Greater' },
  { value: 'equal', label: 'Equal' },
  { value: 'smaller', label: 'Smaller' },
];
// ConditionTypeLeadScore: a shop has at most one lead score rule; its threshold labels
// name the tiers (whether the rule is on or off), falling back to High / Medium / Low.
const tierOptions = (rule) => [
  { value: 'high', label: rule?.threshold_high_label || 'High' },
  { value: 'medium', label: rule?.threshold_medium_label || 'Medium' },
  { value: 'low', label: rule?.threshold_low_label || 'Low' },
];

const pad = (n) => String(n).padStart(2, '0');
const nowStamp = () => {
  const d = new Date();
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const isEmpty = (v) => String(v ?? '').trim() === '';
const comparable = (c) => (c ? { ...c, status: 1, updated_at: '' } : null);

// Select with a placeholder: s-option value="" is unreliable, so a sentinel stands in for "nothing picked".
const NONE = '__none__';

function ConditionModal({ members, initial, hasNoLeadScoreRule, leadScoreRule, onClose, onSave }) {
  const id = useWcId('qcfg-cond');
  const active = members.filter((m) => Number(m.status) === 1);
  const defaults = useMemo(
    () => ({
      status: 1,
      assign_to: active[0]?.email || '',
      updated_at: nowStamp(),
      condition_type: 'product',
      type_product: 'tag',
      type_product_operator: 'contain',
      type_product_value: '',
      type_customer: 'customer',
      type_customer_value: '',
      type_quote: 'country',
      type_quote_operator: 'inset',
      type_quote_value: '',
      type_quote_state_value: '',
      type_lead_score_tier: '',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [data, setData] = useState(() => initial || defaults);
  const [error, setError] = useState(false);
  const [assignError, setAssignError] = useState(false);
  const labelOf = (email) => active.find((m) => m.email === email)?.name || '';
  const [search, setSearch] = useState(() => labelOf((initial || defaults).assign_to));
  const [listOpen, setListOpen] = useState(false);

  const set = (key, value) => {
    setData((d) => {
      const next = { ...d, [key]: value };
      if (d.condition_type === 'quote') {
        if (key === 'type_quote') {
          if (value === 'number_of_product') {
            next.type_quote_operator = 'greater';
            next.type_quote_value = '1';
          } else {
            next.type_quote_operator = value === 'country' ? 'inset' : 'greater';
            next.type_quote_value = value === 'country' ? '' : '0';
          }
          next.type_quote_state_value = '';
        }
        if (key === 'type_quote_value') {
          if (d.type_quote !== 'country' && Number(value) < 0) next.type_quote_value = '0';
          if (d.type_quote === 'country') next.type_quote_state_value = '';
        }
      }
      return next;
    });
  };

  const options = active.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()));

  const save = () => {
    let invalid = false;
    if (data.condition_type === 'product' && isEmpty(data.type_product_value)) invalid = true;
    if (data.condition_type === 'customer' && !['customer', 'non_customer'].includes(data.type_customer) && isEmpty(data.type_customer_value)) invalid = true;
    if (data.condition_type === 'quote' && isEmpty(data.type_quote_value)) invalid = true;
    if (data.condition_type === 'lead_score' && isEmpty(data.type_lead_score_tier)) invalid = true;
    if (isEmpty(data.assign_to) || !search) {
      setAssignError(true);
      invalid = true;
    }
    if (invalid) {
      setError(true);
      return;
    }
    onSave({
      ...data,
      type_product_value: String(data.type_product_value).trim(),
      type_quote_value: String(data.type_quote_value).trim(),
      updated_at: initial ? nowStamp() : data.updated_at,
    });
  };

  const unchanged = initial ? same(comparable(initial), comparable(data)) : false;
  const req = 'Complete all required fields before proceeding';

  const productFields = (
    <s-grid gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap="base">
      <s-select label="Product" labelAccessibilityVisibility="exclusive" value={data.type_product} onChange={(e) => set('type_product', e.currentTarget.value)}>
        <Options options={PRODUCT_TYPES} />
      </s-select>
      <s-select
        label="Operator"
        labelAccessibilityVisibility="exclusive"
        value={data.type_product_operator}
        onChange={(e) => set('type_product_operator', e.currentTarget.value)}
      >
        <Options options={CONTAIN_OPTIONS} />
      </s-select>
      <s-text-field
        label="Value"
        labelAccessibilityVisibility="exclusive"
        placeholder="Value"
        value={data.type_product_value}
        error={error && isEmpty(data.type_product_value) ? req : undefined}
        onInput={(e) => set('type_product_value', e.currentTarget.value)}
      />
    </s-grid>
  );

  const customerNeedsValue = !['customer', 'non_customer'].includes(data.type_customer);
  const customerFields = (
    <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="base">
      <s-select label="Customer" labelAccessibilityVisibility="exclusive" value={data.type_customer} onChange={(e) => set('type_customer', e.currentTarget.value)}>
        <Options options={CUSTOMER_TYPES} />
      </s-select>
      {customerNeedsValue ? (
        <s-text-field
          label="Value"
          labelAccessibilityVisibility="exclusive"
          placeholder="Value"
          value={data.type_customer_value}
          error={error && isEmpty(data.type_customer_value) ? req : undefined}
          onInput={(e) => set('type_customer_value', e.currentTarget.value)}
        />
      ) : null}
    </s-grid>
  );

  const isCountry = data.type_quote === 'country';
  const states = isCountry ? COUNTRY_STATES[data.type_quote_value] : null;
  const quoteFields = (
    <div className={`qcfg-members-quote-grid${states ? ' qcfg-members-quote-grid--state' : ''}`}>
      <s-select label="Quote" labelAccessibilityVisibility="exclusive" value={data.type_quote} onChange={(e) => set('type_quote', e.currentTarget.value)}>
        <Options options={QUOTE_TYPES} />
      </s-select>
      <s-select
        label="Operator"
        labelAccessibilityVisibility="exclusive"
        value={data.type_quote_operator}
        onChange={(e) => set('type_quote_operator', e.currentTarget.value)}
      >
        <Options options={isCountry ? INSET_OPTIONS : GREATER_OPTIONS} />
      </s-select>
      {isCountry ? (
        <s-select
          label="Country"
          labelAccessibilityVisibility="exclusive"
          placeholder="Select countries"
          value={data.type_quote_value || NONE}
          error={error && isEmpty(data.type_quote_value) ? req : undefined}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (v !== NONE) set('type_quote_value', v);
          }}
        >
          {!data.type_quote_value ? (
            <s-option value={NONE} disabled>
              Select countries
            </s-option>
          ) : null}
          <Options options={COUNTRY_OPTIONS} />
        </s-select>
      ) : (
        <s-number-field
          label="Value"
          labelAccessibilityVisibility="exclusive"
          placeholder="Value"
          min={0}
          inputMode={data.type_quote === 'number_of_product' ? 'numeric' : 'decimal'}
          value={String(data.type_quote_value)}
          error={error && isEmpty(data.type_quote_value) ? req : undefined}
          onInput={(e) => set('type_quote_value', e.currentTarget.value)}
        />
      )}
      {states ? (
        <s-select
          label="State"
          labelAccessibilityVisibility="exclusive"
          value={data.type_quote_state_value || NONE}
          onChange={(e) => {
            const v = e.currentTarget.value;
            set('type_quote_state_value', v === NONE ? '' : v);
          }}
        >
          <s-option value={NONE}>Select state</s-option>
          {states.map((s) => (
            <s-option key={s} value={s}>
              {s}
            </s-option>
          ))}
        </s-select>
      ) : null}
    </div>
  );

  const leadFields = (
    <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="base">
      <s-select
        label="Lead score tier"
        labelAccessibilityVisibility="exclusive"
        placeholder="Select a threshold"
        disabled={hasNoLeadScoreRule}
        value={data.type_lead_score_tier || NONE}
        error={error && isEmpty(data.type_lead_score_tier) ? req : undefined}
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v !== NONE) set('type_lead_score_tier', v);
        }}
      >
        {!data.type_lead_score_tier ? (
          <s-option value={NONE} disabled>
            Select a threshold
          </s-option>
        ) : null}
        <Options options={tierOptions(leadScoreRule)} />
      </s-select>
    </s-grid>
  );

  const typeChoices = [
    { value: 'product', label: 'Product-based', fields: productFields },
    { value: 'customer', label: 'Customer-based', fields: customerFields },
    { value: 'quote', label: 'Quote-based', fields: quoteFields },
    {
      value: 'lead_score',
      label: 'Lead score-based',
      fields: leadFields,
      disabled: hasNoLeadScoreRule,
      helpText: hasNoLeadScoreRule ? 'No lead score rule is available. Please create a lead score rule to enable this option' : undefined,
    },
  ];

  return (
    <Modal heading={initial ? 'Edit condition' : 'Add condition'} size="large" onClose={onClose}>
      <s-stack gap="small">
        <NestedRadios
          name={`${id}-type`}
          value={data.condition_type}
          onChange={(v) => set('condition_type', v)}
          options={typeChoices.map((c) => ({ value: c.value, label: c.label, disabled: c.disabled, details: c.helpText, children: c.fields }))}
        />

        <s-stack gap="small-200">
          <s-paragraph fontSize="large" fontWeight="medium">
            Assign to
          </s-paragraph>
          <div className="qcfg-members-assign">
            <div className="qcfg-combo">
              <s-search-field
                label="Search"
                labelAccessibilityVisibility="exclusive"
                placeholder="Search"
                autocomplete="off"
                value={search}
                error={assignError ? req : undefined}
                onFocus={() => setListOpen(true)}
                onInput={(e) => {
                  const raw = e.currentTarget.value;
                  const v = raw.charAt(0) === ' ' ? raw.replace(' ', '') : raw.replace(/\s\s+/g, ' ');
                  setAssignError(false);
                  setSearch(v);
                  setListOpen(true);
                  if (v === '') setData((d) => ({ ...d, assign_to: '' }));
                }}
              />
              {listOpen ? (
                <div className="qcfg-combo__list" role="listbox" aria-label="Members">
                  {options.length ? (
                    options.map((m) => (
                      <button
                        key={m.email}
                        type="button"
                        role="option"
                        aria-selected={data.assign_to === m.email}
                        className="qcfg-combo__option"
                        onClick={() => {
                          setAssignError(false);
                          setData((d) => ({ ...d, assign_to: m.email }));
                          setSearch(m.name);
                          setListOpen(false);
                        }}
                      >
                        <span>{m.name}</span>
                        {data.assign_to === m.email ? <s-icon type="check" /> : null}
                      </button>
                    ))
                  ) : (
                    <s-box padding="small">
                      <s-text>No member found</s-text>
                    </s-box>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </s-stack>
      </s-stack>

      <s-button slot="primary-action" variant="primary" disabled={unchanged} onClick={save}>
        Save
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}
