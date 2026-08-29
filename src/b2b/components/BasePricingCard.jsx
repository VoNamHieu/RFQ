import React from 'react';
import {
  Card,
  IndexTable,
  Badge,
  Button,
  ButtonGroup,
  TextField,
  Select,
  Pagination,
  Text,
  InlineStack,
  BlockStack,
  Box,
  Tooltip,
  EmptyState,
  Icon,
} from '@shopify/polaris';
import { EditIcon, ExchangeIcon, XCircleIcon, PlusIcon, SearchIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { companyBaseEntries, policyStatus } from '../pricing.js';
import { openBuildFromQuotes } from './BuildFromQuotes.jsx';

const PAGE_SIZES = [5, 10, 20, 100];

export function BasePricingCard({ company }) {
  const { state, dispatch } = useStore();
  const policies = state.db.policies;
  const entries = companyBaseEntries(company, policies);

  const showTools = entries.length > 5;
  const q = showTools ? (state.basePricingSearch || '').trim().toLowerCase() : '';
  const filtered = q ? entries.filter((e) => e.policy.name.toLowerCase().includes(q)) : entries;
  const size = PAGE_SIZES.includes(state.basePageSize) ? state.basePageSize : 5;
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(Math.max(1, state.basePage), pageCount);
  const start = (page - 1) * size;
  const pageEntries = filtered.slice(start, start + size);

  const closedQuotes = (state.db.quotes || []).filter(
    (query) =>
      query.company === company.id &&
      query.status === 'Deal Closed' &&
      (query.lines || []).some((l) => l.quoted != null),
  );

  const toast = (m) => dispatch({ type: 'TOAST', message: m });

  const priorityHeader = (
    <Tooltip content="Lower number applies first; the rest are fallbacks.">
      <span style={{ borderBottom: '1px dotted var(--p-color-border)', cursor: 'help' }}>Priority</span>
    </Tooltip>
  );

  const rows = pageEntries.map((entry, index) => {
    const p = entry.policy;
    const st = policyStatus(p);
    return (
      <IndexTable.Row id={p.id} key={p.id} position={index}>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" fontWeight="medium">
            {p.name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{entry.priority}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={st.tone}>{st.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="100" align="end" blockAlign="center" wrap={false}>
            <Button
              icon={EditIcon}
              variant="tertiary"
              accessibilityLabel="Edit pricing"
              onClick={() => dispatch({ type: 'OPEN_EDITOR', policy: p, context: { mode: 'edit', companyId: company.id } })}
            />
            <Button
              icon={ExchangeIcon}
              variant="tertiary"
              accessibilityLabel="Change to another base pricing"
              onClick={() => toast('Swap base pricing')}
            />
            <Button
              icon={XCircleIcon}
              variant="tertiary"
              tone="critical"
              accessibilityLabel="Remove this base pricing"
              onClick={() => dispatch({ type: 'REMOVE_COMPANY_BASE', companyId: company.id, policyId: p.id })}
            />
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const footerButtons = (
    <Box padding="300">
      <ButtonGroup>
        <Button
          icon={PlusIcon}
          onClick={() => dispatch({ type: 'OPEN_EDITOR', policy: null, context: { mode: 'add-base', companyId: company.id } })}
        >
          Add base pricing
        </Button>
        {closedQuotes.length > 0 && (
          <Button onClick={() => openBuildFromQuotes(dispatch, company, state.db)}>
            {`Build pricing from closed quote${closedQuotes.length === 1 ? '' : 's'}`}
          </Button>
        )}
      </ButtonGroup>
    </Box>
  );

  if (entries.length === 0) {
    return (
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingSm">
            Base pricing
          </Text>
          <EmptyState
            heading="No base pricing yet"
            action={{ content: 'Add base pricing', onAction: () => toast('Add base pricing') }}
            secondaryAction={
              closedQuotes.length
                ? { content: 'Build pricing from closed quotes', onAction: () => toast('Build from quotes') }
                : undefined
            }
            image=""
          >
            <p>Assign a base pricing so buyers get a B2B price. You can add more than one — the lowest priority applies first.</p>
          </EmptyState>
        </BlockStack>
      </Card>
    );
  }

  return (
    <Card padding="0">
      <Box padding="300" paddingBlockEnd="200">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">
            Base pricing
          </Text>
          <Text as="span" tone="subdued" variant="bodySm">
            The standard B2B price for this company
          </Text>
        </InlineStack>
      </Box>

      {showTools && (
        <Box paddingInline="300" paddingBlockEnd="200">
          <InlineStack gap="300" align="space-between" blockAlign="center" wrap>
            <div style={{ flex: 1, minWidth: 200 }}>
              <TextField
                labelHidden
                label="Search base pricing"
                placeholder="Search base pricing"
                value={state.basePricingSearch}
                onChange={(v) => dispatch({ type: 'BASE_SEARCH', value: v })}
                prefix={<Icon source={SearchIcon} tone="subdued" />}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => dispatch({ type: 'BASE_SEARCH', value: '' })}
              />
            </div>
            <InlineStack gap="150" blockAlign="center" wrap={false}>
              <Text as="span" tone="subdued" variant="bodySm">
                Show
              </Text>
              <Select
                labelHidden
                label="Per page"
                options={PAGE_SIZES.map((n) => ({ label: String(n), value: String(n) }))}
                value={String(size)}
                onChange={(v) => dispatch({ type: 'BASE_PAGE_SIZE', size: Number(v) })}
              />
              <Text as="span" tone="subdued" variant="bodySm">
                per page
              </Text>
            </InlineStack>
          </InlineStack>
        </Box>
      )}

      <IndexTable
        resourceName={{ singular: 'base pricing', plural: 'base pricings' }}
        itemCount={filtered.length}
        selectable={false}
        headings={[
          { title: 'Pricing' },
          { title: priorityHeader },
          { title: 'Status' },
          { title: '', alignment: 'end' },
        ]}
        emptyState={
          <Box padding="400">
            <Text as="p" alignment="center" tone="subdued">
              {`No base pricing matches “${state.basePricingSearch}”.`}
            </Text>
          </Box>
        }
      >
        {rows}
      </IndexTable>

      {showTools && filtered.length > size && (
        <Box padding="300" borderBlockStartWidth="025" borderColor="border">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" tone="subdued" variant="bodySm">
              {`${start + 1}–${start + pageEntries.length} of ${filtered.length}`}
            </Text>
            <InlineStack gap="200" blockAlign="center">
              <Text as="span" tone="subdued" variant="bodySm">
                {`Page ${page} of ${pageCount}`}
              </Text>
              <Pagination
                hasPrevious={page > 1}
                onPrevious={() => dispatch({ type: 'BASE_PAGE', page: page - 1 })}
                hasNext={page < pageCount}
                onNext={() => dispatch({ type: 'BASE_PAGE', page: page + 1 })}
              />
            </InlineStack>
          </InlineStack>
        </Box>
      )}

      {footerButtons}
    </Card>
  );
}
