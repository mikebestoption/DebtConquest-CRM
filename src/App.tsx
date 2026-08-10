import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./features/auth/LoginPage";
import { RequireAuth } from "./features/auth/RequireAuth";
import { AppShell } from "./features/layout/AppShell";
import { PlaceholderPage } from "./features/layout/PlaceholderPage";
import { WorklistPage } from "./features/worklist/WorklistPage";
import { LeadDetailPage } from "./features/leadDetail/LeadDetailPage";
import { MENU_NAV, MANAGER_NAV } from "./features/layout/navConfig";

// Every sidebar item beyond Worklist is a placeholder route this phase -
// see the plan's "Scope for this pass" note. Generated from the same
// navConfig the sidebar renders from, so a new nav entry always has a route.
const PLACEHOLDER_ITEMS = [...MENU_NAV, ...MANAGER_NAV].filter((item) => item.path !== "/worklist");

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
          {PLACEHOLDER_ITEMS.map((item) => (
            <Route key={item.path} path={item.path} element={<PlaceholderPage title={item.label} />} />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/worklist" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
