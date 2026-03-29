import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch, formatDate } from "../api/client";

export default function AdminLogsPage() {
  const { user } = useAuth();
  const [logData, setLogData] = useState({ items: [], pagination: null });
  const [logPage, setLogPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "admin") {
      apiFetch(`/api/logs?page=${logPage}&pageSize=10`)
        .then(setLogData)
        .catch((err) => setError(err.message));
    }
  }, [user, logPage]);

  if (!user || user.role !== "admin") {
    return (
      <section className="panel">
        <div className="section-head">
          <h3>操作日志</h3>
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
          <h3>操作日志</h3>
          <p>统一成后台表格样式，便于查看关键操作轨迹。</p>
        </div>
        <div className="table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>动作</th>
                <th>操作者</th>
                <th>业务对象</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {logData.items.map((log) => (
                <tr key={log.id}>
                  <td>
                    <strong>{log.action}</strong>
                  </td>
                  <td>{log.username}</td>
                  <td>
                    {log.business_type} #{log.business_id}
                  </td>
                  <td>{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logData.pagination ? (
          <div className="pager-row">
            <button className="ghost-button" disabled={logPage <= 1} onClick={() => setLogPage((prev) => prev - 1)}>
              上一页
            </button>
            <span>
              第 {logData.pagination.page} / {logData.pagination.totalPages || 1} 页
            </span>
            <button className="ghost-button" disabled={logData.pagination.page >= logData.pagination.totalPages} onClick={() => setLogPage((prev) => prev + 1)}>
              下一页
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
