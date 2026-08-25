import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./features/auth/LoginPage";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { SetPasswordPage } from "./features/auth/SetPasswordPage";
import { RequireAuth } from "./features/auth/RequireAuth";
import { AppShell } from "./features/layout/AppShell";
import { PlaceholderPage } from "./features/layout/PlaceholderPage";
import { WorklistPage } from "./features/worklist/WorklistPage";
import { LeadDetailPage } from "./features/leadDetail/LeadDetailPage";
import { UsersListPage } from "./features/users/UsersListPage";
import { AddUserPage } from "./features/users/AddUserPage";
import { UserDetailPage } from "./features/users/UserDetailPage";
import { TeamsPage } from "./features/teams/TeamsPage";
import { OrganizationPage } from "./features/organization/OrganizationPage";
import { AccessProfilesPage } from "./features/access/AccessProfilesPage";
import { AccessProfileDetailPage } from "./features/access/AccessProfileDetailPage";
import { PermissionCatalogPage } from "./features/access/PermissionCatalogPage";
import { PolicyVersionsPage } from "./features/access/PolicyVersionsPage";
import { AccessAuditLogPage } from "./features/access/AccessAuditLogPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { SourcesListPage } from "./features/sources/SourcesListPage";
import { SourceFormPage } from "./features/sources/SourceFormPage";
import { ALL_NAV_ITEMS } from "./features/layout/navConfig";

// Every sidebar item beyond Worklist, User Management (Users/Teams/
// Organization), Access Management, and Lead Management > Sources is a
// placeholder route this phase. Generated from the same navConfig the
// sidebar renders from (children flattened), so a new nav entry always has
// a route.
const BUILT_PATHS = [
  "/worklist",
  "/manager/users",
  "/manager/teams",
  "/manager/organization",
  "/manager/access/profiles",
  "/manager/access/permissions",
  "/manager/access/versions",
  "/manager/access/audit-log",
  "/manager/leads/sources",
];
const PLACEHOLDER_ITEMS = ALL_NAV_ITEMS.filter((item) => !BUILT_PATHS.includes(item.path));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/reset-password" element={<SetPasswordPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/worklist" replace />} />
          <Route path="/worklist" element={<WorklistPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/manager/users" element={<UsersListPage />} />
          <Route path="/manager/users/new" element={<AddUserPage />} />
          <Route path="/manager/users/:id" element={<UserDetailPage />} />
          <Route path="/manager/teams" element={<TeamsPage />} />
          <Route path="/manager/organization" element={<OrganizationPage />} />
          <Route path="/manager/access/profiles" element={<AccessProfilesPage />} />
          <Route path="/manager/access/profiles/:id" element={<AccessProfileDetailPage />} />
          <Route path="/manager/access/permissions" element={<PermissionCatalogPage />} />
          <Route path="/manager/access/versions" element={<PolicyVersionsPage />} />
          <Route path="/manager/access/audit-log" element={<AccessAuditLogPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/manager/leads/sources" element={<SourcesListPage />} />
          <Route path="/manager/leads/sources/new" element={<SourceFormPage />} />
          <Route path="/manager/leads/sources/:id" element={<SourceFormPage />} />
          {PLACEHOLDER_ITEMS.map((item) => (
            <Route key={item.path} path={item.path} element={<PlaceholderPage title={item.label} />} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/worklist" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
