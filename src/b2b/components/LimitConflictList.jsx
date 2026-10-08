import React from 'react';

// The order-limit conflicts a change would cause (see newConflicts in limits.js),
// one per line with where it happens. Shown before saving, turning on or off or
// deleting a limit, and before activating, saving or ending an agreement.
export function LimitConflictList({ conflicts }) {
  return (
    <s-unordered-list>
      {conflicts.map((c) => (
        <s-list-item key={`${c.audience}-${c.text}`}>
          {c.text}{' '}
          <s-text color="subdued">
            At {c.where.length > 3 ? `${c.where.length} ${c.audience === 'd2c' ? 'customer groups' : 'locations'}` : c.where.join(', ')}.
          </s-text>
        </s-list-item>
      ))}
    </s-unordered-list>
  );
}
