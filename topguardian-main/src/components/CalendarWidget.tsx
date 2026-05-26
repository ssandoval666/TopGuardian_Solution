import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Check, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAppointmentsByDate,
  getTodayPendingCount,
  markCompleted,
  seedDemoData,
  type Appointment,
} from "@/services/calendarService";

const CalendarWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const today = new Date().toISOString().split("T")[0];

  const refresh = useCallback(() => {
    if (!user) return;
    seedDemoData(user.id);
    setAppointments(getAppointmentsByDate(user.id, today));
    setPendingCount(getTodayPendingCount(user.id));
  }, [user, today]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleComplete = (id: string) => {
    markCompleted(id);
    refresh();
  };

  const isPast = (time: string) => {
    const now = new Date();
    const [h, m] = time.split(":").map(Number);
    return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  };

  const pendingAppointments = appointments.filter((a) => !a.completed);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-24 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center hover:scale-105 active:scale-95"
      >
        <CalendarDays className="h-6 w-6" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center animate-pulse">
            {pendingCount}
          </span>
        )}
      </button>

      {/* Popup */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed bottom-24 right-20 z-50 w-80 max-h-[28rem] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-primary/5">
              <h3 className="font-semibold text-card-foreground text-sm">
                📅 Citas de hoy
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>

            {/* Appointments list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {pendingAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  🎉 No tenés citas pendientes hoy
                </div>
              ) : (
                pendingAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-start gap-3 p-3 rounded-xl bg-background border border-border/50 hover:border-border transition-colors"
                  >
                    {/* Status indicator */}
                    <div className="mt-1 flex-shrink-0">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          isPast(appt.startTime) ? "bg-destructive" : "bg-green-500"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-card-foreground truncate">
                        {appt.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {appt.startTime} - {appt.endTime}
                      </p>
                    </div>
                    <button
                      onClick={() => handleComplete(appt.id)}
                      className="flex-shrink-0 h-7 w-7 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 flex items-center justify-center transition-colors"
                      title="Marcar como cumplida"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <button
              onClick={() => {
                setOpen(false);
                navigate("/dashboard/calendario");
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 border-t border-border text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              Ir al Calendario
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default CalendarWidget;
