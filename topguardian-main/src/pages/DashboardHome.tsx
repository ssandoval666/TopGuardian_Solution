import { useState, useEffect } from "react";
import { BarChart3, Users, Activity, GraduationCap } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { apiFetchCompanyTrainingStats, type CompanyTraining } from "@/services/companyTrainingApi";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { chatService } from "@/services/chatService";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))"];

const DashboardHome = () => {
  const { selectedCompany } = useApp();
  const [completed, setCompleted] = useState(0);
  const [pending, setPending] = useState(0);
  const [pendingList, setPendingList] = useState<CompanyTraining[]>([]);
  const [showPendingList, setShowPendingList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);
  const [trainingUsers, setTrainingUsers] = useState(0);

  useEffect(() => {
    if (!selectedCompany) return;
    setIsLoading(true);
    setShowPendingList(false);
    apiFetchCompanyTrainingStats(selectedCompany.id).then((res) => {
      setCompleted(res.completed);
      setPending(res.pending);
      setPendingList(res.pendingList);
    }).finally(() => setIsLoading(false));
  }, [selectedCompany]);

  // Suscripción al WebSocket para el contador de usuarios en línea
  useEffect(() => {
    const handleUpdate = () => {
      setActiveUsers(chatService.getOnlineCount());
      setTrainingUsers(chatService.getTrainingOnlineCount());
    };

    const unsubscribe = chatService.subscribe(handleUpdate);
    handleUpdate(); // Seteo inicial

    return unsubscribe;
  }, []);

  const dynamicStats = [
    { label: "Administradores", value: activeUsers.toString(), icon: Users, change: "En línea" },
    { label: "Operarios (Training)", value: trainingUsers.toString(), icon: GraduationCap, change: "Conectados ahora" },
    { label: "Reportes", value: "142", icon: BarChart3, change: "+3.1%" },
    { label: "Sesiones hoy", value: "1,024", icon: Activity, change: "+18%" },
  ];

  const pieData = [
    { name: "Cumplidas", value: completed },
    { name: "Faltantes", value: pending },
  ];

  const handlePieClick = (_: unknown, index: number) => {
    if (index === 1 && pending > 0) {
      setShowPendingList(true);
    }
  };

  const total = completed + pending;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Resumen general — {selectedCompany?.name || "Sin empresa seleccionada"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dynamicStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-display font-bold text-card-foreground">{stat.value}</p>
            <p className="text-xs text-accent font-semibold mt-1">{stat.change} vs mes anterior</p>
          </div>
        ))}
      </div>

      {/* Pie Chart - Capacitaciones */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-display font-semibold text-lg text-card-foreground mb-4">
            Capacitaciones — {selectedCompany?.name || ""}
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">Cargando...</div>
          ) : total === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No hay capacitaciones asignadas a esta empresa
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={handlePieClick}
                    cursor="pointer"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value}`, name]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <span className="text-sm text-muted-foreground">Cumplidas ({completed})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <span className="text-sm text-muted-foreground">Faltantes ({pending})</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Hacé click en "Faltantes" para ver el detalle
              </p>
            </div>
          )}
        </div>

        {/* Pending list */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-display font-semibold text-lg text-card-foreground mb-4">
            {showPendingList ? "Capacitaciones faltantes" : "Actividad reciente"}
          </h2>
          {showPendingList ? (
            <div className="space-y-3">
              {pendingList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No hay capacitaciones faltantes</p>
              ) : (
                pendingList.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                    <div className="h-2 w-2 rounded-full bg-destructive flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{t.trainingTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        Estado: {t.status === "expired" ? "Vencida" : t.status === "expiring_soon" ? "Próx. a vencer" : "Pendiente"}
                        {t.dueDate ? ` — Vence: ${t.dueDate}` : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <button
                onClick={() => setShowPendingList(false)}
                className="text-xs text-primary hover:underline mt-2"
              >
                ← Volver a actividad reciente
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {["Se completó el reporte mensual", "Nuevo usuario registrado: María López", "Actualización del sistema v2.4.1", "Backup automático realizado"].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
