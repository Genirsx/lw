import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import ProjectsPage from "./pages/ProjectsPage";
import ChainRecordsPage from "./pages/ChainRecordsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import MyDonationsPage from "./pages/MyDonationsPage";
import MyProjectApplicationsPage from "./pages/MyProjectApplicationsPage";
import AdminPage from "./pages/AdminPage";
import AdminProjectsPage from "./pages/AdminProjectsPage";
import AdminDisbursementsPage from "./pages/AdminDisbursementsPage";
import AdminChainRecordsPage from "./pages/AdminChainRecordsPage";
import AdminLogsPage from "./pages/AdminLogsPage";
import TransactionDetailPage from "./pages/TransactionDetailPage";
import VerifyPage from "./pages/VerifyPage";

export default function App() {
  return (
    <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/chain-records" element={<ChainRecordsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/my-donations" element={<MyDonationsPage />} />
          <Route path="/my-project-applications" element={<MyProjectApplicationsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/projects" element={<AdminProjectsPage />} />
          <Route path="/admin/disbursements" element={<AdminDisbursementsPage />} />
          <Route path="/admin/chain-records" element={<AdminChainRecordsPage />} />
          <Route path="/admin/logs" element={<AdminLogsPage />} />
          <Route path="/transactions/:txHash" element={<TransactionDetailPage />} />
          <Route path="/verify" element={<VerifyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
