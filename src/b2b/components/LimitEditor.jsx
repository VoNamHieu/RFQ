import React, { useState } from 'react';
import { Page, Card, BlockStack, InlineGrid, InlineStack, Text, TextField, Select, ChoiceList, Button, Tag, Modal, InlineError, Box } from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitErrors, defaultLimitMessage, normalizeLimit } from '../limits.js';
import { ProductScopeCard } from './pricingEditorCards.jsx';
import { COLLECTIONS } from '../data/constants.js';
import { SelectCompaniesModal, companyPicks } from './AssignmentCard.jsx';

const str = (v) => (v == null ? '' : String(v));
// Errors that only mean "not filled in yet" wait for a save attempt; the rest
// (min above max, not a multiple…) show as soon as they're true.
const REQUIRED = ['name', 'order', 'product', 'products', 'threshold', 'targets'];

// Create / edit one order limit — an in-frame page in the Order limits view (see
// the OPEN_LIMIT_EDITOR action). Settings in the main column; status and who it
// applies to in the aside, like the pricing editor.
export function LimitEditor() {
  const { state, dispatch } = useStore();
  const draft = state.limitEditor.draft;
  const [tried, setTried] = useState(false);
  const [companyModal, setCompanyModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const patch = (p) => dispatch({ type: 'LIMIT_EDITOR_PATCH', patch: p });
  const close = () => dispatch({ type: 'CLOSE_LIMIT_EDITOR' });

  const isNew = !draft.id;
  const kind = LIMIT_KINDS[draft.kind];
  const allErrors = limitErrors(draft);
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([k]) => tried || !REQUIRED.includes(k)));
  const save = () => (Object.keys(allErrors).length ? setTried(true) : dispatch({ type: 'SAVE_LIMIT' }));

  const picks = companyPicks(state.db, draft.companyIds || [], draft.locationKeys || [], ({ companyIds, locationKeys }) =>
    patch({ companyIds, locationKeys }),
  );

  const numberField = (key, label, opts = {}) => (
    <TextField
      label={label}
      type="number"
      min={opts.step === 1 ? 1 : 0}
      step={opts.step}
      prefix={opts.money ? '$' : undefined}
      suffix={opts.suffix}
      value={str(draft[key])}
      onChange={(v) => patch({ [key]: v })}
      error={errors[key]}
      helpText={opts.helpText}
      placeholder={opts.placeholder ?? 'No limit'}
      autoComplete="off"
    />
  );

  return (
    <Page
      title={isNew ? `Create ${kind.label.toLowerCase()}` : `Edit limit: ${draft.name}`}
      backAction={{ content: 'Order limits', onAction: close }}
      primaryAction={{ content: isNew ? 'Create limit' : 'Save', onAction: save }}
      secondaryActions={[
        ...(isNew ? [] : [{ content: 'Delete', destructive: true, onAction: () => setConfirmDelete(true) }]),
        { content: 'Cancel', onAction: close },
      ]}
    >
      <InlineGrid columns={{ xs: '1fr', md: '2fr 1fr' }} gap="400" alignItems="start">
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm">{kind.label}</Text>
                <Text as="p" tone="subdued" variant="bodySm">{kind.description}</Text>
              </BlockStack>
              <TextField
                label="Name"
                requiredIndicator
                value={draft.name}
                onChange={(v) => patch({ name: v })}
                error={errors.name}
                helpText="Only you see this."
                maxLength={255}
                autoComplete="off"
              />
            </BlockStack>
          </Card>

          {draft.kind === 'order' && (
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">Order value</Text>
                  <InlineGrid columns={2} gap="300">
                    {numberField('minValue', 'Minimum', { money: true })}
                    {numberField('maxValue', 'Maximum', { money: true })}
                  </InlineGrid>
                  <Text as="p" tone="subdued" variant="bodySm">The cart subtotal at the buyer’s B2B prices, before tax and shipping.</Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">Order quantity</Text>
                  <InlineGrid columns={2} gap="300">
                    {numberField('minQty', 'Minimum', { step: 1, suffix: 'units' })}
                    {numberField('maxQty', 'Maximum', { step: 1, suffix: 'units' })}
                  </InlineGrid>
                  <Text as="p" tone="subdued" variant="bodySm">All items in the cart added together.</Text>
                </BlockStack>
                {errors.order && <InlineError message={errors.order} fieldID="order-limits" />}
              </BlockStack>
            </Card>
          )}

          {draft.kind === 'product' && (
            <>
              <ProductScopeCard
                builder={draft}
                // Switching to a collection picks the first one, as the select shows it.
                patch={(p) => patch(p.scopeType === 'collection' && !draft.collection ? { ...p, collection: Object.keys(COLLECTIONS)[0] } : p)}
                products={state.db.products}
              />
              {errors.products && <InlineError message={errors.products} fieldID="limit-products" />}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">Quantity per product</Text>
                  <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                    {numberField('min', 'Minimum', { step: 1 })}
                    {numberField('max', 'Maximum', { step: 1 })}
                    {numberField('increment', 'Sold in multiples of', { step: 1, placeholder: '1' })}
                  </InlineGrid>
                  <Text as="p" tone="subdued" variant="bodySm">
                    Counted per variant, like Shopify’s quantity rules. Use multiples for case packs, e.g. 12. The minimum and maximum must be multiples of it.
                  </Text>
                  {errors.product && <InlineError message={errors.product} fieldID="limit-product-qty" />}
                </BlockStack>
              </Card>
            </>
          )}

          {draft.kind === 'review' && (
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Amount</Text>
                {numberField('threshold', 'Review orders above', {
                  money: true,
                  placeholder: '',
                  helpText: 'Buyers can’t check out above this amount. They send the order to you instead, and it arrives as a draft order for you to approve or edit.',
                })}
              </BlockStack>
            </Card>
          )}

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Buyer message</Text>
              <TextField
                label="Message buyers see"
                multiline={2}
                value={draft.message || ''}
                onChange={(v) => patch({ message: v })}
                placeholder={defaultLimitMessage(normalizeLimit(draft))}
                helpText="Shown in the cart and at checkout when an order breaks this limit. Leave it empty to use the suggested message."
                autoComplete="off"
              />
            </BlockStack>
          </Card>
        </BlockStack>

        <BlockStack gap="400">
          <Card>
            <Select
              label="Status"
              options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
              value={draft.status}
              onChange={(v) => patch({ status: v })}
            />
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">Applies to</Text>
              <ChoiceList
                title="Applies to"
                titleHidden
                choices={[
                  { label: 'Store-wide', value: 'store', helpText: 'Every B2B company and location.' },
                  { label: 'Specific companies and locations', value: 'specific' },
                ]}
                selected={[draft.storeWide ? 'store' : 'specific']}
                onChange={([v]) => patch({ storeWide: v === 'store' })}
              />
              {!draft.storeWide && (
                <BlockStack gap="200">
                  <Button icon={SearchIcon} textAlign="left" fullWidth onClick={() => setCompanyModal(true)}>
                    Select companies
                  </Button>
                  {picks.selectedCompanies.length ? (
                    <InlineStack gap="150" wrap>
                      {picks.selectedCompanies.map((c) => (
                        <Tag key={c.id} onRemove={() => picks.setTicked(c, [])}>{picks.tagLabel(c)}</Tag>
                      ))}
                    </InlineStack>
                  ) : null}
                  {errors.targets && <InlineError message={errors.targets} fieldID="limit-targets" />}
                </BlockStack>
              )}
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">When limits overlap</Text>
              <Text as="p" tone="subdued" variant="bodySm">
                The most specific limit wins: a location’s own, then its company’s, then store-wide. So you can give one account a lower minimum than everyone else.
              </Text>
            </BlockStack>
          </Card>
        </BlockStack>
      </InlineGrid>
      <Box paddingBlockEnd="1600" />

      <SelectCompaniesModal
        open={companyModal}
        companies={picks.companies}
        tickedOf={picks.tickedOf}
        onToggleCompany={picks.toggleCompany}
        onToggleLocation={picks.toggleLocation}
        onClose={() => setCompanyModal(false)}
      />

      {confirmDelete && (
        <Modal
          open
          onClose={() => setConfirmDelete(false)}
          title={`Delete ${draft.name}?`}
          primaryAction={{ content: 'Delete limit', destructive: true, onAction: () => dispatch({ type: 'DELETE_LIMIT', id: draft.id }) }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setConfirmDelete(false) }]}
        >
          <Modal.Section>
            <Text as="p">Buyers it applies to can check out without it right away. This can’t be undone.</Text>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
