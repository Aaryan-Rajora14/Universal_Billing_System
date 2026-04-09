# 🛒 Universal Billing System v3.2

A fully responsive, production-ready billing system for **any store or service business**.  
No tax calculations (items are pre-taxed), clean invoices, QR codes, Excel export, and 6 color themes.

---

## ✅ Key Features

| Feature | Details |
|---|---|
| **No Tax Calculations** | Prices are final (pre-taxed) — grand total = subtotal − discounts only |
| **Universal** | Works for grocery, clothing, electronics, pharmacy, salon, services — any business |
| **Store Customization** | Name, tagline, address, phone, email, website, currency symbol |
| **6 Color Themes** | Red, Blue, Purple, Orange, Cyan, Mint Green |
| **PDF Invoices** | Branded PDF with QR code, auto-download on bill generation |
| **QR Code** | Embedded in every PDF with bill details |
| **Excel Export** | Bills + Profit/Loss sheets, downloadable anytime |
| **Bill History** | Search, filter by date/customer, download/preview PDFs |
| **Customer IDs** | Auto-generated, same customer reuses same ID |
| **Profit Tracking** | Estimated profit based on configurable profit margin |
| **Data Safety** | Erase bills or full factory reset from Settings |
| **Responsive UI** | Fully responsive 16:9 layout using vh/vw units |

---

## 📁 Project Structure

```
universal_billing/
├── app.py                 ← Flask backend + PDF generation
├── database.py            ← Excel database manager
├── requirements.txt       ← Python dependencies
├── store_bills.xlsx       ← Auto-created on first run
├── templates/
│   └── index.html         ← Main UI (Jinja2 template)
└── static/
    ├── css/
    │   └── style.css      ← All styles + 6 themes
    ├── js/
    │   └── script.js      ← Full frontend logic
    ├── bills/             ← Generated PDF invoices
    └── qr_codes/          ← QR code images
```

---

## 🚀 HOW TO RUN LOCALLY

### Step 1 — Install Python
Make sure you have **Python 3.8+** installed.  
Download from: https://www.python.org/downloads/

### Step 2 — Open Terminal / Command Prompt
- **Windows:** Press `Win + R`, type `cmd`, press Enter
- **Mac/Linux:** Open Terminal

### Step 3 — Navigate to the project folder
```bash
cd path/to/universal_billing
```
Example:
```bash
cd C:\Users\YourName\Downloads\universal_billing
```

### Step 4 — (Recommended) Create a virtual environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 5 — Install dependencies
```bash
pip install -r requirements.txt
```

### Step 6 — Run the app
```bash
python app.py
```

### Step 7 — Open in browser
```
http://localhost:5004
```

🎉 The billing system is now running! The Excel file `store_bills.xlsx` will be created automatically.

---

## ⚙️ First-Time Setup (Settings Tab)

1. Go to the **Settings** tab in the sidebar
2. Fill in your **Store Name**, tagline, address, phone, email, website
3. Set your **Currency Symbol** (₹, $, €, £, etc.)
4. Click **Save Store Settings** — your name appears everywhere instantly
5. Pick a **color theme** to match your brand
6. Go to **Data Control** and set your **Profit Margin %**

---

## 💡 How to Use

### Creating a Bill:
1. Go to **Dashboard**
2. Enter **Customer Name** → Customer ID auto-generates
3. Add products: Name → Price → Quantity → Discount% → Click **Add Item**
4. Review the **Live Bill Preview** on the right
5. Click **Generate Bill** → PDF downloads automatically + saved to Excel

### Viewing History:
- Go to **Bill History** tab
- Filter by date range or customer name
- Download or preview any past bill PDF

### Exporting Data:
- Go to **Data Control** tab
- Click **Download Excel File** to get the full `store_bills.xlsx`

---

## 🌐 HOW TO HOST ON GITHUB (Free — PythonAnywhere)

> GitHub alone only hosts static websites. For a Flask app, you need a free Python hosting service.  
> The best free option is **PythonAnywhere** — it's free and supports Flask perfectly.

### Method 1: PythonAnywhere (Recommended — Completely Free)

**Step 1 — Push code to GitHub**

1. Create a free account at https://github.com
2. Create a new repository called `universal-billing`
3. In your project folder, run:
```bash
git init
git add .
git commit -m "Initial commit - Universal Billing System"
git remote add origin https://github.com/YOUR_USERNAME/universal-billing.git
git push -u origin main
```

**Step 2 — Create PythonAnywhere account**

1. Go to https://www.pythonanywhere.com
2. Sign up for a **free Beginner account**

**Step 3 — Set up on PythonAnywhere**

1. Go to **Dashboard → "Bash" Console**
2. Clone your GitHub repo:
```bash
git clone https://github.com/YOUR_USERNAME/universal-billing.git
```
3. Install dependencies:
```bash
cd universal-billing
pip3 install --user -r requirements.txt
```

**Step 4 — Configure Web App**

1. Go to **Web** tab in PythonAnywhere dashboard
2. Click **Add a new web app**
3. Choose **Manual configuration** → **Python 3.10**
4. Set **Source code**: `/home/YOUR_USERNAME/universal-billing`
5. Set **Working directory**: `/home/YOUR_USERNAME/universal-billing`
6. Click **WSGI configuration file** link and replace its content with:

```python
import sys
sys.path.insert(0, '/home/YOUR_USERNAME/universal-billing')
from app import app as application
```

7. Click **Save** then **Reload** your web app

**Step 5 — Access your live site**

Your site will be live at:
```
https://YOUR_USERNAME.pythonanywhere.com
```

✅ **Free tier includes:** 1 web app, 512MB storage, always-on hosting.

---

### Method 2: Render.com (Also Free)

1. Create account at https://render.com
2. Create a file called `Procfile` in your project:
```
web: python app.py
```
3. Update `app.py` last line to:
```python
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5004))
    app.run(host='0.0.0.0', port=port, debug=False)
```
4. Push to GitHub (same as Method 1, Step 1)
5. On Render → New → Web Service → Connect your GitHub repo
6. Set Build Command: `pip install -r requirements.txt`
7. Set Start Command: `python app.py`
8. Click **Deploy** — live in ~2 minutes at `https://your-app.onrender.com`

---

### Important Note for Hosting

When hosted online, the Excel file and PDF/QR files are stored on the server.  
For production use with persistent data, consider upgrading to a paid plan or using a database like SQLite.  
For a small store with low traffic, the free tier works great.

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` again |
| Port already in use | Change `port=5004` in `app.py` to another number like `5005` |
| PDF not downloading | Make sure `static/bills/` folder exists (auto-created on startup) |
| Excel locked | Close the file in Excel before generating new bills |
| Bill counter jumping | Normal — each page load reserves a number. Click 🔄 to refresh |

---

## 📞 Support

- Check the **Settings** tab to customize your store
- Use **Factory Reset** to start fresh (type "RESET" to confirm)
- All data is stored locally in `store_bills.xlsx`

---

*Universal Billing System v3.0 — Built with Flask, ReportLab, OpenPyXL*
