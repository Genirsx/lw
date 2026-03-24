import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

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
        <p>普通用户可提交捐赠，管理员可发布项目和登记拨付。</p>
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
      <div className="hint-text">
        演示账号：管理员 `admin@example.com / Admin123456`，普通用户 `donor@example.com / Donor123456`
      </div>
    </section>
  );
}
