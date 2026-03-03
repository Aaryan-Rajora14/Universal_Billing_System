'use strict';

class UniversalBilling {
    constructor() {
        this.items = [];
        this.currentBillNo = '';
        this.currentTheme = localStorage.getItem('ubs_theme') || 'red';
        this.currentPage = 'home';
        this.customerId = '';
        this.currency = window.STORE_SETTINGS?.currency || '₹';
        this.allBills = []; // cached for filtering
        this.init();
    }

    init() {
        try {
            this.applyTheme(this.currentTheme);
            this.updateDateTime();
            setInterval(() => this.updateDateTime(), 1000);
            this.bindEvents();
            this.loadFromStorage();
            this.loadSummary();
            this.syncCurrencyLabel();
        } catch (e) {
            console.error('Init error:', e);
        }
    }

    // ===========================
    // EVENT BINDING
    // ===========================
    bindEvents() {
        // Sidebar toggle
        const sidebar = document.querySelector('.sidebar');
        const toggleBtn = document.getElementById('sidebarToggleBtn');
        if (toggleBtn && sidebar) {
            if (localStorage.getItem('ubs_sidebar') === 'closed') sidebar.classList.add('collapsed');
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                localStorage.setItem('ubs_sidebar', sidebar.classList.contains('collapsed') ? 'closed' : 'open');
            });
        }

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.switchPage(page);
            });
        });

        // Theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.applyTheme(e.currentTarget.dataset.theme);
            });
        });

        // Add item
        const addBtn = document.getElementById('addItemBtn');
        if (addBtn) addBtn.addEventListener('click', () => this.addItem());

        // Enter key on product fields
        ['productName', 'productPrice', 'productQuantity', 'productDiscount'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.addItem(); });
        });

        // Customer name events
        const custName = document.getElementById('customerName');
        if (custName) {
            custName.addEventListener('blur', () => this.generateCustomerId());
            custName.addEventListener('input', (e) => {
                const v = e.target.value.trim();
                const el = document.getElementById('previewCustomer');
                if (el) el.innerText = v || 'Not specified';
            });
        }

        // Bill actions
        this.bindById('refreshBillNo',      () => this.generateNewBillNo());
        this.bindById('generatePdfBtn',     () => this.generatePDF());
        this.bindById('clearBillBtn',       () => this.clearBill());

        // Data page
        this.bindById('exportExcelBtn',         () => this.exportExcel());
        this.bindById('exportExcelHistoryBtn',  () => this.exportExcel());
        this.bindById('viewDatabaseBtn',        () => this.openDatabaseModal());
        this.bindById('updateProfitMarginBtn',  () => this.updateProfitMargin());

        // History page
        this.bindById('applyFilterBtn',     () => this.applyFilters());
        this.bindById('clearFilterBtn',     () => this.clearFilters());
        this.bindById('refreshHistoryBtn',  () => this.loadHistory());

        // Settings page — Store info
        this.bindById('saveStoreSettingsBtn', () => this.saveStoreSettings());

        // Settings page — Danger zone
        this.bindById('eraseBillsBtn',  () => this.eraseAllBills());
        this.bindById('factoryResetBtn', () => this.factoryReset());

        // Modal
        this.bindById('closeModalBtn', () => {
            const m = document.getElementById('dbModal');
            if (m) m.style.display = 'none';
        });
        const overlay = document.getElementById('dbModal');
        if (overlay) overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });
    }

    bindById(id, fn) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', fn);
    }

    // ===========================
    // PAGE NAVIGATION
    // ===========================
    switchPage(page) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
        if (btn) btn.classList.add('active');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(`${page}Page`);
        if (target) target.classList.add('active');

        this.currentPage = page;

        const titles = { home: 'Dashboard', history: 'Bill History', data: 'Data Control', settings: 'Settings' };
        const icons  = { home: 'fa-home', history: 'fa-history', data: 'fa-database', settings: 'fa-cog' };
        const titleEl = document.getElementById('pageTitle');
        const iconEl  = document.getElementById('pageIcon');
        if (titleEl) titleEl.innerText = titles[page] || page;
        if (iconEl)  iconEl.className = `fas ${icons[page] || 'fa-circle'}`;

        if (page === 'history') this.loadHistory();
        if (page === 'data')    this.loadStorageInfo();
        if (page === 'settings') this.loadSettingsPage();
    }

    // ===========================
    // THEME
    // ===========================
    applyTheme(theme) {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.theme-btn[data-theme="${theme}"]`);
        if (btn) btn.classList.add('active');
        document.body.className = `theme-${theme}`;
        this.currentTheme = theme;
        localStorage.setItem('ubs_theme', theme);
    }

    // ===========================
    // DATE/TIME
    // ===========================
    updateDateTime() {
        const now = new Date();
        const el = document.getElementById('currentDateTime');
        if (el) {
            el.innerText = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                + ' | ' + now.toLocaleTimeString('en-IN', { hour12: false });
        }
    }

    // ===========================
    // BILL NUMBER
    // ===========================
    async generateNewBillNo() {
        try {
            const res  = await fetch('/generate_bill_no');
            const data = await res.json();
            this.currentBillNo = data.bill_no;
            this.setVal('billNo', data.bill_no);
            this.setInner('previewBillNo', data.bill_no);
        } catch {
            this.currentBillNo = `BILL-${Date.now()}`;
            this.setVal('billNo', this.currentBillNo);
            this.setInner('previewBillNo', this.currentBillNo);
        }
    }

    // ===========================
    // CUSTOMER ID
    // ===========================
    async generateCustomerId() {
        const name = document.getElementById('customerName')?.value.trim();
        if (!name) return;
        try {
            const res  = await fetch('/generate_customer_id', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customer_name: name })
            });
            const data = await res.json();
            this.customerId = data.customer_id;
            this.setVal('customerId', data.customer_id);
        } catch (e) { console.error('Customer ID error:', e); }
    }

    // ===========================
    // ITEMS
    // ===========================
    addItem() {
        const name = document.getElementById('productName')?.value.trim();
        const price = parseFloat(document.getElementById('productPrice')?.value);
        const qty   = parseInt(document.getElementById('productQuantity')?.value);
        const disc  = parseFloat(document.getElementById('productDiscount')?.value) || 0;

        if (!name)                         return this.showToast('Enter item name', 'error');
        if (isNaN(price) || price < 0)     return this.showToast('Enter valid price', 'error');
        if (isNaN(qty)   || qty < 1)       return this.showToast('Enter valid quantity (min 1)', 'error');
        if (disc < 0 || disc > 100)        return this.showToast('Discount must be 0-100%', 'error');

        const actual   = price * qty;
        const discAmt  = actual * (disc / 100);
        const finalPx  = actual - discAmt;

        this.items.push({ name, price, quantity: qty, discount: disc,
                          discountAmount: discAmt, actualPrice: actual, finalPrice: finalPx });

        this.updateBillDisplay();
        this.clearItemFields();
        this.saveToStorage();
        this.showToast(`"${name}" added`, 'success');
        document.getElementById('productName')?.focus();
    }

    removeItem(index) {
        if (index < 0 || index >= this.items.length) return;
        const removed = this.items.splice(index, 1)[0];
        this.updateBillDisplay();
        this.saveToStorage();
        this.showToast(`Removed "${removed.name}"`, 'warning');
    }

    // ===========================
    // BILL DISPLAY
    // ===========================
    updateBillDisplay() {
        const tbody = document.getElementById('billItemsList');
        if (!tbody) return;

        const custName = document.getElementById('customerName')?.value.trim() || '';
        this.setInner('previewCustomer', custName || 'Not specified');
        this.setInner('previewItemCount', this.items.length);

        if (this.items.length === 0) {
            tbody.innerHTML = `<tr class="empty-row"><td colspan="7">
                <div class="empty-state">
                    <i class="fas fa-shopping-basket"></i>
                    <p>No items added yet</p>
                    <small>Fill the form and click "Add Item"</small>
                </div></td></tr>`;
        } else {
            tbody.innerHTML = this.items.map((item, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${this.esc(item.name)}</strong>${item.discount > 0 ? `<br><small style="color:var(--primary)">${item.discount.toFixed(1)}% off</small>` : ''}</td>
                    <td>${this.currency}${item.price.toFixed(2)}</td>
                    <td style="text-align:center">${item.quantity}</td>
                    <td>${item.discount > 0 ? item.discount.toFixed(1) + '%' : '-'}</td>
                    <td><strong>${this.currency}${item.finalPrice.toFixed(2)}</strong></td>
                    <td><button class="delete-btn" onclick="billing.removeItem(${idx})" title="Remove"><i class="fas fa-times"></i></button></td>
                </tr>
            `).join('');
        }

        this.calculateTotals();

        // Update status badge
        const badge = document.getElementById('billStatusBadge');
        if (badge) {
            if (this.items.length > 0) {
                badge.innerText = 'READY'; badge.className = 'status-badge ready';
            } else {
                badge.innerText = 'DRAFT'; badge.className = 'status-badge draft';
            }
        }
    }

    calculateTotals() {
        const subtotal     = this.items.reduce((s, i) => s + i.actualPrice, 0);
        const discountSum  = this.items.reduce((s, i) => s + i.discountAmount, 0);
        const grandTotal   = subtotal - discountSum;

        this.subtotal     = subtotal;
        this.discountTotal = discountSum;
        this.grandTotal   = grandTotal;

        this.setInner('summarySubtotal',   `${this.currency}${subtotal.toFixed(2)}`);
        this.setInner('summaryDiscount',   `- ${this.currency}${discountSum.toFixed(2)}`);
        this.setInner('summaryGrandTotal', `${this.currency}${grandTotal.toFixed(2)}`);

        // Show/hide discount row visually
        const dRow = document.getElementById('discountRow');
        if (dRow) dRow.style.opacity = discountSum > 0 ? '1' : '0.4';
    }

    clearItemFields() {
        this.setVal('productName', '');
        this.setVal('productPrice', '');
        this.setVal('productQuantity', '1');
        this.setVal('productDiscount', '0');
    }

    clearBill() {
        if (this.items.length === 0) return this.showToast('Bill already empty', 'warning');
        if (!confirm('Clear the current bill? This cannot be undone.')) return;
        this.items = [];
        this.setVal('customerName', '');
        this.setVal('customerId', '');
        this.customerId = '';
        this.updateBillDisplay();
        localStorage.removeItem('ubs_bill');
        this.showToast('Bill cleared', 'warning');
    }

    // ===========================
    // PDF GENERATION
    // ===========================
    async generatePDF() {
        if (this.items.length === 0)
            return this.showToast('Add at least one item', 'error');

        const customerName = document.getElementById('customerName')?.value.trim();
        if (!customerName) {
            this.showToast('Enter customer name', 'error');
            document.getElementById('customerName')?.focus();
            return;
        }

        if (!this.customerId) await this.generateCustomerId();

        this.showToast('Generating bill PDF...', 'info');

        const themeColor = getComputedStyle(document.body)
                             .getPropertyValue('--primary').trim() || '#FF4757';

        const payload = {
            customer_name:  customerName,
            customer_id:    this.customerId || 'CUST-WALK',
            bill_no:        this.currentBillNo,
            items: this.items.map(i => ({
                name: i.name, price: i.price, quantity: i.quantity,
                discount: i.discount, total: i.finalPrice
            })),
            subtotal:       this.subtotal,
            discount_total: this.discountTotal,
            grand_total:    this.grandTotal,
            theme_color:    themeColor.startsWith('#') ? themeColor : '#FF4757'
        };

        try {
            const res  = await fetch('/generate_pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Server error');

            // Auto-download
            const a = document.createElement('a');
            a.href = data.filepath;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            this.setInner('excelStatus', 'Updated ✓');
            this.items = [];
            this.setVal('customerName', '');
            this.setVal('customerId', '');
            this.customerId = '';
            localStorage.removeItem('ubs_bill');
            this.updateBillDisplay();
            await this.generateNewBillNo();
            await this.loadSummary();
            this.showToast('Bill generated & downloaded!', 'success');
        } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
            console.error(err);
        }
    }

    // ===========================
    // HISTORY PAGE
    // ===========================
    async loadHistory() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="10" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;

        try {
            const res  = await fetch('/get_all_bills');
            const data = await res.json();

            if (data.success) {
                this.allBills = data.bills || [];
                this.renderHistoryTable(this.allBills);
                const badge = document.getElementById('historyBadge');
                if (badge) badge.innerText = this.allBills.length;
            } else {
                tbody.innerHTML = `<tr><td colspan="10" class="text-center">Failed to load bills</td></tr>`;
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center">Error loading history</td></tr>`;
            console.error(e);
        }
    }

    renderHistoryTable(bills) {
        const tbody = document.getElementById('historyTableBody');
        const counter = document.getElementById('historyCount');
        if (!tbody) return;

        if (!bills || bills.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding:3vh;color:#95A5A6;">
                <i class="fas fa-inbox" style="font-size:3vh;display:block;margin-bottom:1vh;"></i>
                No bills found</td></tr>`;
            if (counter) counter.innerText = '0 bills shown';
            return;
        }

        tbody.innerHTML = bills.map((b, i) => `
            <tr>
                <td>${i + 1}</td>
                <td><strong>${this.esc(b.bill_no || '')}</strong></td>
                <td>${this.esc(b.date || '')}</td>
                <td>${this.esc(b.customer_name || '')}</td>
                <td><span style="font-size:1.1vh;color:#7F8C8D;">${this.esc(b.customer_id || '')}</span></td>
                <td style="text-align:center">${b.items_count || 0}</td>
                <td>${this.currency}${(b.subtotal || 0).toFixed(2)}</td>
                <td style="color:#e74c3c;">- ${this.currency}${(b.discount || 0).toFixed(2)}</td>
                <td><strong>${this.currency}${(b.total || 0).toFixed(2)}</strong></td>
                <td>
                    <button class="action-btn" onclick="billing.downloadBillPDF('${this.esc(b.bill_no)}')" title="Download PDF">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn" onclick="billing.previewBill('${this.esc(b.bill_no)}')" title="Preview PDF">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        if (counter) counter.innerText = `${bills.length} bill${bills.length !== 1 ? 's' : ''} shown`;
    }

    applyFilters() {
        const fromDate = document.getElementById('filterDateFrom')?.value;
        const toDate   = document.getElementById('filterDateTo')?.value;
        const custText = document.getElementById('filterCustomer')?.value.trim().toLowerCase();

        let filtered = [...this.allBills];

        if (fromDate) {
            const from = new Date(fromDate);
            filtered = filtered.filter(b => {
                if (!b.date) return false;
                const parts = b.date.split('-');
                if (parts.length !== 3) return false;
                const bDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                return bDate >= from;
            });
        }
        if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59);
            filtered = filtered.filter(b => {
                if (!b.date) return false;
                const parts = b.date.split('-');
                if (parts.length !== 3) return false;
                const bDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                return bDate <= to;
            });
        }
        if (custText) {
            filtered = filtered.filter(b =>
                (b.customer_name || '').toLowerCase().includes(custText) ||
                (b.customer_id   || '').toLowerCase().includes(custText) ||
                (b.bill_no       || '').toLowerCase().includes(custText)
            );
        }

        this.renderHistoryTable(filtered);
    }

    clearFilters() {
        this.setVal('filterDateFrom', '');
        this.setVal('filterDateTo', '');
        this.setVal('filterCustomer', '');
        this.renderHistoryTable(this.allBills);
        this.showToast('Filters cleared', 'success');
    }

    downloadBillPDF(billNo) {
        if (!billNo) return;
        const link = document.createElement('a');
        link.href = `/static/bills/Bill_${billNo}.pdf`;
        link.download = `Bill_${billNo}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    previewBill(billNo) {
        if (!billNo) return;
        window.open(`/static/bills/Bill_${billNo}.pdf`, '_blank');
    }

    // ===========================
    // DATA PAGE
    // ===========================
    exportExcel() {
        window.location.href = '/export_excel';
        this.showToast('Excel download started', 'success');
    }

    async loadStorageInfo() {
        try {
            const res  = await fetch('/get_summary');
            const data = await res.json();
            if (data.success) {
                const s = data.summary;
                this.setInner('storageTotalBills', s.total_bills);
                this.setInner('storageCustomers', Math.max(0, Math.floor(s.total_bills * 0.75)));
                this.setInner('storageSize', (s.total_bills * 0.12 + 0.05).toFixed(2) + ' MB');
            }
        } catch (e) { console.error(e); }
    }

    async updateProfitMargin() {
        const margin = parseFloat(document.getElementById('profitMargin')?.value);
        if (isNaN(margin) || margin < 0 || margin > 100)
            return this.showToast('Enter a valid margin (0 – 100)', 'error');
        try {
            const res = await fetch('/set_profit_margin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ margin })
            });
            const data = await res.json();
            if (data.success) this.showToast('Profit margin saved', 'success');
            else throw new Error('Save failed');
        } catch (e) {
            this.showToast('Failed to save margin', 'error');
        }
    }

    async openDatabaseModal() {
        const modal = document.getElementById('dbModal');
        const body  = document.getElementById('modalBody');
        if (!modal || !body) return;
        modal.style.display = 'flex';
        body.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading database...';

        try {
            const res  = await fetch('/get_all_bills');
            const data = await res.json();
            if (!data.success || data.bills.length === 0) {
                body.innerHTML = '<p style="text-align:center;padding:3vh;color:#95A5A6;">No bills in database yet.</p>';
                return;
            }
            const rows = data.bills.map((b, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${this.esc(b.bill_no)}</td>
                    <td>${this.esc(b.date)}</td>
                    <td>${this.esc(b.customer_name)}</td>
                    <td>${this.currency}${(b.subtotal || 0).toFixed(2)}</td>
                    <td style="color:#e74c3c;">-${this.currency}${(b.discount || 0).toFixed(2)}</td>
                    <td><strong>${this.currency}${(b.total || 0).toFixed(2)}</strong></td>
                </tr>
            `).join('');
            body.innerHTML = `
                <table style="width:100%;border-collapse:collapse;font-size:1.2vh;">
                    <thead>
                        <tr style="background:var(--primary-light);color:var(--primary-dark);">
                            <th style="padding:1vh 0.8vw;">#</th>
                            <th style="padding:1vh 0.8vw;">Bill No</th>
                            <th style="padding:1vh 0.8vw;">Date</th>
                            <th style="padding:1vh 0.8vw;">Customer</th>
                            <th style="padding:1vh 0.8vw;">Subtotal</th>
                            <th style="padding:1vh 0.8vw;">Discount</th>
                            <th style="padding:1vh 0.8vw;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;
        } catch (e) {
            body.innerHTML = '<p style="color:red;">Error loading database.</p>';
        }
    }

    // ===========================
    // SETTINGS PAGE
    // ===========================
    loadSettingsPage() {
        // Load profit margin from server if needed
        fetch('/get_profit_margin')
            .then(r => r.json())
            .then(d => { this.setVal('profitMargin', d.margin || 30); })
            .catch(() => {});
    }

    async saveStoreSettings() {
        const settings = {
            store_name:     document.getElementById('settingStoreName')?.value.trim(),
            store_tagline:  document.getElementById('settingTagline')?.value.trim(),
            store_address:  document.getElementById('settingAddress')?.value.trim(),
            store_phone:    document.getElementById('settingPhone')?.value.trim(),
            store_email:    document.getElementById('settingEmail')?.value.trim(),
            store_website:  document.getElementById('settingWebsite')?.value.trim(),
            currency_symbol: document.getElementById('settingCurrency')?.value.trim() || '₹',
        };

        if (!settings.store_name) return this.showToast('Store name is required', 'error');

        try {
            const res  = await fetch('/update_store_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();

            if (data.success) {
                // Update UI in real-time
                this.currency = settings.currency_symbol;
                this.setInner('sidebarStoreName', settings.store_name);
                this.setInner('sidebarTagline',  settings.store_tagline);
                this.setInner('topBarStoreName', settings.store_name);
                const initials = settings.store_name.substring(0, 2).toUpperCase();
                this.setInner('topBarInitials', initials);
                document.title = `${settings.store_name} · Billing System`;

                // Update all currency labels
                this.syncCurrencyLabel();
                this.updateBillDisplay();
                this.showToast('Store settings saved!', 'success');
            } else {
                throw new Error(data.error || 'Save failed');
            }
        } catch (e) {
            this.showToast('Error: ' + e.message, 'error');
        }
    }

    syncCurrencyLabel() {
        document.querySelectorAll('.currency-label').forEach(el => {
            el.innerText = this.currency;
        });
    }

    // ===========================
    // DANGER ZONE
    // ===========================
    async eraseAllBills() {
        if (!confirm('⚠️ DELETE ALL BILLS?\n\nThis will permanently remove all bill records from the database.\nThis action cannot be undone!')) return;

        this.showToast('Erasing all bills...', 'info');
        try {
            const res  = await fetch('/erase_all_bills', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                this.allBills = [];
                await this.loadSummary();
                if (this.currentPage === 'history') this.loadHistory();
                if (this.currentPage === 'data')    this.loadStorageInfo();
                this.showToast('All bills erased', 'success');
            } else {
                throw new Error(data.error || 'Erase failed');
            }
        } catch (e) {
            this.showToast('Error: ' + e.message, 'error');
        }
    }

    async factoryReset() {
        const confirmed = prompt('TYPE "RESET" to confirm factory reset (all data + settings will be cleared):');
        if (confirmed !== 'RESET') {
            this.showToast('Factory reset cancelled', 'warning');
            return;
        }
        this.showToast('Performing factory reset...', 'info');
        try {
            const res  = await fetch('/factory_reset', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                this.showToast('Factory reset complete. Reloading...', 'success');
                setTimeout(() => location.reload(), 1800);
            } else {
                throw new Error(data.error || 'Reset failed');
            }
        } catch (e) {
            this.showToast('Error: ' + e.message, 'error');
        }
    }

    // ===========================
    // SUMMARY
    // ===========================
    async loadSummary() {
        try {
            const res  = await fetch('/get_summary');
            const data = await res.json();
            if (data.success) {
                const s = data.summary;
                const cur = this.currency;
                this.setInner('totalBills',     s.total_bills);
                this.setInner('totalSales',     `${cur}${s.total_sales.toFixed(2)}`);
                this.setInner('totalDiscounts', `${cur}${s.total_discounts.toFixed(2)}`);
                this.setInner('totalProfit',    `${cur}${s.total_profit.toFixed(2)}`);
                this.setInner('homeBadge',    s.total_bills);
                this.setInner('historyBadge', s.total_bills);
                this.setInner('storageTotalBills', s.total_bills);

                const marginEl = document.getElementById('profitMargin');
                if (marginEl && !marginEl.dataset.userChanged) marginEl.value = s.profit_margin;
            }
        } catch (e) { console.error('Summary error:', e); }
    }

    // ===========================
    // LOCAL STORAGE
    // ===========================
    saveToStorage() {
        const payload = {
            items:        this.items,
            customerName: document.getElementById('customerName')?.value || '',
            customerId:   this.customerId,
            billNo:       this.currentBillNo
        };
        localStorage.setItem('ubs_bill', JSON.stringify(payload));
    }

    loadFromStorage() {
        const raw = localStorage.getItem('ubs_bill');
        if (!raw) {
            this.generateNewBillNo();
            return;
        }
        try {
            const d = JSON.parse(raw);
            this.items = d.items || [];
            if (d.customerName) this.setVal('customerName', d.customerName);
            if (d.customerId) {
                this.customerId = d.customerId;
                this.setVal('customerId', d.customerId);
            }
            if (d.billNo) {
                this.currentBillNo = d.billNo;
                this.setVal('billNo', d.billNo);
                this.setInner('previewBillNo', d.billNo);
            } else {
                this.generateNewBillNo();
            }
            if (this.items.length > 0) this.updateBillDisplay();
        } catch {
            localStorage.removeItem('ubs_bill');
            this.generateNewBillNo();
        }
    }

    // ===========================
    // TOAST NOTIFICATIONS
    // ===========================
    showToast(msg, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        const icons = {
            success: 'fa-check-circle',
            error:   'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info:    'fa-info-circle'
        };
        toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i> ${msg}`;
        toast.className = `toast show ${type}`;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3200);
    }

    // ===========================
    // HELPERS
    // ===========================
    setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }
    setInner(id, val) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }
    esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
    window.billing = new UniversalBilling();
});
