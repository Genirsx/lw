import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await register(form.username, form.email, form.password);
      setMessage("注册成功，请前往登录。");
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="auth-panel panel narrow-panel">
      <div className="section-head">
        <h3>注册账号</h3>
        <p>注册后可提交捐赠并查询自己的上链记录。</p>
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          用户名
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label>
          邮箱
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          密码
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        {error ? <div className="alert error">{error}</div> : null}
        {message ? <div className="alert success">{message}</div> : null}
        <button className="primary-button" type="submit">
          创建账号
        </button>
      </form>
    </section>
  );
}
