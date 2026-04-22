# Jupiter One USA — Backend Setup Guide

## Folder Structure
```
jupiter-one-usa/
├── backend/                 ← This folder (you are here)
│   ├── server.js            ← Start here
│   ├── package.json
│   ├── .env.example         ← Copy to .env and fill in your details
│   ├── db/
│   │   ├── connect.js       ← SQL Server connection
│   │   └── setup.sql        ← Run this in SSMS first
│   ├── routes/
│   │   ├── search.js        ← NSN/part number search API
│   │   └── rfq.js           ← Quote request API
│   ├── services/
│   │   └── mailer.js        ← Email notifications
│   └── admin/
│       └── index.js         ← AdminJS dashboard
└── frontend/                ← Your HTML website files go here
    └── index.html
```

---

## Step 1 — Install Prerequisites

### SQL Server Express 2025 (Free)
1. Download from: https://www.microsoft.com/en-us/sql-server/sql-server-downloads
2. Run installer → choose **Basic** install
3. Also install **SSMS** (SQL Server Management Studio) from the same page

### Node.js (v20 or higher)
1. Download from: https://nodejs.org
2. Choose the LTS version
3. Verify install: open Command Prompt → type `node --version`

---

## Step 2 — Set Up the Database

1. Open **SSMS** and connect to your local SQL Server
2. Create a new database:
   ```sql
   CREATE DATABASE jupiteroneusa;
   ```
3. Open the file `db/setup.sql` in SSMS
4. Make sure `jupiteroneusa` is selected in the database dropdown
5. Click **Execute** (or press F5)
6. You should see: *"Jupiter One USA database setup complete."*

---

## Step 3 — Import the NSN Data

The free NSN catalog comes from the Defense Logistics Agency (DLA).

### Download the data:
1. Go to: https://www.flis.dla.mil/
2. Look for **FLIS Data Extracts** or **H2/H6 files** (public domain)
3. Alternatively use: https://www.nsnlookup.com (has bulk export options)

### Import into SQL Server:
1. In SSMS, right-click your `jupiteroneusa` database
2. Tasks → Import Flat File (or Import Data)
3. Map columns to `nsn_catalog` and `nsn_parts` tables
4. The NSN catalog has ~14 million rows — import will take 10–30 minutes

> **Tip:** Start with just the aerospace FSG groups 15, 16, 28, 29 to test — that's
> still ~500,000 rows and covers most of what your customers will search for.

---

## Step 4 — Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```
   copy .env.example .env
   ```
2. Open `.env` in any text editor and fill in:
   - `DB_SERVER` — usually `localhost\SQLEXPRESS` or just `localhost`
   - `DB_PASSWORD` — your SQL Server sa password
   - `SMTP_USER` / `SMTP_PASS` — for email notifications (see Gmail setup below)
   - `ADMIN_PASSWORD` — password for the admin panel

### Gmail App Password Setup:
1. Go to your Google Account → Security → 2-Step Verification (enable it)
2. Then go to: https://myaccount.google.com/apppasswords
3. Create an app password for "Mail"
4. Paste that 16-character password into `SMTP_PASS` in your `.env`

---

## Step 5 — Install and Run

Open Command Prompt in the `backend` folder:

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or in development mode (auto-restarts on file changes)
npm run dev
```

You should see:
```
✅ Connected to SQL Server: jupiteroneusa
🔧 Admin panel: http://localhost:3000/admin
🚀 Jupiter One USA server running
   Frontend:  http://localhost:3000
   API:       http://localhost:3000/api
   Admin:     http://localhost:3000/admin
```

---

## Step 6 — Test the API

Open your browser or use Postman:

```
# Search by NSN
http://localhost:3000/api/search?q=1560-00-082-4545&type=nsn

# Search by part number
http://localhost:3000/api/search?q=MS21044N4&type=part

# Health check
http://localhost:3000/api/health
```

---

## Step 7 — Admin Panel

1. Go to: http://localhost:3000/admin
2. Login with the email/password from your `.env`
3. You'll see:
   - **RFQ Leads** — all quote requests, filterable by status
   - **NSN Database** — browse the catalog (read-only)

---

## Step 8 — Deploy to Azure

### Option A: Azure App Service (recommended)
1. Install Azure CLI: https://aka.ms/installazurecliwindows
2. Login: `az login`
3. Create resources:
   ```bash
   az group create --name jupiter-one-rg --location eastus
   az appservice plan create --name jupiter-one-plan --resource-group jupiter-one-rg --sku B1
   az webapp create --name jupiter-one-usa --resource-group jupiter-one-rg --plan jupiter-one-plan --runtime "NODE:20-lts"
   ```
4. Deploy:
   ```bash
   az webapp up --name jupiter-one-usa
   ```

### Option B: Railway (simpler, ~$5/mo)
1. Push code to GitHub
2. Go to: https://railway.app
3. New Project → Deploy from GitHub
4. Add environment variables in Railway dashboard
5. Done — Railway handles everything

### Azure SQL (for production database)
1. In Azure Portal → Create SQL Database
2. Choose **Basic** tier (~$5/mo)
3. Update `DB_SERVER` in your environment variables to the Azure SQL hostname
4. Set `encrypt: true` in `db/connect.js`

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/search?q=...&type=nsn` | GET | Search by NSN |
| `/api/search?q=...&type=part` | GET | Search by part number |
| `/api/search?q=...&type=description` | GET | Search by description |
| `/api/search/nsn/:nsn` | GET | Get full NSN detail |
| `/api/rfq` | POST | Submit a quote request |
| `/api/health` | GET | Check server + DB status |
| `/admin` | GET | Admin dashboard |

---

## Questions?
Contact: DTorchia@jupiteroneusa.com
