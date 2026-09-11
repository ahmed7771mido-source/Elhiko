/* ============================================
   الهيكو - product-details.js
   Single product page logic
   ============================================ */

'use strict';

/* ---- State ---- */
let currentProduct = null;
let selectedSize = null;
let selectedQty = 1;
let selectedRating = 0;

/* ---- Init ---- */
async function init() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { showError(); return; }

    try {
        const data = await apiFetch(`/api/products/${id}`);
        currentProduct = data.product || data;
        if (!currentProduct || !currentProduct.id) { showError(); return; }
    } catch {
        showError();
        return;
    }

    renderProduct();
}

/* ---- Render ---- */
function renderProduct() {
    document.getElementById('productLoading').style.display = 'none';
    document.getElementById('productContent').style.display = 'block';

    const p = currentProduct;
    document.title = `${p.name} - ${p.brand} | الهيكو`;

    document.getElementById('breadcrumbProduct').textContent = p.name;

    renderGallery(p);

    const discount = p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : null;
    const badgesEl = document.getElementById('galleryBadges');
    if (badgesEl) {
        badgesEl.innerHTML =
            (p.is_new ? '<span class="badge badge-new">جديد</span>' : '') +
            (discount ? `<span class="badge badge-sale">-${discount}%</span>` : '');
    }

    document.getElementById('detailBrand').textContent = p.brand;
    document.getElementById('detailName').textContent = p.name;
    document.getElementById('detailDesc').textContent = p.description || '';
    document.getElementById('detailStars').textContent = renderStars(p.rating || 0);
    document.getElementById('detailRatingVal').textContent = (p.rating || 0).toFixed(1);
    document.getElementById('detailRatingCount').textContent = `(${p.reviews_count || p.reviews || 0} تقييم)`;
    document.getElementById('detailPrice').textContent = formatPrice(p.price);

    if (p.old_price) {
        document.getElementById('detailOldPrice').style.display = '';
        document.getElementById('detailOldPrice').textContent = formatPrice(p.old_price);
        document.getElementById('detailDiscount').style.display = '';
        document.getElementById('detailDiscount').textContent = `وفّر ${formatPrice(p.old_price - p.price)}`;
    }

    selectedSize = p.sizes?.[1] || p.sizes?.[0] || '50ml';
    renderSizes(p.sizes || ['50ml']);
    renderStock(p.stock);

    document.getElementById('metaSku').textContent = p.sku || `PRF-${String(p.id).padStart(4, '0')}`;
    document.getElementById('metaBrand').textContent = p.brand;
    document.getElementById('metaCategory').textContent = catAr(p.category);
    document.getElementById('fullDescription').textContent = p.description || '';

    renderSpecs(p.specs || []);

    if (p.notes) {
        document.getElementById('noteTop').textContent = p.notes.top || '-';
        document.getElementById('noteHeart').textContent = p.notes.heart || '-';
        document.getElementById('noteBase').textContent = p.notes.base || '-';
    }

    renderReviews(p);

    const wBtn = document.getElementById('wishlistBtn');
    if (wBtn && isWishlisted(p.id)) {
        wBtn.classList.add('active');
        wBtn.querySelector('i').className = 'fas fa-heart';
    }

    loadRelated(p);
    bindButtons(p);
}

/* ---- Gallery ---- */
function renderGallery(p) {
    const imgs = p.images?.length ? p.images
        : [`https://placehold.co/600x600/f5f0e8/c9a96e?text=${encodeURIComponent(p.brand || 'عطر')}`];

    const mainImg = document.getElementById('mainImage');
    if (mainImg) { mainImg.src = imgs[0]; mainImg.alt = p.name; }

    const thumbs = document.getElementById('thumbnails');
    if (thumbs) {
        thumbs.innerHTML = imgs.map((src, i) => `
            <div class="thumb-item ${i === 0 ? 'active' : ''}" onclick="switchImage('${src}', this)">
                <img src="${src}" alt="صورة ${i + 1}" loading="lazy" />
            </div>`).join('');
    }
}

function switchImage(src, thumbEl) {
    document.getElementById('mainImage').src = src;
    document.querySelectorAll('.thumb-item').forEach(t => t.classList.remove('active'));
    thumbEl.classList.add('active');
}

/* ---- Sizes ---- */
function renderSizes(sizes) {
    const container = document.getElementById('sizeOptions');
    if (!container) return;
    container.innerHTML = sizes.map(s => `
        <button class="size-option ${s === selectedSize ? 'active' : ''}" onclick="selectSize('${s}', this)">
            ${s}
        </button>`).join('');
    document.getElementById('selectedSize').textContent = selectedSize;
}

function selectSize(size, el) {
    selectedSize = size;
    document.querySelectorAll('.size-option').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('selectedSize').textContent = size;
}

/* ---- Stock badge ---- */
function renderStock(stock) {
    const el = document.getElementById('stockBadge');
    if (!el) return;
    if (stock > 5) el.innerHTML = '<span class="stock-badge in-stock">متوفر في المخزون</span>';
    else if (stock > 0) el.innerHTML = `<span class="stock-badge low-stock">آخر ${stock} قطع!</span>`;
    else el.innerHTML = '<span class="stock-badge no-stock">غير متوفر</span>';
}

/* ---- Specs grid ---- */
function renderSpecs(specs) {
    const el = document.getElementById('detailSpecs');
    if (!el || !specs.length) return;
    el.innerHTML = specs.map(s => `
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;text-align:center;">
            <div style="font-size:0.75rem;color:var(--text-light);margin-bottom:4px;">${s.label}</div>
            <div style="font-weight:600;color:var(--secondary);font-size:0.9rem;">${s.value}</div>
        </div>`).join('');
}

/* ---- Reviews ---- */
function renderReviews(p) {
    const reviews = p.demo_reviews || p.reviews_list || [];

    const avgEl = document.getElementById('avgRating');
    const starsEl = document.getElementById('avgStars');
    const countEl = document.getElementById('totalReviews');
    if (avgEl) avgEl.textContent = (p.rating || 0).toFixed(1);
    if (starsEl) starsEl.textContent = renderStars(p.rating || 0);
    if (countEl) countEl.textContent = `${p.reviews_count || p.reviews || 0} تقييم`;

    const list = document.getElementById('reviewList');
    if (!list) return;

    if (!reviews.length) {
        list.innerHTML = `<div class="empty-state" style="padding:30px;">
            <i class="far fa-comment-dots"></i>
            <h3>لا توجد تقييمات بعد</h3>
            <p>كن أول من يقيّم هذا المنتج!</p>
        </div>`;
        return;
    }

    list.innerHTML = reviews.map(r => `
        <div class="review-card">
            <div class="review-header">
                <div class="reviewer-info">
                    <div class="reviewer-avatar">${(r.name || '؟').charAt(0)}</div>
                    <div>
                        <div class="reviewer-name">${r.name || 'مجهول'}</div>
                        <div class="review-date">${r.date || r.created_at || ''}</div>
                    </div>
                </div>
                <span style="color:#f59e0b;">${renderStars(r.rating)}</span>
            </div>
            <p class="review-text">${r.text}</p>
        </div>`).join('');
}

/* ---- Submit review ---- */
function submitReview() {
    if (!getToken()) { showToast('يجب تسجيل الدخول أولاً', 'error'); return; }
    if (!selectedRating) { showToast('يرجى اختيار تقييم', 'error'); return; }
    const text = document.getElementById('reviewText').value.trim();
    if (!text) { showToast('يرجى كتابة تعليق', 'error'); return; }

    apiFetch(`/api/products/${currentProduct.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: selectedRating, text })
    }).then(() => {
        showToast('تم إرسال تقييمك بنجاح!', 'success');
        document.getElementById('reviewText').value = '';
        resetStarRating();
    }).catch(() => {
        showToast('حدث خطأ، حاول مرة أخرى', 'error');
    });
}

/* ---- Star rating input ---- */
function initStarRating() {
    document.querySelectorAll('#starRating span').forEach(star => {
        star.addEventListener('mouseover', () => highlightStars(+star.dataset.v));
        star.addEventListener('mouseout', () => highlightStars(selectedRating));
        star.addEventListener('click', () => { selectedRating = +star.dataset.v; highlightStars(selectedRating); });
    });
}

function highlightStars(n) {
    document.querySelectorAll('#starRating span').forEach(s => {
        s.style.color = +s.dataset.v <= n ? '#f59e0b' : '#ddd';
    });
}

function resetStarRating() {
    selectedRating = 0;
    highlightStars(0);
}

/* ---- Tabs ---- */
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
        });
    });
}

/* ---- Related products ---- */
async function loadRelated(p) {
    const container = document.getElementById('relatedProducts');
    if (!container) return;
    try {
        const data = await apiFetch(`/api/products?category=${p.category}&limit=4`);
        const related = (data.products || []).filter(r => r.id !== p.id).slice(0, 4);
        container.innerHTML = related.length
            ? related.map(r => renderProductCard(r)).join('')
            : '<p style="color:var(--text-light);grid-column:1/-1;text-align:center;">لا توجد منتجات مشابهة</p>';
    } catch {
        container.innerHTML = '<p style="color:var(--text-light);grid-column:1/-1;text-align:center;">لا توجد منتجات مشابهة</p>';
    }
}

/* ---- CTA buttons ---- */
function bindButtons(p) {
    const qtyInput = document.getElementById('qtyInput');

    document.getElementById('qtyMinus')?.addEventListener('click', () => {
        if (selectedQty > 1) { selectedQty--; qtyInput.value = selectedQty; }
    });
    document.getElementById('qtyPlus')?.addEventListener('click', () => {
        if (selectedQty < (p.stock || 99)) { selectedQty++; qtyInput.value = selectedQty; }
    });
    qtyInput?.addEventListener('change', e => {
        const v = parseInt(e.target.value) || 1;
        selectedQty = Math.min(Math.max(1, v), p.stock || 99);
        qtyInput.value = selectedQty;
    });

    const img = p.images?.[0] || `https://placehold.co/300x400/f5f0e8/c9a96e?text=${encodeURIComponent(p.brand || 'عطر')}`;

    document.getElementById('addToCartBtn')?.addEventListener('click', () => {
        if ((p.stock || 0) === 0) { showToast('المنتج غير متوفر حالياً', 'error'); return; }
        for (let i = 0; i < selectedQty; i++) {
            addToCart(p.id, p.name, p.price, img, selectedSize, p.brand);
        }
    });

    document.getElementById('buyNowBtn')?.addEventListener('click', () => {
        if ((p.stock || 0) === 0) { showToast('المنتج غير متوفر حالياً', 'error'); return; }
        addToCart(p.id, p.name, p.price, img, selectedSize, p.brand);
        window.location.href = 'checkout.html';
    });

    document.getElementById('wishlistBtn')?.addEventListener('click', () => {
        const added = toggleWishlist({ id: p.id, name: p.name, price: p.price, image: img, brand: p.brand });
        const wBtn = document.getElementById('wishlistBtn');
        wBtn.classList.toggle('active', added);
        wBtn.querySelector('i').className = added ? 'fas fa-heart' : 'far fa-heart';
    });
}

/* ---- Share ---- */
function shareProduct(platform) {
    const url = encodeURIComponent(location.href);
    const title = encodeURIComponent(currentProduct?.name || 'الهيكو');
    const links = {
        whatsapp: `https://wa.me/?text=${title}%20${url}`,
        twitter: `https://twitter.com/intent/tweet?text=${title}&url=${url}`,
    };
    window.open(links[platform], '_blank');
}

function copyLink() {
    navigator.clipboard.writeText(location.href)
        .then(() => showToast('تم نسخ الرابط', 'success'))
        .catch(() => showToast('تعذّر النسخ', 'error'));
}

/* ---- Helpers ---- */
function showError() {
    document.getElementById('productLoading').style.display = 'none';
    document.getElementById('productError').style.display = 'block';
}

function catAr(cat) {
    const m = { men: 'رجالي', women: 'نسائي', unisex: 'مشترك', oud: 'عود' };
    return m[cat] || cat;
}

/* ---- Bootstrap ---- */
document.addEventListener('DOMContentLoaded', () => {
    init();
    initTabs();
    initStarRating();
});
