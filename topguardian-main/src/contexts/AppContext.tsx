import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { 
  LayoutDashboard, Users, BarChart3, Settings, ShoppingCart, FileText, 
  Building2, GraduationCap, Shield, Map, ClipboardCheck, ClipboardList, 
  CalendarDays, type LucideIcon 
} from "lucide-react";
import { apiFetchCompanies, apiFetchMenu, type Company, type MenuItemRaw } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

// Mapa de iconos disponibles
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  ShoppingCart,
  FileText,
  Building2,
  GraduationCap,
  Shield,
  Map,
  ClipboardCheck,
  ClipboardList,
  CalendarDays,
};

export interface MenuItem {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
  children?: MenuItem[];
  isParent?: boolean; // Indica si es un contenedor (sin path directo)
}

export type { Company };

interface AppContextType {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company) => void;
  menuItems: MenuItem[];
  isLoadingMenu: boolean;
  refreshMenu: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

/**
 * Deduplicar items del menú por ID
 * Mantiene la primera ocurrencia de cada ID
 */
const deduplicateMenuItems = (items: MenuItemRaw[]): MenuItemRaw[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

/**
 * Convertir MenuItemRaw a MenuItem
 * Mapea iconos string a componentes LucideIcon
 * Marca items padre (sin path) y deduplica children
 */
const transformMenuItems = (items: MenuItemRaw[]): MenuItem[] => {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    path: item.path,
    icon: iconMap[item.icon] || LayoutDashboard,
    isParent: !item.path || item.path === "", // Es padre si no tiene path
    children: item.children && item.children.length > 0 
      ? transformMenuItems(deduplicateMenuItems(item.children))
      : undefined,
  }));
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);

  // Función para cargar y transformar menú desde API
  const loadMenu = useCallback(async () => {
    if (!selectedCompany || !user) return;
    
    setIsLoadingMenu(true);
    try {
      const raw = await apiFetchMenu(selectedCompany.id, user.id);
      // Deduplicar items del nivel raíz
      const deduplicated = deduplicateMenuItems(raw);
      // Transformar y convertir iconos
      const transformed = transformMenuItems(deduplicated);
      setMenuItems(transformed);
    } catch (error) {
      console.error("Error loading menu:", error);
      setMenuItems([]);
    } finally {
      setIsLoadingMenu(false);
    }
  }, [selectedCompany, user]);

  // Función pública para refrescar el menú
  const refreshMenu = useCallback(async () => {
    await loadMenu();
  }, [loadMenu]);

  // Cargar empresas desde API
  useEffect(() => {
    if (!user) return;
    apiFetchCompanies(user.id).then((data) => {
      setCompanies(data);
      const stored = localStorage.getItem("selected_company");
      const initial = stored ? data.find((c) => c.id === stored) || data[0] : data[0];
      if (initial) setSelectedCompanyState(initial);
    });
  }, [user]);

  // Cargar menú inicialmente
  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const setSelectedCompany = useCallback((company: Company) => {
    localStorage.setItem("selected_company", company.id);
    setSelectedCompanyState(company);
  }, []);

  return (
    <AppContext.Provider value={{ companies, selectedCompany, setSelectedCompany, menuItems, isLoadingMenu, refreshMenu }}>
      {children}
    </AppContext.Provider>
  );
};
