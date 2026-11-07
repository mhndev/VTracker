import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppI18nProvider } from '@sentinel/ui';
import 'leaflet/dist/leaflet.css';
import '@sentinel/ui/styles.css';
import PortalApp from './PortalApp';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppI18nProvider><PortalApp /></AppI18nProvider></React.StrictMode>);
