import React, { useState } from 'react';

// "Created date" filter body (production: components/common/OmegaDateFilterContent.tsx).
// Two DD/MM/YYYY text fields; focusing one opens its calendar below it. The start
// calendar can't go past the end date and the end calendar can't go before the start.

const pad = (n) => String(n).padStart(2, '0');

// DD/MM/YYYY (or YYYY-MM-DD) → local Date at midnight, or null when empty/invalid.
export function parseDateString(str) {
  if (!str) return null;
  const parts = str.split('/');
  let iso = str;
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (!dd || !mm || !yyyy || yyyy.length !== 4) return null;
    iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const toDisplay = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toView = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const isoToDisplay = (iso) => {
  const d = parseDateString(iso);
  return d ? toDisplay(d) : '';
};

function DateBlock({ heading, value, onChange, open, onFocus, disallow }) {
  const selected = parseDateString(value);
  // Remount on a month change so a typed date brings its month into view.
  const view = toView(selected || new Date());
  return (
    <s-stack gap="small-200">
      <s-heading>{heading}</s-heading>
      <s-text-field
        label={heading}
        labelAccessibilityVisibility="exclusive"
        value={value}
        placeholder="DD/MM/YYYY"
        autocomplete="off"
        onInput={(e) => onChange(e.currentTarget.value)}
        onFocus={onFocus}
      />
      {open ? (
        <s-date-picker
          key={view}
          type="single"
          value={selected ? toIso(selected) : ''}
          defaultView={view}
          disallow={disallow}
          onChange={(e) => {
            const next = isoToDisplay(e.currentTarget.value);
            if (next && next !== value) onChange(next);
          }}
        />
      ) : null}
    </s-stack>
  );
}

export function DateFilterContent({ startDate, endDate, onStartDateChange, onEndDateChange }) {
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const startObj = parseDateString(startDate);
  const endObj = parseDateString(endDate);

  return (
    <div className="discounts-date-filter">
      <s-stack gap="base">
        <DateBlock
          heading="Starting date"
          value={startDate}
          onChange={onStartDateChange}
          open={showStart}
          onFocus={() => {
            setShowStart(true);
            setShowEnd(false);
          }}
          disallow={endObj ? `${toIso(addDays(endObj, 1))}--` : ''}
        />
        <DateBlock
          heading="Ending date"
          value={endDate}
          onChange={onEndDateChange}
          open={showEnd}
          onFocus={() => {
            setShowEnd(true);
            setShowStart(false);
          }}
          disallow={startObj ? `--${toIso(addDays(startObj, -1))}` : ''}
        />
      </s-stack>
    </div>
  );
}
