import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, formatMoney, formatDate, getStatusLabel, getStatusTone } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export default function MyDonationsPage() {
  const { user, loading } = useAuth();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    apiFetch(`/api/donations/my?page=${page}&pageSize=6`)
      .then((data) => {
        setRecords(data.items);
        setPagination(data.pagination);
      })
      .catch((err) => setError(err.message));
  }, [user, page]);

  if (loading) {
    return <section className="panel">正在加载用户信息...</section>;
  }

  if (!user) {
    return (
      <section className="panel">
        <div className="section-head">
          <h3>我的捐赠</h3>
          <p>请先登录后查看。</p>
        </div>
        <Link className="primary-button" to="/login">
          前往登录
        </Link>
      </section>
    );
  }

  const totalAmount = records.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="page-grid">
      <section className="workspace-hero">
        <div className="workspace-copy">
          <p className="eyebrow">Donation Center</p>
          <h2>在一个页面里看清我的捐赠、验证入口和记录状态。</h2>
          <p>这里是捐赠者的个人中心，不再混入管理员和申请者工作内容。</p>
        </div>
        <div className="workspace-actions">
          <div className="hero-metrics">
            <div className="metric-card accent-card">
              <span>当前页记录</span>
              <strong>{records.length}</strong>
            </div>
            <div className="metric-card">
              <span>当前页金额</span>
              <strong>{formatMoney(totalAmount)}</strong>
            </div>
            <div className="metric-card">
              <span>分页</span>
              <strong>{pagination ? `${pagination.page}/${pagination.totalPages || 1}` : "--"}</strong>
            </div>
            <div className="metric-card">
              <span>主要用途</span>
              <strong>校验捐赠</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>我的捐赠记录</h3>
          <p>每条记录都可以快速进入链上校验页。</p>
        </div>
        {error ? <div className="alert error">{error}</div> : null}
        <div className="record-list">
          {records.map((item) => (
            <div className="record-item stacked-item" key={item.id}>
              <div>
                <strong>{item.project_name}</strong>
                <p>{item.message || "无留言"}</p>
                <p>{formatDate(item.donated_at)}</p>
              </div>
              <div className="action-row">
                <span className={`tag ${getStatusTone(item.chain_status)}`}>{getStatusLabel(item.chain_status)}</span>
                <strong>{formatMoney(item.amount)}</strong>
                <Link className="ghost-button" to={`/verify?type=donation&id=${item.id}`}>
                  验证记录
                </Link>
              </div>
            </div>
          ))}
          {!records.length ? <div className="alert">暂无捐赠记录。</div> : null}
        </div>
        {pagination ? (
          <div className="pager-row">
            <button className="ghost-button" disabled={pagination.page <= 1} onClick={() => setPage((prev) => prev - 1)}>
              上一页
            </button>
            <span>
              第 {pagination.page} / {pagination.totalPages || 1} 页
            </span>
            <button
              className="ghost-button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
