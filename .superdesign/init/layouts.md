# Shared layouts

There is no standalone layout component. Each SPA owns its shell so the portal and admin remain physically separate.

## Portal shell — `src/apps/portal/src/PortalApp.tsx`

The full page component renders `.portal-shell` with a sticky `.portal-nav`, `.portal-main` header, and `.portal-content`. The sidebar contains the route-mark logo, organization selector, role-specific navigation, privacy boundary, and help action. The header contains search, telemetry refresh, and role switching.

Core render structure copied from the source:

```tsx
return <div className="portal-shell">
  <aside className={menu ? 'portal-nav open' : 'portal-nav'}>
    <div className="logo"><span><Route /></span><div><strong>Sentinel</strong><small>{isCustomer ? 'Fleet portal' : 'Partner portal'}</small></div></div>
    <div className="org-select"><small>{isCustomer ? 'MY ORGANIZATION' : 'CUSTOMER ACCOUNT'}</small><select>{/* scopes */}</select></div>
    <nav>{/* customer or reseller views */}</nav>
    <div className="nav-bottom"><div className="privacy-status"><ShieldCheck /><div><strong>{isCustomer ? 'Privacy controls active' : 'Scoped support access'}</strong><small>{isCustomer ? 'You control location sharing' : 'Customer grants are enforced'}</small></div></div></div>
  </aside>
  <main className="portal-main">
    <header>{/* page title, search, refresh, actor switcher */}</header>
    <div className="portal-content">{/* active local-state view */}</div>
  </main>
</div>;
```

## Admin shell — `src/apps/admin/src/AdminApp.tsx`

The admin reuses the portal shell class contract while preserving its own navigation and privacy boundary.

```tsx
return <div className="portal-shell admin-shell">
  <aside className="portal-nav admin-nav">
    <div className="logo">{/* Sentinel / Platform admin */}</div>
    <div className="org-select admin-plane"><small>ADMIN PLANE</small><strong>Platform operations</strong></div>
    <nav>{/* Control center, Organizations, Device network, Risk, Global audit */}</nav>
    <div className="nav-bottom">{/* platform actor + isolated-plane notice */}</div>
  </aside>
  <div className="portal-main admin-main">
    <header>{/* search, refresh, UTC clock */}</header>
    <main className="portal-content admin-content">{/* active admin view */}</main>
  </div>
</div>;
```

## Entrypoints

```tsx
// src/apps/portal/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import '@sentinel/ui/styles.css';
import PortalApp from './PortalApp';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><PortalApp /></React.StrictMode>);

// src/apps/admin/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@sentinel/ui/styles.css';
import './styles.css';
import AdminApp from './AdminApp';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AdminApp /></React.StrictMode>);
```
