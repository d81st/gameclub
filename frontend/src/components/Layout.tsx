import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../shared/auth';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">🎮 Game Club</div>
        <NavLink to="/" end>
          Точки
        </NavLink>
        <NavLink to="/history">История</NavLink>
        <NavLink to="/report">Отчёт за день</NavLink>
        <NavLink to="/settings">Настройки</NavLink>
        <div className="spacer" />
        <div className="userbox">
          {user?.fullName || user?.username}
        </div>
        <button className="logout" onClick={logout}>
          Выйти
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
