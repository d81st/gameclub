import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth';
import { formatUZS, TYPE_LABELS } from '../shared/format';
import type { Product, ProductCategory, Station, StationType } from '../shared/types';

interface StationForm {
  id: number | null;
  name: string;
  type: StationType;
  hourlyRate: string;
  groupEnabled: boolean;
  groupRate: string;
  isActive: boolean;
  sortOrder: string;
}

const emptyForm: StationForm = {
  id: null,
  name: '',
  type: 'ps',
  hourlyRate: '15000',
  groupEnabled: false,
  groupRate: '18000',
  isActive: true,
  sortOrder: '0',
};

interface Worker {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'operator';
  isActive: boolean;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stations, setStations] = useState<Station[]>([]);
  const [form, setForm] = useState<StationForm | null>(null);
  const [error, setError] = useState('');
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [pwdMsg, setPwdMsg] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [pForm, setPForm] = useState<{
    id: number | null;
    name: string;
    price: string;
    category: ProductCategory;
    isActive: boolean;
    sortOrder: string;
  } | null>(null);
  const [pError, setPError] = useState('');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [wForm, setWForm] = useState<{ username: string; password: string; fullName: string } | null>(null);
  const [wError, setWError] = useState('');

  const load = useCallback(async () => {
    try {
      setStations(await api<Station[]>('/api/stations'));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }, []);

  const loadWorkers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setWorkers(await api<Worker[]>('/api/users'));
    } catch {
      /* список работников не критичен */
    }
  }, [isAdmin]);

  const loadProducts = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setProducts(await api<Product[]>('/api/products'));
    } catch {
      /* не критично */
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) load();
    loadWorkers();
    loadProducts();
  }, [load, loadWorkers, loadProducts, isAdmin]);

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    if (!pForm) return;
    setPError('');
    const body = {
      name: pForm.name.trim(),
      price: Number(pForm.price),
      category: pForm.category,
      isActive: pForm.isActive,
      sortOrder: Number(pForm.sortOrder) || 0,
    };
    try {
      if (pForm.id === null) await api('/api/products', { method: 'POST', body });
      else await api(`/api/products/${pForm.id}`, { method: 'PUT', body });
      setPForm(null);
      await loadProducts();
    } catch (err) {
      setPError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function removeProduct(p: Product) {
    if (!window.confirm(`Удалить товар «${p.name}»?`)) return;
    try {
      await api(`/api/products/${p.id}`, { method: 'DELETE' });
      await loadProducts();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function createWorker(e: FormEvent) {
    e.preventDefault();
    if (!wForm) return;
    setWError('');
    try {
      await api('/api/users', { method: 'POST', body: wForm });
      setWForm(null);
      await loadWorkers();
    } catch (err) {
      setWError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function resetWorkerPassword(w: Worker) {
    const newPassword = window.prompt(`Новый пароль для «${w.username}» (мин. 6 символов):`);
    if (!newPassword) return;
    try {
      await api(`/api/users/${w.id}/password`, { method: 'POST', body: { newPassword } });
      window.alert('Пароль изменён');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function toggleWorkerActive(w: Worker) {
    const action = w.isActive ? 'Заблокировать' : 'Разблокировать';
    if (!window.confirm(`${action} работника «${w.username}»?`)) return;
    try {
      await api(`/api/users/${w.id}/active`, { method: 'POST', body: { isActive: !w.isActive } });
      await loadWorkers();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function saveStation(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    const body = {
      name: form.name.trim(),
      type: form.type,
      hourlyRate: Number(form.hourlyRate),
      groupEnabled: form.groupEnabled,
      groupRate: form.groupEnabled ? Number(form.groupRate) : null,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      if (form.id === null) {
        await api('/api/stations', { method: 'POST', body });
      } else {
        await api(`/api/stations/${form.id}`, { method: 'PUT', body });
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  }

  async function removeStation(s: Station) {
    if (!window.confirm(`Удалить точку «${s.name}»?`)) return;
    try {
      await api(`/api/stations/${s.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwdMsg('');
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: pwd.current, newPassword: pwd.next },
      });
      setPwd({ current: '', next: '' });
      setPwdMsg('Пароль изменён ✓');
    } catch (err) {
      setPwdMsg(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  return (
    <div>
      <h1>Настройки</h1>
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      {isAdmin && (
        <>
          <h2>Работники</h2>
          <div className="card" style={{ padding: 0, marginBottom: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Логин</th>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id}>
                    <td>{w.username}</td>
                    <td>{w.fullName || '—'}</td>
                    <td className="muted">{w.role === 'admin' ? '👑 Админ' : 'Работник'}</td>
                    <td className="muted">{w.isActive ? 'Активен' : '⛔ Заблокирован'}</td>
                    <td>
                      {w.id !== user?.id && (
                        <div className="btn-row">
                          <button
                            className="btn btn-ghost"
                            title="Сбросить пароль"
                            onClick={() => resetWorkerPassword(w)}
                          >
                            🔑
                          </button>
                          <button
                            className="btn btn-ghost"
                            title={w.isActive ? 'Заблокировать' : 'Разблокировать'}
                            onClick={() => toggleWorkerActive(w)}
                          >
                            {w.isActive ? '⛔' : '✅'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginBottom: 20 }}
            onClick={() => setWForm({ username: '', password: '', fullName: '' })}
          >
            + Добавить работника
          </button>

          {wForm && (
            <div className="modal-backdrop" onClick={() => setWForm(null)}>
              <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={createWorker}>
                <h3>Новый работник</h3>
                <div className="field">
                  <label>Логин (латиница)</label>
                  <input
                    type="text"
                    value={wForm.username}
                    onChange={(e) => setWForm({ ...wForm, username: e.target.value })}
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
                <div className="field">
                  <label>Пароль (мин. 6 символов)</label>
                  <input
                    type="text"
                    value={wForm.password}
                    onChange={(e) => setWForm({ ...wForm, password: e.target.value })}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
                <div className="field">
                  <label>Имя (необязательно)</label>
                  <input
                    type="text"
                    value={wForm.fullName}
                    onChange={(e) => setWForm({ ...wForm, fullName: e.target.value })}
                  />
                </div>
                {wError && <div className="error-text">{wError}</div>}
                <div className="btn-row">
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={wForm.username.length < 3 || wForm.password.length < 6}
                  >
                    Создать
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setWForm(null)}>
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {isAdmin && (
      <>
      <h2>Точки и тарифы</h2>
      <div className="card" style={{ padding: 0, marginBottom: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Тип</th>
              <th>Тариф/час</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>
                  <span className={`badge ${s.type}`}>{TYPE_LABELS[s.type]}</span>
                </td>
                <td>
                  {formatUZS(s.hourlyRate)}
                  {s.groupEnabled && s.groupRate ? (
                    <div className="muted" style={{ fontSize: 12 }}>
                      👥 3+: {formatUZS(s.groupRate)}
                    </div>
                  ) : null}
                </td>
                <td className="muted">{s.isActive ? 'Активна' : 'Выключена'}</td>
                <td>
                  <div className="btn-row">
                    <button
                      className="btn btn-ghost"
                      onClick={() =>
                        setForm({
                          id: s.id,
                          name: s.name,
                          type: s.type,
                          hourlyRate: String(s.hourlyRate),
                          groupEnabled: s.groupEnabled,
                          groupRate: String(s.groupRate ?? 18000),
                          isActive: s.isActive,
                          sortOrder: String(s.sortOrder),
                        })
                      }
                    >
                      ✏️
                    </button>
                    <button className="btn btn-ghost" onClick={() => removeStation(s)}>
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-primary" onClick={() => setForm({ ...emptyForm })}>
        + Добавить точку
      </button>

      {form && (
        <div className="modal-backdrop" onClick={() => setForm(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveStation}>
            <h3>{form.id === null ? 'Новая точка' : 'Редактировать точку'}</h3>
            <div className="field">
              <label>Название</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="field">
              <label>Тип</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as StationType })}
              >
                <option value="ps">PlayStation</option>
                <option value="billiard">Бильярд</option>
              </select>
            </div>
            <div className="field">
              <label>Тариф, сум/час (1–2 человека)</label>
              <input
                type="number"
                min={0}
                step={500}
                value={form.hourlyRate}
                onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.groupEnabled}
                  onChange={(e) => setForm({ ...form, groupEnabled: e.target.checked })}
                />{' '}
                👥 Групповой тариф (спрашивать число человек)
              </label>
            </div>
            {form.groupEnabled && (
              <div className="field">
                <label>Тариф при 3+ человек, сум/час</label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={form.groupRate}
                  onChange={(e) => setForm({ ...form, groupRate: e.target.value })}
                />
                <div className="muted" style={{ fontSize: 13 }}>
                  На этой точке работник при старте укажет число человек и выберет тариф
                </div>
              </div>
            )}
            <div className="field">
              <label>Порядок сортировки</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />{' '}
                Точка активна
              </label>
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={!form.name.trim()}>
                Сохранить
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setForm(null)}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
      </>
      )}

      {isAdmin && (
        <>
          <h2 className="mt">🥤 Товары бара</h2>
          <div className="card" style={{ padding: 0, marginBottom: 12, overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Категория</th>
                  <th>Цена</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="muted">
                      {p.category === 'drink' ? 'Напитки' : p.category === 'snack' ? 'Снеки' : 'Прочее'}
                    </td>
                    <td>{formatUZS(p.price)}</td>
                    <td className="muted">{p.isActive ? 'Активен' : 'Скрыт'}</td>
                    <td>
                      <div className="btn-row">
                        <button
                          className="btn btn-ghost"
                          onClick={() =>
                            setPForm({
                              id: p.id,
                              name: p.name,
                              price: String(p.price),
                              category: p.category,
                              isActive: p.isActive,
                              sortOrder: String(p.sortOrder),
                            })
                          }
                        >
                          ✏️
                        </button>
                        <button className="btn btn-ghost" onClick={() => removeProduct(p)}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Товаров пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button
            className="btn btn-primary"
            onClick={() =>
              setPForm({
                id: null,
                name: '',
                price: '10000',
                category: 'drink',
                isActive: true,
                sortOrder: '0',
              })
            }
          >
            + Добавить товар
          </button>

          {pForm && (
            <div className="modal-backdrop" onClick={() => setPForm(null)}>
              <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveProduct}>
                <h3>{pForm.id === null ? 'Новый товар' : 'Редактировать товар'}</h3>
                <div className="field">
                  <label>Название</label>
                  <input
                    type="text"
                    value={pForm.name}
                    onChange={(e) => setPForm({ ...pForm, name: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Цена, сум</label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={pForm.price}
                    onChange={(e) => setPForm({ ...pForm, price: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Категория</label>
                  <select
                    value={pForm.category}
                    onChange={(e) =>
                      setPForm({ ...pForm, category: e.target.value as ProductCategory })
                    }
                  >
                    <option value="drink">Напитки</option>
                    <option value="snack">Снеки</option>
                    <option value="other">Прочее</option>
                  </select>
                </div>
                <div className="field">
                  <label>
                    <input
                      type="checkbox"
                      checked={pForm.isActive}
                      onChange={(e) => setPForm({ ...pForm, isActive: e.target.checked })}
                    />{' '}
                    Показывать работнику
                  </label>
                </div>
                {pError && <div className="error-text">{pError}</div>}
                <div className="btn-row">
                  <button className="btn btn-primary" type="submit" disabled={!pForm.name.trim()}>
                    Сохранить
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setPForm(null)}>
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      <h2 className="mt">Смена пароля</h2>
      <form className="card" style={{ maxWidth: 380 }} onSubmit={changePassword}>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Текущий пароль</label>
          <input
            type="password"
            value={pwd.current}
            onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
          />
        </div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Новый пароль (мин. 6 символов)</label>
          <input
            type="password"
            value={pwd.next}
            onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
          />
        </div>
        {pwdMsg && <div className={pwdMsg.includes('✓') ? 'muted' : 'error-text'}>{pwdMsg}</div>}
        <button
          className="btn btn-primary"
          style={{ marginTop: 8 }}
          disabled={!pwd.current || pwd.next.length < 6}
        >
          Сменить пароль
        </button>
      </form>

      <h2 className="mt">Аккаунт</h2>
      <div className="card" style={{ maxWidth: 380 }}>
        <div className="muted" style={{ marginBottom: 12 }}>
          Вы вошли как <b>{user?.fullName || user?.username}</b>
        </div>
        <button
          className="btn btn-stop"
          onClick={() => {
            if (window.confirm('Точно выйти из аккаунта?')) logout();
          }}
        >
          🚪 Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
