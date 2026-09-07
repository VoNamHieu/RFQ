import React from 'react';
import { TextField, Select, Text, InlineStack, Box, Icon } from '@shopify/polaris';
import { SearchIcon, ImageIcon } from '@shopify/polaris-icons';

// Read-only product price table styled like the Shopify resource picker (see
// ProductPickerModal / VariantPicker): a search + sort row, a grey column-header
// bar, thumbnail rows (image + title + subtitle), and a scrollable body. Shared by
// the price-preview modals so they match the pickers. Filtering/sorting stay with
// the caller (the price semantics differ per modal); this renders the controls and
// the rows it is handed.
//
//   columns: [{ title, width, align }]           — the columns AFTER the Product one
//   rows:    [{ key, title, subtitle, cells: [node,…], action? }]  cells align to columns
const THUMB = {
  width: 32,
  height: 32,
  borderRadius: 6,
  background: 'var(--p-color-bg-surface-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
};
const cellStyle = (align) => ({
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: align === 'end' ? 'flex-end' : 'flex-start',
});

export function ProductPriceTable({
  search,
  onSearch,
  sort,
  onSort,
  sortOptions,
  columns,
  rows,
  emptyLabel,
  searchPlaceholder = 'Search by product name or SKU',
  maxHeight = 420,
}) {
  const hasAction = rows.some((r) => r.action);
  const grid = {
    display: 'grid',
    gridTemplateColumns: `minmax(160px, 1fr) ${columns.map((c) => c.width).join(' ')}${hasAction ? ' 44px' : ''}`,
    gap: 12,
    alignItems: 'center',
  };

  return (
    <>
      <InlineStack gap="200" blockAlign="center" wrap={false}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TextField
            label="Search products"
            labelHidden
            value={search}
            onChange={onSearch}
            prefix={<Icon source={SearchIcon} tone="subdued" />}
            placeholder={searchPlaceholder}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => onSearch('')}
          />
        </div>
        {sortOptions ? (
          <div style={{ width: 210, flex: '0 0 auto' }}>
            <Select label="Sort by" labelHidden options={sortOptions} value={sort} onChange={onSort} />
          </div>
        ) : null}
      </InlineStack>

      <Box borderWidth="025" borderColor="border" borderRadius="200">
        {/* Column header */}
        <Box background="bg-surface-secondary" borderBlockEndWidth="025" borderColor="border" paddingBlock="150" paddingInline="300">
          <div style={grid}>
            <div style={cellStyle('start')}>
              <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">Product</Text>
            </div>
            {columns.map((c, i) => (
              <div key={i} style={cellStyle(c.align)}>
                <Text as="span" variant="bodySm" tone="subdued" fontWeight="medium">{c.title}</Text>
              </div>
            ))}
            {hasAction ? <span /> : null}
          </div>
        </Box>

        {/* Scrollable body */}
        <div style={{ maxHeight, overflowY: 'auto', overflowX: 'hidden' }}>
          {rows.length === 0 ? (
            <Box padding="400">
              <Text as="p" alignment="center" tone="subdued">{emptyLabel}</Text>
            </Box>
          ) : (
            rows.map((r, i) => (
              <Box key={r.key} paddingBlock="200" paddingInline="300" borderBlockStartWidth={i === 0 ? '0' : '025'} borderColor="border">
                <div style={grid}>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <span style={THUMB}>
                      <Icon source={ImageIcon} tone="subdued" />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <Text as="span" variant="bodyMd" fontWeight="medium" truncate>{r.title}</Text>
                      {r.subtitle ? (
                        <Text as="p" tone="subdued" variant="bodySm" truncate>{r.subtitle}</Text>
                      ) : null}
                    </div>
                  </InlineStack>
                  {columns.map((c, ci) => (
                    <div key={ci} style={cellStyle(c.align)}>
                      {r.cells[ci]}
                    </div>
                  ))}
                  {hasAction ? <div style={cellStyle('end')}>{r.action}</div> : null}
                </div>
              </Box>
            ))
          )}
        </div>
      </Box>
    </>
  );
}
