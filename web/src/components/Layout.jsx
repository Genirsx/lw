import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}
    >
      {children}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Blockchain Charity Prototype</div>
          <h1>慈善捐赠上链存证与管理系统</h1>
        </div>
        <div className="topbar-actions">
          {user ? (
            <>
              <span className="user-badge">
                {user.username} / {user.role === "admin" ? "管理员" : "捐赠者"}
              </span>
              <button className="ghost-button" onClick={logout}>
                退出登录
              </button>
            </>
          ) : (
            <>
              <NavItem to="/login">登录</NavItem>
              <NavItem to="/register">注册</NavItem>
            </>
          )}
        </div>
      </header>

      <nav className="nav-bar">
        <NavItem to="/">项目总览</NavItem>
        <NavItem to="/my-donations">我的捐赠</NavItem>
        <NavItem to="/verify">链上校验</NavItem>
        <NavItem to="/admin">后台管理</NavItem>
      </nav>

      <main className="page-container">
        <Outlet />
      </main>
    </div>
  );
}
