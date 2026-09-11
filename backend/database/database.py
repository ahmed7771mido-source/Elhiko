"""
PERFUIM - database.py
SQLite database initialization and connection management.
"""

import sqlite3
import os
import hashlib
import secrets

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# On Vercel, filesystem is read-only except /tmp
if os.environ.get('VERCEL'):
    DB_PATH = '/tmp/heiko.db'
else:
    DB_PATH = os.path.join(BASE_DIR, 'backend', 'heiko.db')


# ── Connection helper ───────────────────────────────────────────────────────────
def get_connection() -> sqlite3.Connection:
    """Return a SQLite connection with row factory."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=DELETE")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


# ── Schema ──────────────────────────────────────────────────────────────────────
SCHEMA = """
-- Users
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name    TEXT    NOT NULL,
    last_name     TEXT    NOT NULL DEFAULT '',
    email         TEXT    NOT NULL UNIQUE,
    phone         TEXT,
    password_hash TEXT    NOT NULL,
    salt          TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
    status        TEXT    NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
    newsletter    INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    brand         TEXT    NOT NULL,
    description   TEXT,
    price         REAL    NOT NULL,
    old_price     REAL,
    category      TEXT    NOT NULL DEFAULT 'unisex', -- 'men'|'women'|'unisex'|'oud'
    stock         INTEGER NOT NULL DEFAULT 0,
    sizes         TEXT    NOT NULL DEFAULT '50ml',   -- comma-separated: "30ml,50ml,100ml"
    image         TEXT,
    images        TEXT,                              -- JSON array of image URLs
    note_top      TEXT,
    note_heart    TEXT,
    note_base     TEXT,
    rating        REAL    NOT NULL DEFAULT 0,
    reviews_count INTEGER NOT NULL DEFAULT 0,
    is_new        INTEGER NOT NULL DEFAULT 0,
    featured      INTEGER NOT NULL DEFAULT 0,
    status        TEXT    NOT NULL DEFAULT 'active',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    rating     INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    text       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Offers / Coupons
CREATE TABLE IF NOT EXISTS offers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    type        TEXT    NOT NULL DEFAULT 'percent',  -- 'percent'|'fixed'|'buy2get1'
    value       REAL    NOT NULL DEFAULT 0,
    code        TEXT    UNIQUE,
    description TEXT,
    min_order   REAL    NOT NULL DEFAULT 0,
    max_uses    INTEGER,
    used_count  INTEGER NOT NULL DEFAULT 0,
    start_date  TEXT,
    end_date    TEXT,
    featured    INTEGER NOT NULL DEFAULT 0,
    status      TEXT    NOT NULL DEFAULT 'active',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Packages (subscription tiers)
CREATE TABLE IF NOT EXISTS packages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    price       REAL    NOT NULL,
    count       INTEGER NOT NULL DEFAULT 2,          -- perfumes per month
    size        TEXT    NOT NULL DEFAULT '50ml',
    discount    REAL    NOT NULL DEFAULT 0,          -- % discount on purchases
    description TEXT,
    features    TEXT,                                -- JSON array of feature strings
    featured    INTEGER NOT NULL DEFAULT 0,
    status      TEXT    NOT NULL DEFAULT 'active',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Subscriptions (user → package)
CREATE TABLE IF NOT EXISTS subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    status     TEXT    NOT NULL DEFAULT 'active',
    starts_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    renews_at  TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status         TEXT    NOT NULL DEFAULT 'pending',
    payment_method TEXT    NOT NULL DEFAULT 'cod',
    subtotal       REAL    NOT NULL DEFAULT 0,
    discount_amt   REAL    NOT NULL DEFAULT 0,
    shipping_cost  REAL    NOT NULL DEFAULT 0,
    tax_amt        REAL    NOT NULL DEFAULT 0,
    total          REAL    NOT NULL DEFAULT 0,
    -- Shipping address (denormalised for history)
    sh_first_name  TEXT,
    sh_last_name   TEXT,
    sh_email       TEXT,
    sh_phone       TEXT,
    sh_address     TEXT,
    sh_city        TEXT,
    sh_region      TEXT,
    sh_zip         TEXT,
    sh_notes       TEXT,
    coupon_code    TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
    product_id INTEGER          REFERENCES products(id) ON DELETE SET NULL,
    name       TEXT    NOT NULL,
    brand      TEXT,
    price      REAL    NOT NULL,
    qty        INTEGER NOT NULL DEFAULT 1,
    size       TEXT    NOT NULL DEFAULT '50ml'
);

-- Wishlist
CREATE TABLE IF NOT EXISTS wishlist (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, product_id)
);
"""


# ── Indexes ─────────────────────────────────────────────────────────────────────
INDEXES = """
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status   ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_orders_user       ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product   ON reviews(product_id);
"""


# ── Seed data ───────────────────────────────────────────────────────────────────
def _hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((password + salt).encode()).hexdigest()


def seed_database(conn: sqlite3.Connection) -> None:
    """Insert demo data if tables are empty."""
    cur = conn.cursor()

    # ── Admin user
    if not cur.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        salt = secrets.token_hex(16)
        cur.execute("""
            INSERT INTO users (first_name, last_name, email, phone, password_hash, salt, role)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ('مدير', 'النظام', 'admin@perfuim.com', '0500000000',
              _hash_password('admin123', salt), salt, 'admin'))

        # Demo customer
        salt2 = secrets.token_hex(16)
        cur.execute("""
            INSERT INTO users (first_name, last_name, email, phone, password_hash, salt, role)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ('محمد', 'العتيبي', 'user@example.com', '0501234567',
              _hash_password('user123', salt2), salt2, 'user'))

    # ── Products (لا يضاف شيء - المنتجات تُضاف من لوحة التحكم)
    # if not cur.execute("SELECT 1 FROM products LIMIT 1").fetchone():
    #     pass  # أضف منتجاتك من admin panel

    # ── Offers (تُضاف من لوحة التحكم)
    # ── Packages (تُضاف من لوحة التحكم)

    conn.commit()


# ── Init ────────────────────────────────────────────────────────────────────────
def init_db() -> None:
    """Create tables, indexes, and seed demo data."""
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        conn.executescript(INDEXES)
        seed_database(conn)
        print(f"[DB] Database ready at: {DB_PATH}")
    finally:
        conn.close()


if __name__ == '__main__':
    init_db()
