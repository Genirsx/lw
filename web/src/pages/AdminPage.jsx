import { useEffect, useState } from "react";
import { apiFetch, formatMoney, formatDate, truncateHash } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

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

const initialDisbursementForm = {
  projectId: "",
  amount: "",
  receiver: "",
  purpose: "",
  description: "",
  occurredAt: ""
};

function toInputDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [projectOptions, setProjectOptions] = useState([]);
  const [projectData, setProjectData] = useState({ items: [], pagination: null });
  const [chainData, setChainData] = useState({ items: [], pagination: null });
  const [logData, setLogData] = useState({ items: [], pagination: null });
  const [projectPage, setProjectPage] = useState(1);
  const [chainPage, setChainPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const [projectStatusFilter, setProjectStatusFilter] = useState("");
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [disbursementForm, setDisbursementForm] = useState(initialDisbursementForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = () => {
    Promise.all([
      apiFetch("/api/chain/summary"),
      apiFetch("/api/projects"),
      apiFetch(`/api/projects/admin/list?page=${projectPage}&pageSize=6${projectStatusFilter ? `&status=${projectStatusFilter}` : ""}`),
      apiFetch(`/api/chain/records?page=${chainPage}&pageSize=6`),
      apiFetch(`/api/logs?page=${logPage}&pageSize=6`)
    ])
      .then(([summaryData, publicProjects, projectList, chainList, logList]) => {
        setSummary(summaryData);
        setProjectOptions(publicProjects);
        setProjectData(projectList);
        setChainData(chainList);
        setLogData(logList);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (user?.role === "admin") {
      loadData();
    }
  }, [user, projectPage, chainPage, logPage, projectStatusFilter]);

  if (!user || user.role !== "admin") {
    return (
      <section className="panel">
        <div className="section-head">
          <h3>后台管理</h3>
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

  const handleDisbursementSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      await apiFetch("/api/disbursements", {
        method: "POST",
        body: JSON.stringify({
          ...disbursementForm,
          projectId: Number(disbursementForm.projectId),
          amount: Number(disbursementForm.amount)
        })
      });
      setMessage("拨付记录创建完成。");
      setDisbursementForm(initialDisbursementForm);
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
      <section className="panel">
        <div className="section-head">
          <h3>后台概览</h3>
          <p>查看项目、捐赠、拨付和链上记录的全局状态。</p>
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

      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      <section className="panel">
        <div className="section-head">
          <h3>{projectForm.id ? "编辑项目" : "发布公益项目"}</h3>
        </div>
        <form className="form-grid two-column" onSubmit={handleProjectSubmit}>
          <label>
            项目名称
            <input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
          </label>
          <label>
            目标金额（元）
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={projectForm.targetAmount}
              onChange={(e) => setProjectForm({ ...projectForm, targetAmount: e.target.value })}
            />
          </label>
          <label className="full-span">
            项目描述
            <textarea
              rows="4"
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
            />
          </label>
          <label className="full-span">
            封面图片 URL
            <input
              value={projectForm.imageUrl}
              onChange={(e) => setProjectForm({ ...projectForm, imageUrl: e.target.value })}
            />
          </label>
          <label>
            开始时间
            <input
              type="datetime-local"
              value={projectForm.startTime}
              onChange={(e) => setProjectForm({ ...projectForm, startTime: e.target.value })}
            />
          </label>
          <label>
            结束时间
            <input
              type="datetime-local"
              value={projectForm.endTime}
              onChange={(e) => setProjectForm({ ...projectForm, endTime: e.target.value })}
            />
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
          <h3>项目管理</h3>
          <p>可筛选项目、编辑内容和切换状态。</p>
        </div>
        <div className="toolbar-row">
          <select value={projectStatusFilter} onChange={(e) => setProjectStatusFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="closed">closed</option>
          </select>
        </div>
        <div className="record-list">
          {projectData.items.map((project) => (
            <div className="record-item stacked-item" key={project.id}>
              <div>
                <strong>{project.name}</strong>
                <p>
                  目标 {formatMoney(project.target_amount)} / 已筹 {formatMoney(project.raised_amount)} / 已拨付{" "}
                  {formatMoney(project.disbursed_amount)}
                </p>
                <p>
                  状态 {project.status} / 上链 {project.chain_status}
                </p>
              </div>
              <div className="action-row">
                <button className="ghost-button" onClick={() => handleEditProject(project)}>
                  编辑
                </button>
                <select value={project.status} onChange={(e) => handleStatusChange(project.id, e.target.value)}>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="closed">closed</option>
                </select>
              </div>
            </div>
          ))}
        </div>
        {projectData.pagination ? (
          <div className="pager-row">
            <button className="ghost-button" disabled={projectPage <= 1} onClick={() => setProjectPage((prev) => prev - 1)}>
              上一页
            </button>
            <span>
              第 {projectData.pagination.page} / {projectData.pagination.totalPages || 1} 页
            </span>
            <button
              className="ghost-button"
              disabled={projectData.pagination.page >= projectData.pagination.totalPages}
              onClick={() => setProjectPage((prev) => prev + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>登记资金拨付</h3>
        </div>
        <form className="form-grid two-column" onSubmit={handleDisbursementSubmit}>
          <label>
            选择项目
            <select
              value={disbursementForm.projectId}
              onChange={(e) => setDisbursementForm({ ...disbursementForm, projectId: e.target.value })}
            >
              <option value="">请选择</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            拨付金额（元）
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={disbursementForm.amount}
              onChange={(e) => setDisbursementForm({ ...disbursementForm, amount: e.target.value })}
            />
          </label>
          <label>
            接收方
            <input
              value={disbursementForm.receiver}
              onChange={(e) => setDisbursementForm({ ...disbursementForm, receiver: e.target.value })}
            />
          </label>
          <label>
            用途
            <input
              value={disbursementForm.purpose}
              onChange={(e) => setDisbursementForm({ ...disbursementForm, purpose: e.target.value })}
            />
          </label>
          <label className="full-span">
            说明
            <textarea
              rows="4"
              value={disbursementForm.description}
              onChange={(e) => setDisbursementForm({ ...disbursementForm, description: e.target.value })}
            />
          </label>
          <label>
            发生时间
            <input
              type="datetime-local"
              value={disbursementForm.occurredAt}
              onChange={(e) => setDisbursementForm({ ...disbursementForm, occurredAt: e.target.value })}
            />
          </label>
          <button className="primary-button" type="submit">
            创建拨付记录
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>链记录管理</h3>
          <p>可查看失败记录并手动重试上链。</p>
        </div>
        <div className="record-list">
          {chainData.items.map((record) => (
            <div className="record-item stacked-item" key={record.id}>
              <div>
                <strong>
                  {record.business_type} #{record.business_id}
                </strong>
                <p>
                  状态 {record.status} / {formatDate(record.created_at)}
                </p>
                <p>
                  {record.explorerTxUrl ? (
                    <>
                      交易哈希{" "}
                      <a href={record.explorerTxUrl} target="_blank" rel="noreferrer">
                        {truncateHash(record.tx_hash)}
                      </a>
                    </>
                  ) : record.tx_hash ? (
                    `交易哈希 ${truncateHash(record.tx_hash)}`
                  ) : (
                    "暂无交易哈希"
                  )}
                </p>
              </div>
              <div className="action-row">
                <span className={`tag ${record.status === "success" ? "tag-success" : ""}`}>{record.status}</span>
                {record.status !== "success" ? (
                  <button className="ghost-button" onClick={() => handleRetry(record.business_type, record.business_id)}>
                    重试上链
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {chainData.pagination ? (
          <div className="pager-row">
            <button className="ghost-button" disabled={chainPage <= 1} onClick={() => setChainPage((prev) => prev - 1)}>
              上一页
            </button>
            <span>
              第 {chainData.pagination.page} / {chainData.pagination.totalPages || 1} 页
            </span>
            <button
              className="ghost-button"
              disabled={chainData.pagination.page >= chainData.pagination.totalPages}
              onClick={() => setChainPage((prev) => prev + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>操作日志</h3>
          <p>记录管理员的关键动作，方便答辩展示权限与审计。</p>
        </div>
        <div className="record-list">
          {logData.items.map((log) => (
            <div className="record-item stacked-item" key={log.id}>
              <div>
                <strong>{log.action}</strong>
                <p>
                  操作者 {log.username} / {log.business_type} #{log.business_id}
                </p>
              </div>
              <div>
                <p>{formatDate(log.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
        {logData.pagination ? (
          <div className="pager-row">
            <button className="ghost-button" disabled={logPage <= 1} onClick={() => setLogPage((prev) => prev - 1)}>
              上一页
            </button>
            <span>
              第 {logData.pagination.page} / {logData.pagination.totalPages || 1} 页
            </span>
            <button
              className="ghost-button"
              disabled={logData.pagination.page >= logData.pagination.totalPages}
              onClick={() => setLogPage((prev) => prev + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
