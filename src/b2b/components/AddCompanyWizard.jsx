import React from 'react';
import { Modal, BlockStack, InlineStack, Box, Text, Badge, TextField, Select, Divider, Banner, Button, Icon } from '@shopify/polaris';
import { SearchIcon, PlusIcon, EditIcon, ExchangeIcon, XIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/directory.js';
import { kindOf, scopeLabel, ruleAdjustmentLabel, policyUsage, policyUsageCount } from '../pricing.js';

// Add a Shopify company to B2B — mirrors the god file's two-modal flow
// ("Add company from Shopify" → "Set up Shopify company"). Three steps, not
// four: the Company's Shopify Locations all come with it, so there is no
// Location choice to make — setup is Company, then pricing, then review.
const STEPS = ['Company', 'Assign pricing', 'Review'];
const KIND_ORDER = ['base', 'quantity'];
const KIND_META = {
  base: { name: 'Base pricing', purpose: 'The list price B2B buyers pay before quantity breaks.' },
  quantity: { name: 'Quantity pricing', purpose: 'An extra discount as the order quantity grows.' },
};
const kindName = (k) => KIND_META[k].name;
const kindPurpose = (k) => KIND_META[k].purpose;
const keyOf = (k) => (k === 'quantity' ? 'quantityId' : 'baseId');
const TERMS_PREVIEW = 3;

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

  // Assign-pricing state (god-file parity): committed selection per kind, plus
  // the open chooser (addKind), its uncommitted draft, and which committed kinds
  // were built in this flow (so they show Edit rather than Change).
  const policyByKind = { base: ac.baseId, quantity: ac.quantityId };
  const createdHere = ac.createdHere || {};
  const addKind = ac.addKind || null;
  const addedCount = KIND_ORDER.filter((k) => policyByKind[k]).length;
  const anyPricing = addedCount > 0;
  const pending = !!(addKind && ac.draftPolicy);

  const patch = (p) => dispatch({ type: 'ADD_COMPANY_PATCH', patch: p });
  const setStep = (step) => dispatch({ type: 'ADD_COMPANY_STEP', step });
  const close = () => dispatch({ type: 'CLOSE_ADD_COMPANY' });

  // Chooser handlers.
  const openAdd = (k) => patch({ addKind: k, draftPolicy: policyByKind[k] || '', draftIsNew: !!createdHere[k] });
  const selectDraft = (id) => patch({ draftPolicy: id, draftIsNew: false });
  const discardKind = () => patch({ addKind: null, draftPolicy: '', draftIsNew: false });
  const saveKind = () =>
    patch({
      [keyOf(addKind)]: ac.draftPolicy,
      createdHere: { ...createdHere, [addKind]: !!ac.draftIsNew },
      addKind: null,
      draftPolicy: '',
      draftIsNew: false,
    });
  const removeKind = (k) => patch({ [keyOf(k)]: '', createdHere: { ...createdHere, [k]: false } });
  const openEditor = (policy, k) =>
    dispatch({ type: 'OPEN_EDITOR', policy, kind: k, context: { setupKind: k } });
  const editDraft = () => openEditor(setupPolicy(ac.draftPolicy), addKind);
  const editCommitted = (k) => openEditor(setupPolicy(policyByKind[k]), k);
  const createNew = () => openEditor(null, addKind);

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
    secondaryActions = [{ content: 'Back', onAction: () => setStep(1) }, { content: 'Cancel', onAction: close }];
  } else {
    primaryAction = {
      content: anyPricing ? 'Add company and apply pricing' : 'Add company without pricing',
      onAction: () => dispatch({ type: 'ADD_COMPANY_CONFIRM' }),
    };
    secondaryActions = [{ content: 'Back', onAction: () => setStep(2) }, { content: 'Cancel', onAction: close }];
  }

  const locs = chosen?.locations || [];
  const termsShown = ac.termsExpanded ? locs : locs.slice(0, TERMS_PREVIEW);
  const termsHidden = Math.max(0, locs.length - termsShown.length);

  const addedKinds = KIND_ORDER.filter((k) => policyByKind[k] && k !== addKind);

  return (
    <Modal
      open
      onClose={close}
      title={ac.step === 1 ? 'Add company from Shopify' : 'Set up Shopify company'}
      size="large"
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <InlineStack gap="150" wrap>
            {STEPS.map((s, i) => (
              <Badge key={s} tone={i + 1 === ac.step ? 'info' : i + 1 < ac.step ? 'success' : undefined}>
                {`${i + 1}. ${s}`}
              </Badge>
            ))}
          </InlineStack>
          <Divider />

          {/* STEP 1 — pick a Shopify company (searchable directory) */}
          {ac.step === 1 &&
            (isEmpty ? (
              <Banner tone="info">Every Shopify company is already in the B2B app.</Banner>
            ) : (
              <BlockStack gap="300">
                <TextField
                  label="Search"
                  labelHidden
                  placeholder="Search company, location or buyer email"
                  value={ac.search || ''}
                  onChange={(v) => patch({ search: v })}
                  prefix={<Icon source={SearchIcon} tone="subdued" />}
                  autoComplete="off"
                />
                <Text as="span" tone="subdued" variant="bodySm">{`${filtered.length} available`}</Text>
                {filtered.length === 0 ? (
                  <Text as="p" tone="subdued">No Shopify company matches your search.</Text>
                ) : (
                  <BlockStack gap="200">
                    {filtered.map((shp) => {
                      const sel = ac.shopifyId === shp.id;
                      return (
                        <button
                          key={shp.id}
                          type="button"
                          onClick={() => patch({ shopifyId: shp.id })}
                          style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                        >
                          <Box
                            padding="300"
                            borderWidth="025"
                            borderRadius="200"
                            borderColor={sel ? 'border-emphasis' : 'border'}
                          >
                            <InlineStack align="space-between" blockAlign="center" wrap={false}>
                              <BlockStack gap="050">
                                <Text as="span" variant="bodyMd" fontWeight="medium">
                                  {shp.name}
                                </Text>
                                <Text as="span" tone="subdued" variant="bodySm">
                                  {`${(shp.locations || []).length} location${(shp.locations || []).length === 1 ? '' : 's'} · ${(shp.contacts || []).length} contact${(shp.contacts || []).length === 1 ? '' : 's'}`}
                                </Text>
                              </BlockStack>
                              {sel ? <Badge tone="success">Selected</Badge> : null}
                            </InlineStack>
                          </Box>
                        </button>
                      );
                    })}
                  </BlockStack>
                )}
                <Text as="p" tone="subdued" variant="bodySm">
                  {chosen ? (
                    <>
                      <Text as="span" fontWeight="semibold">
                        {chosen.name}
                      </Text>
                      {' selected. Continue to set its pricing and review.'}
                    </>
                  ) : (
                    'Select a company to link it to the B2B app. All of its Shopify locations come with it.'
                  )}
                </Text>
              </BlockStack>
            ))}

          {/* STEP 2 — assign pricing (whole company shares it) */}
          {ac.step === 2 && (
            <BlockStack gap="300">
              <Text as="p" tone="subdued" variant="bodySm">
                {`Every location of ${chosen?.name || 'the company'} shares one pricing. A company can hold one profile per pricing type.`}
              </Text>

              {/* Committed pricings (not the one being edited) */}
              {addedKinds.map((k) => {
                const p = setupPolicy(policyByKind[k]);
                if (!p) return null;
                const madeHere = !!createdHere[k];
                return (
                  <Box key={k} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                    <InlineStack align="space-between" blockAlign="center" gap="200">
                      <BlockStack gap="025">
                        <Text as="span" variant="bodyMd" fontWeight="medium">{p.name}</Text>
                        <Text as="span" tone="subdued" variant="bodySm">{kindName(k)}</Text>
                      </BlockStack>
                      <InlineStack gap="100">
                        {madeHere ? (
                          <Button icon={EditIcon} variant="tertiary" accessibilityLabel="Edit pricing" onClick={() => editCommitted(k)} />
                        ) : (
                          <Button
                            icon={ExchangeIcon}
                            variant="tertiary"
                            accessibilityLabel={`Change ${kindName(k).toLowerCase()}`}
                            onClick={() => openAdd(k)}
                          />
                        )}
                        <Button
                          icon={XIcon}
                          variant="tertiary"
                          tone="critical"
                          accessibilityLabel={`Remove ${kindName(k).toLowerCase()}`}
                          onClick={() => removeKind(k)}
                        />
                      </InlineStack>
                    </InlineStack>
                  </Box>
                );
              })}
              {KIND_ORDER.some((k) => createdHere[k] && policyByKind[k] && k !== addKind) ? (
                <Text as="span" tone="subdued" variant="bodySm">
                  A pricing created here can’t be swapped for a template. Remove it to pick a template, or edit it.
                </Text>
              ) : null}

              {/* Chooser | type cards | both-set note */}
              {addKind ? (
                <PricingChooser
                  addKind={addKind}
                  taken={!!policyByKind[addKind]}
                  options={b2bBy(addKind)}
                  cur={ac.draftPolicy || ''}
                  sel={setupPolicy(ac.draftPolicy)}
                  justBuilt={!!(setupPolicy(ac.draftPolicy) && ac.draftIsNew)}
                  scopeLabel={scopeLabel}
                  priceCalcLabel={priceCalcLabel}
                  usageCount={(p) => policyUsageCount(p, state.db)}
                  usageLabel={(p) => policyUsage(p, state.db)}
                  onSelect={selectDraft}
                  onEditDraft={editDraft}
                  onDiscard={discardKind}
                  onSave={saveKind}
                  onCreateNew={createNew}
                />
              ) : addedCount < KIND_ORDER.length ? (
                <InlineStack gap="200" wrap>
                  {KIND_ORDER.map((k) => {
                    const taken = !!policyByKind[k];
                    return (
                      <div key={k} style={{ flex: '1 1 220px', minWidth: 200 }}>
                        <button
                          type="button"
                          disabled={taken}
                          onClick={taken ? undefined : () => openAdd(k)}
                          style={{ all: 'unset', display: 'block', width: '100%', cursor: taken ? 'default' : 'pointer' }}
                        >
                          <Box
                            padding="300"
                            borderWidth="025"
                            borderRadius="200"
                            borderColor={taken ? 'border-disabled' : 'border'}
                            background={taken ? 'bg-surface-secondary' : undefined}
                          >
                            <BlockStack gap="050">
                              <Text as="span" variant="bodyMd" fontWeight="medium" tone={taken ? 'subdued' : undefined}>
                                {`${taken ? '✓' : '+'} ${kindName(k)}`}
                              </Text>
                              <Text as="span" tone="subdued" variant="bodySm">
                                {taken ? 'Already added' : kindPurpose(k)}
                              </Text>
                            </BlockStack>
                          </Box>
                        </button>
                      </div>
                    );
                  })}
                </InlineStack>
              ) : (
                <Text as="span" tone="subdued" variant="bodySm">Both pricing types are set.</Text>
              )}

              {addedCount === 0 && !addKind ? (
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
                <Kv label="Company" value={chosen.name} />
                <Kv label="Locations" value={locs.map((l) => l.name).join(', ')} />
                <Kv label="Contacts of company" value={String((chosen.contacts || []).length)} />
                <Kv label="Main contact" value={chosen.contacts?.[0]?.name || 'None on this company'} />
              </ReviewBlock>

              <ReviewBlock head="Pricing setup">
                {anyPricing ? (
                  <BlockStack gap="150">
                    {ac.baseId ? <PriceRow name={policyName(ac.baseId)} kind="Base pricing" /> : null}
                    {ac.quantityId ? <PriceRow name={policyName(ac.quantityId)} kind="Quantity pricing" /> : null}
                  </BlockStack>
                ) : (
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="025">
                      <Text as="span" variant="bodyMd">
                        No pricing yet
                      </Text>
                      <Text as="span" tone="subdued" variant="bodySm">
                        Assign a profile from the Pricing page after setup.
                      </Text>
                    </BlockStack>
                    <Badge tone="warning">Assign later</Badge>
                  </InlineStack>
                )}
              </ReviewBlock>

              <ReviewBlock head="Ordering and payment terms">
                <BlockStack gap="150">
                  {termsShown.map((l) => (
                    <BlockStack key={l.id} gap="025">
                      <Text as="span" variant="bodyMd">
                        {l.name}
                      </Text>
                      <Text as="span" tone="subdued" variant="bodySm">
                        {`${l.ordering || 'Buys directly'} · ${l.terms || 'Net 30'}`}
                      </Text>
                    </BlockStack>
                  ))}
                  {(termsHidden > 0 || ac.termsExpanded) && (
                    <Box>
                      <Button variant="plain" onClick={() => patch({ termsExpanded: !ac.termsExpanded })}>
                        {ac.termsExpanded
                          ? 'Show fewer locations'
                          : `Show ${termsHidden} more location${termsHidden === 1 ? '' : 's'}`}
                      </Button>
                    </Box>
                  )}
                </BlockStack>
              </ReviewBlock>

              <Banner
                tone={anyPricing ? 'success' : 'warning'}
                title={anyPricing ? 'Ready to add and apply' : 'Ready to add without pricing'}
              >
                <p>
                  {anyPricing
                    ? `Pricing will apply to all ${locs.length} location${locs.length === 1 ? '' : 's'}.`
                    : 'The company and its locations are added now. Buyers can’t order until pricing is assigned from the Pricing page.'}
                </p>
              </Banner>
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
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

function PriceRow({ name, kind }) {
  return (
    <InlineStack align="space-between" blockAlign="center">
      <Text as="span" variant="bodyMd">
        {name}
      </Text>
      <Badge tone="info">{kind}</Badge>
    </InlineStack>
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
