# Philanz

Bilanz-App (Angular) unter `bila/`. Live: https://philanz.ajne.ch

## Lokal

```bash
cd bila
npm ci
npm test          # pretest setzt workbook.service.ts aus _wb_parts zusammen
npm start         # http://localhost:9001
npm run build
node scripts/check-assemble.cjs
```

CI (`.github/workflows/bila.yml`) macht denselben Check: Assemble-Drift, `npm test`, `npm run build`.

## Version

`bila/package.json` `version` und `bila/src/app/version.ts` `APP_VERSION` müssen gleich sein. Aktuell `1.1.21`.

## Workbook

Nur `bila/src/app/service/_wb_parts/partNN.txt` editieren, dann `npm run assemble`. Details in `bila/src/app/service/_wb_parts/README.md`.

## PrimeNG

Entscheidung: **adopt** (nicht entfernen). `primeng` ist sichtbar im Einsatz: Toolbar, Dialog, Button, Chart (`primeng/toolbar`, `primeng/dialog`, `primeng/button`, `primeng/chart`). `primeicons` über `index.html`. Theme-Pakete (`@primeng/themes`, `@primeuix/themes`, `tailwindcss-primeui`) bleiben im Lock, werden aber nicht importiert — kein Redesign in diesem Pass. UI bleibt Custom-CSS plus die genutzten Prime-Komponenten.

## Smoke 200 Zeilen

`bila/src/app/component/monthTable/month-table-smoke.spec.ts` — Virt-Fenster, Multi-Paste, Undo. Manuell: Monat mit vielen Zeilen öffnen, horizontal scrollen (Index bleibt links), Fill-Handle an der aktiven Zelle ziehen.
