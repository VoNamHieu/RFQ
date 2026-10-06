import React from 'react';

// A centered empty state: heading / text / actions, with optional art.
//
// `image` (optional) is a bundled illustration URL — pass one to show art above
// the heading. It renders nothing when omitted, so text-only empty states have
// no image placeholder.
export function EmptyBlock({ heading, children, action, secondaryAction, image, imageAlt }) {
  return (
    <s-box padding="large-300">
      <s-stack gap="small-200" alignItems="center">
        {image ? (
          // Size by height (not width) so illustrations with different content
          // aspect ratios still render at a consistent visual size. Art is trimmed
          // to its content, so the height maps directly to the drawn subject.
          <s-box maxInlineSize="320px" paddingBlockEnd="small-200">
            <img src={image} alt={imageAlt || ''} style={{ display: 'block', height: 140, width: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }} />
          </s-box>
        ) : null}
        {heading ? (
          <div style={{ textAlign: 'center' }}>
            <s-heading>{heading}</s-heading>
          </div>
        ) : null}
        {children ? (
          <div style={{ maxWidth: 440, textAlign: 'center' }}>
            <s-text color="subdued">{children}</s-text>
          </div>
        ) : null}
        {action || secondaryAction ? (
          <s-box paddingBlockStart="small-200">
            <s-stack direction="inline" gap="small-200" justifyContent="center">
              {action ? (
                <s-button variant="primary" onClick={action.onAction}>
                  {action.content}
                </s-button>
              ) : null}
              {secondaryAction ? <s-button onClick={secondaryAction.onAction}>{secondaryAction.content}</s-button> : null}
            </s-stack>
          </s-box>
        ) : null}
      </s-stack>
    </s-box>
  );
}
