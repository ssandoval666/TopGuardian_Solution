import { useState, useCallback } from "react";
import shieldLogo from "@/assets/shield-logo.png";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApp, type MenuItem } from "@/contexts/AppContext";
import NotificationPanel from "@/components/NotificationPanel";
import ChatWidget from "@/components/ChatWidget";
import CalendarWidget from "@/components/CalendarWidget";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import {
  Menu,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  LogOut,
  Building2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Tiempo de inactividad en minutos antes de hacer logout automático
const SESSION_TIMEOUT_MINUTES = 15;

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const { companies, selectedCompany, setSelectedCompany, menuItems, isLoadingMenu } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});

  const handleLogout = useCallback(() => {
    logout();
    navigate("/");
  }, [logout, navigate]);

  // Auto-logout por inactividad
  useSessionTimeout(SESSION_TIMEOUT_MINUTES, handleLogout);

  const handleCompanyChange = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    if (company) {
      setSelectedCompany(company);
      navigate("/dashboard");
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        {!collapsed && (
          <>
            <img src={shieldLogo} alt="TopGuardian" className="h-7 w-7" />
            <h1 className="font-display font-bold text-lg text-sidebar-primary-foreground truncate">
              <span className="text-accent">Top</span>Guardian
            </h1>
          </>
        )}
        {collapsed && <img src={shieldLogo} alt="TopGuardian" className="h-7 w-7" />}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
          onClick={() => {
            setCollapsed(!collapsed);
            setMobileOpen(false);
          }}
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {isLoadingMenu ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-sidebar-muted" />
          </div>
        ) : (
          menuItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openSubMenus[item.id] || false;
            const isItemActive = location.pathname === item.path;
            const isChildActive = hasChildren && item.children.some((c) => location.pathname === c.path);
            const isAnyChildActive = isItemActive || isChildActive;

            // Items con children (expandibles/colapsables)
            if (hasChildren) {
              return (
                <div key={item.id}>
                  <button
                    onClick={() => {
                      // Si tiene path, navega; si no, solo abre/cierra
                      if (item.path) {
                        navigate(item.path);
                      }
                      setOpenSubMenus((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                    }}
                    className={`flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                      isAnyChildActive ? "text-sidebar-accent-foreground bg-sidebar-accent/50" : "text-sidebar-foreground"
                    } ${collapsed ? "justify-center" : ""}`}
                    title={collapsed ? item.label : ""}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </>
                    )}
                  </button>

                  {/* Submenu - solo se muestra si no está colapsado */}
                  {isOpen && !collapsed && (
                    <div className="ml-4 pl-3 border-l border-sidebar-border space-y-1 mt-1">
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => {
                            if (child.path) {
                              navigate(child.path);
                              setMobileOpen(false);
                            }
                          }}
                          disabled={!child.path}
                          className={`flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm transition-colors ${
                            child.path
                              ? "cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              : "cursor-default opacity-50"
                          } ${
                            location.pathname === child.path
                              ? "text-sidebar-accent-foreground bg-sidebar-accent/50 font-medium"
                              : "text-sidebar-foreground"
                          }`}
                          title={collapsed ? child.label : ""}
                        >
                          <child.icon className="h-4 w-4 flex-shrink-0" />
                          <span>{child.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // Items simples (sin children)
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.path) {
                    navigate(item.path);
                    setMobileOpen(false);
                  }
                }}
                disabled={!item.path}
                className={`flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  item.path
                    ? "cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    : "cursor-default opacity-50"
                } ${
                  isItemActive ? "text-sidebar-accent-foreground bg-sidebar-accent/50" : "text-sidebar-foreground"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? item.label : ""}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })
        )}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-[hsl(var(--page-gradient-from))] via-[hsl(var(--page-gradient-via))] to-[hsl(var(--page-gradient-to))] overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-foreground/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - desktop */}
      <aside
        className={`hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Sidebar - mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <img src={shieldLogo} alt="TopGuardian" className="h-7 w-7" />
            <h2 className="font-display font-semibold text-lg text-card-foreground">
              <span className="text-accent">Top</span>Guardian
            </h2>

            {/* Company selector */}
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select
                value={selectedCompany?.id || ""}
                onValueChange={handleCompanyChange}
              >
                <SelectTrigger className="w-[180px] h-9 border-border bg-background text-foreground">
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border z-50">
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationPanel />
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                {user?.name?.charAt(0) || "U"}
              </div>
              <span className="text-sm font-medium text-card-foreground truncate max-w-[120px]">
                {user?.name}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Widgets flotantes */}
      <CalendarWidget />
      <ChatWidget />
    </div>
  );
};

export default DashboardLayout;
