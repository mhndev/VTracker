# Page dependency trees

## Portal SPA — `/` on port 5173

Entry: `src/apps/portal/src/main.tsx`

- `src/apps/portal/src/PortalApp.tsx`
  - `src/apps/portal/src/LiveMap.tsx`
    - `src/apps/portal/src/types.ts`
  - `src/apps/portal/src/types.ts`
  - `src/packages/ui/src/index.tsx`
- `src/packages/ui/src/styles.css`
- Leaflet CSS and external OpenStreetMap tiles

## Admin SPA — `/` on port 5174

Entry: `src/apps/admin/src/main.tsx`

- `src/apps/admin/src/AdminApp.tsx`
  - `src/packages/ui/src/index.tsx`
- `src/packages/ui/src/styles.css`
- `src/apps/admin/src/styles.css`

## Marketing landing page — new target

No source exists. Use the portal overview as the closest representative style anchor:

- `src/apps/portal/src/PortalApp.tsx`
- `src/apps/portal/src/LiveMap.tsx`
- `src/packages/ui/src/index.tsx`
- `src/packages/ui/src/styles.css`
- `README.md` and `DECISIONS.md` for accurate product messaging and privacy/safety constraints
