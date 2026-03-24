import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, formatMoney, formatDate } from "../api/client";
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

  return (
    <section className="panel">
      <div className="section-head">
        <h3>我的捐赠记录</h3>
        <p>可快速进入验证页，对单条记录执行链上校验。</p>
      </div>
      {error ? <div className="alert error">{error}</div> : null}
      <div className="record-list">
        {records.map((item) => (
          <div className="record-item" key={item.id}>
            <div>
              <strong>{item.project_name}</strong>
              <p>{item.message || "无留言"}</p>
            </div>
            <div>
              <strong>{formatMoney(item.amount)}</strong>
              <p>
                {formatDate(item.donated_at)} / {item.chain_status}
              </p>
              <Link to={`/verify?type=donation&id=${item.id}`}>验证该记录</Link>
            </div>
          </div>
        ))}
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
  );
}
