import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import shieldLogo from "@/assets/shield-logo.png";
import { NavLink } from "@/components/NavLink";
import { BookOpen, LogOut } from "lucide-react";

const AppSidebarContent: React.FC = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/capacitaciones"
                    end
                    className="hover:bg-sidebar-accent/50"
                    activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Capacitaciones</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

const MainLayout: React.FC = () => {
  const { isAuthenticated, logout, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full gradient-bg">
        <AppSidebarContent />
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <img src={shieldLogo} alt="TopGuardian" className="w-6 h-6 object-contain" />
                <span className="font-semibold text-foreground">TopGuardian</span>
                <span className="text-muted-foreground text-sm hidden sm:inline">Capacitaciones</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Usuario: <span className="text-foreground">{user?.username}</span>
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
