/* ============================================
   الهيكو - auth.js
   Shared auth utilities used by login/register
   pages and across the site
   ============================================ */

'use strict';

/* ---- Token helpers (already in main.js, kept for standalone use) ---- */
function getAuthToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
}

function getAuthUser() {
    try {
        return JSON.parse(
            localStorage.getItem('user') || sessionStorage.getItem('user') || 'null'
        );
    } catch { return null; }
}

function setAuthData(token, user, remember = true) {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('token', token);
    storage.setItem('user', JSON.stringify(user));
}

function clearAuthData() {
    ['token', 'user'].forEach(k => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
    });
}

/* ---- Logout ---- */
function doLogout() {
    clearAuthData();
    window.location.href = '/login.html';
}

/* ---- Require auth (call on protected pages) ---- */
function requireAuth(redirectTo = '/login.html') {
    if (!getAuthToken()) {
        window.location.href = redirectTo + '?redirect=' + encodeURIComponent(location.href);
    }
}

/* ---- Require admin ---- */
function requireAdmin() {
    const user = getAuthUser();
    if (!getAuthToken() || user?.role !== 'admin') {
        window.location.href = '/login.html';
    }
}

/* ---- Render auth-aware UI elements site-wide ---- */
function renderAuthUI() {
    const user = getAuthUser();
    const token = getAuthToken();

    // User button in navbar
    const userBtn = document.getElementById('userBtn');
    if (!userBtn) return;

    if (token && user) {
        // Show avatar / name dropdown
        const initials = (user.name || user.email || '?').charAt(0).toUpperCase();
        userBtn.innerHTML = `
      <span style="
        display:inline-flex;align-items:center;justify-content:center;
        width:30px;height:30px;border-radius:50%;
        background:var(--primary);color:#fff;font-size:0.78rem;font-weight:700;">
        ${initials}
      </span>`;
        userBtn.title = user.name || user.email;

        // Create dropdown menu if not already present
        if (!document.getElementById('userDropdown')) {
            const dropdown = document.createElement('div');
            dropdown.id = 'userDropdown';
            dropdown.style.cssText = `
        position:absolute;top:calc(100% + 8px);left:0;
        background:#fff;border-radius:var(--radius-md);
        box-shadow:var(--shadow-lg);min-width:200px;
        z-index:500;display:none;overflow:hidden;
        border:1px solid var(--border);`;
            dropdown.innerHTML = `
        <div style="padding:14px 16px;border-bottom:1px solid var(--border);">
          <div style="font-weight:700;font-size:0.9rem;color:var(--secondary);">${user.name || ''}</div>
          <div style="font-size:0.78rem;color:var(--text-light);">${user.email || ''}</div>
        </div>
        ${user.role === 'admin' ? `
        <a href="/admin/" style="display:flex;align-items:center;gap:8px;padding:11px 16px;font-size:0.87rem;color:var(--secondary);transition:var(--transition);"
           onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
          <i class="fas fa-cog" style="width:16px;color:var(--primary);"></i> لوحة الإدارة
        </a>` : ''}
        <a href="#" style="display:flex;align-items:center;gap:8px;padding:11px 16px;font-size:0.87rem;color:var(--secondary);transition:var(--transition);"
           onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
          <i class="fas fa-user" style="width:16px;color:var(--primary);"></i> حسابي
        </a>
        <a href="#" style="display:flex;align-items:center;gap:8px;padding:11px 16px;font-size:0.87rem;color:var(--secondary);transition:var(--transition);"
           onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
          <i class="fas fa-box" style="width:16px;color:var(--primary);"></i> طلباتي
        </a>
        <a href="#" style="display:flex;align-items:center;gap:8px;padding:11px 16px;font-size:0.87rem;color:var(--secondary);transition:var(--transition);"
           onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
          <i class="fas fa-heart" style="width:16px;color:var(--primary);"></i> المفضلة
        </a>
        <div style="border-top:1px solid var(--border);">
          <button onclick="doLogout()" style="
            display:flex;align-items:center;gap:8px;width:100%;padding:11px 16px;
            background:none;border:none;font-size:0.87rem;color:var(--error);
            cursor:pointer;font-family:var(--font-body);text-align:right;"
            onmouseover="this.style.background='#fce4ec'" onmouseout="this.style.background=''">
            <i class="fas fa-sign-out-alt" style="width:16px;"></i> تسجيل الخروج
          </button>
        </div>`;

            const navActions = userBtn.parentElement;
            navActions.style.position = 'relative';
            navActions.appendChild(dropdown);

            userBtn.onclick = (e) => {
                e.stopPropagation();
                const isOpen = dropdown.style.display !== 'none';
                dropdown.style.display = isOpen ? 'none' : 'block';
            };

            document.addEventListener('click', () => { dropdown.style.display = 'none'; });
        }
    } else {
        userBtn.innerHTML = '<i class="fas fa-user"></i>';
        userBtn.title = 'تسجيل الدخول';
        userBtn.onclick = () => window.location.href = 'login.html';
    }
}

/* ---- Password strength calculator ---- */
function calcPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score += 25;
    if (password.length >= 12) score += 10;
    if (/[a-z]/.test(password)) score += 15;
    if (/[A-Z]/.test(password)) score += 15;
    if (/[0-9]/.test(password)) score += 20;
    if (/[^A-Za-z0-9]/.test(password)) score += 15;

    if (score < 40) return { level: 'weak', label: 'ضعيفة', color: 'var(--error)', pct: score };
    if (score < 70) return { level: 'medium', label: 'متوسطة', color: 'var(--warning)', pct: score };
    return { level: 'strong', label: 'قوية', color: 'var(--success)', pct: score };
}

/* ---- Email validator ---- */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ---- Phone validator (Egyptian format) ---- */
function isValidPhone(phone) {
    return /^01[0-9]{9}$/.test(phone.replace(/\s|-/g, ''));
}

/* ---- Auto-init auth UI on page load ---- */
document.addEventListener('DOMContentLoaded', renderAuthUI);
