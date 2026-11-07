import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppI18nProvider } from '@sentinel/ui';
import '@sentinel/ui/styles.css';
import './styles.css';
import AdminApp from './AdminApp';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AppI18nProvider><AdminApp /></AppI18nProvider></React.StrictMode>);
