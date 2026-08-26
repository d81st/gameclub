import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../shared/auth';

export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">🎮 Game Club</div>
        <NavLink to="/" end>
          <span className="nav-icon">🎮</span>
          <span className="nav-label">Точки</span>
        </NavLink>
        <NavLink to="/bar">
          <span className="nav-icon">🥤</span>
          <span className="nav-label">Бар</span>
        </NavLink>
        <NavLink to="/history">
          <span className="nav-icon">🕒</span>
          <span className="nav-label">История</span>
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/report">
            <span className="nav-icon">📊</span>
            <span className="nav-label">Отчёт</span>
          </NavLink>
        )}
        <NavLink to="/settings">
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">Настройки</span>
        </NavLink>
        <div className="spacer" />
        <div className="userbox">
          {user?.fullName || user?.username}
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
