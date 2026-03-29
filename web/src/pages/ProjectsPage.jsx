import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, formatDate, formatMoney, getStatusLabel, getStatusTone } from "../api/client";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/projects")
      .then(setProjects)
      .catch((err) => setError(err.message));
  }, []);

  const filteredProjects = projects.filter((project) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return [project.name, project.description].join(" ").toLowerCase().includes(keyword);
  });

  const totalRaised = filteredProjects.reduce((sum, project) => sum + Number(project.raised_amount || 0), 0);

  return (
    <div className="page-grid">
      <section className="workspace-hero">
        <div className="workspace-copy">
          <p className="eyebrow">Project Hall</p>
          <h2>用更清晰的项目列表浏览已上线公益项目。</h2>
          <p>项目大厅改成列表和表格式阅读，不再使用大面积展示卡片。</p>
        </div>
        <div className="workspace-actions">
          <div className="summary-list">
            <div><span>上线项目</span><strong>{filteredProjects.length}</strong></div>
            <div><span>已筹总额</span><strong>{formatMoney(totalRaised)}</strong></div>
            <div><span>当前筛选</span><strong>{search.trim() || "全部项目"}</strong></div>
            <div><span>浏览方式</span><strong>项目列表</strong></div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>项目大厅</h3>
          <p>集中展示已审核上线项目，支持搜索和状态阅读。</p>
        </div>
        {error ? <div className="alert error">{error}</div> : null}
        <div className="toolbar-row">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索项目名称或描述" />
        </div>
        <div className="status-legend">
          <span><strong>状态说明：</strong></span>
          <span>进行中：项目当前可接受捐赠</span>
          <span>已通过：项目已审核通过并公开展示</span>
          <span>已上链：项目记录已成功写入链上</span>
        </div>
        <div className="table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>状态</th>
                <th>资金进度</th>
                <th>截止时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <strong>{project.name}</strong>
                    <p>{project.description}</p>
                  </td>
                  <td>
                    <div className="table-tag-group">
                      <span className={`tag ${getStatusTone(project.status)}`}>{getStatusLabel(project.status)}</span>
                      <span className={`tag ${getStatusTone(project.chain_status)}`}>{getStatusLabel(project.chain_status)}</span>
                    </div>
                  </td>
                  <td>
                    <p>已筹 {formatMoney(project.raised_amount)}</p>
                    <p>目标 {formatMoney(project.target_amount)}</p>
                    <p>拨付 {formatMoney(project.disbursed_amount)}</p>
                  </td>
                  <td>{formatDate(project.end_time)}</td>
                  <td>
                    <Link className="ghost-button" to={`/projects/${project.id}`}>
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filteredProjects.length ? <div className="alert">没有匹配的项目。</div> : null}
      </section>
    </div>
  );
}
