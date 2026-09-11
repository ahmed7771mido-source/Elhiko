/* ============================================
   الهيكو - cart.js
   ============================================ */
'use strict';

let shippingCost = 0;
let discountAmt = 0;

/* ---- Init ---- */
function initCart() {
    renderCart();
}

/* ---- Render ---- */
function renderCart() {
    const cart = getCart();
    const layout = document.getElementById('cartLayout');
    const empty = document.getElementById('emptyCart');

    if (!cart.length) {
        if (layout) layout.style.display = 'none';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (layout) layout.style.display = '';
    if (empty) empty.style.display = 'none';

    renderItems(cart);
    recalcSummary(cart);
    updateItemCount(cart);
}

function renderItems(cart) {
    const list = document.getElementById('cartItemsList');
    if (!list) return;

    list.innerHTML = cart.map(item => {
        const img = item.image || `https://placehold.co/90x90/f5f0e8/c9a96e?text=${encodeURIComponent(item.brand || 'P')}`;
        return `
        <div class="cart-item" id="item-${item.key}">
            <div class="cart-item-img">
                <a href="product-details.html?id=${item.id}">
                    <img src="${img}" alt="${escHtml(item.name)}"
                         onerror="this.src='https://placehold.co/90x90/f5f0e8/c9a96e?text=P'" />
                </a>
            </div>
            <div class="cart-item-info">
                <div class="cart-item-brand">${escHtml(item.brand || '')}</div>
                <h4 class="cart-item-name">
                    <a href="product-details.html?id=${item.id}">${escHtml(item.name)}</a>
                </h4>
                <div class="cart-item-meta">الحجم: ${item.size || '50ml'}</div>
                <div class="cart-item-actions">
                    <div class="cart-qty-control">
                        <button class="cart-qty-btn" onclick="changeQty('${item.key}', ${item.qty - 1})" aria-label="تقليل">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" class="cart-qty-num" value="${item.qty}" min="1" max="99"
                               onchange="changeQty('${item.key}', parseInt(this.value)||1)" />
                        <button class="cart-qty-btn" onclick="changeQty('${item.key}', ${item.qty + 1})" aria-label="زيادة">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <button class="remove-item-btn" onclick="removeItem('${item.key}')">
                        <i class="fas fa-trash-alt"></i> حذف
                    </button>
                </div>
            </div>
            <div class="cart-item-price">
                <div class="item-price-total">${formatPrice(item.price * item.qty)}</div>
                <div class="item-price-unit">${formatPrice(item.price)} / قطعة</div>
            </div>
        </div>`;
    }).join('');
}

function recalcSummary(cart) {
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const total = Math.max(0, subtotal - discountAmt);

    setText('subtotal', formatPrice(subtotal));
    setText('totalVal', formatPrice(total));

    const discRow = document.getElementById('discountRow');
    if (discRow) discRow.style.display = discountAmt > 0 ? '' : 'none';
    setText('discountVal', `-${formatPrice(discountAmt)}`);
}

function updateItemCount(cart) {
    setText('itemCount', cart.reduce((s, i) => s + i.qty, 0));
}

/* ---- Actions ---- */
function changeQty(key, qty) {
    if (qty <= 0) { removeItem(key); return; }
    updateCartItemQty(key, Math.min(qty, 99));
    renderCart();
}

function removeItem(key) {
    removeFromCart(key);
    const el = document.getElementById(`item-${key}`);
    if (el) {
        el.style.transition = 'opacity 0.3s, transform 0.3s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        setTimeout(() => renderCart(), 300);
    } else {
        renderCart();
    }
    showToast('تم حذف المنتج من السلة', 'info');
}

function clearCart() {
    if (!confirm('هل أنت متأكد من مسح جميع المنتجات؟')) return;
    saveCart([]);
    discountAmt = 0;
    renderCart();
    showToast('تم مسح السلة', 'info');
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

document.addEventListener('DOMContentLoaded', initCart);
