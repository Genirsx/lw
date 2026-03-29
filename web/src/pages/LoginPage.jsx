import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const demoAccounts = [
    { label: "管理员", email: "admin@example.com", password: "Admin123456" },
    { label: "普通用户", email: "donor@example.com", password: "Donor123456" },
    { label: "项目申请者", email: "applicant@example.com", password: "Applicant123456" }
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="auth-panel panel narrow-panel">
      <div className="section-head">
        <h3>登录系统</h3>
        <p>捐赠者可提交捐赠，项目申请者可提交项目申请，管理员负责审核上线和登记拨付。</p>
      </div>
      <div className="list-shell">
        {demoAccounts.map((account) => (
          <div className="list-row" key={account.email}>
            <div>
              <strong>{account.label}</strong>
              <p>
                {account.email} / {account.password}
              </p>
            </div>
            <div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setForm({ email: account.email, password: account.password })}
              >
                一键填充
              </button>
            </div>
          </div>
        ))}
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          邮箱
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="admin@example.com"
          />
        </label>
        <label>
          密码
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="请输入密码"
          />
        </label>
        {error ? <div className="alert error">{error}</div> : null}
        <button className="primary-button" type="submit">
          登录
        </button>
      </form>
    </section>
  );
}
