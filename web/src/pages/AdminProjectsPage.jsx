import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch, formatDate, formatMoney, getStatusLabel, getStatusTone } from "../api/client";

const initialProjectForm = {
  id: null,
  name: "",
  description: "",
  targetAmount: "",
  imageUrl: "",
  startTime: "",
  endTime: "",
  status: "active"
};

function toInputDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminProjectsPage() {
  const { user } = useAuth();
  const [projectData, setProjectData] = useState({ items: [], pagination: null });
  const [projectPage, setProjectPage] = useState(1);
  const [projectStatusFilter, setProjectStatusFilter] = useState("");
  const [projectApprovalFilter, setProjectApprovalFilter] = useState("");
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [reviewState, setReviewState] = useState({ open: false, projectId: null, action: "approve", reviewNote: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = () => {
    apiFetch(
      `/api/projects/admin/list?page=${projectPage}&pageSize=8${projectStatusFilter ? `&status=${projectStatusFilter}` : ""}${projectApprovalFilter ? `&approvalStatus=${projectApprovalFilter}` : ""}`
    )
      .then(setProjectData)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (user?.role === "admin") {
      loadData();
    }
  }, [user, projectPage, projectStatusFilter, projectApprovalFilter]);

  if (!user || user.role !== "admin") {
    return (
      <section className="panel">
        <div className="section-head">
          <h3>项目审核与管理</h3>
          <p>该页面仅管理员可访问。</p>
        </div>
      </section>
    );
  }

  const handleProjectSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const payload = {
      name: projectForm.name,
      description: projectForm.description,
      targetAmount: Number(projectForm.targetAmount),
      imageUrl: projectForm.imageUrl,
      startTime: projectForm.startTime,
      endTime: projectForm.endTime,
      status: projectForm.status
    };

    try {
      if (projectForm.id) {
        await apiFetch(`/api/projects/${projectForm.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setMessage("项目更新完成。");
      } else {
        await apiFetch("/api/projects", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setMessage("项目创建完成。");
      }
      setProjectForm(initialProjectForm);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditProject = (project) => {
    setProjectForm({
      id: project.id,
      name: project.name,
      description: project.description,
      targetAmount: Number(project.target_amount) / 100,
      imageUrl: project.image_url || "",
      startTime: toInputDate(project.start_time),
      endTime: toInputDate(project.end_time),
      status: project.status
    });
  };

  const handleStatusChange = async (projectId, status) => {
    setMessage("");
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setMessage("项目状态更新完成。");
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const openReviewModal = (projectId, action) => {
    setReviewState({ open: true, projectId, action, reviewNote: "" });
  };

  const closeReviewModal = () => {
    setReviewState({ open: false, projectId: null, action: "approve", reviewNote: "" });
  };

  const handleReview = async () => {
    setMessage("");
    setError("");
    if (reviewState.action === "reject" && !reviewState.reviewNote.trim()) {
      setError("驳回项目时需要填写审核意见。");
      return;
    }
    try {
      await apiFetch(`/api/projects/${reviewState.projectId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ action: reviewState.action, reviewNote: reviewState.reviewNote })
      });
      setMessage(reviewState.action === "approve" ? "项目已审核通过。" : "项目已驳回。");
      closeReviewModal();
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const pendingCount = projectData.items.filter((project) => project.approval_status === "pending").length;
  const approvedCount = projectData.items.filter((project) => project.approval_status === "approved").length;

  return (
    <div className="page-grid">
      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      <section className="panel">
        <div className="section-head">
          <h3>项目审核概览</h3>
          <p>先看当前页项目状态，再进入审核和编辑操作。</p>
        </div>
        <div className="admin-stat-grid">
          <div className="metric-card accent-card">
            <span>当前页项目</span>
            <strong>{projectData.items.length}</strong>
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
            <span>筛选状态</span>
            <strong>{projectApprovalFilter || "全部"}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>{projectForm.id ? "编辑项目" : "发布公益项目"}</h3>
          <p>管理员可以创建项目，也可以编辑已上线项目。</p>
        </div>
        <form className="form-grid two-column" onSubmit={handleProjectSubmit}>
          <label>
            项目名称
            <input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
          </label>
          <label>
            目标金额（元）
            <input type="number" min="0.01" step="0.01" value={projectForm.targetAmount} onChange={(e) => setProjectForm({ ...projectForm, targetAmount: e.target.value })} />
          </label>
          <label className="full-span">
            项目描述
            <textarea rows="4" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} />
          </label>
          <label className="full-span">
            封面图片 URL
            <input value={projectForm.imageUrl} onChange={(e) => setProjectForm({ ...projectForm, imageUrl: e.target.value })} />
          </label>
          <label>
            开始时间
            <input type="datetime-local" value={projectForm.startTime} onChange={(e) => setProjectForm({ ...projectForm, startTime: e.target.value })} />
          </label>
          <label>
            结束时间
            <input type="datetime-local" value={projectForm.endTime} onChange={(e) => setProjectForm({ ...projectForm, endTime: e.target.value })} />
          </label>
          <label>
            项目状态
            <select value={projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}>
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="closed">closed</option>
            </select>
          </label>
          <div className="button-row">
            <button className="primary-button" type="submit">
              {projectForm.id ? "保存项目" : "创建项目"}
            </button>
            {projectForm.id ? (
              <button className="ghost-button" type="button" onClick={() => setProjectForm(initialProjectForm)}>
                取消编辑
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>项目审核与管理</h3>
          <p>统一表格视图，方便管理员阅读和批量处理。</p>
        </div>
        <div className="toolbar-row">
          <select value={projectStatusFilter} onChange={(e) => setProjectStatusFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="closed">closed</option>
          </select>
          <select value={projectApprovalFilter} onChange={(e) => setProjectApprovalFilter(e.target.value)}>
            <option value="">全部审核状态</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
        </div>

        <div className="table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>资金</th>
                <th>状态</th>
                <th>申请者 / 审核人</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {projectData.items.map((project) => (
                <tr key={project.id}>
                  <td>
                    <strong>{project.name}</strong>
                    <p>{project.review_note || "暂无审核意见"}</p>
                  </td>
                  <td>
                    <p>目标 {formatMoney(project.target_amount)}</p>
                    <p>已筹 {formatMoney(project.raised_amount)}</p>
                    <p>已拨付 {formatMoney(project.disbursed_amount)}</p>
                  </td>
                  <td>
                    <div className="table-tag-group">
                      <span className={`tag ${getStatusTone(project.status)}`}>{getStatusLabel(project.status)}</span>
                      <span className={`tag ${getStatusTone(project.approval_status)}`}>{getStatusLabel(project.approval_status)}</span>
                      <span className={`tag ${getStatusTone(project.chain_status)}`}>{getStatusLabel(project.chain_status)}</span>
                    </div>
                  </td>
                  <td>
                    <p>申请者 {project.creator_username || "-"}</p>
                    <p>审核人 {project.approved_by_name || "-"}</p>
                  </td>
                  <td>{formatDate(project.updated_at)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost-button" onClick={() => handleEditProject(project)}>
                        编辑
                      </button>
                      {project.approval_status === "pending" ? (
                        <>
                          <button className="ghost-button" onClick={() => openReviewModal(project.id, "approve")}>
                            审核通过
                          </button>
                          <button className="ghost-button" onClick={() => openReviewModal(project.id, "reject")}>
                            驳回
                          </button>
                        </>
                      ) : null}
                      <select value={project.status} disabled={project.approval_status !== "approved"} onChange={(e) => handleStatusChange(project.id, e.target.value)}>
                        <option value="draft">draft</option>
                        <option value="active">active</option>
                        <option value="closed">closed</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {projectData.pagination ? (
          <div className="pager-row">
            <button className="ghost-button" disabled={projectPage <= 1} onClick={() => setProjectPage((prev) => prev - 1)}>
              上一页
            </button>
            <span>
              第 {projectData.pagination.page} / {projectData.pagination.totalPages || 1} 页
            </span>
            <button className="ghost-button" disabled={projectData.pagination.page >= projectData.pagination.totalPages} onClick={() => setProjectPage((prev) => prev + 1)}>
              下一页
            </button>
          </div>
        ) : null}
      </section>

      {reviewState.open ? (
        <div className="modal-backdrop" onClick={closeReviewModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>{reviewState.action === "approve" ? "审核通过项目" : "驳回项目申请"}</h3>
              <p>{reviewState.action === "approve" ? "可选填写审核备注。" : "驳回时必须填写明确原因。"}</p>
            </div>
            <div className="form-grid">
              <label>
                审核意见
                <textarea
                  rows="5"
                  value={reviewState.reviewNote}
                  onChange={(e) => setReviewState((prev) => ({ ...prev, reviewNote: e.target.value }))}
                  placeholder={reviewState.action === "approve" ? "例如：材料齐全，允许上线" : "请填写驳回原因"}
                />
              </label>
              <div className="button-row">
                <button className="primary-button" type="button" onClick={handleReview}>
                  提交审核
                </button>
                <button className="ghost-button" type="button" onClick={closeReviewModal}>
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
