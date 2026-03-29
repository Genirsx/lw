import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, formatMoney, getStatusLabel } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

function WorkspaceIntro({ eyebrow, title, description, children }) {
  return (
    <section className="workspace-hero">
      <div className="workspace-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="workspace-actions">{children}</div>
    </section>
  );
}

function NavList({ items }) {
  return (
    <div className="list-shell">
      {items.map((item) => (
        <div className="list-row" key={item.title}>
          <div>
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </div>
          <div className="button-row">
            {item.secondaryTo ? (
              <Link className="ghost-button" to={item.secondaryTo}>
                {item.secondaryLabel}
              </Link>
            ) : null}
            <Link className="primary-button" to={item.to}>
              {item.label}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function GuestHome({ summary, error }) {
  return (
    <div className="page-grid">
      <section className="workspace-hero">
        <div className="workspace-copy">
          <p className="eyebrow">Guest View</p>
          <h2>先看系统，再决定你要用哪个角色进入。</h2>
          <p>首页只保留总览和公开入口，不再做大面积卡片堆叠。</p>
        </div>
        <div className="workspace-actions">
          <div className="summary-list">
            <div><span>累计捐赠</span><strong>{summary ? formatMoney(summary.total_donation_amount) : "--"}</strong></div>
            <div><span>公益项目</span><strong>{summary?.project_count ?? "--"}</strong></div>
            <div><span>存证记录</span><strong>{summary?.total_records ?? "--"}</strong></div>
            <div><span>当前网络</span><strong>{summary?.chainMode ?? "--"}</strong></div>
          </div>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="panel">
        <div className="section-head">
          <h3>公开入口</h3>
          <p>游客只看项目、链记录、校验和登录入口。</p>
        </div>
        <NavList
          items={[
            { title: "项目大厅", description: "浏览已上线公益项目，查看筹款和拨付详情。", to: "/projects", label: "进入项目大厅" },
            { title: "链记录", description: "查看最近存证记录，点击交易哈希进入详情页。", to: "/chain-records", label: "查看链记录" },
            { title: "链上校验", description: "按记录编号验证链下哈希和链上哈希是否一致。", to: "/verify", label: "打开校验页" },
            { title: "登录或注册", description: "登录后会根据角色切换到对应的工作首页。", to: "/login", label: "前往登录", secondaryTo: "/register", secondaryLabel: "新用户注册" }
          ]}
        />
      </section>
    </div>
  );
}

function DonorHome({ summary, myDonationData, error }) {
  return (
    <div className="page-grid">
      <WorkspaceIntro
        eyebrow="Donor Workspace"
        title="你是捐赠者，先看我的记录，再决定继续支持哪个项目。"
        description="首页只保留捐赠者最常用的入口，信息按列表分组展示。"
      >
        <div className="summary-list">
          <div><span>系统累计捐赠</span><strong>{summary ? formatMoney(summary.total_donation_amount) : "--"}</strong></div>
          <div><span>我的捐赠笔数</span><strong>{myDonationData?.pagination?.total ?? 0}</strong></div>
          <div><span>公益项目</span><strong>{summary?.project_count ?? "--"}</strong></div>
          <div><span>当前网络</span><strong>{summary?.chainMode ?? "--"}</strong></div>
        </div>
      </WorkspaceIntro>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="panel">
        <div className="section-head">
          <h3>我的常用页面</h3>
        </div>
        <NavList
          items={[
            { title: "我的捐赠", description: "查看我的捐赠记录，并快速跳转做链上校验。", to: "/my-donations", label: "查看我的捐赠" },
            { title: "项目大厅", description: "浏览公开项目，选择想支持的公益项目继续捐赠。", to: "/projects", label: "去捐赠" },
            { title: "链记录", description: "如果你想直接看交易和链记录，可以从这里进入。", to: "/chain-records", label: "查看链记录" }
          ]}
        />
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>最近捐赠</h3>
        </div>
        <div className="list-shell">
          {myDonationData?.items?.map((item) => (
            <div className="list-row" key={item.id}>
              <div>
                <strong>{item.project_name}</strong>
                <p>{item.message || "无留言"}</p>
              </div>
              <div className="inline-meta">
                <span>{formatMoney(item.amount)}</span>
                <span>{item.chain_status}</span>
              </div>
            </div>
          ))}
          {!myDonationData?.items?.length ? <div className="alert">你还没有捐赠记录。</div> : null}
        </div>
      </section>
    </div>
  );
}

function ApplicantHome({ applicationData, error }) {
  const pendingCount = applicationData?.items?.filter((item) => item.approval_status === "pending").length ?? 0;
  const approvedCount = applicationData?.items?.filter((item) => item.approval_status === "approved").length ?? 0;

  return (
    <div className="page-grid">
      <WorkspaceIntro
        eyebrow="Applicant Workspace"
        title="你是项目申请者，先看审核状态和下一步动作。"
        description="申请者首页只显示申请相关信息，并改用更克制的列表布局。"
      >
        <div className="summary-list">
          <div><span>我的申请总数</span><strong>{applicationData?.pagination?.total ?? 0}</strong></div>
          <div><span>待审核</span><strong>{pendingCount}</strong></div>
          <div><span>已通过</span><strong>{approvedCount}</strong></div>
          <div><span>最近状态</span><strong>{getStatusLabel(applicationData?.items?.[0]?.approval_status)}</strong></div>
        </div>
      </WorkspaceIntro>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="panel">
        <div className="section-head">
          <h3>我的工作入口</h3>
        </div>
        <NavList
          items={[
            { title: "我的项目申请", description: "提交新项目申请，查看审核意见和上线结果。", to: "/my-project-applications", label: "进入申请页" },
            { title: "已上线项目", description: "查看已审核上线的项目展示效果，方便对照自己的申请结果。", to: "/projects", label: "查看项目大厅" },
            { title: "链记录", description: "如果你的项目已通过并有链上交易，可以从这里查看。", to: "/chain-records", label: "查看链记录" }
          ]}
        />
      </section>

      <section className="panel">
        <div className="section-head">
          <h3>最近申请</h3>
        </div>
        <div className="list-shell">
          {applicationData?.items?.map((project) => (
            <div className="list-row" key={project.id}>
              <div>
                <strong>{project.name}</strong>
                <p>{project.review_note || "管理员暂未留下审核意见"}</p>
              </div>
              <div className="inline-meta">
                <span>{getStatusLabel(project.approval_status)}</span>
                <span>{getStatusLabel(project.status)}</span>
              </div>
            </div>
          ))}
          {!applicationData?.items?.length ? <div className="alert">你还没有提交项目申请。</div> : null}
        </div>
      </section>
    </div>
  );
}

function AdminHome({ summary, pendingProjects, chainRecords, error }) {
  const pendingCount = pendingProjects?.pagination?.total ?? 0;
  const failedCount = chainRecords?.items?.filter((item) => item.status !== "success").length ?? 0;

  return (
    <div className="page-grid">
      <WorkspaceIntro
        eyebrow="Admin Workspace"
        title="你是管理员，首页只保留后台待处理事项。"
        description="管理员首页保持列表式信息架构，避免视觉噪音。"
      >
        <div className="summary-list">
          <div><span>待审核项目</span><strong>{pendingCount}</strong></div>
          <div><span>项目总数</span><strong>{summary?.project_count ?? "--"}</strong></div>
          <div><span>失败链记录</span><strong>{failedCount}</strong></div>
          <div><span>总拨付额</span><strong>{formatMoney(summary?.total_disbursed ?? 0)}</strong></div>
        </div>
      </WorkspaceIntro>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="panel">
        <div className="section-head">
          <h3>后台模块</h3>
        </div>
        <NavList
          items={[
            { title: "项目审核", description: "优先处理申请者提交的待审核项目。", to: "/admin/projects", label: "进入项目审核" },
            { title: "资金拨付", description: "单独登记和管理项目拨付。", to: "/admin/disbursements", label: "进入资金拨付" },
            { title: "链记录管理", description: "查看失败记录并执行重试。", to: "/admin/chain-records", label: "进入链记录管理" },
            { title: "操作日志", description: "查看后台操作轨迹和审计记录。", to: "/admin/logs", label: "进入操作日志" }
          ]}
        />
      </section>
    </div>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const [summary, setSummary] = useState(null);
  const [myDonationData, setMyDonationData] = useState(null);
  const [applicationData, setApplicationData] = useState(null);
  const [pendingProjects, setPendingProjects] = useState(null);
  const [chainRecords, setChainRecords] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    if (loading) return;

    if (!user) {
      apiFetch("/api/chain/summary").then(setSummary).catch((err) => setError(err.message));
      return;
    }

    if (user.role === "admin") {
      Promise.all([
        apiFetch("/api/chain/summary"),
        apiFetch("/api/projects/admin/list?page=1&pageSize=6&approvalStatus=pending"),
        apiFetch("/api/chain/records?page=1&pageSize=10")
      ])
        .then(([summaryData, pendingData, chainData]) => {
          setSummary(summaryData);
          setPendingProjects(pendingData);
          setChainRecords(chainData);
        })
        .catch((err) => setError(err.message));
      return;
    }

    if (user.role === "applicant") {
      apiFetch("/api/projects/my-applications?page=1&pageSize=6").then(setApplicationData).catch((err) => setError(err.message));
      return;
    }

    Promise.all([apiFetch("/api/chain/summary"), apiFetch("/api/donations/my?page=1&pageSize=6")])
      .then(([summaryData, donationData]) => {
        setSummary(summaryData);
        setMyDonationData(donationData);
      })
      .catch((err) => setError(err.message));
  }, [user, loading]);

  if (loading) {
    return <section className="panel">正在加载首页...</section>;
  }

  if (!user) return <GuestHome summary={summary} error={error} />;
  if (user.role === "admin") return <AdminHome summary={summary} pendingProjects={pendingProjects} chainRecords={chainRecords} error={error} />;
  if (user.role === "applicant") return <ApplicantHome applicationData={applicationData} error={error} />;
  return <DonorHome summary={summary} myDonationData={myDonationData} error={error} />;
}
