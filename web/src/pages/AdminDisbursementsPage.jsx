import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch, formatMoney, getStatusLabel, getStatusTone } from "../api/client";

const initialDisbursementForm = {
  projectId: "",
  amount: "",
  receiver: "",
  purpose: "",
  description: "",
  occurredAt: ""
};

export default function AdminDisbursementsPage() {
  const { user } = useAuth();
  const [projectOptions, setProjectOptions] = useState([]);
  const [disbursementForm, setDisbursementForm] = useState(initialDisbursementForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "admin") {
      apiFetch("/api/projects")
        .then(setProjectOptions)
        .catch((err) => setError(err.message));
    }
  }, [user]);

  if (!user || user.role !== "admin") {
    return (
      <section className="panel">
        <div className="section-head">
          <h3>资金拨付</h3>
          <p>该页面仅管理员可访问。</p>
        </div>
      </section>
    );
  }

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
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page-grid admin-split-grid">
      <section className="panel">
        <div className="section-head">
          <h3>登记资金拨付</h3>
          <p>将拨付表单独立出来，避免和项目审核流程混在一起。</p>
        </div>
        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}
        <form className="form-grid two-column" onSubmit={handleDisbursementSubmit}>
          <label>
            选择项目
            <select value={disbursementForm.projectId} onChange={(e) => setDisbursementForm({ ...disbursementForm, projectId: e.target.value })}>
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
            <input type="number" min="0.01" step="0.01" value={disbursementForm.amount} onChange={(e) => setDisbursementForm({ ...disbursementForm, amount: e.target.value })} />
          </label>
          <label>
            接收方
            <input value={disbursementForm.receiver} onChange={(e) => setDisbursementForm({ ...disbursementForm, receiver: e.target.value })} />
          </label>
          <label>
            用途
            <input value={disbursementForm.purpose} onChange={(e) => setDisbursementForm({ ...disbursementForm, purpose: e.target.value })} />
          </label>
          <label className="full-span">
            说明
            <textarea rows="4" value={disbursementForm.description} onChange={(e) => setDisbursementForm({ ...disbursementForm, description: e.target.value })} />
          </label>
          <label>
            发生时间
            <input type="datetime-local" value={disbursementForm.occurredAt} onChange={(e) => setDisbursementForm({ ...disbursementForm, occurredAt: e.target.value })} />
          </label>
          <button className="primary-button" type="submit">
            创建拨付记录
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>可拨付项目</h3>
          <p>这里只保留已上线项目，作为拨付操作的参考清单。</p>
        </div>
        <div className="table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>状态</th>
                <th>已筹金额</th>
                <th>已拨付金额</th>
              </tr>
            </thead>
            <tbody>
              {projectOptions.map((project) => (
                <tr key={project.id}>
                  <td>
                    <strong>{project.name}</strong>
                  </td>
                  <td>
                    <div className="table-tag-group">
                      <span className={`tag ${getStatusTone(project.status)}`}>{getStatusLabel(project.status)}</span>
                      <span className={`tag ${getStatusTone(project.chain_status)}`}>{getStatusLabel(project.chain_status)}</span>
                    </div>
                  </td>
                  <td>{formatMoney(project.raised_amount)}</td>
                  <td>{formatMoney(project.disbursed_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!projectOptions.length ? <div className="alert">当前没有可拨付项目。</div> : null}
      </section>
    </div>
  );
}
