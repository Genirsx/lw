import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, buildTransactionPath, formatMoney, formatDate, getStatusLabel, getStatusTone, truncateHash } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    donorName: "",
    amount: "",
    message: "",
    isAnonymous: false
  });
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const loadData = () => {
    apiFetch(`/api/projects/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleDonate = async (event) => {
    event.preventDefault();
    setFeedback("");
    setError("");
    try {
      await apiFetch("/api/donations", {
        method: "POST",
        body: JSON.stringify({
          projectId: Number(id),
          donorName: form.donorName,
          amount: Number(form.amount),
          message: form.message,
          isAnonymous: form.isAnonymous
        })
      });
      setFeedback("捐赠记录已提交并写入存证流程。");
      setForm({ donorName: "", amount: "", message: "", isAnonymous: false });
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data) {
    return <div className="panel">正在加载项目详情...</div>;
  }

  const { project, donations, disbursements } = data;
  const progress = Math.min(100, Math.round((project.raised_amount / project.target_amount) * 100));
  const donationDisabled = project.status !== "active";
  const remainingAmount = Math.max(0, Number(project.target_amount || 0) - Number(project.raised_amount || 0));

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="detail-header">
          <div>
            <div className="tag-row">
              <span className={`tag ${getStatusTone(project.status)}`}>{getStatusLabel(project.status)}</span>
              <span className={`tag ${getStatusTone(project.chain_status)}`}>
                {getStatusLabel(project.chain_status)}
              </span>
            </div>
            <h2>{project.name}</h2>
            <p>{project.description}</p>
          </div>
          <div className="hero-side-card">
            <span>筹款进度</span>
            <strong>{progress}%</strong>
            <p>已筹 {formatMoney(project.raised_amount)}</p>
            <p>已拨付 {formatMoney(project.disbursed_amount)}</p>
          </div>
        </div>
        <div className="progress-bar large-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="status-legend">
          <span><strong>状态说明：</strong></span>
          <span>进行中：项目当前可接受捐赠</span>
          <span>已通过：项目已审核通过并公开展示</span>
          <span>已上链：项目记录已成功写入链上</span>
        </div>
        <div className="info-grid">
          <div>
            <span>目标金额</span>
            <strong>{formatMoney(project.target_amount)}</strong>
          </div>
          <div>
            <span>开始时间</span>
            <strong>{formatDate(project.start_time)}</strong>
          </div>
          <div>
            <span>结束时间</span>
            <strong>{formatDate(project.end_time)}</strong>
          </div>
          <div>
            <span>项目哈希</span>
            <strong className="mono-text">{project.chain_hash ? truncateHash(project.chain_hash, 10) : "-"}</strong>
          </div>
          <div>
            <span>待筹金额</span>
            <strong>{formatMoney(remainingAmount)}</strong>
          </div>
        </div>
        {donationDisabled ? <div className="alert">当前项目状态为 `{project.status}`，暂不接受新的捐赠。</div> : null}
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>发起捐赠</h3>
          <p>提交后会生成哈希摘要，并写入链上存证流程。</p>
        </div>
        {user ? (
          <form className="form-grid" onSubmit={handleDonate}>
            <label>
              展示名称
              <input
                disabled={donationDisabled}
                value={form.donorName}
                onChange={(e) => setForm({ ...form, donorName: e.target.value })}
                placeholder={user.username}
              />
            </label>
            <label>
              捐赠金额（元）
              <input
                disabled={donationDisabled}
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </label>
            <label>
              留言
              <textarea
                disabled={donationDisabled}
                rows="4"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </label>
            <label className="checkbox-row">
              <input
                disabled={donationDisabled}
                type="checkbox"
                checked={form.isAnonymous}
                onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })}
              />
              匿名展示
            </label>
            {feedback ? <div className="alert success">{feedback}</div> : null}
            {error ? <div className="alert error">{error}</div> : null}
            <button className="primary-button" type="submit" disabled={donationDisabled}>
              {donationDisabled ? "当前不可捐赠" : "提交捐赠"}
            </button>
          </form>
        ) : (
          <div className="record-list">
            <div className="alert">登录后可提交捐赠。</div>
            <Link className="primary-button" to="/login">
              前往登录
            </Link>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>链上状态</h3>
          <p>展示当前项目的链上存证状态和最近交易。</p>
        </div>
        <div className="record-list">
          <div className="record-item stacked-item">
            <div>
              <strong>链上状态</strong>
              <p>{getStatusLabel(project.chain_status)}</p>
            </div>
            <div className="action-row">
              <span className={`tag ${getStatusTone(project.chain_status)}`}>{getStatusLabel(project.chain_status)}</span>
            </div>
          </div>
          {project.chain_tx_hash ? (
            <div className="record-item stacked-item">
              <div>
                <strong>最近项目交易</strong>
                <p className="hash-wrap">{project.chain_tx_hash}</p>
              </div>
              <div>
                <Link className="ghost-button" to={buildTransactionPath(project.chain_tx_hash)}>
                  查看交易详情
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>最新捐赠记录</h3>
        </div>
        <div className="record-list">
          {donations.map((item) => (
            <div className="record-item stacked-item" key={item.id}>
              <div>
                <strong>{item.is_anonymous ? "匿名捐赠者" : item.donor_name}</strong>
                <p>{item.message || "无留言"}</p>
              </div>
              <div className="action-row">
                <strong>{formatMoney(item.amount)}</strong>
                <span className={`tag ${getStatusTone(item.chain_status)}`}>{getStatusLabel(item.chain_status)}</span>
                <p>{formatDate(item.donated_at)}</p>
              </div>
            </div>
          ))}
          {!donations.length ? <div className="alert">暂无捐赠记录。</div> : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>资金流向记录</h3>
        </div>
        <div className="timeline">
          {disbursements.map((item) => (
            <div className="timeline-item" key={item.id}>
              <div className="timeline-dot" />
              <div className="timeline-content">
                <strong>{item.purpose}</strong>
                <p>接收方：{item.receiver}</p>
                <p>{item.description || "无补充说明"}</p>
                <small>
                  {formatDate(item.occurred_at)} / {formatMoney(item.amount)} / {getStatusLabel(item.chain_status)}
                </small>
              </div>
            </div>
          ))}
          {!disbursements.length ? <div className="alert">暂无资金流向记录。</div> : null}
        </div>
      </section>
    </div>
  );
}
