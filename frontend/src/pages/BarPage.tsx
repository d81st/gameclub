import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../shared/api';
import { formatUZS, PAYMENT_LABELS } from '../shared/format';
import type { PaymentMethod, Product, SaleRow, Station } from '../shared/types';

const CATEGORY_LABELS: Record<string, string> = {
  drink: '🥤 Напитки',
  snack: '🍫 Снеки',
  other: '📦 Прочее',
};

export default function BarPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [checkout, setCheckout] = useState<'pay' | 'station' | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, st, s] = await Promise.all([
        api<Product[]>('/api/products'),
        api<Station[]>('/api/stations'),
        api<SaleRow[]>('/api/sales'),
      ]);
      setProducts(p.filter((x) => x.isActive));
      setStations(st);
      setSales(s);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }, []);

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
  const busyStations = stations.filter((s) => s.activeSession);

  function add(id: number) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
    setMsg('');
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

  async function submit(body: Record<string, unknown>) {
    setError('');
    setBusy(true);
    try {
      await api('/api/sales', {
        method: 'POST',
        body: { items: cartItems.map((x) => ({ productId: x.product.id, qty: x.qty })), ...body },
      });
      setCart({});
      setCheckout(null);
      setMsg('✓ Продажа записана');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  async function removeSale(s: SaleRow) {
    if (!window.confirm(`Удалить продажу на ${formatUZS(s.total)}?`)) return;
    try {
      await api(`/api/sales/${s.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  const grouped = ['drink', 'snack', 'other'].map((cat) => ({
    cat,
    items: products.filter((p) => p.category === cat),
  }));

  return (
    <div className="bar-page">
      <h1>Бар</h1>
      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
      {msg && <div className="muted" style={{ marginBottom: 10 }}>{msg}</div>}

      {products.length === 0 ? (
        <div className="muted">Товаров пока нет — админ добавляет их в «Настройках».</div>
      ) : (
        grouped.map(
          ({ cat, items }) =>
            items.length > 0 && (
              <div key={cat}>
                <h2>{CATEGORY_LABELS[cat]}</h2>
                <div className="product-grid">
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
        )
      )}

      <h2>Продажи за сегодня</h2>
      <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: 90 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Товары</th>
              <th>Сумма</th>
              <th>Оплата</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>
                  {new Date(s.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="muted">
                  {s.items.map((i) => `${i.name}×${i.qty}`).join(', ')}
                </td>
                <td>{formatUZS(s.total)}</td>
                <td className="muted">
                  {s.paymentMethod
                    ? PAYMENT_LABELS[s.paymentMethod]
                    : `⏳ на ${s.stationName ?? 'точке'}`}
                </td>
                <td>
                  <button className="btn btn-ghost" onClick={() => removeSale(s)}>
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Продаж пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cartItems.length > 0 && (
        <div className="cart-bar">
          <div className="cart-items">
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
          <div className="cart-total">
            Итого: <b>{formatUZS(cartTotal)}</b>
          </div>
          <div className="btn-row">
            <button className="btn btn-start" onClick={() => setCheckout('pay')}>
              Продать
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setCheckout('station')}
              disabled={busyStations.length === 0}
            >
              На точку
            </button>
            <button className="btn btn-secondary" onClick={() => setCart({})}>
              Очистить
            </button>
          </div>
        </div>
      )}

      {checkout === 'pay' && (
        <div className="modal-backdrop" onClick={() => setCheckout(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Оплата — {formatUZS(cartTotal)}</h3>
            {(['cash', 'card', 'transfer'] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                className="btn btn-primary"
                disabled={busy}
                onClick={() => submit({ paymentMethod: m })}
              >
                {PAYMENT_LABELS[m]}
              </button>
            ))}
            <button className="btn btn-secondary" onClick={() => setCheckout(null)} disabled={busy}>
              Назад
            </button>
          </div>
        </div>
      )}

      {checkout === 'station' && (
        <div className="modal-backdrop" onClick={() => setCheckout(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>На какую точку? — {formatUZS(cartTotal)}</h3>
            <div className="muted" style={{ fontSize: 13 }}>
              Товары добавятся к сессии, клиент заплатит одной суммой при закрытии
            </div>
            {busyStations.map((s) => (
              <button
                key={s.id}
                className="btn btn-primary"
                disabled={busy}
                onClick={() => submit({ sessionId: s.activeSession!.id })}
              >
                {s.name}
              </button>
            ))}
            <button className="btn btn-secondary" onClick={() => setCheckout(null)} disabled={busy}>
              Назад
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
