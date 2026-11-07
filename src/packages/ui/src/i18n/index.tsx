import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type Messages } from './en';
import { fa } from './fa';

export type SupportedLocale = 'en' | 'fa';
export const ACTIVE_LOCALES = ['en', 'fa'] as const;
export type ActiveLocale = (typeof ACTIVE_LOCALES)[number];
export const DEFAULT_LOCALE: ActiveLocale = 'en';

type MessageNode = { readonly [key: string]: string | MessageNode };
type DotPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : T[K] extends MessageNode ? `${K}.${DotPaths<T[K]>}` : never;
}[keyof T & string];
export type MessageKey = DotPaths<Messages>;
export type MessageParams = Record<string, string | number>;

export type LocaleMeta = {
  htmlLang: string;
  dir: 'ltr' | 'rtl';
  bcp47: string;
};

export const LOCALE_META: Record<SupportedLocale, LocaleMeta> = {
  en: { htmlLang: 'en', dir: 'ltr', bcp47: 'en-US' },
  fa: { htmlLang: 'fa', dir: 'rtl', bcp47: 'fa-IR-u-ca-persian' }
};

const catalogs: Record<SupportedLocale, Messages> = { en, fa };

function collectKeys(node: MessageNode, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : collectKeys(value, path);
  });
}

const MESSAGE_KEYS = new Set(collectKeys(en));

function collectPlaceholders(value: string): string[] {
  return [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

export function assertCatalogCoverage(locale: SupportedLocale, catalog: Messages): void {
  const referenceKeys = collectKeys(en).sort();
  const catalogKeys = collectKeys(catalog).sort();
  const missing = referenceKeys.filter((key) => !catalogKeys.includes(key));
  const extra = catalogKeys.filter((key) => !MESSAGE_KEYS.has(key));
  const placeholderMismatches = referenceKeys.filter((key) => {
    const messageKey = key as MessageKey;
    return collectPlaceholders(lookup(en, messageKey)).join(',') !== collectPlaceholders(lookup(catalog, messageKey)).join(',');
  });

  if (missing.length || extra.length || placeholderMismatches.length) {
    throw new Error([
      `Invalid ${locale} translation catalog.`,
      missing.length ? `Missing keys: ${missing.join(', ')}` : '',
      extra.length ? `Extra keys: ${extra.join(', ')}` : '',
      placeholderMismatches.length ? `Placeholder mismatches: ${placeholderMismatches.join(', ')}` : ''
    ].filter(Boolean).join(' '));
  }
}

export function isMessageKey(key: string): key is MessageKey {
  return MESSAGE_KEYS.has(key);
}

export function resolveLocale(locale?: string | null): ActiveLocale {
  if (locale && (ACTIVE_LOCALES as readonly string[]).includes(locale) && catalogs[locale as SupportedLocale]) {
    return locale as ActiveLocale;
  }
  return DEFAULT_LOCALE;
}

function lookup(messages: Messages, key: MessageKey): string {
  const parts = key.split('.');
  let node: string | MessageNode = messages;
  for (const part of parts) {
    if (typeof node === 'string' || node[part] === undefined) {
      throw new Error(`Missing translation: ${key}`);
    }
    node = node[part];
  }
  if (typeof node !== 'string') throw new Error(`Invalid translation: ${key}`);
  return node;
}

assertCatalogCoverage('fa', fa);

export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ));
}

export function translate(messages: Messages, key: MessageKey, params?: MessageParams): string {
  return interpolate(lookup(messages, key), params);
}

export function formatNumber(value: number, locale?: string | null, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE_META[resolveLocale(locale)].bcp47, options).format(value);
}

export function formatDateTime(value: Date | string | number | null | undefined, locale?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (value == null || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const resolved = resolveLocale(locale);
  return new Intl.DateTimeFormat(LOCALE_META[resolved].bcp47, options ?? { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatDate(value: Date | string | number | null | undefined, locale?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (value == null || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const resolved = resolveLocale(locale);
  return new Intl.DateTimeFormat(LOCALE_META[resolved].bcp47, options ?? { dateStyle: 'medium' }).format(date);
}

const RELATIVE_DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' }
];

export function formatRelativeTime(value: Date | string | number | null | undefined, locale?: string | null, now = Date.now()): string {
  if (value == null || value === '') return '';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const rtf = new Intl.RelativeTimeFormat(LOCALE_META[resolveLocale(locale)].bcp47, { numeric: 'auto' });
  let duration = (time - now) / 1000;
  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return rtf.format(Math.round(duration), 'year');
}

export type I18nApi = {
  locale: ActiveLocale;
  dir: 'ltr' | 'rtl';
  htmlLang: string;
  setLocale: (locale?: string | null) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (value: Date | string | number | null | undefined, now?: number) => string;
};

export function createI18n(locale?: string | null, setLocale: I18nApi['setLocale'] = () => undefined): I18nApi {
  const resolved = resolveLocale(locale);
  const meta = LOCALE_META[resolved];
  const catalog = catalogs[resolved] ?? en;
  return {
    locale: resolved,
    dir: meta.dir,
    htmlLang: meta.htmlLang,
    setLocale,
    t: (key, params) => translate(catalog, key, params),
    formatNumber: (value, options) => formatNumber(value, resolved, options),
    formatDate: (value, options) => formatDate(value, resolved, options),
    formatDateTime: (value, options) => formatDateTime(value, resolved, options),
    formatRelativeTime: (value, now) => formatRelativeTime(value, resolved, now)
  };
}

const I18nContext = createContext<I18nApi | null>(null);
const fallbackI18n = createI18n(DEFAULT_LOCALE);

export function I18nProvider({ locale = DEFAULT_LOCALE, onLocaleChange, children }: { locale?: SupportedLocale; onLocaleChange?: I18nApi['setLocale']; children: ReactNode }) {
  const value = useMemo(() => createI18n(locale, onLocaleChange), [locale, onLocaleChange]);
  useEffect(() => {
    document.documentElement.lang = value.htmlLang;
    document.documentElement.dir = value.dir;
    document.documentElement.dataset.locale = value.locale;
  }, [value.dir, value.htmlLang, value.locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function AppI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const changeLocale = useCallback((next?: string | null) => setLocaleState(resolveLocale(next)), []);
  return (
    <I18nProvider locale={locale} onLocaleChange={changeLocale}>
      {children}
    </I18nProvider>
  );
}

export function useI18n(): I18nApi {
  return useContext(I18nContext) ?? fallbackI18n;
}

export { en, fa };
export type { Messages } from './en';
