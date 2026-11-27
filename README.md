# Villas Capellanias — Building Ledger

A private, password-protected app for keeping the books of **Villas Capellanias** (15 Phoenetia Avenue, Coral Gables). It tracks rent, expenses, assets, liabilities and security deposits. It is plain HTML, CSS and JavaScript with no build step and no server. It is hosted free on GitHub Pages, works offline, installs on phones, and can sync between devices through your own Firebase project.

**➡ Setup instructions: [SETUP-GUIDE.md](SETUP-GUIDE.md)**

## What it does

- **Overview** — the villa from the logo drawn as the building's front (bell tower, tile roofs, arcade), one arched window per unit, colored by that month's rent status. Also: rent collected vs scheduled, income, expenses, net operating income and equity for the year, a monthly chart, where the money went, items needing review, bills due soon and recent changes.
- **Units & tenants** — every unit with its tenant, rent, due day, deposit, lease end and any balance owed. Each unit page has contacts, a 12-month rent strip, payments, repairs tagged to the unit, and past tenants. Includes move-in / move-out.
- **Rent** — the units × months grid from the workbook. Click a cell to record or edit. **Bank deposit** records several checks in one go.
- **Income & expenses** — the general ledger, with category, vendor, unit, account and **Paid for**. Paid for keeps the workbook's TLP / LCDLT / Vivian / Jorge / Mom split, so only the building's share counts. Also has transfers (rent deposits, returned checks, loan principal), receipt photos, filters, bulk edits and CSV export.
- **Needs review** — every entry with an open question, with quick category / paid-for fixes.
- **Recurring bills** — FPL, Waste Management, elevator monitoring, etc. with next due date, found automatically from the ledger.
- **Assets** — bank accounts (balance from a statement plus everything recorded since), the building, land and equipment, with straight-line depreciation.
- **Liabilities** — mortgages and loans (amortization schedule, yearly interest) and tenants' security deposits held.
- **Vendors** — contacts, totals per year, W-9 and 1099 hints (threshold $600 through 2025, $2,000 from 2026).
- **Legal** — the family's own lease, Rules and Regulations, security deposit letter, §83.49 notice, three-day notice, extension of lease and new-lease cover letter, filled in from each tenant's record and downloaded as Word files. Keeps track of what is due (deposit letter + §83.49 within 5 days of move-in, three-day notice 3 days after unpaid rent, extension 30 days before each anniversary), what was sent, served or signed, and the 3-business-day deadline (weekends and holidays skipped). Reminders: the bell, phone/computer notifications, and a calendar file with alerts.
- **Reports** — income statement by month, balance sheet, rent roll, rent by month, by unit, paid for others, Schedule E summary, budget vs actual and the security deposit register. Each report prints or saves as a branded PDF, and everything downloads as one formatted Excel workbook.
- **Import** — reads the family's *Income & Expense Worksheet* (RENTAL BY MONTH + GENERAL LEDGER) with a preview, matches per-apartment charges to ledger lines, splits combined payments and flags uncertain lines. Re-importing only adds what's new.
- **Safety** — AES-256 encryption of every record, auto-lock, recovery key and security questions, encrypted backups, automatic snapshots before imports and restores, undo, and a full change history with who did what.
- Light and dark themes, keyboard search (`/`), works on phones.

## Security model

- The app password → PBKDF2-SHA256 (310,000 rounds) → AES-256-GCM key, held in memory only while unlocked.
- Every record is encrypted on its own before it is stored in the browser (IndexedDB). Nothing readable is stored.
- Cloud sync uploads only encrypted documents `{u, d, k, iv, ct}`. Access is limited by Firebase sign-in plus an e-mail allow-list in the Firestore rules.
- **The repository contains code only.** `.gitignore` blocks `*.json`, `*.xlsx`, `*.csv` and `firestore.rules`. Never upload records or backups here.
- The page itself is public. The password protects the records, which are never on the page.

## Files

```
index.html                 layout
vc.png                     building logo (full, with name)
icons/vc-mark.png          logo emblem (side menu, printouts); icons/ = app icons made from it
css/styles.css             design
js/utils.js                formatting, dates, dialogs
js/store.js                encrypted storage, recovery, backup encryption
js/model.js                data model and all calculations
js/charts.js               SVG charts
js/importer.js             Excel workbook importer
js/sync.js                 encrypted Firebase sync
js/forms.js                add / edit dialogs
js/pages.js                overview, units, rent, ledger, review
js/pages-books.js          bills, assets, liabilities, vendors
js/reports.js              reports, printing, Excel export
js/settings.js             settings, import / backup / restore, security, help
js/legal.js                legal documents, deadlines, reminders, notifications, calendar file
templates/*.docx           Word templates with {fields}; no signatures or account numbers
js/app.js                  lock screen, saving, navigation, search
firebase-config.js         your Firebase web settings (fill in once)
firestore.rules.template   Firestore security rules to paste into Firebase
lib/                       ExcelJS 4.4.0 (MIT), JSZip 3.10.1 (MIT), Firebase JS SDK (compat), vendored for offline use
fonts/                     Marcellus and Source Sans 3 (SIL Open Font License); fonts/signatures/ eight handwriting fonts (OFL; Homemade Apple under Apache 2.0)
sw.js, manifest.webmanifest, icons/   installable app and offline support
```

## Calculations

- **Rent status** for a month: paid ≥ rent → Paid; some paid → Partly paid; nothing and before the due day → Not due yet; within the grace days → Due; after → Late. Months before “Track rent starting” never count.
- **Income statement** is cash basis: rent and expenses count in the month received or paid. Expenses whose *Paid for* is not the building are excluded and listed under Paid for others. Transfers are excluded.
- **Net operating income** = total income − building expenses.
- **Bank balance** = starting balance + rent and income − expenses (and transfers in/out) recorded for that account after the starting date.
- **Depreciation** = (cost − salvage) ÷ (life × 12) per month from the in-service month (mid-month start). Residential buildings default to 27.5 years. Land is never depreciated.
- **Loan balance** follows the amortization schedule; other liabilities use the latest balance entered.
- **Equity** = total assets − total liabilities (loans + security deposits held).

Tax figures are planning summaries for your accountant, not tax advice.

## Running locally

```
python3 -m http.server 8000
```
Then open http://localhost:8000 (the encryption API needs `https://` or `localhost`).
