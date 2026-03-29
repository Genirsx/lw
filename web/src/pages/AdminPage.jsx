import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch, formatMoney } from "../api/client";

export default function AdminPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "admin") {
      apiFetch("/api/chain/summary")
        .then(setSummary)
        .catch((err) => setError(err.message));
    }
  }, [user]);

  if (!user || user.role !== "admin") {
    return (
      <section className="panel">
        <div className="section-head">
          <h3>后台首页</h3>
          <p>该页面仅管理员可访问。</p>
        </div>
      </section>
    );
  }

  return (
    <div className="page-grid">
      {error ? <div className="alert error">{error}</div> : null}

      <section className="panel">
        <div className="section-head">
          <h3>后台首页</h3>
          <p>后台功能已拆分为多个页面，先看总览，再进入对应模块处理业务。</p>
        </div>
        <div className="network-banner">
          <span>网络：{summary?.chainName ?? "--"}</span>
          <span>模式：{summary?.chainMode ?? "--"}</span>
          <span>Chain ID：{summary?.chainId ?? "--"}</span>
        </div>
        <div className="info-grid">
          <div>
            <span>项目数</span>
            <strong>{summary?.project_count ?? "--"}</strong>
          </div>
          <div>
            <span>总捐赠额</span>
            <strong>{formatMoney(summary?.total_donation_amount ?? 0)}</strong>
          </div>
          <div>
            <span>总拨付额</span>
            <strong>{formatMoney(summary?.total_disbursed ?? 0)}</strong>
          </div>
          <div>
            <span>成功存证</span>
            <strong>{summary?.success_count ?? "--"}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>后台模块</h3>
          <p>每类功能都拆成独立页面，便于单独操作和展示。</p>
        </div>
        <div className="dashboard-grid">
          <article className="dashboard-card">
            <span className="eyebrow">Admin</span>
            <h3>项目审核与管理</h3>
            <p>处理申请项目、审核上线、编辑项目与状态切换。</p>
            <Link className="primary-button" to="/admin/projects">
              进入模块
            </Link>
          </article>
          <article className="dashboard-card">
            <span className="eyebrow">Admin</span>
            <h3>资金拨付</h3>
            <p>单独登记拨付记录，避免和项目审核页混在一起。</p>
            <Link className="primary-button" to="/admin/disbursements">
              进入模块
            </Link>
          </article>
          <article className="dashboard-card">
            <span className="eyebrow">Admin</span>
            <h3>链记录管理</h3>
            <p>按业务查看上链结果，并对失败记录执行重试。</p>
            <Link className="primary-button" to="/admin/chain-records">
              进入模块
            </Link>
          </article>
          <article className="dashboard-card">
            <span className="eyebrow">Admin</span>
            <h3>操作日志</h3>
            <p>查看后台操作轨迹，适合做系统审计和答辩展示。</p>
            <Link className="primary-button" to="/admin/logs">
              进入模块
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
