/**
 * withFormSection — Higher-Order Component
 *
 * SOLID: Open/Closed Principle
 *   Section components are closed for modification but open for extension —
 *   wrapping them with this HOC adds consistent heading + divider decoration
 *   without touching the section's own rendering logic.
 *
 * Usage:
 *   const LocationSection = withFormSection(LocationFields, {
 *     title: 'Location',
 *   });
 *
 *   <LocationSection form={form} />  ← receives LocationFields' own props
 */

import React from 'react';
import { Divider, Typography } from 'antd';

const { Text } = Typography;

// ─── Contract ─────────────────────────────────────────────────────────────────

export interface SectionConfig {
  title: string;
  description?: string;
}

// ─── HOC ──────────────────────────────────────────────────────────────────────

export function withFormSection<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  config: SectionConfig,
): React.FC<P> {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';

  function WithSectionWrapper(props: P) {
    return (
      <>
        <Text
          strong
          style={{
            fontSize: 11,
            color: '#8c8c8c',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {config.title}
        </Text>
        <Divider style={{ marginTop: 6, marginBottom: config.description ? 4 : 14 }} />
        {config.description && (
          <Text
            type="secondary"
            style={{ fontSize: 12, display: 'block', marginBottom: 12 }}
          >
            {config.description}
          </Text>
        )}
        <WrappedComponent {...props} />
      </>
    );
  }

  WithSectionWrapper.displayName = `withFormSection(${displayName})`;
  return WithSectionWrapper;
}
