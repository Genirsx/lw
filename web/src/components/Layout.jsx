import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function NavItem({ to, children }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-link${isActive ? " nav-link-active" : ""}`}>
      {children}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const roleLabel =
    user?.role === "admin" ? "管理员" : user?.role === "applicant" ? "项目申请者" : user ? "捐赠者" : "游客";

  const roleNavItems =
    user?.role === "admin"
      ? [
          { to: "/admin", label: "后台首页" },
          { to: "/admin/projects", label: "项目审核" },
          { to: "/admin/disbursements", label: "资金拨付" },
          { to: "/admin/chain-records", label: "链记录管理" },
          { to: "/admin/logs", label: "操作日志" }
        ]
      : user?.role === "applicant"
        ? [
            { to: "/my-project-applications", label: "我的项目申请" },
            { to: "/projects", label: "已上线项目" },
            { to: "/chain-records", label: "链记录" }
          ]
        : user
          ? [
              { to: "/", label: "首页" },
              { to: "/my-donations", label: "我的捐赠" },
              { to: "/projects", label: "去捐赠" },
              { to: "/chain-records", label: "链记录" },
              { to: "/verify", label: "链上校验" }
            ]
          : [
              { to: "/", label: "首页" },
              { to: "/projects", label: "项目大厅" },
              { to: "/chain-records", label: "链记录" },
              { to: "/verify", label: "链上校验" },
              { to: "/login", label: "登录" },
              { to: "/register", label: "注册" }
            ];

  return (
    <div className="app-shell app-with-sidebar">
      <aside className="app-sidebar">
        <div className="app-brand">
          <div className="eyebrow">Charity Chain System</div>
          <h1>慈善捐赠上链存证系统</h1>
          <p>{user ? `${user.username} / ${roleLabel}` : "未登录用户"}</p>
        </div>

        <div className="nav-group">
          <div className="nav-group-label">{user ? "我的功能" : "功能导航"}</div>
          <nav className="sidebar-nav">
            {roleNavItems.map((item) => (
              <NavItem key={item.to} to={item.to}>
                {item.label}
              </NavItem>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          {user ? (
            <>
              <span className="user-badge">
                {user.username} / {roleLabel}
              </span>
              <button className="ghost-button" onClick={logout}>
                退出登录
              </button>
            </>
          ) : (
            <span className="user-badge">当前角色 / 游客</span>
          )}
        </div>
      </aside>

      <div className="app-main">
        <header className="content-topbar">
          <div>
            <div className="eyebrow">{user ? `${roleLabel} Workspace` : "Public Workspace"}</div>
            <h2>系统工作区</h2>
          </div>
        </header>

        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
