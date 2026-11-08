import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EmptyState, LtrText, StatusPill, useI18n, type MessageKey, type SupportedLocale } from '@sentinel/ui';
import { AlertTriangle, Building2, LoaderCircle, LockKeyhole, LockKeyholeOpen, Pencil, Plus, Search, UserRound, X } from 'lucide-react';
import type { CustomerLifecycle, ManagedCustomer, ManagedCustomerInput } from '../types';

const CUSTOMER_TIMEZONES = ['Europe/Berlin', 'Asia/Tehran', 'UTC', 'Europe/London', 'America/New_York', 'Asia/Dubai'];

export function CustomerDialog({ customer, submitting, errorKey, onDismiss, onSubmit }: {
  customer: ManagedCustomer | null;
  submitting: boolean;
  errorKey: MessageKey | null;
  onDismiss: () => void;
  onSubmit: (input: ManagedCustomerInput) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(customer?.name ?? '');
  const [defaultLocale, setDefaultLocale] = useState<SupportedLocale>(customer?.defaultLocale ?? 'en');
  const [timezone, setTimezone] = useState(customer?.timezone ?? 'Europe/Berlin');
  const [status, setStatus] = useState<CustomerLifecycle>(customer?.status ?? 'ACTIVE');
  const [nameInvalid, setNameInvalid] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const timezoneOptions = CUSTOMER_TIMEZONES.includes(timezone) ? CUSTOMER_TIMEZONES : [timezone, ...CUSTOMER_TIMEZONES];

  useEffect(() => { if (errorKey) errorRef.current?.focus(); }, [errorKey]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setNameInvalid(true);
      return;
    }
    onSubmit({ name: normalizedName, defaultLocale, timezone, status });
  };

  return (
    <div className="customer-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) onDismiss(); }}>
      <form className="customer-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-dialog-title" aria-busy={submitting} onSubmit={submit}>
        <div className="customer-dialog-head">
          <div><span>{t(customer ? 'portal.customers.editOverline' : 'portal.customers.createOverline')}</span><h2 id="customer-dialog-title">{t(customer ? 'portal.customers.editTitle' : 'portal.customers.createTitle')}</h2></div>
          <button type="button" className="dialog-close" onClick={onDismiss} disabled={submitting} aria-label={t('common.close')}><X aria-hidden="true" /></button>
        </div>
        <p className="customer-dialog-copy">{t('portal.customers.dialogCopy')}</p>
        {errorKey ? <div className="customer-dialog-error" role="alert" tabIndex={-1} ref={errorRef}><AlertTriangle aria-hidden="true" />{t(errorKey)}</div> : null}
        <div className="customer-form-grid">
          <label className="customer-field customer-field-wide">
            <span>{t('portal.customers.nameLabel')}</span>
            <input value={name} maxLength={120} autoFocus aria-invalid={nameInvalid || undefined} aria-describedby={nameInvalid ? 'customer-name-error' : undefined} onChange={event => { setName(event.target.value); setNameInvalid(false); }} />
            {nameInvalid ? <small id="customer-name-error">{t('portal.customers.nameValidation')}</small> : null}
          </label>
          <label className="customer-field">
            <span>{t('portal.customers.languageLabel')}</span>
            <select value={defaultLocale} onChange={event => setDefaultLocale(event.target.value as SupportedLocale)}><option value="en">{t('common.english')}</option><option value="fa">{t('common.farsi')}</option></select>
          </label>
          <label className="customer-field">
            <span>{t('portal.customers.timezoneLabel')}</span>
            <select dir="ltr" value={timezone} onChange={event => setTimezone(event.target.value)}>{timezoneOptions.map(value => <option key={value} value={value}>{value}</option>)}</select>
          </label>
          <label className="customer-field customer-field-wide">
            <span>{t('portal.customers.statusLabel')}</span>
            <select value={status} onChange={event => setStatus(event.target.value as CustomerLifecycle)}><option value="ACTIVE">{t('status.ACTIVE')}</option><option value="SUSPENDED">{t('status.SUSPENDED')}</option></select>
          </label>
        </div>
        <p className="customer-privacy-callout"><LockKeyhole aria-hidden="true" />{t('portal.customers.privacyBoundary')}</p>
        <div className="customer-dialog-actions">
          <button type="button" className="outline" onClick={onDismiss} disabled={submitting}>{t('common.cancel')}</button>
          <button type="submit" className="primary" disabled={submitting}>{submitting ? <LoaderCircle className="spin" aria-hidden="true" /> : null}{submitting ? t('common.saving') : t(customer ? 'portal.customers.saveChanges' : 'portal.customers.createAction')}</button>
        </div>
      </form>
    </div>
  );
}

export function CustomerDirectory({ customers, loading, search, statusFilter, onSearch, onStatusFilter, onCreate, onEdit, onOpenWorkspace }: {
  customers: ManagedCustomer[];
  loading: boolean;
  search: string;
  statusFilter: 'ALL' | CustomerLifecycle;
  onSearch: (value: string) => void;
  onStatusFilter: (value: 'ALL' | CustomerLifecycle) => void;
  onCreate: () => void;
  onEdit: (customer: ManagedCustomer) => void;
  onOpenWorkspace: (customer: ManagedCustomer) => void;
}) {
  const { t, formatDate, formatNumber } = useI18n();
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = customers.filter(customer => (!normalizedSearch || `${customer.name} ${customer.timezone}`.toLocaleLowerCase().includes(normalizedSearch)) && (statusFilter === 'ALL' || customer.status === statusFilter));

  return (
    <section className="surface customer-directory">
      <div className="customer-directory-head"><div><span>{t('portal.customers.eyebrow')}</span><h1>{t('portal.customers.title')}</h1><p>{t('portal.customers.description')}</p></div><button className="primary" onClick={onCreate}><Plus aria-hidden="true" />{t('portal.customers.createAction')}</button></div>
      <div className="customer-boundary"><LockKeyholeOpen aria-hidden="true" /><div><strong>{t('portal.customers.boundaryTitle')}</strong><span>{t('portal.customers.boundaryCopy')}</span></div></div>
      <div className="customer-toolbar">
        <label className="customer-search"><Search aria-hidden="true" /><span className="sr-only">{t('portal.customers.searchPlaceholder')}</span><input value={search} onChange={event => onSearch(event.target.value)} placeholder={t('portal.customers.searchPlaceholder')} /></label>
        <label className="customer-filter"><span>{t('portal.customers.statusFilter')}</span><select value={statusFilter} onChange={event => onStatusFilter(event.target.value as 'ALL' | CustomerLifecycle)}><option value="ALL">{t('portal.customers.allStatuses')}</option><option value="ACTIVE">{t('status.ACTIVE')}</option><option value="SUSPENDED">{t('status.SUSPENDED')}</option></select></label>
        <span className="customer-count">{t('portal.customers.count', { count: formatNumber(filtered.length) })}</span>
      </div>
      {loading ? <div className="customer-loading"><LoaderCircle className="spin" />{t('common.loading')}</div> : filtered.length === 0 ? (
        <EmptyState icon={<Building2 />} title={customers.length ? t('portal.customers.noResultsTitle') : t('portal.customers.emptyTitle')} copy={customers.length ? t('portal.customers.noResultsCopy') : t('portal.customers.emptyCopy')} />
      ) : (
        <div className="customer-cards">{filtered.map(customer => (
          <article className="customer-card" key={customer.id}>
            <div className="customer-card-title"><span aria-hidden="true">{customer.name.charAt(0)}</span><div><h3>{customer.name}</h3><small><LtrText>{customer.id}</LtrText></small></div><StatusPill value={customer.status} /></div>
            <dl><div><dt>{t('portal.customers.language')}</dt><dd>{customer.defaultLocale === 'fa' ? t('common.farsi') : t('common.english')}</dd></div><div><dt>{t('portal.customers.timezone')}</dt><dd><LtrText>{customer.timezone}</LtrText></dd></div><div><dt>{t('portal.customers.relationship')}</dt><dd><StatusPill value={customer.serviceRelationship.status} /></dd></div></dl>
            <p>{t('portal.customers.started', { date: formatDate(customer.serviceRelationship.startedAt) })}</p>
            <div className="customer-card-actions"><button className="outline" onClick={() => onEdit(customer)} aria-label={t('portal.customers.editAria', { name: customer.name })}><Pencil aria-hidden="true" />{t('portal.customers.edit')}</button><button className="primary" onClick={() => onOpenWorkspace(customer)} aria-label={t('portal.customers.openWorkspaceAria', { name: customer.name })}>{t('portal.customers.openWorkspace')}</button></div>
          </article>
        ))}</div>
      )}
      <p className="identity-gate"><UserRound aria-hidden="true" />{t('portal.customers.identityGate')}</p>
    </section>
  );
}
