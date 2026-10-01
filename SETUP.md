# LOKO 16-TAL Dashboard — Setup Guide

This is a single-page HTML dashboard hosted on Vercel, with data stored in Supabase.

---

## What You Need

- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (free Hobby plan is fine)
- A [Supabase](https://supabase.com) account (free plan is fine)

---

## Step 1 — Supabase: Create a Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Give it a name (e.g. `loko-dashboard`) and set a database password
4. Wait for the project to be ready (~1 minute)

---

## Step 2 — Supabase: Create the Table

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Paste and run this SQL:

```sql
create table dashboard_store (
  key   text primary key,
  value text not null
);

alter table dashboard_store enable row level security;
create policy "public read"  on dashboard_store for select using (true);
create policy "public write" on dashboard_store for insert with check (true);
create policy "public update" on dashboard_store for update using (true);
```

3. Click **Run** — you should see "Success"

---

## Step 3 — Supabase: Get Your Credentials

1. Go to **Project Settings → API** (left sidebar)
2. Copy the **Project URL** — looks like `https://xxxx.supabase.co`
3. Under **Publishable key**, copy the `sb_publishable__...` key

Keep these handy for the next step.

---

## Step 4 — Update the HTML File

Open `index.html` and find this block near the top (just before `</head>`):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  const _db = supabase.createClient(
    'https://jdcibpjrflsjjvgngsan.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  );
</script>
```

Replace the two values with **your own** Project URL and key:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  const _db = supabase.createClient(
    'https://YOUR-PROJECT-URL.supabase.co',
    'YOUR-PUBLISHABLE-KEY'
  );
</script>
```

Save the file.

---

## Step 5 — GitHub: Push the Code

1. Create a new repository on [github.com](https://github.com)
   - Click **+** → **New repository**
   - Name it anything (e.g. `loko-dashboard`)
   - Set it to **Private** (recommended — your Supabase key is in the file)
   - Click **Create repository**

2. Open Terminal, navigate to your project folder and run:

```bash
git config user.email "your@email.com"
git config user.name "yourusername"
git init
git add index.html
git commit -m "initial"
git remote add origin https://github.com/yourusername/loko-dashboard.git
git push -u origin main
```

3. When prompted, authenticate with GitHub:
   - Install GitHub CLI if needed: `brew install gh` (Mac) or download from [cli.github.com](https://cli.github.com)
   - Run `gh auth login` and follow the device code instructions

---

## Step 6 — Vercel: Deploy

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New Project**
3. Click **Import Git Repository** → select your GitHub repo
4. Leave all settings as default
5. Click **Deploy**

Vercel will give you a live URL like `https://loko-dashboard.vercel.app` in about 30 seconds.

---

## Step 7 — Verify It Works

1. Open your Vercel URL
2. Go to the **Daily Status** tab
3. Click a cell and type something
4. **Reload the page** — the value should still be there
5. In Supabase → **Table Editor** → `dashboard_store` — you should see a `dailyStatus` row with data in it

---

## Future Updates

Whenever you edit `index.html` locally, push to GitHub to redeploy:

```bash
git add index.html
git commit -m "describe your change"
git push
```

Vercel auto-deploys every push to `main` — no manual steps needed.

---

## Login

The dashboard requires signing in before it loads, using a single shared username/password stored in its own Supabase table (not a Supabase Auth account).

### Create the login table

In your Supabase project, go to **SQL Editor** and run:

```sql
create table login_credentials (
  username text primary key,
  password text not null
);
alter table login_credentials enable row level security;
create policy "public read" on login_credentials for select using (true);

insert into login_credentials (username, password) values (
  'loko16tal',
  '16-TAL'
);
```

The dashboard signs in with username `loko16tal` and password `16-TAL`.

> If you already created the table with the earlier `password_hash` version, run this instead to switch it over:
> ```sql
> alter table login_credentials rename column password_hash to password;
> update login_credentials set password = '16-TAL' where username = 'loko16tal';
> ```

### Changing the password

In Supabase SQL Editor, run:
```sql
update login_credentials set password = 'yournewpassword' where username = 'loko16tal';
```

### Important: this only gates the page, not the data

Both `dashboard_store` and `login_credentials` have `using (true)` read policies — anyone holding the publishable key embedded in `index.html` can query them directly through Supabase's API, logged in or not, including reading the password straight out of the table (it's stored in plain text). The login screen stops people from casually opening the dashboard; it does **not** stop direct API access. Real access control would require a proper backend or Supabase Auth with authenticated-only RLS policies, which is a bigger change than this login screen.

---

## Daily & Weekly Failure Report Emails

Two GitHub Actions workflows read the `failures` data straight from Supabase and email a summary — both share the same failure-analysis logic (`scripts/lib/failure-analysis.mjs`) so their numbers always agree with the dashboard's USW/Sub-System tabs:

- **Daily** (`.github/workflows/daily-failure-report.yml` → `scripts/daily-failure-report.mjs`) — sends every morning at 08:30 (Asia/Kuala_Lumpur): failures logged the previous day, repeat failures this month (same locomotive + sub-system 2+ times), month-to-date top failing sub-system/locomotive/depot with trend arrows vs. last month, a root-cause (4M) breakdown, and downtime totals.
- **Weekly** (`.github/workflows/weekly-failure-summary.yml` → `scripts/weekly-failure-summary.mjs`) — sends every Monday at 08:30, covering the week that just ended (last Monday–Sunday): the same set of sections, scoped to that week instead of a single day/month, with trends compared to the previous week.

Both run entirely on GitHub's servers — your computer doesn't need to be on.

### One-time setup

1. **Turn on 2-Step Verification** on the Gmail account that will send the email: [myaccount.google.com/security](https://myaccount.google.com/security)
2. **Generate an App Password**: go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), create one for "Mail", and copy the 16-character password it gives you
3. In your GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret**, and add each of these (both workflows share the same 5 secrets):

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | Same Project URL from Step 3 above |
| `SUPABASE_ANON_KEY` | Same Publishable key from Step 3 above |
| `GMAIL_USER` | The Gmail address you enabled the App Password on |
| `GMAIL_APP_PASSWORD` | The 16-character App Password (no spaces) |
| `RECIPIENT_EMAIL` | The email address that should receive the report |

4. Push these files to GitHub if they aren't already there: `package.json`, `scripts/lib/failure-analysis.mjs`, `scripts/daily-failure-report.mjs`, `scripts/weekly-failure-summary.mjs`, `.github/workflows/daily-failure-report.yml`, `.github/workflows/weekly-failure-summary.yml`.

### Testing it

You don't have to wait for the scheduled time to test either one:

1. Go to your repo on GitHub → **Actions** tab → **Daily Failure Report** or **Weekly Failure Summary** (left sidebar)
2. Click **Run workflow** → **Run workflow** (this uses the manual trigger, `workflow_dispatch`)
3. Wait ~30 seconds, refresh, click into the run — a green checkmark means it sent successfully
4. Check the recipient's inbox (and spam folder, the first time)

### Troubleshooting the report emails

| Problem | Fix |
|---|---|
| Workflow run fails with "Missing required env var" | One of the 5 secrets above is missing or misspelled — check **Settings → Secrets and variables → Actions** |
| Fails with a Gmail auth error | The App Password is wrong, has spaces in it, or 2-Step Verification isn't actually turned on for that account |
| Email never arrives but the run succeeded | Check spam folder; also double check `RECIPIENT_EMAIL` is spelled correctly |
| Daily report says "No failures reported yesterday" every day | Confirm failures are actually being entered with `dateReceive` set to that day in the dashboard's USW tab |
| Weekly summary looks the same as the daily one | That's expected on a week with few failures — check the "Week of ..." date range in the subject line to confirm it's actually covering 7 days, not 1 |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Page shows 404 | Make sure the file is named exactly `index.html` |
| Edits not saving | Open browser DevTools (F12) → Console tab, look for red errors |
| Data resets on reload | Check that Supabase URL and key are correct in the HTML |
| Vercel deployment blocked | Make sure `git config user.email` matches your GitHub account email |
| "Invalid username or password" | Double check the username/password, or confirm the `login_credentials` table has a matching row in Supabase's Table Editor |
| Stuck on the login screen after signing in | Open DevTools (F12) → Console, look for red errors; also confirm the `login_credentials` table and its "public read" policy exist |
