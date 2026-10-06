import React from 'react';

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
  toolbar = null, // extra control(s) between search and sort, e.g. a location picker
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <s-search-field
            label="Search products"
            labelAccessibilityVisibility="exclusive"
            value={search}
            placeholder={searchPlaceholder}
            autocomplete="off"
            onInput={(e) => onSearch(e.currentTarget.value)}
          />
        </div>
        {toolbar}
        {sortOptions ? (
          <div style={{ width: 210, flex: '0 0 auto' }}>
            <s-select label="Sort by" labelAccessibilityVisibility="exclusive" value={sort} onChange={(e) => onSort(e.currentTarget.value)}>
              {sortOptions.map((o) => (
                <s-option key={o.value} value={o.value}>
                  {o.label}
                </s-option>
              ))}
            </s-select>
          </div>
        ) : null}
      </div>

      <s-box border="base" borderRadius="base" overflow="hidden">
        {/* Column header */}
        <s-box background="subdued" paddingBlock="small-300" paddingInline="small">
          <div style={grid}>
            <div style={cellStyle('start')}>
              <s-text fontSize="small" color="subdued" fontWeight="medium">
                Product
              </s-text>
            </div>
            {columns.map((c, i) => (
              <div key={i} style={cellStyle(c.align)}>
                <s-text fontSize="small" color="subdued" fontWeight="medium">
                  {c.title}
                </s-text>
              </div>
            ))}
            {hasAction ? <span /> : null}
          </div>
        </s-box>
        <s-divider />

        {/* Scrollable body */}
        <div style={{ maxHeight, overflowY: 'auto', overflowX: 'hidden' }}>
          {rows.length === 0 ? (
            <s-box padding="base">
              <div style={{ textAlign: 'center' }}>
                <s-text color="subdued">{emptyLabel}</s-text>
              </div>
            </s-box>
          ) : (
            rows.map((r, i) => (
              <React.Fragment key={r.key}>
                {i > 0 ? <s-divider /> : null}
                <s-box paddingBlock="small-200" paddingInline="small">
                  <div style={grid}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={THUMB}>
                        <s-icon type="image" color="subdued" />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <s-paragraph fontWeight="medium" lineClamp={1}>
                          {r.title}
                        </s-paragraph>
                        {r.subtitle ? (
                          <s-paragraph color="subdued" fontSize="small" lineClamp={1}>
                            {r.subtitle}
                          </s-paragraph>
                        ) : null}
                      </div>
                    </div>
                    {columns.map((c, ci) => (
                      <div key={ci} style={cellStyle(c.align)}>
                        {r.cells[ci]}
                      </div>
                    ))}
                    {hasAction ? <div style={cellStyle('end')}>{r.action}</div> : null}
                  </div>
                </s-box>
              </React.Fragment>
            ))
          )}
        </div>
      </s-box>
    </>
  );
}
