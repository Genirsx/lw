import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch, formatDate, formatMoney, getStatusLabel, getStatusTone } from "../api/client";

const initialForm = {
  name: "",
  description: "",
  targetAmount: "",
  imageUrl: "",
  startTime: "",
  endTime: ""
};

export default function MyProjectApplicationsPage() {
  const { user, loading } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const data = await apiFetch("/api/projects/my-applications?page=1&pageSize=20");
      setRecords(data.items);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (user?.role === "applicant") {
      loadData();
    }
  }, [user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await apiFetch("/api/projects/applications", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          targetAmount: Number(form.targetAmount)
        })
      });
      setForm(initialForm);
      setMessage("项目申请已提交，等待管理员审核。");
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <section className="panel">正在加载用户信息...</section>;
  }

  if (!user || user.role !== "applicant") {
    return (
      <section className="panel">
        <div className="section-head">
          <h3>我的项目申请</h3>
          <p>该页面仅项目申请者可访问。</p>
        </div>
      </section>
    );
  }

  const pendingCount = records.filter((project) => project.approval_status === "pending").length;
  const approvedCount = records.filter((project) => project.approval_status === "approved").length;

  return (
    <div className="page-grid">
      <section className="workspace-hero">
        <div className="workspace-copy">
          <p className="eyebrow">Application Center</p>
          <h2>把项目申请、审核状态和反馈统一到一个申请工作台。</h2>
          <p>你可以在这里提交新项目，也可以跟踪每个项目的审核结果和备注。</p>
        </div>
        <div className="workspace-actions">
          <div className="hero-metrics">
            <div className="metric-card accent-card">
              <span>申请总数</span>
              <strong>{records.length}</strong>
            </div>
            <div className="metric-card">
              <span>待审核</span>
              <strong>{pendingCount}</strong>
            </div>
            <div className="metric-card">
              <span>已通过</span>
              <strong>{approvedCount}</strong>
            </div>
            <div className="metric-card">
              <span>工作模式</span>
              <strong>项目申请</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>提交项目申请</h3>
          <p>管理员审核通过后，项目才会公开展示并允许接受捐赠。</p>
        </div>
        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}
        <form className="form-grid two-column" onSubmit={handleSubmit}>
          <label>
            项目名称
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            目标金额（元）
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.targetAmount}
              onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
            />
          </label>
          <label className="full-span">
            项目描述
            <textarea
              rows="4"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="full-span">
            封面图片 URL
            <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          </label>
          <label>
            开始时间
            <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </label>
          <label>
            结束时间
            <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </label>
          <button className="primary-button" type="submit">
            提交申请
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>我的申请记录</h3>
          <p>可查看当前审核状态和管理员意见。</p>
        </div>
        <div className="record-list">
          {records.map((project) => (
            <div className="record-item stacked-item" key={project.id}>
              <div>
                <strong>{project.name}</strong>
                <p>
                  审核状态 {getStatusLabel(project.approval_status)} / 项目状态 {getStatusLabel(project.status)}
                </p>
                <p>
                  目标 {formatMoney(project.target_amount)} / 提交时间 {formatDate(project.submitted_at || project.created_at)}
                </p>
                <p>{project.review_note || "管理员暂未留下审核意见"}</p>
              </div>
              <div className="action-row">
                <span className={`tag ${getStatusTone(project.approval_status)}`}>{getStatusLabel(project.approval_status)}</span>
                <span className={`tag ${getStatusTone(project.status)}`}>{getStatusLabel(project.status)}</span>
              </div>
            </div>
          ))}
          {!records.length ? <div className="alert">暂无项目申请记录。</div> : null}
        </div>
      </section>
    </div>
  );
}
