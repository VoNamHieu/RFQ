import React from 'react';
import { Modal, BlockStack, Box, Text, RadioButton, Select, Badge, InlineStack, Divider } from '@shopify/polaris';
import { useStore } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/directory.js';

const STEPS = ['Company', 'Locations', 'Assign pricing', 'Review'];

// Add a Shopify company to B2B (spec §2.9), 4 steps.
export function AddCompanyWizard() {
  const { state, dispatch } = useStore();
  const ac = state.addCompany;
  if (!ac) return null;

  const linkedNames = new Set(state.db.companies.map((c) => c.name));
  const available = Object.values(shopifyCompanyDirectory).filter((shp) => !linkedNames.has(shp.name));
  const chosen = ac.shopifyId ? Object.values(shopifyCompanyDirectory).find((s) => s.id === ac.shopifyId) : null;
  const baseOptions = [
    { label: 'Assign later', value: '' },
    ...state.db.policies
      .filter((p) => p.priceKind === 'base' && p.audienceType === 'b2b')
      .map((p) => ({ label: p.name, value: p.id })),
  ];

  const close = () => dispatch({ type: 'CLOSE_ADD_COMPANY' });
  const setStep = (step) => dispatch({ type: 'ADD_COMPANY_STEP', step });

  const nextDisabled = ac.step === 1 && !ac.shopifyId;
  const primary =
    ac.step < 4
      ? { content: 'Next', onAction: () => setStep(ac.step + 1), disabled: nextDisabled }
      : { content: 'Add company', onAction: () => dispatch({ type: 'ADD_COMPANY_CONFIRM' }) };
  const secondary =
    ac.step > 1
      ? [{ content: 'Back', onAction: () => setStep(ac.step - 1) }, { content: 'Cancel', onAction: close }]
      : [{ content: 'Cancel', onAction: close }];

  return (
    <Modal open onClose={close} title="Add a company" size="large" primaryAction={primary} secondaryActions={secondary}>
      <Modal.Section>
        <BlockStack gap="400">
          <InlineStack gap="150" wrap>
            {STEPS.map((s, i) => (
              <Badge key={s} tone={i + 1 === ac.step ? 'info' : undefined}>
                {`${i + 1}. ${s}`}
              </Badge>
            ))}
          </InlineStack>
          <Divider />

          {ac.step === 1 && (
            <BlockStack gap="200">
              <Text as="p" tone="subdued" variant="bodySm">
                Pick a Shopify company that isn’t in the B2B app yet.
              </Text>
              {available.length === 0 ? (
                <Text as="p" tone="subdued">
                  Every Shopify company is already linked.
                </Text>
              ) : (
                available.map((shp) => (
                  <Box
                    key={shp.id}
                    padding="300"
                    borderWidth="025"
                    borderColor={ac.shopifyId === shp.id ? 'border-emphasis' : 'border'}
                    borderRadius="200"
                  >
                    <RadioButton
                      label={shp.name}
                      helpText={`${(shp.locations || []).length} location${(shp.locations || []).length === 1 ? '' : 's'} · ${(shp.contacts || []).length} contact${(shp.contacts || []).length === 1 ? '' : 's'}`}
                      checked={ac.shopifyId === shp.id}
                      id={`addco-${shp.id}`}
                      name="addco"
                      onChange={() => dispatch({ type: 'ADD_COMPANY_PATCH', patch: { shopifyId: shp.id } })}
                    />
                  </Box>
                ))
              )}
            </BlockStack>
          )}

          {ac.step === 2 && chosen && (
            <BlockStack gap="200">
              <Text as="p" tone="subdued" variant="bodySm">
                These locations come from Shopify and will be created in the B2B app.
              </Text>
              {(chosen.locations || []).map((l) => (
                <Box key={l.id} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                  <BlockStack gap="050">
                    <Text as="span" variant="bodyMd" fontWeight="medium">
                      {l.name}
                    </Text>
                    <Text as="span" tone="subdued" variant="bodySm">
                      {`${l.terms || 'Net 30'} · ${l.ordering || 'Buys directly'}`}
                    </Text>
                  </BlockStack>
                </Box>
              ))}
            </BlockStack>
          )}

          {ac.step === 3 && (
            <BlockStack gap="200">
              <Text as="p" tone="subdued" variant="bodySm">
                Give the company a base pricing now, or assign one later.
              </Text>
              <Select
                label="Base pricing"
                options={baseOptions}
                value={ac.baseId}
                onChange={(v) => dispatch({ type: 'ADD_COMPANY_PATCH', patch: { baseId: v } })}
              />
            </BlockStack>
          )}

          {ac.step === 4 && chosen && (
            <BlockStack gap="150">
              <Kv label="Company" value={chosen.name} />
              <Kv label="Locations" value={String((chosen.locations || []).length)} />
              <Kv label="Contacts" value={String((chosen.contacts || []).length)} />
              <Kv label="Base pricing" value={ac.baseId ? state.db.policies.find((p) => p.id === ac.baseId)?.name : 'Assign later'} />
              <Kv label="Main contact" value={chosen.contacts?.[0]?.name} />
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
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
