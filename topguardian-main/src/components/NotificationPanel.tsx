import { useState, useEffect } from "react";
import { Bell, X, Check, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetchCompanyTrainingAlerts, type CompanyTraining } from "@/services/companyTrainingApi";
import { useApp } from "@/contexts/AppContext";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "warning" | "error";
}

const alertToNotification = (a: CompanyTraining): Notification => ({
  id: `alert-${a.id}`,
  title: a.status === "expired" ? "Capacitación vencida" : "Próxima a vencer",
  message: `${a.trainingTitle} — Empresa: ${a.companyName} — vence el ${a.dueDate ?? "—"}`,
  time: a.status === "expired" ? "Venció" : "Próxima a vencer",
  read: false,
  type: a.status === "expired" ? "error" : "warning",
});

const NotificationPanel = () => {
  const { selectedCompany } = useApp();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!selectedCompany) return;
    apiFetchCompanyTrainingAlerts(selectedCompany.id).then((alerts) => {
      const alertNotifs = alerts.map(alertToNotification);
      setNotifications(alertNotifs);
    });
  }, [selectedCompany]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const typeIcon = (type: Notification["type"]) => {
    if (type === "error") return <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />;
    if (type === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />;
    return <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />;
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative text-sidebar-foreground hover:bg-sidebar-accent"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-notification-badge text-[10px] font-bold text-notification-badge-foreground">
            {unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border border-border bg-card shadow-xl animate-slide-in-right">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display font-semibold text-card-foreground">Notificaciones</h3>
              <div className="flex gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs text-primary h-7" onClick={markAllRead}>
                    <Check className="h-3 w-3 mr-1" /> Leer todo
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Sin notificaciones</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 border-b border-border last:border-0 transition-colors ${
                      n.read ? "bg-card" : n.type === "error" ? "bg-destructive/5" : n.type === "warning" ? "bg-yellow-50 dark:bg-yellow-900/10" : "bg-primary/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read ? typeIcon(n.type) : <span className="w-4 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationPanel;
