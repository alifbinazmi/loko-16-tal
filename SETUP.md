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

## Troubleshooting

| Problem | Fix |
|---|---|
| Page shows 404 | Make sure the file is named exactly `index.html` |
| Edits not saving | Open browser DevTools (F12) → Console tab, look for red errors |
| Data resets on reload | Check that Supabase URL and key are correct in the HTML |
| Vercel deployment blocked | Make sure `git config user.email` matches your GitHub account email |
