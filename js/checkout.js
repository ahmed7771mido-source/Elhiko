/* ============================================
   الهيكو - checkout.js
   Simple 1-step checkout: name + phone + address + governorate
   Payment: cash on delivery only
   No tax
   ============================================ */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const cart = getCart();
    if (!cart.length) {
        window.location.href = 'cart.html';
        return;
    }
    renderOrderSummary(cart);
    prefillFromStorage();
});

/* ---- Order Summary ---- */
function renderOrderSummary(cart) {
    const itemsEl = document.getElementById('osSummaryItems');
    if (itemsEl) {
        itemsEl.innerHTML = cart.map(i => {
            const img = i.image || `https://placehold.co/52x52/f5f0e8/c9a96e?text=P`;
            return `
            <div class="os-item">
                <div class="os-item-img"><img src="${img}" alt="${escHtml(i.name)}" /></div>
                <div>
                    <div class="os-item-name">${escHtml(i.name)}</div>
                    <div class="os-item-qty">${i.size || '50ml'} × ${i.qty}</div>
                </div>
                <div class="os-item-price">${formatPrice(i.price * i.qty)}</div>
            </div>`;
        }).join('');
    }
    updateTotal(cart);
}

function updateTotal(cart) {
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const el = document.getElementById('osTotal');
    if (el) el.textContent = formatPrice(total);
}

/* ---- Validation ---- */
function validateForm() {
    const fields = [
        { id: 'firstName', msg: 'الاسم مطلوب' },
        { id: 'phone', msg: 'رقم الموبايل مطلوب' },
        { id: 'address', msg: 'العنوان مطلوب' },
        { id: 'city', msg: 'المحافظة مطلوبة' },
    ];
    for (const { id, msg } of fields) {
        const el = document.getElementById(id);
        if (!el || !el.value.trim()) {
            el?.style && (el.style.borderColor = 'var(--error)');
            showToast(msg, 'error');
            el?.focus();
            return false;
        }
        el.style.borderColor = '';
    }
    const phone = document.getElementById('phone').value.replace(/\s/g, '');
    if (!/^01[0-9]{9}$/.test(phone)) {
        document.getElementById('phone').style.borderColor = 'var(--error)';
        showToast('رقم الموبايل غير صحيح — يجب أن يبدأ بـ 01 ويكون 11 رقم', 'error');
        return false;
    }
    return true;
}

/* ---- Place Order ---- */
async function placeOrder() {
    if (!validateForm()) return;

    const btn = document.getElementById('placeOrderBtn');
    const cart = getCart();
    if (!cart.length) { window.location.href = 'cart.html'; return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التأكيد...'; }

    const cityEl = document.getElementById('city');
    const cityText = cityEl?.options[cityEl.selectedIndex]?.text || cityEl?.value || '';

    const order = {
        items: cart.map(i => ({
            product_id: i.id,
            name: i.name,
            brand: i.brand || '',
            qty: i.qty,
            size: i.size || '50ml',
            price: i.price,
        })),
        shipping: {
            first_name: document.getElementById('firstName')?.value.trim() || '',
            last_name: '',
            email: 'guest@الهيكو.com',
            phone: document.getElementById('phone')?.value.trim() || '',
            address: document.getElementById('address')?.value.trim() || '',
            city: cityText,
            region: document.getElementById('region')?.value.trim() || '',
            zip: '',
            notes: document.getElementById('notes')?.value.trim() || '',
        },
        payment_method: 'cod',
        subtotal: cart.reduce((s, i) => s + i.price * i.qty, 0),
        discount_amt: 0,
        shipping_cost: 0,
    };

    // Save address for next time
    if (document.getElementById('saveAddress')?.checked) {
        localStorage.setItem('الهيكو_address', JSON.stringify({
            firstName: order.shipping.first_name,
            phone: order.shipping.phone,
            address: order.shipping.address,
            city: cityEl?.value || '',
            region: order.shipping.region,
        }));
    }

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        handleSuccess(data.order?.id || data.order_id || data.id || Date.now().toString().slice(-6));

    } catch (e) {
        console.error('Order error:', e);
        showToast('حدث خطأ أثناء تأكيد الطلب: ' + (e.message || 'تأكد من اتصالك'), 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> تأكيد الطلب'; }
        return;
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> تأكيد الطلب'; }
}

function handleSuccess(orderId) {
    saveCart([]);
    document.getElementById('checkoutForm').style.display = 'none';
    document.getElementById('orderSuccess').style.display = 'block';
    document.getElementById('orderNumDisplay').textContent = `#${orderId}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---- Prefill saved address ---- */
function prefillFromStorage() {
    const saved = JSON.parse(localStorage.getItem('الهيكو_address') || 'null');
    if (!saved) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set('firstName', saved.firstName);
    set('phone', saved.phone);
    set('address', saved.address);
    set('city', saved.city);
    set('region', saved.region);
}

/* ---- Phone live validation ---- */
function validatePhoneInput(input) {
    // أرقام بس
    input.value = input.value.replace(/[^0-9]/g, '').slice(0, 11);

    const errEl = document.getElementById('phoneError');
    const okEl = document.getElementById('phoneOk');
    const phone = input.value;

    if (phone.length === 0) {
        if (errEl) errEl.style.display = 'none';
        if (okEl) okEl.style.display = 'none';
        input.style.borderColor = '';
        return;
    }

    const valid = /^01[0-9]{9}$/.test(phone);

    if (valid) {
        input.style.borderColor = 'var(--success)';
        if (errEl) errEl.style.display = 'none';
        if (okEl) okEl.style.display = 'block';
    } else {
        input.style.borderColor = phone.length === 11 ? 'var(--error)' : 'var(--warning)';
        if (okEl) okEl.style.display = 'none';
        if (errEl) errEl.style.display = phone.length === 11 ? 'block' : 'none';
    }
}
