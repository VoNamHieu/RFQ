import React from 'react';
import { Modal, BlockStack, InlineStack, Box, Text, Badge, TextField, Select, Divider, Banner, Button, Icon, Avatar, Tooltip } from '@shopify/polaris';
import { SearchIcon, PlusIcon, EditIcon, ExchangeIcon, XIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/directory.js';
import { kindOf, scopeLabel, scopeTypeLabel, ruleAdjustmentLabel, policyUsage, policyUsageCount } from '../pricing.js';
import { PricingCombobox } from './PricingCombobox.jsx';

// Add a Shopify company to B2B — mirrors the god file's two-modal flow
// ("Add company from Shopify" → "Set up Shopify company"). Three steps, not
// four: the Company's Shopify Locations all come with it, so there is no
// Location choice to make — setup is Company, then pricing, then review.
const STEPS = ['Company', 'Assign pricing', 'Review'];
const KIND_META = {
  base: { name: 'Base pricing', purpose: 'The list price B2B buyers pay before quantity breaks.' },
  quantity: { name: 'Quantity pricing', purpose: 'An extra discount as the order quantity grows.' },
};
const kindName = (k) => KIND_META[k].name;
const kindPurpose = (k) => KIND_META[k].purpose;
// Two-letter monogram for the company avatar (e.g. "Watson Co" → "Wa").
const initialsOf = (name) => {
  const clean = (name || '').trim();
  return clean ? clean[0].toUpperCase() + (clean[1] || '').toLowerCase() : '?';
};

export function AddCompanyWizard() {
  const { state, dispatch } = useStore();
  const ac = state.addCompany;
  // Hide the wizard while the pricing editor is open (a "Create a new price"
  // from step 2); it reappears on this step once the editor saves or closes.
  if (!ac || state.builder) return null;

  const linkedNames = new Set(state.db.companies.map((c) => c.name));
  const available = Object.values(shopifyCompanyDirectory).filter((shp) => !linkedNames.has(shp.name));
  const chosen = ac.shopifyId ? Object.values(shopifyCompanyDirectory).find((s) => s.id === ac.shopifyId) : null;
  const isEmpty = available.length === 0;
  const hiddenCount = Object.values(shopifyCompanyDirectory).length - available.length;

  const q = (ac.search || '').trim().toLowerCase();
  const filtered = q
    ? available.filter((shp) =>
        [shp.name, ...(shp.locations || []).map((l) => l.name), ...(shp.contacts || []).map((c) => c.email)]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : available;

  const b2bBy = (kind) => state.db.policies.filter((p) => p.audienceType === 'b2b' && kindOf(p) === kind);
  const setupPolicy = (id) => (id ? state.db.policies.find((p) => p.id === id) || null : null);
  const policyName = (id) => setupPolicy(id)?.name || '';
  const priceCalcLabel = (p) =>
    kindOf(p) === 'quantity'
      ? 'Volume price breaks'
      : ruleAdjustmentLabel({ rule: p.pricingRule, valueType: p.valueType, value: p.value });

  // Assign-pricing state: base pricing holds MANY profiles (multi-select), quantity
  // holds one. `createdIds` are profiles built in this flow (they show Edit, not
  // Change). `addKind` is the open chooser; base drafts into `draftBaseIds` (a
  // multi-select), quantity into `draftPolicy` (single, god-file parity).
  const baseIds = ac.baseIds || [];
  const quantityId = ac.quantityId || '';
  const qPolicy = quantityId ? setupPolicy(quantityId) : null;
  const createdIds = ac.createdIds || [];
  const addKind = ac.addKind || null;
  const draftBaseIds = ac.draftBaseIds || [];
  const anyPricing = baseIds.length > 0 || !!quantityId;
  // An open chooser with an uncommitted selection blocks Continue — Save or Discard first.
  const pending = addKind === 'base' ? draftBaseIds.length > 0 : addKind === 'quantity' && !!ac.draftPolicy;

  const patch = (p) => dispatch({ type: 'ADD_COMPANY_PATCH', patch: p });
  const setStep = (step) => dispatch({ type: 'ADD_COMPANY_STEP', step });
  const close = () => dispatch({ type: 'CLOSE_ADD_COMPANY' });
  const openEditor = (policy, k) =>
    dispatch({ type: 'OPEN_EDITOR', policy, kind: k, context: { setupKind: k } });

  // Base pricing (multi-select; create adds exactly one).
  const openAddBase = () => patch({ addKind: 'base', draftBaseIds: [] });
  const discardBase = () => patch({ addKind: null, draftBaseIds: [] });
  const saveBase = () => patch({ baseIds: [...new Set([...baseIds, ...draftBaseIds])], addKind: null, draftBaseIds: [] });
  const removeBase = (id) => patch({ baseIds: baseIds.filter((x) => x !== id), createdIds: createdIds.filter((x) => x !== id) });
  const editBase = (id) => openEditor(setupPolicy(id), 'base');
  const createNewBase = () => openEditor(null, 'base');

  // Quantity pricing (single, god-file parity).
  const openAddQuantity = () => patch({ addKind: 'quantity', draftPolicy: quantityId, draftIsNew: createdIds.includes(quantityId) });
  const selectDraftQuantity = (id) => patch({ draftPolicy: id, draftIsNew: false });
  const discardQuantity = () => patch({ addKind: null, draftPolicy: '', draftIsNew: false });
  const saveQuantity = () =>
    patch({
      quantityId: ac.draftPolicy,
      createdIds: ac.draftIsNew ? [...new Set([...createdIds, ac.draftPolicy])] : createdIds,
      addKind: null,
      draftPolicy: '',
      draftIsNew: false,
    });
  const removeQuantity = () => patch({ quantityId: '', createdIds: createdIds.filter((x) => x !== quantityId) });
  const editQuantity = () => openEditor(setupPolicy(quantityId), 'quantity');
  const editDraftQuantity = () => openEditor(setupPolicy(ac.draftPolicy), 'quantity');

  let primaryAction;
  let secondaryActions;
  if (ac.step === 1) {
    primaryAction = { content: 'Continue', onAction: () => setStep(2), disabled: !ac.shopifyId };
    secondaryActions = [{ content: 'Cancel', onAction: close }];
  } else if (ac.step === 2) {
    primaryAction = {
      content: anyPricing ? 'Review setup' : 'Continue without pricing',
      onAction: () => setStep(3),
      disabled: pending,
    };
    secondaryActions = [{ content: 'Back', onAction: () => setStep(1) }];
  } else {
    primaryAction = {
      content: anyPricing ? 'Add company and apply pricing' : 'Add company without pricing',
      onAction: () => dispatch({ type: 'ADD_COMPANY_CONFIRM' }),
    };
    secondaryActions = [{ content: 'Back', onAction: () => setStep(2) }];
  }

  const locs = chosen?.locations || [];

  return (
    <Modal
      open
      onClose={close}
      title="Set up Shopify company"
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Stepper steps={STEPS} current={ac.step} />

          {/* STEP 1 — pick a Shopify company (searchable directory) */}
          {ac.step === 1 &&
            (isEmpty ? (
              <Banner tone="info">Every Shopify company is already in the B2B app.</Banner>
            ) : (
              <BlockStack gap="400">
                {hiddenCount > 0 ? (
                  <Banner tone="info">
                    {`${hiddenCount} ${hiddenCount === 1 ? 'company' : 'companies'} already added ${hiddenCount === 1 ? 'is' : 'are'} hidden.`}
                  </Banner>
                ) : null}
                <TextField
                  label="Search"
                  labelHidden
                  placeholder="Search by company name"
                  value={ac.search || ''}
                  onChange={(v) => patch({ search: v })}
                  prefix={<Icon source={SearchIcon} tone="subdued" />}
                  autoComplete="off"
                />
                <div>
                  <Box paddingBlockEnd="200">
                    <Text as="span" tone="subdued" variant="bodySm">
                      {`Showing ${filtered.length} ${filtered.length === 1 ? 'company' : 'companies'}`}
                    </Text>
                  </Box>
                  <Divider />
                  {filtered.length === 0 ? (
                    <Box paddingBlockStart="300">
                      <Text as="p" tone="subdued">No Shopify company matches your search.</Text>
                    </Box>
                  ) : (
                    filtered.map((shp, idx) => {
                      const sel = ac.shopifyId === shp.id;
                      const main = (shp.contacts || [])[0] || null;
                      const nLoc = (shp.locations || []).length;
                      const nCon = (shp.contacts || []).length;
                      return (
                        <React.Fragment key={shp.id}>
                          {idx > 0 ? <Divider /> : null}
                          <button
                            type="button"
                            onClick={() => patch({ shopifyId: shp.id })}
                            style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                          >
                            <Box paddingBlock="300">
                              <InlineStack gap="300" blockAlign="center" wrap={false}>
                                <Radio checked={sel} />
                                <Avatar size="md" initials={initialsOf(shp.name)} name={shp.name} />
                                <BlockStack gap="050">
                                  <Text as="span" variant="bodyMd" fontWeight="semibold">{shp.name}</Text>
                                  {main ? (
                                    <Text as="span" tone="subdued" variant="bodySm">{`${main.name} · ${main.email}`}</Text>
                                  ) : null}
                                  <Text as="span" tone="subdued" variant="bodySm">
                                    {`${nLoc} location${nLoc === 1 ? '' : 's'} · ${nCon} contact${nCon === 1 ? '' : 's'}`}
                                  </Text>
                                </BlockStack>
                              </InlineStack>
                            </Box>
                          </button>
                        </React.Fragment>
                      );
                    })
                  )}
                  <Divider />
                </div>
                <Text as="p" tone="subdued" variant="bodySm">
                  Select a company to link. You assign its pricing in the next step.
                </Text>
              </BlockStack>
            ))}

          {/* STEP 2 — assign pricing (whole company shares it) */}
          {ac.step === 2 && (
            <BlockStack gap="300">
              <Text as="p" tone="subdued" variant="bodySm">
                {`Every location of ${chosen?.name || 'the company'} shares this pricing. Base pricing can hold several; quantity pricing holds one.`}
              </Text>

              {/* Committed base profiles — one compact, scrollable list (a company
                  can hold many, so keep it dense instead of a card per profile). */}
              {baseIds.length > 0 ? (
                <BlockStack gap="150">
                  <Text as="span" tone="subdued" variant="bodySm">
                    {`Base pricing · ${baseIds.length} pricing`}
                  </Text>
                  <Box borderWidth="025" borderColor="border" borderRadius="200">
                    <div style={{ maxHeight: 224, overflowY: 'auto' }}>
                      {baseIds.map((id, idx) => {
                        const p = setupPolicy(id);
                        if (!p) return null;
                        const madeHere = createdIds.includes(id);
                        return (
                          <React.Fragment key={id}>
                            {idx > 0 ? <Divider /> : null}
                            <Box paddingInline="300" paddingBlock="200">
                              <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
                                <Text as="span" variant="bodyMd" fontWeight="medium" truncate>{p.name}</Text>
                                <InlineStack gap="050" blockAlign="center" wrap={false}>
                                  {madeHere ? (
                                    <Button icon={EditIcon} variant="tertiary" size="micro" accessibilityLabel={`Edit ${p.name}`} onClick={() => editBase(id)} />
                                  ) : null}
                                  <Button icon={XIcon} variant="tertiary" size="micro" tone="critical" accessibilityLabel={`Remove ${p.name}`} onClick={() => removeBase(id)} />
                                </InlineStack>
                              </InlineStack>
                            </Box>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </Box>
                </BlockStack>
              ) : null}

              {/* Committed quantity profile (one; not the one being edited) */}
              {qPolicy && addKind !== 'quantity' ? (
                <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                  <InlineStack align="space-between" blockAlign="center" gap="200">
                    <BlockStack gap="025">
                      <Text as="span" variant="bodyMd" fontWeight="medium">{qPolicy.name}</Text>
                      <Text as="span" tone="subdued" variant="bodySm">Quantity pricing</Text>
                    </BlockStack>
                    <InlineStack gap="100">
                      {createdIds.includes(quantityId) ? (
                        <Button icon={EditIcon} variant="tertiary" accessibilityLabel="Edit quantity pricing" onClick={editQuantity} />
                      ) : (
                        <Button icon={ExchangeIcon} variant="tertiary" accessibilityLabel="Change quantity pricing" onClick={openAddQuantity} />
                      )}
                      <Button icon={XIcon} variant="tertiary" tone="critical" accessibilityLabel="Remove quantity pricing" onClick={removeQuantity} />
                    </InlineStack>
                  </InlineStack>
                </Box>
              ) : null}

              {/* Chooser | type cards */}
              {addKind === 'base' ? (
                <BaseChooser
                  options={b2bBy('base').filter((p) => !baseIds.includes(p.id))}
                  selected={draftBaseIds}
                  onChange={(ids) => patch({ draftBaseIds: ids })}
                  onDiscard={discardBase}
                  onSave={saveBase}
                  onCreateNew={createNewBase}
                />
              ) : addKind === 'quantity' ? (
                <PricingChooser
                  addKind="quantity"
                  taken={!!quantityId}
                  options={b2bBy('quantity')}
                  cur={ac.draftPolicy || ''}
                  sel={setupPolicy(ac.draftPolicy)}
                  justBuilt={!!(setupPolicy(ac.draftPolicy) && ac.draftIsNew)}
                  scopeLabel={scopeLabel}
                  priceCalcLabel={priceCalcLabel}
                  usageCount={(p) => policyUsageCount(p, state.db)}
                  usageLabel={(p) => policyUsage(p, state.db)}
                  onSelect={selectDraftQuantity}
                  onEditDraft={editDraftQuantity}
                  onDiscard={discardQuantity}
                  onSave={saveQuantity}
                  onCreateNew={() => openEditor(null, 'quantity')}
                />
              ) : (
                <InlineStack gap="200" wrap>
                  {/* Base pricing — always addable (a company can hold several) */}
                  <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                    <button
                      type="button"
                      onClick={openAddBase}
                      style={{ all: 'unset', display: 'block', width: '100%', cursor: 'pointer' }}
                    >
                      <Box padding="300" borderWidth="025" borderRadius="200" borderColor="border">
                        <BlockStack gap="050">
                          <Text as="span" variant="bodyMd" fontWeight="medium">{`+ ${kindName('base')}`}</Text>
                          <Text as="span" tone="subdued" variant="bodySm">{kindPurpose('base')}</Text>
                        </BlockStack>
                      </Box>
                    </button>
                  </div>
                  {/* Quantity pricing — one per company */}
                  <div style={{ flex: '1 1 220px', minWidth: 200 }}>
                    <button
                      type="button"
                      disabled={!!quantityId}
                      onClick={quantityId ? undefined : openAddQuantity}
                      style={{ all: 'unset', display: 'block', width: '100%', cursor: quantityId ? 'default' : 'pointer' }}
                    >
                      <Box
                        padding="300"
                        borderWidth="025"
                        borderRadius="200"
                        borderColor={quantityId ? 'border-disabled' : 'border'}
                        background={quantityId ? 'bg-surface-secondary' : undefined}
                      >
                        <BlockStack gap="050">
                          <Text as="span" variant="bodyMd" fontWeight="medium" tone={quantityId ? 'subdued' : undefined}>
                            {`${quantityId ? '✓' : '+'} ${kindName('quantity')}`}
                          </Text>
                          <Text as="span" tone="subdued" variant="bodySm">
                            {quantityId ? 'Already added' : kindPurpose('quantity')}
                          </Text>
                        </BlockStack>
                      </Box>
                    </button>
                  </div>
                </InlineStack>
              )}

              {!anyPricing && !addKind ? (
                <Banner tone="warning" title="No pricing yet">
                  <p>
                    You can still finish setup. The company and its locations are added, but buyers can’t order until
                    pricing is assigned from the Pricing page.
                  </p>
                </Banner>
              ) : null}
            </BlockStack>
          )}

          {/* STEP 3 — review */}
          {ac.step === 3 && chosen && (
            <BlockStack gap="300">
              <ReviewBlock head="Company and locations">
                <BlockStack gap="100">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">{chosen.name}</Text>
                  <Text as="span" tone="subdued" variant="bodySm">
                    {`${locs.length} location${locs.length === 1 ? '' : 's'}, ${(chosen.contacts || []).length} contact${(chosen.contacts || []).length === 1 ? '' : 's'}`}
                  </Text>
                  <Text as="span" tone="subdued" variant="bodySm">
                    {chosen.contacts?.[0]
                      ? `Main contact: ${chosen.contacts[0].name}${chosen.contacts[0].email ? ` (${chosen.contacts[0].email})` : ''}`
                      : 'Main contact: None on this company'}
                  </Text>
                </BlockStack>
              </ReviewBlock>

              <ReviewBlock head="Pricing setup">
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
                    <Text as="span" variant="bodyMd">Base pricing</Text>
                    {baseIds.length ? (
                      <InlineStack gap="100" blockAlign="center" wrap={false}>
                        {baseIds.slice(0, 3).map((id) => (
                          <Badge key={id} tone="success">{policyName(id)}</Badge>
                        ))}
                        {baseIds.length > 3 ? (
                          <Tooltip content={baseIds.slice(3).map((id) => policyName(id)).join(', ')}>
                            <span style={{ display: 'inline-flex', cursor: 'default' }}>
                              <Badge>{`+${baseIds.length - 3}`}</Badge>
                            </span>
                          </Tooltip>
                        ) : null}
                      </InlineStack>
                    ) : (
                      <Badge>Not set</Badge>
                    )}
                  </InlineStack>
                  <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
                    <Text as="span" variant="bodyMd">Quantity pricing</Text>
                    {quantityId ? <Badge tone="success">{policyName(quantityId)}</Badge> : <Badge>Not set</Badge>}
                  </InlineStack>
                </BlockStack>
              </ReviewBlock>
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// Base-pricing chooser: a company can hold several base profiles, so this reuses
// the company section's multi-select dropdown (PricingCombobox — checkable options
// + removable tags). "Create a new" still builds exactly one and drops it straight
// into the committed list.
function BaseChooser({ options, selected, onChange, onDiscard, onSave, onCreateNew }) {
  const optionLabel = (p) => `${p.name} · Priority ${p.priority ?? '—'} · ${scopeTypeLabel(p)}`;
  return (
    <Box padding="300" background="bg-surface-secondary" borderWidth="025" borderColor="border" borderRadius="200">
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" gap="200">
          <Text as="h3" variant="headingSm">Add base pricing</Text>
          <InlineStack gap="100">
            <Button size="slim" onClick={onDiscard}>Discard</Button>
            <Button variant="primary" size="slim" disabled={!selected.length} onClick={onSave}>
              {selected.length > 1 ? `Add ${selected.length}` : 'Add'}
            </Button>
          </InlineStack>
        </InlineStack>

        {options.length ? (
          <>
            <PricingCombobox
              label="Use an existing base pricing"
              placeholder="Select base pricing"
              candidates={options}
              selectedIds={selected}
              onChange={onChange}
              optionLabel={optionLabel}
              emptyText="No matching base pricing"
            />
            <Text as="p" tone="subdued" variant="bodySm">Pick one or more — the lowest priority applies first.</Text>
          </>
        ) : (
          <Text as="span" tone="subdued" variant="bodySm">
            No base pricing serves companies yet, or every one is already added. Create a new one below.
          </Text>
        )}

        <BlockStack gap="150">
          {options.length ? (
            <InlineStack align="center">
              <Text as="span" tone="subdued" variant="bodySm">or</Text>
            </InlineStack>
          ) : null}
          <Button icon={PlusIcon} onClick={onCreateNew}>Create a new base pricing</Button>
        </BlockStack>
      </BlockStack>
    </Box>
  );
}

// The chooser card shown when a pricing type is being added or changed: pick an
// existing profile or create a new one, review the selection, then Save/Discard.
function PricingChooser({
  addKind,
  taken,
  options,
  cur,
  sel,
  justBuilt,
  scopeLabel,
  priceCalcLabel,
  usageCount,
  usageLabel,
  onSelect,
  onEditDraft,
  onDiscard,
  onSave,
  onCreateNew,
}) {
  const label = kindName(addKind).toLowerCase();
  return (
    <Box padding="300" background="bg-surface-secondary" borderWidth="025" borderColor="border" borderRadius="200">
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" gap="200">
          <Text as="h3" variant="headingSm">{`${taken ? 'Change' : 'Add'} ${label}`}</Text>
          <InlineStack gap="100">
            {justBuilt ? (
              <Button size="slim" onClick={onEditDraft}>Edit</Button>
            ) : null}
            <Button size="slim" onClick={onDiscard}>Discard</Button>
            <Button variant="primary" size="slim" disabled={!sel} onClick={onSave}>Save</Button>
          </InlineStack>
        </InlineStack>

        {justBuilt ? (
          <BlockStack gap="100">
            <Text as="span" tone="subdued" variant="bodySm">{`New ${label}`}</Text>
            <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200">
              <Text as="span" variant="bodyMd" fontWeight="medium">{sel.name}</Text>
            </Box>
            <Text as="span" tone="subdued" variant="bodySm">{`Discard to go back to picking an existing ${label}.`}</Text>
          </BlockStack>
        ) : options.length ? (
          <Select
            label={`Use an existing ${label}`}
            options={[{ label: `Select a ${label}…`, value: '' }, ...options.map((p) => ({ label: p.name, value: p.id }))]}
            value={cur}
            onChange={onSelect}
          />
        ) : (
          <Text as="span" tone="subdued" variant="bodySm">
            {`No ${label} serves companies yet. Pricing set up for customers can’t be assigned to a company.`}
          </Text>
        )}

        {sel ? (
          <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200" background="bg-surface">
            <BlockStack gap="100">
              <Kv label="Products" value={scopeLabel(sel)} />
              <Kv label="Price calculation" value={priceCalcLabel(sel)} />
              <Kv
                label="Also assigned to"
                value={usageCount(sel) ? `${usageLabel(sel)}. Editing it later changes all of them` : 'Nothing else yet'}
              />
            </BlockStack>
          </Box>
        ) : null}

        {!sel ? (
          <BlockStack gap="150">
            {options.length ? (
              <InlineStack align="center">
                <Text as="span" tone="subdued" variant="bodySm">or</Text>
              </InlineStack>
            ) : null}
            <Button icon={PlusIcon} onClick={onCreateNew}>{`Create a new ${label}`}</Button>
          </BlockStack>
        ) : null}
      </BlockStack>
    </Box>
  );
}

function ReviewBlock({ head, children }) {
  return (
    <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200">
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          {head}
        </Text>
        {children}
      </BlockStack>
    </Box>
  );
}

// Segmented progress bar across the wizard's three steps: a filled pill for the
// active step, a green check for finished ones, a muted number for what's ahead.
function Stepper({ steps, current }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        borderRadius: 12,
        background: 'var(--p-color-bg-surface-secondary, #f1f1f1)',
      }}
    >
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div
            key={label}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              background: active ? 'var(--p-color-bg-surface, #ffffff)' : 'transparent',
              boxShadow: active ? 'var(--p-shadow-200, 0 1px 3px rgba(0,0,0,0.15))' : 'none',
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                flex: '0 0 auto',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1,
                background: done
                  ? 'var(--p-color-bg-fill-success, #29845a)'
                  : active
                    ? 'var(--p-color-bg-fill-info-secondary, #d1e3fb)'
                    : 'var(--p-color-bg-fill-tertiary, #e3e3e3)',
                color: done
                  ? '#ffffff'
                  : active
                    ? 'var(--p-color-text-info, #0a4ea2)'
                    : 'var(--p-color-text-secondary, #616161)',
              }}
            >
              {done ? '✓' : n}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: active ? 'var(--p-color-text, #303030)' : 'var(--p-color-text-secondary, #616161)',
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Visual-only radio dot for the company rows (the row's <button> owns the click).
function Radio({ checked }) {
  const color = checked ? 'var(--p-color-input-border-active, #303030)' : 'var(--p-color-input-border, #8a8a8a)';
  return (
    <span
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        flex: '0 0 auto',
        boxSizing: 'border-box',
        borderRadius: '50%',
        border: `2px solid ${color}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} /> : null}
    </span>
  );
}

function Kv({ label, value }) {
  return (
    <InlineStack align="space-between">
      <Text as="span" tone="subdued" variant="bodySm">
        {label}
      </Text>
      <Text as="span" variant="bodySm">
        {value || '—'}
      </Text>
    </InlineStack>
  );
}
