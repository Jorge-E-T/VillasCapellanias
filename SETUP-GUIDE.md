# Villas Capellanias — Setup Guide

This guide takes you from the ZIP file to a working, password-protected app on every phone and computer you use, with your 2024 workbook already loaded. It assumes no programming experience. Plan on about 30 minutes for Parts 1–4, plus 20 minutes for cloud sync (Part 5) if you want it.

---

## How it fits together

| Piece | What it does | Holds your records? |
|---|---|---|
| **GitHub repository** | Stores the program files (HTML, CSS, JavaScript, the logo). | **No, never.** Only code. |
| **GitHub Pages** | Publishes those files as a website at `https://YOUR-USERNAME.github.io/REPO-NAME/`. | No |
| **Your browser (each device)** | Runs the app and keeps the records in its own database, **encrypted with the app password**. | Yes, encrypted |
| **Firebase (optional)** | Keeps every device in step. Receives only encrypted copies. | Yes, encrypted |
| **Backup files** | A file you download now and then, kept somewhere safe. | Yes, encrypted unless you choose otherwise |

The website itself is public. Anyone who finds the address sees only a lock screen. The password protects the **records**, and the records are never on the website.

---

## Part 1 — Prepare the files

1. Unzip **villas-capellanias-app.zip**. You get a folder named `villas-capellanias` with this inside:

   ```
   index.html              the app
   vc.png                  ← you add this (the building's logo)
   css/  js/  lib/  fonts/  icons/
   firebase-config.js      cloud settings (filled in at Part 5)
   firestore.rules.template security rules for Firebase (Part 5)
   manifest.webmanifest  sw.js   phone-app and offline support
   README.md  SETUP-GUIDE.md  .gitignore  .nojekyll
   ```

2. **The logo is already in place.** `vc.png` (the VC monogram with the villa and “Villas Capellanias”) sits next to `index.html`, trimmed of its empty margins. It appears on the lock screen and in the Excel workbook. The emblem alone (`icons/vc-mark.png`) is used in the side menu and on printed reports, and the home-screen icons in `icons/` are made from it. To change the logo later, replace `vc.png` (and `icons/vc-mark.png` for the emblem) with files of the same names.

> ⚠️ Do **not** put the Excel workbook, backup files or any other records in this folder before uploading. The included `.gitignore` blocks `.xlsx`, `.json` and `.csv` files, but web uploads ignore that file, so keep them out by hand.

---

## Part 2 — Create the repository and upload

1. Sign in at **github.com** (create a free account if needed). Turn on two-factor authentication: profile picture → **Settings → Password and authentication**.
2. Click **+** (top right) → **New repository**.
   - **Repository name:** e.g. `villas-capellanias`
   - **Public or private:** choose **Public** if you have the free GitHub plan. GitHub Free only publishes Pages sites from public repositories; private repositories need GitHub Pro. A public repo is safe here because it contains only the program, never your records.
   - Leave “Add a README” unticked. Click **Create repository**.
3. On the new repository's page, click **uploading an existing file**.
4. Open the `villas-capellanias` folder on your computer, select **everything inside it** (not the folder itself), and drag it onto the upload area. Folders upload with their contents.
   - On a Mac, files starting with a dot (`.gitignore`, `.nojekyll`) are hidden. Press **⌘ + Shift + .** in Finder to show them, then include them. If they don't upload, the app still works.
5. Under “Commit changes”, click **Commit changes**. Wait until all files appear in the list. Check that `index.html` is at the top level of the repository, not inside a subfolder.

---

## Part 3 — Turn on GitHub Pages

1. In the repository, open **Settings → Pages** (left menu).
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose **main** and **/ (root)**, then **Save**.
4. Wait 1–3 minutes and refresh. The page shows **“Your site is live at https://YOUR-USERNAME.github.io/villas-capellanias/”**. That is the app's address. Bookmark it.

> The address must start with **https://**. Browsers only allow the encryption the app relies on over a secure connection.

---

## Part 4 — First launch on your main computer

### 4.1 Create the app password
Open the site. You are asked to **create a password**.

- Use **at least 10 characters**. A short sentence works well, e.g. `Coral Gables palms 1926`.
- **Everyone who uses the app uses this same password** (it is the key the records are locked with).
- The hint is optional and shows after a wrong try. Never put the password itself in the hint.

### 4.2 Your name
The app asks who is using this device. Your name appears next to every change you make (Settings → History).

### 4.3 Password recovery — do not skip
You are shown a **recovery key** (25 letters and numbers) and asked to choose **three security questions**.

- **Print** the recovery key and keep it with the building's papers.
- Any **two** of the three answers also reset the password.
- Without either, a forgotten password means the records can't be opened. Nobody can unlock them, including Anthropic, GitHub and Google.

### 4.4 Import the 2024 workbook
On the welcome screen click **Import the Excel workbook** and choose `2024_Expenses_Torres_Limited.xlsx`. The preview shows what was found:

| Found | Count |
|---|---|
| Units | 15 (201–205, 301–305, 401–405) |
| Tenants | 16 (15 current + the former tenant of 301) |
| Security deposits | 14, totaling $36,200 |
| Rent payments | 104, totaling $243,065 (January–August 2024) |
| Expenses | 131 lines, $176,857.98 |
| Income and transfers | 35 lines |

Before you click **Import everything**, a few things to know:

- **The ledger totals match the workbook exactly:** debits $179,257.98 and credits $254,524.07.
- **“Paid for” keeps the EXPENSES columns.** Of the $176,857.98 in expenses, $100,453.88 is the building's (TLP). $76,404.10 was paid for LCDLT (La Casa de los Trucos), Vivian, Jorge and Mom. Only the building's share counts in its income statement.
- **Rent deposits aren't counted twice.** The ledger's rent deposit lines become *transfers*, because rent is already recorded unit by unit.
- **Combined payments are split.** The $8,340.08 Vivian reimbursement becomes its four parts. Prestige Elevator's $37,280 becomes its three invoices. Jorge del Amo's multi-apartment bills are tagged with their units.
- **30 entries are flagged “Needs review”.** These carry the workbook's question marks and notes (“WHAT IS THIS???”, “NOT SURE…”), the unitemized credit card payments, the $605 cash deposit, and the $2,200 debit sitting on the 7/5 rent deposit line.
- **A placeholder tenant is created for unit 301.** Its January–March rent came from someone before Ronald Ademaj moved in, so it's called “Former tenant — unit 301”. Rename it if you know who it was.

Leave the three boxes ticked: the operating account, the building and land assets, and the recurring bills.

### 4.5 Finish the picture
1. **Needs review** (left menu): settle each flagged entry, then **Mark reviewed**.
2. **Assets → Operating account**: enter a balance from a bank statement and its date.
3. **Assets → Building / Land**: enter their cost from the closing statement or your accountant's depreciation schedule. Add the elevator, roof or A/C if your accountant depreciates them separately.
4. **Liabilities**: add a mortgage or loan if the building has one.
5. **Settings → Property**: rent is recorded through **August 2024**, so September 2024 onward shows as late. Either record those payments, or set **Track rent starting** to the month you begin using the app.
6. **Settings → Categories & budgets**: optional yearly budgets per category.
7. **Download a backup** (Settings → Import & backups).

---

## Part 5 — Cloud sync with Firebase (optional, recommended for more than one device)

Without cloud sync, each device keeps its own separate records. With it, every phone and computer stays in step within seconds. It uses your own free Firebase project (Google). The free plan includes 1 GiB of storage, 50,000 document reads and 20,000 writes per day — far more than one building needs.

### 5.1 Create the Firebase project
1. Go to **console.firebase.google.com** and sign in with a Google account the family controls (turn on 2-step verification for it).
2. **Create a project** → name it e.g. `villas-capellanias` → you can turn **off** Google Analytics → **Create project**.

### 5.2 Register the web app and fill in `firebase-config.js`
1. On the project overview, click the **web icon `</>`** (“Add app” → Web).
2. Nickname: `Villas Capellanias`. **Don't** tick Firebase Hosting. Click **Register app**.
3. Firebase shows a code block containing `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`. Keep that page open.
4. In GitHub, open your repository → click **firebase-config.js** → the **pencil (Edit)** icon.
5. Replace each `PASTE_...` value with the matching value from Firebase (keep the quotes):
   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIza…",
     authDomain: "villas-capellanias.firebaseapp.com",
     projectId: "villas-capellanias",
     storageBucket: "villas-capellanias.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   };
   ```
6. **Commit changes.** These values identify your project; they are not secret. The sign-in, the rules and the encryption protect the records.

### 5.3 Turn on sign-in and create a login per person
1. Firebase menu → **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Email/Password** → **Enable** → **Save**. (Leave “Email link” off.)
3. **Users** tab → **Add user**. Create one for each person (e.g. you, Vivian, Jorge, the bookkeeper), with their e-mail and a cloud password of at least 8 characters. Tell each person their own cloud e-mail and password.
4. **Settings** tab → **Authorized domains** → **Add domain** → `YOUR-USERNAME.github.io` (no `https://`, no repository name).

### 5.4 Create the database
1. Firebase menu → **Build → Firestore Database → Create database**.
2. If asked for an edition, choose **Standard**.
3. **Location:** `nam5 (United States)` or `us-east1 (South Carolina)`. You can't change it later.
4. Start in **production mode** → **Create**.

### 5.5 Publish the security rules
1. Open `firestore.rules.template` from the ZIP in a text editor.
2. Replace the two example addresses with the cloud e-mails from 5.3, in **lower case**, each in quotes, separated by commas:
   ```
   && request.auth.token.email in [
     'you@gmail.com',
     'vivian@example.com',
     'jorge@example.com'
   ];
   ```
3. In Firebase → **Firestore Database → Rules**, delete everything, paste the whole edited file, and click **Publish**.
4. **Don't upload the filled-in rules to GitHub** (they list your e-mails). Firebase keeps them.

To add or remove a person later: add or delete their user under Authentication, and edit the e-mail list in the Rules again.

### 5.6 Connect the first device
1. Open the app (refresh with **Ctrl + Shift + R**, or **⌘ + Shift + R** on a Mac, so it picks up the new `firebase-config.js`).
2. **Settings → Cloud sync** → enter your cloud e-mail and password → **Sign in to cloud**.
3. The top bar shows **Syncing…** then **Synced**. Everything is uploaded, encrypted.

### 5.7 Add the other devices
On each phone or computer:
1. Open the app's address.
2. **Create the password using the same app password as the first device.** If a different one is typed, the app asks for the right one once it reaches the cloud, and switches to it.
3. Enter your name, set up recovery on this device too, then skip the import.
4. **Settings → Cloud sync** → sign in with **that person's** cloud e-mail. The records arrive in a few seconds.

**How sync behaves:** changes appear on the other devices within seconds. Offline changes are saved and sent when the connection returns. If two people edit the same record, the later edit wins. Every change is listed in Settings → History with who made it.

---

## Part 5½ — Legal documents and reminders

1. **Settings → Legal**: enter, once, the person who signs for the Lessor and their title, the Lessor's mailing address, where rent is paid, the landlord's contact details, the attorney for three-day notices, and the security deposit bank, address, account number and account title. These are stored encrypted and never go to GitHub.
2. For each current tenant, open **Units & tenants → the unit → Edit tenant** and fill in **Lease start**, the **names as they appear on legal documents**, the letter greeting, adults, children and parking space. The lease start drives the yearly extension reminders.
3. **Legal** (left menu) shows what is due. **Create documents** fills in the Word files; check them, print, deliver, then click **Mark sent / served / signed**.
4. Reminders: the **bell** at the top; **Turn on notifications** on each phone or computer (on iPhone, only after adding the app to the Home Screen); and **Add reminders to my calendar**, which downloads a calendar file whose alerts work even when the app is closed. Download it again after big changes.
5. Reminders start from the day the legal section was first opened. Change **Start reminders from** in Settings → Legal if you want earlier ones.

6. **Signatures** (Settings → Legal → Signatures): for the attorney, the Lessor's signer and the landlord, choose **Typed** (type the name, pick one of eight handwriting styles) or **Upload** (a photo of the real signature on white paper; the app removes the background). They are added automatically to the three-day notice, the security deposit letter and the cover letter. Leases and extensions stay blank for signing in front of witnesses.

> The templates folder is public on GitHub, so the scanned signature in the old three-day notice was removed. To print a signature, edit a template in Word (keep the {…} fields) and upload it under Settings → Legal → Document templates; your version is stored encrypted.

## Part 6 — Install it like an app

| Device | How |
|---|---|
| iPhone / iPad | Open the address in **Safari** → Share → **Add to Home Screen** |
| Android | Open in **Chrome** → ⋮ menu → **Install app** (or Add to Home screen) |
| Windows / Mac | Open in **Chrome** or **Edge** → install icon in the address bar, or menu → **Install Villas Capellanias** |

The installed app opens offline too; the records stay encrypted on the device.

---

## Part 7 — The three kinds of password

| | App password | Cloud sign-in | GitHub account |
|---|---|---|---|
| **What it protects** | The records themselves (encryption key) | Access to the Firebase copy | The program files only |
| **Who has one** | One shared by everyone | One per person | Whoever updates the app |
| **Where it's typed** | The lock screen | Settings → Cloud sync, once per device | github.com |
| **If forgotten** | Lock screen → Forgot password? → recovery key or 2 security answers | Settings → Cloud sync → Forgot the cloud password? (e-mail link) | github.com password reset |
| **Changing it** | Settings → Password & security (re-encrypts everything; other synced devices ask once for the new one) | Firebase → Authentication → Users | GitHub settings |

The app locks itself after 15 idle minutes (change it in Settings → Property), and the padlock button locks it right away.

---

## Part 8 — Where the records live, and backups

- **On each device:** in the browser's database for the app's address, every record encrypted with AES-256 (key from the password via PBKDF2-SHA256, 310,000 rounds).
- **In Firebase (if on):** the same records, encrypted before upload. Firebase sees only scrambled data and timestamps.
- **Never in GitHub.**

**Backups:** Settings → Import & backups → **Download backup**. Keep “Lock the file with the app password” ticked. Store the file off the computer: a USB stick, or a private cloud folder. The app reminds you every 14 days (adjustable).

**Restoring:** Settings → Import & backups → **Restore from a backup…**, then choose **Combine** (keep everything, newest version wins) or **Replace everything**. A safety snapshot is taken automatically before every import or restore (last 8 kept, Settings → Import & backups).

> Clearing the browser's “site data” or “cookies and site data” for the app's address erases that device's copy. With cloud sync on, signing in again brings it back; without it, you need a backup file.

---

## Part 9 — Using it month to month

1. **Rent:** as checks arrive, **Add → Rent payment**, or click a window on the Overview or a cell on the Rent grid. For one bank deposit with several checks, **Add → Bank deposit**: “Add every unit not yet paid” fills in the lines, and each line becomes that unit's payment.
2. **Expenses:** from the bank statement, **Add → Expense**. Pick the category (it's often suggested from the vendor), and set **Paid for** when the building account paid someone else's bill. Attach a receipt photo if you like.
3. **Recurring bills:** check nothing is overdue; **Record payment** fills in the usual amount.
4. **Needs review:** settle anything flagged.
5. **Backup:** download one.
6. **Year end:** Reports → **Download Excel workbook** for the accountant. It has the income statement, rent by month, rent payments, every entry, paid for others, balance sheet, Schedule E summary, tenants, assets, liabilities and vendors. Any report can also be printed or saved as a PDF.

Colors on the building drawing and rent grid: **green** paid · **amber** partly paid · **sand** not due yet / within the grace days · **bougainvillea** late · **dashed** vacant · **blue-grey** no rent due (unit 205's on-site manager).

---

## Part 10 — Updating the app later

1. Download a backup first.
2. In GitHub, open the repository → **Add file → Upload files** → drag in the changed files (keep the same folder names) → **Commit changes**.
3. Wait a minute, then on each device refresh once with **Ctrl + Shift + R** (⌘ + Shift + R). An installed phone app updates the next time it's opened online.
4. Records are untouched by updates. A safety snapshot is taken before any import.

---

## Part 11 — Security checklist

- [ ] Two-factor authentication on the GitHub account and on the Google account that owns Firebase.
- [ ] Recovery key printed and stored; security questions set on each device.
- [ ] No workbooks, backups, CSVs or the filled-in `firestore.rules` in the GitHub repository.
- [ ] Firestore rules list only your family's cloud e-mails; Firebase is in **production mode**.
- [ ] Optional: in Google Cloud console → APIs & Services → Credentials, restrict the Browser API key to the website `https://YOUR-USERNAME.github.io/*`.
- [ ] Remove people who no longer need access: delete their Firebase user and take their e-mail out of the rules. If they knew the app password, change it (Settings → Password & security).

---

## Part 12 — Troubleshooting

| What you see | What to do |
|---|---|
| “This page must be opened over https://” | Use the `https://…github.io/…` address, not a file opened from your computer. For local testing see Part 13. |
| 404 on the GitHub address | Pages takes a few minutes. Check that `index.html` is at the top level of the repo, and Pages is set to **main / (root)**. |
| Logo doesn't show | The file must be named exactly `vc.png` (lower case) and sit next to `index.html`. Refresh with Ctrl + Shift + R. |
| Cloud sync card says “Not set up yet” | `firebase-config.js` still has `PASTE_` values, or the new file wasn't uploaded. Refresh with Ctrl + Shift + R. |
| “This cloud account is not allowed” | The e-mail isn't in the Firestore rules (or isn't lower case). Edit Rules → Publish. |
| “Firebase refused this website” | Add `YOUR-USERNAME.github.io` under Authentication → Settings → Authorized domains. |
| “The Firestore database has not been created yet” | Part 5.4. |
| “The cloud copy uses a different password” | Another device changed the app password, or this device was set up with a different one. Enter the current app password; this device switches to it. |
| Lots of units show **Late** | Rent is recorded through August 2024. Record later payments, or set Settings → Property → **Track rent starting**. |
| The page looks out of date after an update | Ctrl + Shift + R (⌘ + Shift + R). |
| Forgot the app password | Lock screen → **Forgot password?** → recovery key, or any two security answers. |

---

## Part 13 — Testing on your own computer (optional)

With Python installed, open a terminal in the `villas-capellanias` folder and run:

```
python3 -m http.server 8000
```

Then open **http://localhost:8000**. Records made here are separate from the ones on the GitHub address (different address, different browser database). Cloud sync needs `localhost` in Firebase's Authorized domains (it's there by default).

---

*Tax figures (Schedule E summary, 1099 hints, depreciation) are planning summaries for your accountant, not tax advice. Florida has specific rules on holding and returning security deposits; check them with your attorney when a tenant moves out.*
