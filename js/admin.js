/* ============================================
   الهيكو - admin.js
   Admin panel logic: products, orders, offers,
   packages, users CRUD + demo data
   ============================================ */

'use strict';

/* ============================================
   AUTH GUARD
   ============================================ */
function initAdminAuth() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    const user = JSON.parse(userStr || 'null');

    if (!token || !user || user.role !== 'admin') {
        window.location.href = '/login.html';
        return;
    }

    // تأكد إن الـ token موجود في localStorage دايماً
    if (!localStorage.getItem('token') && sessionStorage.getItem('token')) {
        localStorage.setItem('token', sessionStorage.getItem('token'));
        localStorage.setItem('user', sessionStorage.getItem('user'));
    }

    const name = user?.name || user?.email || 'المدير';
    const el = document.getElementById('adminName');
    if (el) el.textContent = name;
    const av = document.getElementById('adminAvatar');
    if (av) av.textContent = name.charAt(0).toUpperCase();
}

function adminLogout() {
    ['token', 'user'].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    window.location.href = '/login.html';
}

/* ============================================
   DEMO DATA (فارغ - كل البيانات من الـ API)
   ============================================ */
const DEMO_PRODUCTS_ADMIN = [];
const DEMO_ORDERS = [];
const DEMO_OFFERS = [];
const DEMO_PACKAGES = [];
const DEMO_USERS = [];

/* ============================================
   PRODUCTS
   ============================================ */
let _products = [];
let _productPage = 1;
const _productPerPage = 8;

async function loadProducts() {
    try {
        const data = await apiFetch('/api/products?limit=100');
        _products = data.products || [];
    } catch { _products = []; }
    filterProducts();
}

function filterProducts() {
    const search = (document.getElementById('productSearch')?.value || '').toLowerCase();
    const cat = document.getElementById('catFilter')?.value || '';
    const status = document.getElementById('statusFilter')?.value || '';

    let list = _products.filter(p =>
        (!search || p.name.toLowerCase().includes(search) || p.brand.toLowerCase().includes(search)) &&
        (!cat || p.category === cat) &&
        (!status || p.status === status)
    );
    _productPage = 1;
    renderProductsTable(list);
}

function renderProductsTable(list) {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    const start = (_productPage - 1) * _productPerPage;
    const page = list.slice(start, start + _productPerPage);

    document.getElementById('productsCount').textContent = `${list.length} منتج`;

    if (!page.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-light);">لا توجد منتجات</td></tr>`;
        return;
    }

    const catAr = { men: 'رجالي', women: 'نسائي', unisex: 'مشترك', oud: 'عود' };

    tbody.innerHTML = page.map(p => `
    <tr>
      <td><input type="checkbox" class="row-check" value="${p.id}" /></td>
      <td>
        <div class="table-product-info">
          <img class="table-thumb"
               src="${p.image || `https://placehold.co/44x44/f5f0e8/c9a96e?text=${encodeURIComponent(p.brand.charAt(0))}`}"
               alt="${p.name}"
               onerror="this.src='https://placehold.co/44x44/f5f0e8/c9a96e?text=P'" />
          <div>
            <div class="table-product-name">${p.name}</div>
            <div class="table-product-brand">${p.is_new ? '<span class="badge badge-new" style="font-size:0.65rem;padding:2px 6px;">جديد</span>' : ''}</div>
          </div>
        </div>
      </td>
      <td>${p.brand}</td>
      <td>${catAr[p.category] || p.category}</td>
      <td><strong>${p.price} ج.م</strong>
        ${p.old_price ? `<br><span style="font-size:0.75rem;text-decoration:line-through;color:var(--text-light);">${p.old_price} ج.م</span>` : ''}
      </td>
      <td>
        <span style="color:${p.stock > 5 ? 'var(--success)' : p.stock > 0 ? 'var(--warning)' : 'var(--error)'};">
          ${p.stock}
        </span>
      </td>
      <td><span style="color:#f59e0b;">${'★'.repeat(Math.round(p.rating || 0))}</span> ${p.rating}</td>
      <td><span class="status-badge ${p.status === 'active' ? 'status-active' : 'status-inactive'}">${p.status === 'active' ? 'نشط' : 'غير نشط'}</span></td>
      <td>
        <div class="table-actions">
          <button class="tbl-btn" onclick="editProduct(${p.id})" title="تعديل"><i class="fas fa-edit"></i></button>
          <button class="tbl-btn" onclick="window.open('../frontend/product-details.html?id=${p.id}','_blank')" title="عرض"><i class="fas fa-eye"></i></button>
          <button class="tbl-btn tbl-delete" onclick="deleteProduct(${p.id})" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');

    renderAdminPagination('productsPagination', list.length, _productPerPage, _productPage, n => { _productPage = n; renderProductsTable(list); });
}

function openProductModal(id = null) {
    document.getElementById('productModalTitle').textContent = id ? 'تعديل المنتج' : 'إضافة منتج جديد';
    document.getElementById('productId').value = id || '';
    if (id) {
        const p = _products.find(x => x.id === id);
        if (!p) return;
        setValue('pName', p.name); setValue('pBrand', p.brand);
        setValue('pPrice', p.price); setValue('pOldPrice', p.old_price || '');
        setValue('pCategory', p.category); setValue('pStock', p.stock);
        setValue('pSizes', (p.sizes || ['50ml']).join(', '));
        setValue('pStatus', p.status); setValue('pDescription', p.description || '');
        // show existing image
        const prev = document.getElementById('pImagePreview');
        if (prev && p.image) { prev.src = p.image; prev.style.display = 'block'; }
        setValue('pImage', p.image || '');
        setValue('pImageB64', p.image || '');
        setValue('pImages', JSON.stringify(p.images || []));
        // show existing extra images
        const grid = document.getElementById('pImagesPreviewGrid');
        if (grid) {
            grid.innerHTML = (p.images || []).map(src => `
            <div style="position:relative;width:70px;height:70px;">
                <img src="${src}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;border:1.5px solid var(--border);" />
            </div>`).join('');
        }
        setCheck('pIsNew', p.is_new); setCheck('pFeatured', p.featured);
    } else {
        document.getElementById('productForm')?.reset();
        setValue('pImages', ''); setValue('pImageB64', '');
        const prev = document.getElementById('pImagePreview');
        if (prev) prev.style.display = 'none';
        const grid = document.getElementById('pImagesPreviewGrid');
        if (grid) grid.innerHTML = '';
    }
    document.getElementById('productModal').classList.add('open');
}

function closeProductModal() { document.getElementById('productModal').classList.remove('open'); }

function saveProduct(e) {
    e?.preventDefault();
    const id = document.getElementById('productId').value;

    const name     = getValue('pName').trim();
    const brand    = getValue('pBrand').trim();
    const priceRaw = getValue('pPrice').trim();
    const category = getValue('pCategory');
    const price    = parseFloat(priceRaw);

    // Validate required fields clearly
    if (!name)     { showToast('اسم المنتج مطلوب', 'error');   document.getElementById('pName').focus();     return; }
    if (!brand)    { showToast('الدار/الماركة مطلوبة', 'error'); document.getElementById('pBrand').focus();    return; }
    if (!priceRaw || isNaN(price) || price <= 0) {
        showToast('السعر مطلوب ويجب أن يكون أكبر من 0', 'error');
        document.getElementById('pPrice').focus();
        return;
    }
    if (!category) { showToast('اختر الفئة', 'error');           document.getElementById('pCategory').focus(); return; }

    const product = {
        name,
        brand,
        price,
        old_price: getValue('pOldPrice') ? parseFloat(getValue('pOldPrice')) : null,
        category,
        stock:       parseInt(getValue('pStock')) || 0,
        sizes:       getValue('pSizes').split(',').map(s => s.trim()).filter(Boolean),
        status:      getValue('pStatus') || 'active',
        description: getValue('pDescription'),
        notes:       { top: '', heart: '', base: '' },
        image:       document.getElementById('pImageB64')?.value || getValue('pImage') || '',
        images:      (() => {
            try { const v = getValue('pImages'); return v ? JSON.parse(v) : []; }
            catch { return []; }
        })(),
        is_new:   getCheck('pIsNew'),
        featured: getCheck('pFeatured'),
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/products/${id}` : '/api/products';

    // Show loading
    const saveBtn = document.querySelector('#productModal .btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...'; }

    fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(product),
    })
        .then(async res => {
            const data = await res.json();
            console.log('Save response:', res.status, data);
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'HTTP ' + res.status);
            }
            closeProductModal();
            showToast(id ? 'تم تحديث المنتج بنجاح' : 'تمت إضافة المنتج بنجاح ✓', 'success');
            loadProducts();
        })
        .catch(err => {
            console.error('Save error:', err);
            showToast('فشل: ' + err.message, 'error');
        })
        .finally(() => {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ المنتج'; }
        });
}

function editProduct(id) { openProductModal(id); }

let _deleteProductId = null;
function deleteProduct(id) {
    _deleteProductId = id;
    document.getElementById('confirmModal').classList.add('open');
    document.getElementById('confirmDeleteBtn').onclick = confirmDeleteProduct;
}
function confirmDeleteProduct() {
    apiFetch(`/api/products/${_deleteProductId}`, { method: 'DELETE' })
        .then(() => {
            _products = _products.filter(p => p.id !== _deleteProductId);
            closeConfirm();
            filterProducts();
            showToast('تم حذف المنتج', 'info');
        })
        .catch(() => {
            closeConfirm();
            showToast('فشل الحذف، حاول مرة أخرى', 'error');
        });
}
function closeConfirm() {
    document.getElementById('confirmModal')?.classList.remove('open');
}

function previewMainImage(url) {
    const img = document.getElementById('pImagePreview');
    if (!img) return;
    if (url && url.startsWith('http')) {
        img.src = url;
        img.style.display = 'block';
        img.onerror = () => { img.style.display = 'none'; };
    } else {
        img.style.display = 'none';
    }
}
function toggleSelectAll(cb) {
    document.querySelectorAll('.row-check').forEach(c => c.checked = cb.checked);
}

/* ============================================
   ORDERS
   ============================================ */
let _orders = [];
let _currentOrder = null;

async function loadOrders() {
    try {
        const data = await apiFetch('/api/orders?limit=100');
        _orders = data.orders || [];
        if (_orders.length === 0) {
            // جرب تحميل بدون limit
            const data2 = await apiFetch('/api/orders');
            _orders = data2.orders || [];
        }
    } catch (e) {
        console.error('Orders load error:', e);
        _orders = [];
    }
    filterOrders();
}

function filterOrders() {
    const search = (document.getElementById('orderSearch')?.value || '').toLowerCase();
    const status = window._orderStatusFilter || '';

    let list = _orders.filter(o =>
        (!search || String(o.id).includes(search) || (o.customer || '').toLowerCase().includes(search) || (o.phone || '').includes(search)) &&
        (!status || o.status === status)
    );
    renderOrdersTable(list);
}

function renderOrdersTable(list) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    document.getElementById('ordersCount').textContent = `${list.length} طلب`;

    const statusLabel = { pending: 'معلق', processing: 'قيد التجهيز', shipped: 'شُحن', delivered: 'مُسلَّم', cancelled: 'ملغي' };
    const statusClass = { pending: 'status-pending', processing: 'status-processing', shipped: 'status-shipped', delivered: 'status-delivered', cancelled: 'status-cancelled' };
    const payLabel = { card: 'بطاقة', fawry: 'فوري', instapay: 'إنستاباي', cod: 'كاش عند الاستلام' };

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-light);">لا توجد طلبات</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(o => `
    <tr>
      <td><strong style="color:var(--primary);">#${o.id}</strong></td>
      <td>
        <div style="font-weight:600;">${o.customer || '-'}</div>
        <div style="font-size:0.75rem;color:var(--text-light);">${o.phone || ''}</div>
      </td>
      <td>${o.items_count || 0} قطعة</td>
      <td><strong>${Number(o.total).toLocaleString('ar-EG')} ج.م</strong></td>
      <td>${payLabel[o.payment_method] || o.payment_method || 'كاش'}</td>
      <td><span class="status-badge ${statusClass[o.status] || ''}">${statusLabel[o.status] || o.status}</span></td>
      <td>${o.date || ''}</td>
      <td>
        <div class="table-actions">
          <button class="tbl-btn" onclick="viewOrder(${o.id})" title="تفاصيل"><i class="fas fa-eye"></i></button>
          <button class="tbl-btn" onclick="printOrder(${o.id})" title="طباعة"><i class="fas fa-print"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function viewOrder(id) {
    const o = _orders.find(x => x.id === id);
    if (!o) return;
    _currentOrder = o;
    const statusLabel = { pending: 'معلق', processing: 'قيد التجهيز', shipped: 'شُحن', delivered: 'مُسلَّم', cancelled: 'ملغي' };

    document.getElementById('orderModalTitle').textContent = `تفاصيل الطلب #${o.id}`;
    document.getElementById('orderModalBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;">
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:6px;">بيانات العميل</div>
        <div style="font-weight:600;font-size:0.9rem;">${o.customer || '-'}</div>
        <div style="font-size:0.83rem;color:var(--text-light);">${o.phone || ''}</div>
        <div style="font-size:0.83rem;color:var(--text-light);margin-top:4px;">${o.address || ''}${o.city ? '، ' + o.city : ''}</div>
        ${o.notes ? `<div style="font-size:0.8rem;color:var(--text-light);margin-top:4px;">ملاحظة: ${o.notes}</div>` : ''}
      </div>
      <div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;">
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:8px;">تحديث الحالة</div>
        <select id="orderStatusSelect" class="filter-select" style="width:100%;">
          ${['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s =>
        `<option value="${s}" ${o.status === s ? 'selected' : ''}>${statusLabel[s]}</option>`
    ).join('')}
        </select>
      </div>
    </div>
    <div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;margin-bottom:16px;">
      <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:8px;">المنتجات</div>
      ${(o.items || []).map(i => `
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;padding:6px 0;border-bottom:1px solid #f0f0f0;">
          <span>${i.name || ''} ${i.brand ? '(' + i.brand + ')' : ''} — ${i.size || '50ml'} × ${i.qty || 1}</span>
          <strong>${Number((i.price || 0) * (i.qty || 1)).toLocaleString('ar-EG')} ج.م</strong>
        </div>`).join('') || `<div style="font-size:0.85rem;color:var(--text-light);">${o.items_count || 0} منتج</div>`}
      <div style="display:flex;justify-content:space-between;font-size:0.95rem;padding-top:10px;font-weight:700;">
        <span>الإجمالي</span>
        <strong style="color:var(--primary);">${Number(o.total || 0).toLocaleString('ar-EG')} ج.م</strong>
      </div>
    </div>`;
    document.getElementById('orderModal').classList.add('open');
}

function updateOrderStatus() {
    if (!_currentOrder) return;
    const newStatus = document.getElementById('orderStatusSelect')?.value;
    const idx = _orders.findIndex(o => o.id === _currentOrder.id);
    if (idx > -1) _orders[idx].status = newStatus;
    apiFetch(`/api/orders/${_currentOrder.id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) }).catch(() => { });
    closeOrderModal();
    filterOrders();
    showToast('تم تحديث حالة الطلب', 'success');
}

function closeOrderModal() { document.getElementById('orderModal')?.classList.remove('open'); }
function printOrder(id) { showToast(`طباعة الطلب ${id}`, 'info'); }
function exportOrders() { showToast('جاري تصدير الطلبات...', 'info'); setTimeout(() => showToast('تم التصدير بنجاح', 'success'), 1200); }

/* ============================================
   OFFERS
   ============================================ */
let _offers = [];

async function loadOffers() {
    try {
        const data = await apiFetch('/api/offers');
        _offers = data.offers || [];
    } catch { _offers = []; }

    const active = _offers.filter(o => o.status === 'active');
    const coupons = _offers.filter(o => o.code);
    const avgDisc = _offers.length
        ? Math.round(_offers.filter(o => o.type === 'percent').reduce((s, o) => s + o.value, 0) / Math.max(_offers.filter(o => o.type === 'percent').length, 1))
        : 0;

    setText('activeOffersCount', active.length);
    setText('couponsCount', coupons.length);
    setText('avgDiscount', avgDisc + '%');
    filterOffers();
}

function filterOffers() {
    const search = (document.getElementById('offerSearch')?.value || '').toLowerCase();
    const list = _offers.filter(o =>
        !search || o.name.toLowerCase().includes(search) || (o.code || '').toLowerCase().includes(search)
    );
    renderOffersTable(list);
}

function renderOffersTable(list) {
    const tbody = document.getElementById('offersTableBody');
    if (!tbody) return;
    setText('offersCount', `${list.length} عرض`);
    const typeLabel = { percent: 'نسبة مئوية', fixed: 'مبلغ ثابت', buy2get1: 'اشتر 2 خذ 1' };
    tbody.innerHTML = list.map(o => `
    <tr>
      <td><strong>${o.name}</strong></td>
      <td>${typeLabel[o.type] || o.type}</td>
      <td>${o.type === 'buy2get1' ? '—' : o.type === 'percent' ? `${o.value}%` : `${o.value} ج.م`}</td>
      <td><code style="background:var(--bg);padding:3px 8px;border-radius:4px;font-size:0.82rem;">${o.code || '—'}</code></td>
      <td>${o.end || '—'}</td>
      <td>${o.uses}${o.max_uses ? ` / ${o.max_uses}` : ''}</td>
      <td><span class="status-badge ${o.status === 'active' ? 'status-active' : 'status-inactive'}">${o.status === 'active' ? 'نشط' : 'غير نشط'}</span></td>
      <td>
        <div class="table-actions">
          <button class="tbl-btn" onclick="editOffer(${o.id})" title="تعديل"><i class="fas fa-edit"></i></button>
          <button class="tbl-btn tbl-delete" onclick="deleteOffer(${o.id})" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function openOfferModal(id = null) {
    document.getElementById('offerModalTitle').textContent = id ? 'تعديل العرض' : 'إضافة عرض جديد';
    document.getElementById('offerId').value = id || '';
    if (id) {
        const o = _offers.find(x => x.id === id);
        if (!o) return;
        setValue('offerName', o.name); setValue('offerType', o.type);
        setValue('offerValue', o.value); setValue('offerCode', o.code || '');
        setValue('offerEnd', o.end || ''); setValue('offerMaxUse', o.max_uses || '');
        setValue('offerDesc', o.desc || '');
        setCheck('offerActive', o.status === 'active');
    } else {
        document.getElementById('offerForm')?.reset();
        setCheck('offerActive', true);
    }
    document.getElementById('offerModal').classList.add('open');
}
function closeOfferModal() { document.getElementById('offerModal').classList.remove('open'); }
function editOffer(id) { openOfferModal(id); }

function saveOffer() {
    const id = document.getElementById('offerId').value;
    const originalPrice = parseFloat(getValue('offerOriginalPrice')) || 0;
    const type = getValue('offerType');
    const value = +getValue('offerValue') || 0;

    // حساب السعر بعد الخصم
    let finalPrice = originalPrice;
    if (type === 'percent' && originalPrice) finalPrice = originalPrice - (originalPrice * value / 100);
    else if (type === 'fixed') finalPrice = Math.max(0, originalPrice - value);

    const offer = {
        id: id ? +id : Date.now(),
        name: getValue('offerName'),
        type,
        value,
        original_price: originalPrice,
        final_price: Math.round(finalPrice * 100) / 100,
        code: getValue('offerCode').toUpperCase(),
        end: getValue('offerEnd'),
        max_uses: getValue('offerMaxUse') ? +getValue('offerMaxUse') : null,
        desc: getValue('offerDesc'),
        status: getCheck('offerActive') ? 'active' : 'inactive',
        featured: getCheck('offerFeatured'),
        image: document.getElementById('offerImage')?.value || '',
        uses: 0,
    };
    if (!offer.name) { showToast('اسم العرض مطلوب', 'error'); return; }
    if (id) { const i = _offers.findIndex(o => o.id === +id); if (i > -1) _offers[i] = offer; }
    else _offers.unshift(offer);
    apiFetch(id ? `/api/offers/${id}` : '/api/offers', { method: id ? 'PUT' : 'POST', body: JSON.stringify(offer) }).catch(() => { });
    closeOfferModal();
    loadOffers();
    showToast(id ? 'تم تحديث العرض' : 'تمت إضافة العرض', 'success');
}

function deleteOffer(id) {
    if (!confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    _offers = _offers.filter(o => o.id !== id);
    apiFetch(`/api/offers/${id}`, { method: 'DELETE' }).catch(() => { });
    loadOffers();
    showToast('تم حذف العرض', 'info');
}

function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setValue('offerCode', code);
}

/* ============================================
   PACKAGES
   ============================================ */
let _packages = [];

async function loadPackages() {
    try {
        const data = await apiFetch('/api/packages');
        _packages = data.packages || [];
    } catch { _packages = []; }
    renderPackagesPreview();
    renderSubscribersTable();
}

function renderPackagesPreview() {
    const el = document.getElementById('packagesPreview');
    if (!el) return;
    const icons = ['fas fa-seedling', 'fas fa-crown', 'fas fa-gem'];
    el.innerHTML = _packages.map((p, i) => `
    <div class="package-card ${p.featured ? 'featured' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div class="package-icon"><i class="${icons[i] || 'fas fa-box'}"></i></div>
        <div style="display:flex;gap:6px;">
          <button class="tbl-btn" onclick="editPackage(${p.id})" title="تعديل"><i class="fas fa-edit"></i></button>
          <button class="tbl-btn tbl-delete" onclick="deletePackage(${p.id})" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <h3 class="package-name">${p.name}</h3>
      <div class="package-price">${p.price} <span>جنيه / شهر</span></div>
      <p class="package-desc">${p.desc}</p>
      <ul class="package-features">${(p.features || []).map(f => `<li>${f}</li>`).join('')}</ul>
      <div style="display:flex;justify-content:space-between;font-size:0.82rem;color:var(--text-light);margin-top:8px;">
        <span><i class="fas fa-users" style="color:var(--primary);margin-left:4px;"></i>${p.subscribers} مشترك</span>
        <span class="status-badge ${p.active ? 'status-active' : 'status-inactive'}">${p.active ? 'نشط' : 'غير نشط'}</span>
      </div>
    </div>`).join('');
}

function renderSubscribersTable() {
    const tbody = document.getElementById('subscribersTableBody');
    if (!tbody) return;
    setText('subsCount', '0 مشترك');
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-light);">
        لا يوجد مشتركون بعد
    </td></tr>`;
}

function filterSubscribers() { renderSubscribersTable(); }

function openPackageModal(id = null) {
    document.getElementById('packageModalTitle').textContent = id ? 'تعديل الباقة' : 'إضافة باقة جديدة';
    document.getElementById('packageId').value = id || '';
    if (id) {
        const p = _packages.find(x => x.id === id);
        if (!p) return;
        setValue('pkgName', p.name); setValue('pkgPrice', p.price);
        setValue('pkgCount', p.count); setValue('pkgSize', p.size);
        setValue('pkgDiscount', p.discount); setValue('pkgDesc', p.desc);
        setValue('pkgFeatures', (p.features || []).join('\n'));
        setCheck('pkgActive', p.active); setCheck('pkgFeatured', p.featured);
    } else {
        document.getElementById('packageForm')?.reset();
        setCheck('pkgActive', true);
    }
    document.getElementById('packageModal').classList.add('open');
}
function closePackageModal() { document.getElementById('packageModal').classList.remove('open'); }
function editPackage(id) { openPackageModal(id); }

function savePackage() {
    const id = document.getElementById('packageId').value;
    const pkg = {
        id: id ? +id : Date.now(),
        name: getValue('pkgName'),
        price: +getValue('pkgPrice'),
        count: +getValue('pkgCount'),
        size: getValue('pkgSize'),
        discount: +getValue('pkgDiscount'),
        desc: getValue('pkgDesc'),
        features: getValue('pkgFeatures').split('\n').map(s => s.trim()).filter(Boolean),
        active: getCheck('pkgActive'),
        featured: getCheck('pkgFeatured'),
        subscribers: 0,
    };
    if (!pkg.name || !pkg.price) { showToast('اسم الباقة والسعر مطلوبان', 'error'); return; }
    if (id) { const i = _packages.findIndex(p => p.id === +id); if (i > -1) _packages[i] = pkg; }
    else _packages.push(pkg);
    apiFetch(id ? `/api/packages/${id}` : '/api/packages', { method: id ? 'PUT' : 'POST', body: JSON.stringify(pkg) }).catch(() => { });
    closePackageModal();
    renderPackagesPreview();
    showToast(id ? 'تم تحديث الباقة' : 'تمت إضافة الباقة', 'success');
}

function deletePackage(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الباقة؟')) return;
    _packages = _packages.filter(p => p.id !== id);
    apiFetch(`/api/packages/${id}`, { method: 'DELETE' }).catch(() => { });
    renderPackagesPreview();
    showToast('تم حذف الباقة', 'info');
}

/* ============================================
   USERS
   ============================================ */
let _users = [];
let _userPage = 1;
const _userPerPage = 10;

async function loadUsers() {
    try {
        const data = await apiFetch('/api/admin/users');
        _users = data.users || [];
    } catch { _users = []; }

    setText('totalUsersCount', _users.length);
    setText('activeUsersCount', _users.filter(u => u.status === 'active').length);
    setText('subscribersCount', 3);  // demo
    setText('newUsersCount', _users.filter(u => new Date(u.joined) > new Date(Date.now() - 30 * 86400000)).length);
    filterUsers();
}

function filterUsers() {
    const search = (document.getElementById('userSearch')?.value || '').toLowerCase();
    const role = document.getElementById('roleFilter')?.value || '';
    const status = document.getElementById('userStatusFilter')?.value || '';

    let list = _users.filter(u =>
        (!search || `${u.first_name} ${u.last_name}`.toLowerCase().includes(search) || u.email.toLowerCase().includes(search) || (u.phone || '').includes(search)) &&
        (!role || u.role === role) &&
        (!status || u.status === status)
    );
    renderUsersTable(list);
}

function renderUsersTable(list) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    document.getElementById('usersCount').textContent = `${list.length} مستخدم`;

    const start = (_userPage - 1) * _userPerPage;
    const page = list.slice(start, start + _userPerPage);

    tbody.innerHTML = page.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-light);color:var(--primary-dark);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0;">
            ${u.first_name.charAt(0)}
          </div>
          <div>
            <div style="font-weight:600;font-size:0.88rem;">${u.first_name} ${u.last_name}</div>
          </div>
        </div>
      </td>
      <td style="font-size:0.85rem;">${u.email}</td>
      <td style="font-size:0.85rem;">${u.phone || '—'}</td>
      <td><span class="status-badge ${u.role === 'admin' ? 'status-processing' : 'status-shipped'}">${u.role === 'admin' ? 'مدير' : 'عميل'}</span></td>
      <td style="text-align:center;">${u.orders}</td>
      <td style="font-size:0.82rem;color:var(--text-light);">${u.joined}</td>
      <td><span class="status-badge ${u.status === 'active' ? 'status-active' : 'status-inactive'}">${u.status === 'active' ? 'نشط' : 'موقوف'}</span></td>
      <td>
        <div class="table-actions">
          <button class="tbl-btn" onclick="editUser(${u.id})" title="تعديل"><i class="fas fa-edit"></i></button>
          <button class="tbl-btn" onclick="viewUserOrders(${u.id})" title="الطلبات"><i class="fas fa-box"></i></button>
          <button class="tbl-btn tbl-delete" onclick="toggleUserStatus(${u.id})" title="تغيير الحالة"><i class="fas fa-ban"></i></button>
        </div>
      </td>
    </tr>`).join('');

    renderAdminPagination('usersPagination', list.length, _userPerPage, _userPage, n => { _userPage = n; renderUsersTable(list); });
}

function openUserModal(id = null) {
    document.getElementById('userModalTitle').textContent = id ? 'تعديل المستخدم' : 'إضافة مستخدم';
    document.getElementById('userId').value = id || '';
    if (id) {
        const u = _users.find(x => x.id === id);
        if (!u) return;
        setValue('uFirstName', u.first_name); setValue('uLastName', u.last_name);
        setValue('uEmail', u.email); setValue('uPhone', u.phone || '');
        setValue('uRole', u.role); setValue('uStatus', u.status);
        setValue('uPassword', '');
    } else {
        document.getElementById('userForm')?.reset();
    }
    document.getElementById('userModal').classList.add('open');
}
function closeUserModal() { document.getElementById('userModal').classList.remove('open'); }
function editUser(id) { openUserModal(id); }

function saveUser() {
    const id = document.getElementById('userId').value;
    const user = {
        id: id ? +id : Date.now(),
        first_name: getValue('uFirstName'),
        last_name: getValue('uLastName'),
        email: getValue('uEmail'),
        phone: getValue('uPhone'),
        role: getValue('uRole'),
        status: getValue('uStatus'),
        orders: 0,
        joined: new Date().toISOString().split('T')[0],
    };
    if (!user.first_name || !user.email) { showToast('الاسم والبريد الإلكتروني مطلوبان', 'error'); return; }
    if (id) { const i = _users.findIndex(u => u.id === +id); if (i > -1) _users[i] = { ..._users[i], ...user }; }
    else _users.unshift(user);
    apiFetch(id ? `/api/admin/users/${id}` : '/api/admin/users', { method: id ? 'PUT' : 'POST', body: JSON.stringify(user) }).catch(() => { });
    closeUserModal();
    loadUsers();
    showToast(id ? 'تم تحديث المستخدم' : 'تمت إضافة المستخدم', 'success');
}

function toggleUserStatus(id) {
    const u = _users.find(x => x.id === id);
    if (!u) return;
    u.status = u.status === 'active' ? 'inactive' : 'active';
    apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ status: u.status }) }).catch(() => { });
    filterUsers();
    showToast(`تم ${u.status === 'active' ? 'تفعيل' : 'إيقاف'} المستخدم`, 'info');
}

function viewUserOrders(id) {
    const u = _users.find(x => x.id === id);
    const orders = _orders.filter(o => o.user_id === id || o.customer === `${u?.first_name} ${u?.last_name}`).slice(0, 5);
    document.getElementById('userOrdersTitle').textContent = `طلبات ${u?.first_name || ''} ${u?.last_name || ''}`;
    document.getElementById('userOrdersBody').innerHTML = orders.length
        ? `<div class="table-wrapper"><table class="admin-table">
            <thead><tr><th>الطلب</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th></tr></thead>
            <tbody>${orders.map(o => `<tr>
                <td><strong style="color:var(--primary);">ORD-${String(o.id).padStart(3, '0')}</strong></td>
                <td>${o.total} ج.م</td>
                <td><span class="status-badge status-${o.status}">${o.status}</span></td>
                <td>${o.date || o.created_at || ''}</td>
            </tr>`).join('')}</tbody></table></div>`
        : '<div class="empty-state" style="padding:30px;"><i class="fas fa-box-open"></i><h3>لا توجد طلبات</h3></div>';
    document.getElementById('userOrdersModal').classList.add('open');
}
function closeUserOrdersModal() { document.getElementById('userOrdersModal').classList.remove('open'); }

/* ============================================
   SHARED UTILITIES
   ============================================ */
function renderAdminPagination(containerId, total, perPage, current, onChange) {
    const pages = Math.ceil(total / perPage);
    const el = document.getElementById(containerId);
    if (!el || pages <= 1) { if (el) el.innerHTML = ''; return; }

    // نخزن الـ callback في window عشان نقدر نستدعيه من onclick
    const cbKey = `__pgcb_${containerId}`;
    window[cbKey] = onChange;

    let html = `<button class="page-btn" ${current === 1 ? 'disabled' : ''} onclick="window['${cbKey}'](${current - 1})"><i class="fas fa-chevron-right"></i></button>`;
    for (let i = 1; i <= pages; i++) {
        html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="window['${cbKey}'](${i})">${i}</button>`;
    }
    html += `<button class="page-btn" ${current === pages ? 'disabled' : ''} onclick="window['${cbKey}'](${current + 1})"><i class="fas fa-chevron-left"></i></button>`;
    el.innerHTML = html;
}

function setValue(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
function getValue(id) { return document.getElementById(id)?.value ?? ''; }
function setCheck(id, v) { const el = document.getElementById(id); if (el) el.checked = !!v; }
function getCheck(id) { return !!document.getElementById(id)?.checked; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
