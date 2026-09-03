import React from 'react';
import { BlockStack, InlineStack, Box, Text, Button } from '@shopify/polaris';

// A centered empty state WITHOUT Polaris EmptyState's image slot. That slot
// renders a circular SkeletonImage placeholder (border-radius 9999px) that
// flashes in the middle whenever no real image is supplied (image=""). This
// keeps the same heading / text / actions with none of that flash.
export function EmptyBlock({ heading, children, action, secondaryAction }) {
  return (
    <Box padding="800">
      <BlockStack gap="200" inlineAlign="center">
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
