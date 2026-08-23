import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../shared/auth';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">🎮 Game Club</div>
        <NavLink to="/" end>
          <span className="nav-icon">🎮</span>
          <span className="nav-label">Точки</span>
        </NavLink>
        <NavLink to="/history">
          <span className="nav-icon">🕒</span>
          <span className="nav-label">История</span>
        </NavLink>
        <NavLink to="/report">
          <span className="nav-icon">📊</span>
          <span className="nav-label">Отчёт</span>
        </NavLink>
        <NavLink to="/settings">
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">Настройки</span>
        </NavLink>
        <div className="spacer" />
        <div className="userbox">
          {user?.fullName || user?.username}
        </div>
        <button className="logout" onClick={logout} title="Выйти">
          <span className="nav-icon">🚪</span>
          <span className="nav-label">Выйти</span>
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
