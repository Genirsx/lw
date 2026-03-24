import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import MyDonationsPage from "./pages/MyDonationsPage";
import AdminPage from "./pages/AdminPage";
import VerifyPage from "./pages/VerifyPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/my-donations" element={<MyDonationsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
