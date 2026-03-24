import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, formatMoney, formatDate, truncateHash } from "../api/client";

export default function HomePage() {
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch("/api/chain/summary"), apiFetch("/api/projects")])
      .then(([summaryData, projectData]) => {
        setSummary(summaryData);
        setProjects(projectData);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">可信记录 / 公开验证 / 资金可追溯</p>
          <h2>让公益项目的每笔关键记录都可查询、可验证、可追踪。</h2>
          <p>
            本系统将项目发布、捐赠存证、拨付流向和链上校验统一到一个 Web
            平台，适合毕业设计演示与论文实现。
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card accent-card">
            <span>累计捐赠</span>
            <strong>{summary ? formatMoney(summary.total_donation_amount) : "--"}</strong>
          </div>
          <div className="metric-card">
            <span>公益项目</span>
            <strong>{summary?.project_count ?? "--"}</strong>
          </div>
          <div className="metric-card">
            <span>存证记录</span>
            <strong>{summary?.total_records ?? "--"}</strong>
          </div>
          <div className="metric-card">
            <span>当前网络</span>
            <strong>{summary?.chainMode ?? "--"}</strong>
          </div>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="panel">
        <div className="section-head">
          <h3>公益项目</h3>
          <p>展示项目概况、筹款进度、拨付情况与最新链上状态。</p>
        </div>
        <div className="card-grid">
          {projects.map((project) => {
            const progress = Math.min(
              100,
              project.target_amount ? Math.round((project.raised_amount / project.target_amount) * 100) : 0
            );

            return (
              <article className="project-card" key={project.id}>
                <div
                  className="project-cover"
                  style={{ backgroundImage: `linear-gradient(135deg, rgba(9,31,44,.55), rgba(18,92,120,.15)), url(${project.image_url})` }}
                />
                <div className="project-body">
                  <div className="tag-row">
                    <span className="tag">{project.status}</span>
                    <span className={`tag ${project.chain_status === "success" ? "tag-success" : ""}`}>
                      {project.chain_status}
                    </span>
                  </div>
                  <h4>{project.name}</h4>
                  <p>{project.description}</p>
                  <div className="progress-bar">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="project-meta">
                    <span>已筹 {formatMoney(project.raised_amount)}</span>
                    <span>目标 {formatMoney(project.target_amount)}</span>
                  </div>
                  <div className="project-meta">
                    <span>拨付 {formatMoney(project.disbursed_amount)}</span>
                    <span>记录 {project.donation_count} 笔</span>
                  </div>
                  <div className="project-meta">
                    <span>截止 {formatDate(project.end_time)}</span>
                  </div>
                  <Link className="primary-button" to={`/projects/${project.id}`}>
                    查看详情
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>最近链上存证</h3>
          <p>展示最近写入链服务的关键业务记录。</p>
        </div>
        {summary ? (
          <div className="network-banner">
            <span>网络：{summary.chainName}</span>
            <span>Chain ID：{summary.chainId}</span>
            <span>币种：{summary.chainCurrencySymbol}</span>
          </div>
        ) : null}
        <div className="record-list">
          {summary?.recentRecords?.map((record) => (
            <div className="record-item" key={record.id}>
              <div>
                <strong>{record.business_type}</strong>
                <p>ID #{record.business_id}</p>
              </div>
              <div>
                <span className={`tag ${record.status === "success" ? "tag-success" : ""}`}>{record.status}</span>
                <p>
                  {record.explorerTxUrl ? (
                    <a href={record.explorerTxUrl} target="_blank" rel="noreferrer">
                      {truncateHash(record.tx_hash)}
                    </a>
                  ) : record.tx_hash ? (
                    truncateHash(record.tx_hash)
                  ) : (
                    "无交易哈希"
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
