# Extractable components

There are no standalone reusable layout components; both app shells are embedded in their page components. Skip component extraction for the new marketing landing page.

## StatusPill
- Source: `src/packages/ui/src/index.tsx`
- Category: basic
- Description: Semantic status badge with a colored dot.
- Extractable props: `value`, `tone`
- Hardcoded: pill structure and tone mapping

## MetricCard
- Source: `src/packages/ui/src/index.tsx`
- Category: basic
- Description: Icon-led metric summary card.
- Extractable props: `label`, `value`, `meta`, `color`
- Hardcoded: internal layout and typography

## SectionTitle
- Source: `src/packages/ui/src/index.tsx`
- Category: basic
- Description: Eyebrow, title, and optional action row for card sections.
- Extractable props: `eyebrow`, `title`, `action`
- Hardcoded: class structure

## Surface
- Source: `src/packages/ui/src/index.tsx`
- Category: basic
- Description: Standard white bordered card surface.
- Extractable props: `className`
- Hardcoded: surface class contract
