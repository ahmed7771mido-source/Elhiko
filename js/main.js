/* ============================================
   الهيكو - main.js
   Shared utilities: navbar, cart badge, toast,
   auth state, addToCart global helper
   ============================================ */

'use strict';

/* ---- Navbar scroll behaviour ---- */
const navbar = document.getElementById('navbar');
if (navbar) {
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
}

/* ---- Mobile hamburger ---- */
const hamburger = document.getElementById('hamburger');
const navbarNav = document.getElementById('navbarNav');
const navOverlay = document.getElementById('navOverlay');

function openNav() {
    navbarNav?.classList.add('open');
    hamburger?.classList.add('open');
    navOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeNav() {
    navbarNav?.classList.remove('open');
    hamburger?.classList.remove('open');
    navOverlay?.classList.remove('open');
    document.body.style.overflow = '';
}

hamburger?.addEventListener('click', () => {
    navbarNav?.classList.contains('open') ? closeNav() : openNav();
});

navOverlay?.addEventListener('click', closeNav);

/* ---- Toast notifications ---- */
let toastTimer = null;

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.className = `toast ${type}`;

    const iconMap = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const icon = toast.querySelector('i');
    if (icon) icon.className = `fas ${iconMap[type] || iconMap.info}`;

    clearTimeout(toastTimer);
    requestAnimationFrame(() => {
        toast.classList.add('show');
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
    });
}

/* ---- Cart utilities ---- */
const CART_KEY = 'الهيكو_cart';

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const cart = getCart();
    const total = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
    document.querySelectorAll('#cartCount').forEach(el => {
        el.textContent = total;
        el.style.display = total > 0 ? 'flex' : 'none';
    });
}

function addToCart(id, name, price, image = '', size = '50ml', brand = '') {
    const cart = getCart();
    const key = `${id}-${size}`;
    const idx = cart.findIndex(i => i.key === key);

    if (idx > -1) {
        cart[idx].qty = (cart[idx].qty || 1) + 1;
    } else {
        cart.push({ key, id, name, price, image, size, brand, qty: 1 });
    }
    saveCart(cart);
    showToast(`تمت إضافة "${name}" إلى السلة`, 'success');
}

function removeFromCart(key) {
    const cart = getCart().filter(i => i.key !== key);
    saveCart(cart);
}

function updateCartItemQty(key, qty) {
    const cart = getCart();
    const idx = cart.findIndex(i => i.key === key);
    if (idx > -1) {
        if (qty <= 0) cart.splice(idx, 1);
        else cart[idx].qty = qty;
    }
    saveCart(cart);
}

function clearCart() {
    saveCart([]);
}

/* ---- Wishlist utilities ---- */
const WISHLIST_KEY = 'الهيكو_wishlist';

function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || []; }
    catch { return []; }
}

function toggleWishlist(product) {
    const list = getWishlist();
    const idx = list.findIndex(i => i.id === product.id);
    if (idx > -1) {
        list.splice(idx, 1);
        showToast('تمت الإزالة من المفضلة', 'info');
    } else {
        list.push(product);
        showToast('تمت الإضافة إلى المفضلة ❤️', 'success');
    }
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
    return idx === -1; // true = added
}

function isWishlisted(id) {
    return getWishlist().some(i => i.id === id);
}

/* ---- Auth helpers ---- */
function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
    } catch { return null; }
}

function logout() {
    ['token', 'user'].forEach(k => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
    });
    window.location.href = '/login.html';
}

/* ---- Render user state in navbar ---- */
function renderNavUser() {
    const userBtn = document.getElementById('userBtn');
    if (!userBtn) return;
    const user = getCurrentUser();
    if (user) {
        userBtn.innerHTML = `<i class="fas fa-user-circle"></i>`;
        userBtn.title = user.name || user.email;
        userBtn.onclick = () => {
            const menu = document.getElementById('userDropdown');
            if (menu) menu.classList.toggle('open');
        };
    } else {
        userBtn.onclick = () => window.location.href = 'login.html';
    }
}

/* ---- Product card renderer (shared) ---- */
function renderProductCard(p) {
    const discount = p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : null;
    const img = p.image || `https://placehold.co/300x400/f5f0e8/c9a96e?text=${encodeURIComponent(p.brand || 'الهيكو')}`;
    const wishlisted = isWishlisted(p.id);

    return `
  <div class="product-card" data-id="${p.id}">
    <div class="product-img">
      <a href="product-details.html?id=${p.id}">
        <img src="${img}" alt="${p.name}" loading="lazy"
             onerror="this.src='https://placehold.co/300x400/f5f0e8/c9a96e?text=الهيكو'" />
      </a>
      <div class="product-badges">
        ${p.is_new ? '<span class="badge badge-new">جديد</span>' : ''}
        ${discount ? `<span class="badge badge-sale">-${discount}%</span>` : ''}
      </div>
      <div class="product-actions">
        <button class="action-btn ${wishlisted ? 'wishlisted' : ''}"
                onclick="handleWishlist(event, ${p.id}, '${escHtml(p.name)}', ${p.price}, '${img}', '${escHtml(p.brand || '')}')"
                title="${wishlisted ? 'إزالة من المفضلة' : 'أضف للمفضلة'}">
          <i class="${wishlisted ? 'fas' : 'far'} fa-heart"></i>
        </button>
        <button class="action-btn"
                onclick="window.location.href='product-details.html?id=${p.id}'"
                title="عرض التفاصيل">
          <i class="fas fa-eye"></i>
        </button>
      </div>
    </div>
    <div class="product-info">
      <div class="product-brand">${escHtml(p.brand || '')}</div>
      <h3 class="product-name">
        <a href="product-details.html?id=${p.id}">${escHtml(p.name)}</a>
      </h3>
      <div class="product-rating">
        <span class="stars">${renderStars(p.rating || 0)}</span>
        <span class="rating-count">(${p.reviews || 0})</span>
      </div>
      <div class="product-price">
        <span class="price-current">${formatPrice(p.price)}</span>
        ${p.old_price ? `<span class="price-old">${formatPrice(p.old_price)}</span>` : ''}
        ${discount ? `<span class="price-discount">-${discount}%</span>` : ''}
      </div>
      <button class="add-to-cart-btn"
              onclick="addToCart(${p.id}, '${escHtml(p.name)}', ${p.price}, '${img}', '50ml', '${escHtml(p.brand || '')}')">
        <i class="fas fa-shopping-bag"></i> أضف للسلة
      </button>
    </div>
  </div>`;
}

function handleWishlist(e, id, name, price, image, brand) {
    e.stopPropagation();
    const added = toggleWishlist({ id, name, price, image, brand });
    const btn = e.currentTarget;
    const icon = btn.querySelector('i');
    if (added) {
        icon.className = 'fas fa-heart';
        btn.classList.add('wishlisted');
    } else {
        icon.className = 'far fa-heart';
        btn.classList.remove('wishlisted');
    }
}

/* ---- Helpers ---- */
function renderStars(rating) {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function formatPrice(n) {
    return `${Number(n).toLocaleString('ar-EG')} ج.م`;
}

function escHtml(str) {
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function debounce(fn, delay = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/* ---- API wrapper ---- */
async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        logout();
        throw new Error('Unauthorized');
    }
    return res.json();
}

/* ---- Init on every page ---- */
updateCartBadge();
renderNavUser();

/* ---- Scroll Reveal ---- */
function initScrollReveal() {
    // Animate gold lines
    document.querySelectorAll('.gold-line').forEach(el => el.classList.add('animated'));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    // Add reveal classes to key elements
    document.querySelectorAll('.section-title, .section-subtitle').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
    document.querySelectorAll('.features-grid').forEach(el => {
        el.classList.add('reveal-stagger');
        observer.observe(el);
    });
    document.querySelectorAll('.product-card').forEach((el, i) => {
        el.style.transitionDelay = `${(i % 4) * 0.08}s`;
        el.classList.add('reveal');
        observer.observe(el);
    });
    document.querySelectorAll('.package-card, .testimonial-card, .stat-card').forEach((el, i) => {
        el.style.transitionDelay = `${i * 0.1}s`;
        el.classList.add('reveal');
        observer.observe(el);
    });
    document.querySelectorAll('.offer-card, .admin-card').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
    document.querySelectorAll('.hero-content').forEach(el => {
        el.classList.add('reveal-left');
        observer.observe(el);
    });
    document.querySelectorAll('.hero-image').forEach(el => {
        el.classList.add('reveal-right');
        observer.observe(el);
    });
}

document.addEventListener('DOMContentLoaded', initScrollReveal);

/* ---- Re-observe after dynamic content loads ---- */
function reObserveCards() {
    document.querySelectorAll('.product-card:not(.visible)').forEach((el, i) => {
        el.style.transitionDelay = `${(i % 4) * 0.08}s`;
        if (!el.classList.contains('reveal')) {
            el.classList.add('reveal');
        }
    });
}
