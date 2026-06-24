import { Routes, Route, Navigate } from "react-router-dom";
import Shell from "@/components/Shell";
import { RequireAuth } from "@/components/RequireAuth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import SwaggerUpload from "@/pages/SwaggerUpload";
import Collections from "@/pages/Collections";
import Automation from "@/pages/Automation";
import LoadTest from "@/pages/LoadTest";
import Runs from "@/pages/Runs";
import Vault from "@/pages/Vault";
import Mocks from "@/pages/Mocks";
import AIAssist from "@/pages/AIAssist";
import Reports from "@/pages/Reports";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Shell /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="swagger" element={<SwaggerUpload />} />
        <Route path="collections" element={<Collections />} />
        <Route path="automation" element={<Automation />} />
        <Route path="loadtest" element={<LoadTest />} />
        <Route path="runs" element={<Runs />} />
        <Route path="vault" element={<Vault />} />
        <Route path="mocks" element={<Mocks />} />
        <Route path="ai" element={<AIAssist />} />
        <Route path="reports" element={<Reports />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
