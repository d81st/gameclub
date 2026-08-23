import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../shared/api';
import { useAuth } from '../shared/auth';
import { formatUZS, TYPE_LABELS } from '../shared/format';
import type { Station, StationType } from '../shared/types';

interface StationForm {
  id: number | null;
  name: string;
  type: StationType;
  hourlyRate: string;
  isActive: boolean;
  sortOrder: string;
}

const emptyForm: StationForm = {
  id: null,
  name: '',
  type: 'ps',
  hourlyRate: '15000',
  isActive: true,
  sortOrder: '0',
};

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [form, setForm] = useState<StationForm | null>(null);
  const [error, setError] = useState('');
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [pwdMsg, setPwdMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setStations(await api<Station[]>('/api/stations'));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveStation(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    const body = {
      name: form.name.trim(),
      type: form.type,
      hourlyRate: Number(form.hourlyRate),
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
                <td>{formatUZS(s.hourlyRate)}</td>
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
              <label>Тариф, сум/час</label>
              <input
                type="number"
                min={0}
                step={500}
                value={form.hourlyRate}
                onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
              />
            </div>
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
