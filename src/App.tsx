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
import { ALL_NAV_ITEMS } from "./features/layout/navConfig";

// Every sidebar item beyond Worklist and User Management > Users is a
// placeholder route this phase. Generated from the same navConfig the
// sidebar renders from (children flattened), so a new nav entry always has
// a route.
const BUILT_PATHS = ["/worklist", "/manager/users"];
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
          {PLACEHOLDER_ITEMS.map((item) => (
            <Route key={item.path} path={item.path} element={<PlaceholderPage title={item.label} />} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/worklist" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
