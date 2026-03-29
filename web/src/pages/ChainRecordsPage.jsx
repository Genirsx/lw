import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, buildTransactionPath, formatDate, getStatusLabel, getStatusTone, truncateHash } from "../api/client";

export default function ChainRecordsPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/chain/summary")
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page-grid">
      <section className="workspace-hero">
        <div className="workspace-copy">
          <p className="eyebrow">On-chain Records</p>
          <h2>把链上记录和交易详情做成单独的查询入口。</h2>
          <p>这里适合演示系统的可验证性，也适合用户快速查看最近存证和交易详情。</p>
        </div>
        <div className="workspace-actions">
          <div className="hero-metrics">
            <div className="metric-card accent-card">
              <span>总记录</span>
              <strong>{summary?.total_records ?? "--"}</strong>
            </div>
            <div className="metric-card">
              <span>成功存证</span>
              <strong>{summary?.success_count ?? "--"}</strong>
            </div>
            <div className="metric-card">
              <span>失败记录</span>
              <strong>{summary?.failed_count ?? "--"}</strong>
            </div>
            <div className="metric-card">
              <span>当前网络</span>
              <strong>{summary?.chainMode ?? "--"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>链记录</h3>
          <p>单独查看当前网络、最近链上存证和可点击的交易详情。</p>
        </div>
        {error ? <div className="alert error">{error}</div> : null}
        {summary ? (
          <>
            <div className="network-banner">
              <span>网络：{summary.chainName}</span>
              <span>模式：{summary.chainMode}</span>
              <span>Chain ID：{summary.chainId}</span>
              <span>币种：{summary.chainCurrencySymbol}</span>
            </div>
            <div className="info-grid">
              <div>
                <span>总记录数</span>
                <strong>{summary.total_records}</strong>
              </div>
              <div>
                <span>成功存证</span>
                <strong>{summary.success_count}</strong>
              </div>
              <div>
                <span>失败记录</span>
                <strong>{summary.failed_count}</strong>
              </div>
              <div>
                <span>合约地址</span>
                <strong className="hash-wrap">{summary.contractAddress || "-"}</strong>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>最近链上存证</h3>
          <p>点击交易哈希可进入详细交易信息页。</p>
        </div>
            <div className="record-list">
          {summary?.recentRecords?.map((record) => (
            <div className="record-item" key={record.id}>
              <div>
                <strong>{record.business_type} #{record.business_id}</strong>
                <p>ID #{record.business_id}</p>
              </div>
              <div>
                <span className={`tag ${getStatusTone(record.status)}`}>{getStatusLabel(record.status)}</span>
                <p>{formatDate(record.created_at)}</p>
                <p>
                  {record.tx_hash ? (
                    <Link to={buildTransactionPath(record.tx_hash)}>{truncateHash(record.tx_hash)}</Link>
                  ) : (
                    "无交易哈希"
                  )}
                </p>
              </div>
            </div>
          ))}
          {!summary?.recentRecords?.length ? <div className="alert">暂无链记录。</div> : null}
        </div>
      </section>
    </div>
  );
}
