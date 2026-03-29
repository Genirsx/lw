import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch, buildTransactionPath, formatDate, getStatusLabel, getStatusTone, truncateHash } from "../api/client";

export default function AdminChainRecordsPage() {
  const { user } = useAuth();
  const [chainData, setChainData] = useState({ items: [], pagination: null });
  const [chainPage, setChainPage] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = () => {
    apiFetch(`/api/chain/records?page=${chainPage}&pageSize=10`)
      .then(setChainData)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (user?.role === "admin") {
      loadData();
    }
  }, [user, chainPage]);

  if (!user || user.role !== "admin") {
    return (
      <section className="panel">
        <div className="section-head">
          <h3>链记录管理</h3>
          <p>该页面仅管理员可访问。</p>
        </div>
      </section>
    );
  }

  const handleRetry = async (businessType, businessId) => {
    setMessage("");
    setError("");
    try {
      await apiFetch(`/api/chain/retry/${businessType}/${businessId}`, {
        method: "POST"
      });
      setMessage(`已重试 ${businessType} #${businessId} 的上链流程。`);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page-grid">
      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}
      <section className="panel">
        <div className="section-head">
          <h3>链记录管理</h3>
          <p>按业务记录查看上链结果，失败时可单独重试。</p>
        </div>
        <div className="table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>业务</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>交易哈希</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {chainData.items.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{record.business_type}</strong>
                    <p>#{record.business_id}</p>
                  </td>
                  <td>
                    <span className={`tag ${getStatusTone(record.status)}`}>{getStatusLabel(record.status)}</span>
                  </td>
                  <td>{formatDate(record.created_at)}</td>
                  <td>
                    {record.tx_hash ? <Link to={buildTransactionPath(record.tx_hash)}>{truncateHash(record.tx_hash)}</Link> : "暂无交易哈希"}
                  </td>
                  <td>
                    {record.status !== "success" ? (
                      <button className="ghost-button" onClick={() => handleRetry(record.business_type, record.business_id)}>
                        重试上链
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {chainData.pagination ? (
          <div className="pager-row">
            <button className="ghost-button" disabled={chainPage <= 1} onClick={() => setChainPage((prev) => prev - 1)}>
              上一页
            </button>
            <span>
              第 {chainData.pagination.page} / {chainData.pagination.totalPages || 1} 页
            </span>
            <button className="ghost-button" disabled={chainData.pagination.page >= chainData.pagination.totalPages} onClick={() => setChainPage((prev) => prev + 1)}>
              下一页
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
