import React, { useEffect, useMemo, useState } from 'react';
import { useWcId } from '../../../shared/wc.jsx';
import { DRP } from './copy.js';
import { TODAY, addDays, endOfDay, formatPP, parseYmd, ymd } from './model.js';

// components/core/DateRangePicker: a calendar button opening a popover with the preset
// list (an OptionList on wide screens, a Select on narrow ones), Since → Until fields,
// a range calendar (two months on large screens) and Cancel / Apply.

function useMatchMedia(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

export function buildRanges(today = TODAY) {
  const yesterday = addDays(today, -1);
  const firstOfMonth = (monthsAgo) => new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
  const lastOfMonth = (monthsAgo) => new Date(today.getFullYear(), today.getMonth() - monthsAgo + 1, 0);
  return [
    { alias: 'today', title: DRP.today, since: today, until: endOfDay(today) },
    { alias: 'yesterday', title: DRP.yesterday, since: yesterday, until: endOfDay(yesterday) },
    { alias: 'last7days', title: DRP.last7days, since: addDays(today, -7), until: endOfDay(yesterday) },
    { alias: 'last30days', title: DRP.last30days, since: addDays(today, -30), until: endOfDay(yesterday) },
    { alias: 'thisMonth', title: DRP.thisMonth, since: firstOfMonth(0), until: endOfDay(today) },
    { alias: 'lastMonth', title: DRP.lastMonth, since: firstOfMonth(1), until: endOfDay(lastOfMonth(1)) },
    { alias: 'last60days', title: DRP.last60days, since: addDays(today, -60), until: endOfDay(yesterday) },
    { alias: 'custom', title: DRP.custom, since: addDays(today, -7), until: endOfDay(yesterday) },
  ];
}

const customRange = (since, until) => ({ alias: 'custom', title: DRP.custom, since, until });

function matchRange(ranges, start, end) {
  return (
    ranges.find((r) => r.since.valueOf() === start?.valueOf() && r.until.valueOf() === end?.valueOf()) ||
    customRange(start, end)
  );
}

export const rangeLabel = (range) =>
  range.alias === 'custom' ? `${formatPP(range.since)} - ${formatPP(range.until)}` : range.title;

const monthOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function DateRangePicker({ startDate, endDate, onChange, disableDatesBefore, disableDatesAfter = TODAY }) {
  const popId = useWcId('qan-drp');
  const multiMonth = useMatchMedia('(min-width: 1280px)');
  const ranges = useMemo(() => buildRanges(TODAY), []);
  const applied = useMemo(() => matchRange(ranges, startDate, endDate), [ranges, startDate, endDate]);
  const [draft, setDraft] = useState(applied);
  const [view, setView] = useState(monthOf(applied.until));

  // Snap the calendar to the range's end month (previous + end month when two show).
  const snapTo = (range) => {
    const u = range.until;
    setView(monthOf(new Date(u.getFullYear(), u.getMonth() - (multiMonth ? 1 : 0), 1)));
  };
  const resetDraft = () => {
    setDraft(applied);
    snapTo(applied);
  };
  useEffect(() => {
    setDraft(applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  const pick = (alias) => {
    const r = ranges.find((x) => x.alias === alias);
    if (!r) return;
    setDraft(r);
    snapTo(r);
  };

  const onCalendarChange = (value) => {
    const [a, b] = String(value || '').split('--');
    const since = parseYmd(a);
    const until = parseYmd(b);
    if (!since || !until) return;
    setDraft(customRange(since, until));
  };

  const apply = () => onChange(draft.since, endOfDay(draft.until));

  return (
    <div>
      <s-button icon="calendar" commandFor={popId}>
        {rangeLabel(applied)}
      </s-button>
      <s-popover id={popId} onShow={resetDraft}>
        <div className="qan-drp">
          <div className="qan-drp__options" role="listbox" aria-label="Date range">
            {ranges.map((r) => (
              <button
                key={r.alias}
                type="button"
                role="option"
                aria-selected={draft.alias === r.alias}
                className="qan-drp__option"
                onClick={() => pick(r.alias)}
              >
                {r.title}
              </button>
            ))}
          </div>
          <div className="qan-drp__select">
            <s-select
              label="Date range"
              labelAccessibilityVisibility="exclusive"
              value={draft.alias}
              onChange={(e) => pick(e.currentTarget.value)}
            >
              {ranges.map((r) => (
                <s-option key={r.alias} value={r.alias}>
                  {r.title}
                </s-option>
              ))}
            </s-select>
          </div>
          <div className="qan-drp__main">
            <s-stack gap="base">
              <div className="qan-drp__fields">
                <s-text-field
                  label={DRP.since}
                  labelAccessibilityVisibility="exclusive"
                  icon="calendar"
                  value={ymd(draft.since)}
                  disabled
                />
                <s-icon type="arrow-right" />
                <s-text-field
                  label={DRP.until}
                  labelAccessibilityVisibility="exclusive"
                  icon="calendar"
                  value={ymd(draft.until)}
                  disabled
                />
              </div>
              <s-date-picker
                type="range"
                value={`${ymd(draft.since)}--${ymd(draft.until)}`}
                view={view}
                visibleMonths={multiMonth ? '2' : '1'}
                allow={`${disableDatesBefore ? ymd(disableDatesBefore) : ''}--${ymd(disableDatesAfter)}`}
                onViewChange={(e) => setView(e.currentTarget.view)}
                onChange={(e) => onCalendarChange(e.currentTarget.value)}
              />
            </s-stack>
          </div>
        </div>
        <div className="qan-drp__footer">
          <s-button commandFor={popId} command="--hide">
            {DRP.cancel}
          </s-button>
          <s-button variant="primary" commandFor={popId} command="--hide" onClick={apply}>
            {DRP.apply}
          </s-button>
        </div>
      </s-popover>
    </div>
  );
}
