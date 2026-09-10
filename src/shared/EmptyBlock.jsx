import React from 'react';
import { BlockStack, InlineStack, Box, Text, Button } from '@shopify/polaris';

// A centered empty state WITHOUT Polaris EmptyState's image slot. That slot
// renders a circular SkeletonImage placeholder (border-radius 9999px) that
// flashes in the middle whenever no real image is supplied (image=""). This
// keeps the same heading / text / actions with none of that flash.
//
// `image` (optional) is a bundled illustration URL — pass one to show art above
// the heading. Unlike Polaris EmptyState it renders nothing when omitted, so
// there is still no placeholder/flash for the text-only empty states.
export function EmptyBlock({ heading, children, action, secondaryAction, image, imageAlt }) {
  return (
    <Box padding="800">
      <BlockStack gap="200" inlineAlign="center">
        {image ? (
          // Size by height (not width) so illustrations with different content
          // aspect ratios still render at a consistent visual size. Art is trimmed
          // to its content, so the height maps directly to the drawn subject.
          <Box maxWidth="320px" paddingBlockEnd="200">
            <img src={image} alt={imageAlt || ''} style={{ display: 'block', height: 140, width: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }} />
          </Box>
        ) : null}
        {heading ? (
          <Text as="h3" variant="headingSm" alignment="center">
            {heading}
          </Text>
        ) : null}
        {children ? (
          <Box maxWidth="440px">
            <Text as="p" tone="subdued" alignment="center">
              {children}
            </Text>
          </Box>
        ) : null}
        {action || secondaryAction ? (
          <Box paddingBlockStart="200">
            <InlineStack gap="200" align="center">
              {action ? (
                <Button variant="primary" onClick={action.onAction}>
                  {action.content}
                </Button>
              ) : null}
              {secondaryAction ? <Button onClick={secondaryAction.onAction}>{secondaryAction.content}</Button> : null}
            </InlineStack>
          </Box>
        ) : null}
      </BlockStack>
    </Box>
  );
}
