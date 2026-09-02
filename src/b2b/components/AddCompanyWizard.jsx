import React from 'react';
import { Modal, BlockStack, InlineStack, Box, Text, Badge, TextField, Select, Divider, Banner, Button, Icon } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/directory.js';
import { kindOf } from '../pricing.js';

// Add a Shopify company to B2B — mirrors the god file's two-modal flow
// ("Add company from Shopify" → "Set up Shopify company"). Three steps, not
// four: the Company's Shopify Locations all come with it, so there is no
// Location choice to make — setup is Company, then pricing, then review.
const STEPS = ['Company', 'Assign pricing', 'Review'];
const KIND_META = {
  base: { name: 'Base pricing', purpose: 'The list price B2B buyers pay before quantity breaks.' },
  quantity: { name: 'Quantity pricing', purpose: 'An extra discount as the order quantity grows.' },
};
const TERMS_PREVIEW = 3;

export function AddCompanyWizard() {
  const { state, dispatch } = useStore();
  const ac = state.addCompany;
  if (!ac) return null;

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
  const baseOptions = [{ label: 'Assign later', value: '' }, ...b2bBy('base').map((p) => ({ label: p.name, value: p.id }))];
  const qtyOptions = [{ label: 'Assign later', value: '' }, ...b2bBy('quantity').map((p) => ({ label: p.name, value: p.id }))];
  const policyName = (id) => state.db.policies.find((p) => p.id === id)?.name || '';
  const anyPricing = !!(ac.baseId || ac.quantityId);

  const patch = (p) => dispatch({ type: 'ADD_COMPANY_PATCH', patch: p });
  const setStep = (step) => dispatch({ type: 'ADD_COMPANY_STEP', step });
  const close = () => dispatch({ type: 'CLOSE_ADD_COMPANY' });

  let primaryAction;
  let secondaryActions;
  if (ac.step === 1) {
    primaryAction = { content: 'Continue', onAction: () => setStep(2), disabled: !ac.shopifyId };
    secondaryActions = [{ content: 'Cancel', onAction: close }];
  } else if (ac.step === 2) {
    primaryAction = { content: anyPricing ? 'Review setup' : 'Continue without pricing', onAction: () => setStep(3) };
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
                {`Every location of ${chosen?.name || 'the company'} shares one pricing. Pick existing profiles or assign them later.`}
              </Text>
              {[
                { kind: 'base', value: ac.baseId, options: baseOptions, on: (v) => patch({ baseId: v }) },
                { kind: 'quantity', value: ac.quantityId, options: qtyOptions, on: (v) => patch({ quantityId: v }) },
              ].map(({ kind, value, options, on }) => (
                <Box key={kind} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                  <BlockStack gap="150">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="span" variant="bodyMd" fontWeight="medium">
                        {KIND_META[kind].name}
                      </Text>
                      {value ? <Badge tone="success">Added</Badge> : <Badge>Optional</Badge>}
                    </InlineStack>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {KIND_META[kind].purpose}
                    </Text>
                    <Select label={KIND_META[kind].name} labelHidden options={options} value={value || ''} onChange={on} />
                  </BlockStack>
                </Box>
              ))}
              {!anyPricing && (
                <Banner tone="warning" title="No pricing yet">
                  <p>
                    You can still finish setup. The company and its locations are added, but buyers can’t order until
                    pricing is assigned from the Pricing page.
                  </p>
                </Banner>
              )}
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
