import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import LoginPage from "./pages/LoginPage";
import DashboardHome from "./pages/DashboardHome";
import CompaniesPage from "./pages/CompaniesPage";
import UsersPage from "./pages/UsersPage";
import TrainingsPage from "./pages/TrainingsPage";
import RiskMatrixPage from "./pages/RiskMatrixPage";
import PlanosPage from "./pages/PlanosPage";
import ChecklistVisitsPage from "./pages/ChecklistVisitsPage";
import ChecklistItemsPage from "./pages/ChecklistItemsPage";
import CalendarPage from "./pages/CalendarPage";
import MenuPage from "./pages/MenuPage";
import RegistroCapacitacionesPage from "./pages/RegistroCapacitacionesPage";
import SesionesActivasPage from "./pages/SesionesActivasPage";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AppProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardHome />} />
                <Route path="companies" element={<CompaniesPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="menu" element={<MenuPage />} />
                <Route path="reports" element={<DashboardHome />} />
                <Route path="settings" element={<DashboardHome />} />
                <Route path="sales" element={<DashboardHome />} />
                <Route path="docs" element={<DashboardHome />} />
                <Route path="trainings" element={<TrainingsPage />} />
                <Route path="risk-matrix" element={<RiskMatrixPage />} />
                <Route path="planos" element={<PlanosPage />} />
                <Route path="checklist-visits" element={<ChecklistVisitsPage />} />
                <Route path="checklist-items" element={<ChecklistItemsPage />} />
                <Route path="calendario" element={<CalendarPage />} />
                <Route path="registro-capacitaciones" element={<RegistroCapacitacionesPage />} />
                <Route path="sesiones-activas" element={<SesionesActivasPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AppProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
