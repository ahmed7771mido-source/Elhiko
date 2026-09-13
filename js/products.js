/* ============================================
   الهيكو - products.js
   Products listing page: filters, sort, pagination
   ============================================ */

'use strict';

/* ---- State ---- */
const state = {
    all: [],   // full dataset
    filtered: [],   // after filters
    page: 1,
    perPage: 12,
    category: 'all',
    priceMax: 3000,
    brands: [],
    sizes: [],
    minRating: 0,
    inStock: false,
    onSale: false,
    search: '',
    sort: 'default',
    view: 'grid',
    discount: null,  // coupon
};

/* ---- Demo products dataset (فارغ - المنتجات تيجي من لوحة التحكم) ---- */
const DEMO_PRODUCTS = [];

/* ---- Init ---- */
async function init() {
    await loadProducts();
    readUrlParams();
    buildBrandList();
    updateCounts();
    applyFilters();
    bindEvents();
}

async function loadProducts() {
    try {
        const data = await apiFetch('/api/products?limit=100');
        state.all = data.products || [];
    } catch {
        state.all = [];
    }
}

/* ---- URL params ---- */
function readUrlParams() {
    const p = new URLSearchParams(location.search);
    if (p.get('cat')) { state.category = p.get('cat'); setActiveCategory(state.category); }
    if (p.get('search')) { state.search = p.get('search'); document.getElementById('searchInput').value = state.search; }
    if (p.get('sort')) { state.sort = p.get('sort'); document.getElementById('sortSelect').value = state.sort; }
}

/* ---- Build dynamic brand list ---- */
function buildBrandList() {
    const brands = [...new Set(state.all.map(p => p.brand))].sort();
    const container = document.getElementById('brandList');
    if (!container) return;
    container.innerHTML = brands.map(b => `
    <label class="checkbox-item">
      <input type="checkbox" value="${b}" onchange="toggleBrandFilter('${b}', this.checked)" />
      ${b}
    </label>`).join('');
}

/* ---- Counts per category ---- */
function updateCounts() {
    const cats = ['all', 'men', 'women', 'unisex', 'oud'];
    cats.forEach(cat => {
        const el = document.getElementById(`count-${cat}`);
        if (!el) return;
        el.textContent = cat === 'all' ? state.all.length : state.all.filter(p => p.category === cat).length;
    });
}

/* ---- Apply all filters ---- */
function applyFilters() {
    let list = [...state.all];

    if (state.category !== 'all') list = list.filter(p => p.category === state.category);
    if (state.search) list = list.filter(p =>
        p.name.toLowerCase().includes(state.search.toLowerCase()) ||
        (p.brand || '').toLowerCase().includes(state.search.toLowerCase())
    );
    if (state.priceMax < 3000) list = list.filter(p => p.price <= state.priceMax);
    if (state.brands.length) list = list.filter(p => state.brands.includes(p.brand));
    if (state.sizes.length) list = list.filter(p => p.sizes?.some(s => state.sizes.includes(s.replace('ml', ''))));
    if (state.minRating > 0) list = list.filter(p => (p.rating || 0) >= state.minRating);
    if (state.inStock) list = list.filter(p => (p.stock || 0) > 0);
    if (state.onSale) list = list.filter(p => p.old_price);

    // Sort
    switch (state.sort) {
        case 'price-asc': list.sort((a, b) => a.price - b.price); break;
        case 'price-desc': list.sort((a, b) => b.price - a.price); break;
        case 'rating': list.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
        case 'newest': list.sort((a, b) => (b.is_new ? 1 : 0) - (a.is_new ? 1 : 0)); break;
        case 'name-asc': list.sort((a, b) => a.name.localeCompare(b.name, 'ar')); break;
    }

    state.filtered = list;
    state.page = 1;
    renderProducts();
    renderPagination();
    updateToolbar();
    updateActiveTags();
}

/* ---- Render product cards ---- */
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const start = (state.page - 1) * state.perPage;
    const end = start + state.perPage;
    const page = state.filtered.slice(start, end);

    if (!page.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <i class="fas fa-box-open"></i>
      <h3>لا توجد منتجات</h3>
      <p>جرّب تغيير الفلاتر أو البحث بكلمة مختلفة</p>
      <button class="btn btn-outline" onclick="clearAllFilters()">إلغاء جميع الفلاتر</button>
    </div>`;
        return;
    }

    grid.innerHTML = page.map(p => renderProductCard(p)).join('');
}

/* ---- Pagination ---- */
function renderPagination() {
    const total = Math.ceil(state.filtered.length / state.perPage);
    const pag = document.getElementById('pagination');
    if (!pag) return;
    if (total <= 1) { pag.innerHTML = ''; return; }

    let html = `<button class="page-btn" onclick="goPage(${state.page - 1})" ${state.page === 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    for (let i = 1; i <= total; i++) {
        if (total > 7 && i > 3 && i < total - 1 && Math.abs(i - state.page) > 1) {
            if (i === 4 || i === total - 2) html += `<span style="padding:0 4px;color:var(--text-light);">...</span>`;
            continue;
        }
        html += `<button class="page-btn ${i === state.page ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="goPage(${state.page + 1})" ${state.page === total ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    pag.innerHTML = html;
}

function goPage(n) {
    const total = Math.ceil(state.filtered.length / state.perPage);
    if (n < 1 || n > total) return;
    state.page = n;
    renderProducts();
    renderPagination();
    window.scrollTo({ top: 300, behavior: 'smooth' });
}

/* ---- Toolbar ---- */
function updateToolbar() {
    const shown = document.getElementById('resultsShown');
    const total = document.getElementById('resultsTotal');
    if (shown) shown.textContent = Math.min(state.page * state.perPage, state.filtered.length);
    if (total) total.textContent = state.filtered.length;
}

/* ---- Active filter tags ---- */
function updateActiveTags() {
    const container = document.getElementById('activeFilters');
    if (!container) return;
    const tags = [];
    if (state.category !== 'all') tags.push({ label: catLabel(state.category), key: 'category' });
    if (state.search) tags.push({ label: `"${state.search}"`, key: 'search' });
    if (state.priceMax < 3000) tags.push({ label: `حتى ${state.priceMax} ج.م`, key: 'price' });
    state.brands.forEach(b => tags.push({ label: b, key: `brand:${b}` }));
    state.sizes.forEach(s => tags.push({ label: `${s}ml`, key: `size:${s}` }));
    if (state.minRating) tags.push({ label: `${state.minRating}+ نجوم`, key: 'rating' });
    if (state.inStock) tags.push({ label: 'متوفر', key: 'inStock' });
    if (state.onSale) tags.push({ label: 'عروض', key: 'onSale' });

    container.innerHTML = tags.map(t => `
    <span class="filter-tag">${t.label}
      <button onclick="removeTag('${t.key}')" aria-label="إزالة"><i class="fas fa-times"></i></button>
    </span>`).join('');
}

function removeTag(key) {
    if (key === 'category') { state.category = 'all'; setActiveCategory('all'); }
    else if (key === 'search') { state.search = ''; document.getElementById('searchInput').value = ''; }
    else if (key === 'price') { state.priceMax = 3000; document.getElementById('priceSlider').value = 3000; updatePriceLabel(); }
    else if (key === 'rating') { state.minRating = 0; document.querySelector('input[name="rating"][value="0"]').checked = true; }
    else if (key === 'inStock') { state.inStock = false; document.getElementById('inStock').checked = false; }
    else if (key === 'onSale') { state.onSale = false; document.getElementById('onSale').checked = false; }
    else if (key.startsWith('brand:')) { const b = key.slice(6); state.brands = state.brands.filter(x => x !== b); document.querySelector(`input[value="${b}"]`).checked = false; }
    else if (key.startsWith('size:')) { const s = key.slice(5); state.sizes = state.sizes.filter(x => x !== s); document.querySelector(`.size-btn[data-size="${s}"]`).classList.remove('active'); }
    applyFilters();
}

function clearAllFilters() {
    state.category = 'all';
    state.search = '';
    state.priceMax = 3000;
    state.brands = [];
    state.sizes = [];
    state.minRating = 0;
    state.inStock = false;
    state.onSale = false;
    document.getElementById('searchInput').value = '';
    document.getElementById('priceSlider').value = 3000;
    updatePriceLabel();
    setActiveCategory('all');
    document.querySelectorAll('.brand-list input').forEach(i => i.checked = false);
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('input[name="rating"][value="0"]').checked = true;
    document.getElementById('inStock').checked = false;
    document.getElementById('onSale').checked = false;
    applyFilters();
}

/* ---- Filter handlers ---- */
function filterByCategory(el) {
    document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    state.category = el.dataset.cat;
    applyFilters();
}

function setActiveCategory(cat) {
    document.querySelectorAll('.category-item').forEach(i => {
        i.classList.toggle('active', i.dataset.cat === cat);
    });
}

function toggleBrandFilter(brand, checked) {
    if (checked) state.brands.push(brand);
    else state.brands = state.brands.filter(b => b !== brand);
    applyFilters();
}

function updatePriceLabel() {
    const el = document.getElementById('priceMax');
    if (el) el.textContent = `${state.priceMax} ج.م`;
}

function catLabel(cat) {
    const map = { men: 'رجالي', women: 'نسائي', unisex: 'مشترك', oud: 'عود' };
    return map[cat] || cat;
}

/* ---- Bind events ---- */
function bindEvents() {
    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput?.addEventListener('input', debounce(e => {
        state.search = e.target.value.trim();
        applyFilters();
    }, 350));

    // Price slider
    const slider = document.getElementById('priceSlider');
    slider?.addEventListener('input', e => {
        state.priceMax = +e.target.value;
        updatePriceLabel();
        // Update gradient
        const pct = (state.priceMax / 3000) * 100;
        slider.style.background = `linear-gradient(to right, var(--primary) 0%, var(--primary) ${pct}%, var(--border) ${pct}%)`;
        applyFilters();
    });

    // Sort
    document.getElementById('sortSelect')?.addEventListener('change', e => {
        state.sort = e.target.value;
        applyFilters();
    });

    // View toggle
    document.getElementById('gridViewBtn')?.addEventListener('click', () => {
        state.view = 'grid';
        document.getElementById('products-container').classList.remove('list-view');
        document.getElementById('gridViewBtn').classList.add('active');
        document.getElementById('listViewBtn').classList.remove('active');
    });

    document.getElementById('listViewBtn')?.addEventListener('click', () => {
        state.view = 'list';
        document.getElementById('products-container').classList.add('list-view');
        document.getElementById('listViewBtn').classList.add('active');
        document.getElementById('gridViewBtn').classList.remove('active');
    });

    // Size buttons
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const s = btn.dataset.size;
            btn.classList.toggle('active');
            if (state.sizes.includes(s)) state.sizes = state.sizes.filter(x => x !== s);
            else state.sizes.push(s);
            applyFilters();
        });
    });

    // Rating
    document.querySelectorAll('input[name="rating"]').forEach(r => {
        r.addEventListener('change', e => {
            state.minRating = +e.target.value;
            applyFilters();
        });
    });

    // Availability
    document.getElementById('inStock')?.addEventListener('change', e => {
        state.inStock = e.target.checked;
        applyFilters();
    });
    document.getElementById('onSale')?.addEventListener('change', e => {
        state.onSale = e.target.checked;
        applyFilters();
    });

    // Mobile filter toggle
    document.getElementById('filterToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebarOverlay').classList.add('open');
    });
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('open');
    });
}

/* ---- Bootstrap ---- */
document.addEventListener('DOMContentLoaded', init);
