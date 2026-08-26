import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../shared/api';
import { formatUZS } from '../shared/format';
import type { Product, Station } from '../shared/types';

interface OrderSale {
  id: number;
  createdAt: string;
  total: number;
  items: Array<{ name: string; qty: number; amount: number }>;
}

interface Props {
  station: Station;
  onClose: () => void;
  onDone: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  drink: '🥤 Напитки',
  snack: '🍫 Снеки',
  other: '📦 Прочее',
};

/** Заказ бара прямо с карточки точки — товары уйдут в счёт при закрытии сессии */
export default function StationBarModal({ station, onClose, onDone }: Props) {
  const sessionId = station.activeSession!.id;
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<OrderSale[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, o] = await Promise.all([
        api<Product[]>('/api/products'),
        api<OrderSale[]>(`/api/sales/session/${sessionId}`),
      ]);
      setProducts(p.filter((x) => x.isActive));
      setOrder(o);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: products.find((p) => p.id === Number(id))!, qty }))
        .filter((x) => x.product),
    [cart, products],
  );
  const cartTotal = cartItems.reduce((s, x) => s + x.product.price * x.qty, 0);
  const orderTotal = order.reduce((s, o) => s + o.total, 0);

  function add(id: number) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }
  function sub(id: number) {
    setCart((c) => {
      const n = (c[id] ?? 0) - 1;
      const next = { ...c };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });
  }

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await api('/api/sales', {
        method: 'POST',
        body: {
          items: cartItems.map((x) => ({ productId: x.product.id, qty: x.qty })),
          sessionId,
        },
      });
      setCart({});
      await load();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function removeSale(id: number) {
    if (!window.confirm('Убрать эту позицию из заказа?')) return;
    try {
      await api(`/api/sales/${id}`, { method: 'DELETE' });
      await load();
      onDone();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  const grouped = ['drink', 'snack', 'other'].map((cat) => ({
    cat,
    items: products.filter((p) => p.category === cat),
  }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Заказ — {station.name}</h3>

        {order.length > 0 && (
          <div className="order-list">
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
              Уже в счёте: <b>{formatUZS(orderTotal)}</b>
            </div>
            {order.map((o) => (
              <div key={o.id} className="order-row">
                <span>{o.items.map((i) => `${i.name}×${i.qty}`).join(', ')}</span>
                <span>{formatUZS(o.total)}</span>
                <button className="btn btn-ghost" onClick={() => removeSale(o.id)}>
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <div className="muted">Товаров нет — админ добавляет их в «Настройках».</div>
        ) : (
          <div className="order-products">
            {grouped.map(
              ({ cat, items }) =>
                items.length > 0 && (
                  <div key={cat}>
                    <div className="muted" style={{ fontSize: 13, margin: '8px 0 6px' }}>
                      {CATEGORY_LABELS[cat]}
                    </div>
                    <div className="product-grid compact">
                      {items.map((p) => (
                        <button key={p.id} className="product-tile" onClick={() => add(p.id)}>
                          <span className="product-name">{p.name}</span>
                          <span className="product-price">{formatUZS(p.price)}</span>
                          {cart[p.id] ? <span className="product-badge">{cart[p.id]}</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ),
            )}
          </div>
        )}

        {cartItems.length > 0 && (
          <div className="order-cart">
            {cartItems.map((x) => (
              <div key={x.product.id} className="cart-row">
                <span>{x.product.name}</span>
                <div className="cart-qty">
                  <button onClick={() => sub(x.product.id)}>−</button>
                  <b>{x.qty}</b>
                  <button onClick={() => add(x.product.id)}>+</button>
                </div>
                <span>{formatUZS(x.product.price * x.qty)}</span>
              </div>
            ))}
          </div>
        )}

        {error && <div className="error-text">{error}</div>}
        <div className="btn-row">
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || cartItems.length === 0}
          >
            {busy ? 'Добавление…' : `Добавить · ${formatUZS(cartTotal)}`}
          </button>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
