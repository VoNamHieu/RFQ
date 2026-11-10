import React from 'react';
import './companyLayout.css';

// Read-only product price table, in the company and location pages' look: a search +
// sort row, then a bordered card with a plain table — light headings (they stay on top
// while the rows scroll), rows split by hairlines, two-line cells (the product's title
// over its SKU). Shared by the price-preview modals. Filtering/sorting stay with the
// caller (the price semantics differ per modal); this renders the controls and the rows
// it is handed.
//
//   columns: [{ title, align }]                       — the columns AFTER the Product one
//   rows:    [{ key, title, subtitle, cells: [node,…], onOpen? }]  cells align to columns;
//            `onOpen` makes the row open something (its title is the keyboard target)

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

      <div className="cd-card">
        {rows.length === 0 ? (
          <div className="cd-card__empty">{emptyLabel}</div>
        ) : (
          <div className="cd-table-scroll cd-table-scroll--tall" style={{ maxHeight }}>
            <table className="cd-table cd-table--sticky">
              <thead>
                <tr>
                  <th>Product</th>
                  {columns.map((c, i) => (
                    <th key={i} className={c.align === 'end' ? 'cd-num' : undefined}>
                      {c.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={r.onOpen ? 'cd-row-link' : undefined} onClick={r.onOpen}>
                    <td>
                      {r.onOpen ? (
                        <button type="button" className="cd-link-button">
                          {r.title}
                        </button>
                      ) : (
                        <span className="cd-primary">{r.title}</span>
                      )}
                      {r.subtitle ? <span className="cd-sub">{r.subtitle}</span> : null}
                    </td>
                    {columns.map((c, ci) => (
                      <td key={ci} className={c.align === 'end' ? 'cd-num cd-nowrap' : undefined}>
                        {r.cells[ci]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
