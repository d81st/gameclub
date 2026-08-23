import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      // Обрезаем случайные пробелы от телефонной клавиатуры/автозаполнения
      await login(username.trim(), password.trim());
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={onSubmit}>
        <h1>🎮 Game Club</h1>
        <div className="field">
          <label>Логин</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
          />
        </div>
        <div className="field">
          <label>Пароль</label>
          <div className="pwd-wrap">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="pwd-toggle"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" disabled={busy || !username.trim() || !password.trim()}>
          {busy ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
