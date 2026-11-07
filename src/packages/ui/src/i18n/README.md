# Sentinel Fleet translation keys

Shared i18n lives in `@sentinel/ui`. English and Farsi are active. `AppI18nProvider` exposes `setLocale`; each application resolves it from the authenticated session or active organization scope. Organization settings are the source of truth, and unknown values fall back to English.

## Naming

- Group keys by domain, then use camelCase for phrases: `portal.vehicleCreate.title`.
- Keep API status, permission, and audit codes as the final segment, unchanged: `status.ONLINE`, `status.QUARANTINED`.
- Translate at the UI boundary only. APIs continue to return stable codes; never translate stored values in the API.
- Use `{name}` placeholders for interpolation. Do not concatenate translated fragments when a single keyed sentence can hold the variable.
- Do not catalog IDs, plates, serials, emails, coordinates, or technical payloads. Render those with `LtrText`, `bdi`, or `dir="ltr"` isolation.
- Add every new user-facing string as a typed key in `en.ts`, then add the matching value to `fa.ts`. TypeScript fails if a caller uses an unknown English key or if the Farsi catalog is missing, adds, or structurally changes a key.
- Preserve interpolation placeholders exactly between catalogs. The catalog coverage assertion checks placeholder parity at module load so mistakes fail during local development and builds.

## Usage

```ts
const { t, formatNumber, formatDateTime, formatRelativeTime } = useI18n();
t('status.ONLINE');
formatNumber(1204);
formatDateTime(isoTimestamp);
formatRelativeTime(isoTimestamp);
```

`StatusPill` is the reference component: it looks up `status.<CODE>` and falls back to `humanizeStatus` for unknown codes.

## Locales

- `SupportedLocale` is `'en' | 'fa'`.
- `ACTIVE_LOCALES` is `['en', 'fa']`. Unknown values resolve to English.
- Do not branch on `locale === 'fa'` in components. Put locale metadata in `LOCALE_META` and string values in catalogs.
- `fa.ts` uses professional Persian product terminology while keeping IDs, codes, plates, serial numbers, technical tokens, and placeholders untranslated.
- `I18nProvider` synchronizes `<html lang>` / `dir`; Farsi uses `fa-IR-u-ca-persian` for user-facing dates, while API timestamps stay ISO-8601 UTC.
- Vazirmatn is bundled locally through `@fontsource-variable/vazirmatn`. Do not replace it with a remote font request.
- Use `LtrText` or `dir="ltr"` for plates, serials, emails, coordinates, IDs, and other technical values inside RTL pages.
