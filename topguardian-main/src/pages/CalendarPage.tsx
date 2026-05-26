import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAppointmentsByMonth,
  getAppointmentsByDate,
  addAppointment,
  updateAppointment,
  deleteAppointment,
  seedDemoData,
  type Appointment,
} from "@/services/calendarService";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function generateTimeSlots() {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

const CalendarPage = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthAppointments, setMonthAppointments] = useState<Appointment[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ title: "", startTime: "09:00", endTime: "09:30", notes: "" });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const refreshMonth = () => {
    if (!user) return;
    seedDemoData(user.id);
    setMonthAppointments(getAppointmentsByMonth(user.id, year, month));
  };

  const refreshDay = (date: string) => {
    if (!user) return;
    setDayAppointments(getAppointmentsByDate(user.id, date));
  };

  useEffect(() => {
    refreshMonth();
  }, [user, year, month]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: { day: number; inMonth: boolean; dateStr: string }[] = [];
    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      days.push({ day: d, inMonth: false, dateStr: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, inMonth: true, dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }
    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      days.push({ day: d, inMonth: false, dateStr: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }
    return days;
  }, [year, month]);

  const datesWithAppts = useMemo(() => {
    const set = new Set<string>();
    monthAppointments.forEach((a) => set.add(a.date));
    return set;
  }, [monthAppointments]);

  const todayStr = new Date().toISOString().split("T")[0];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const openDay = (dateStr: string) => {
    setSelectedDay(dateStr);
    refreshDay(dateStr);
    setShowDayDialog(true);
  };

  const openAddForm = () => {
    setEditMode(false);
    setForm({ title: "", startTime: "09:00", endTime: "09:30", notes: "" });
    setShowForm(true);
  };

  const openEditForm = () => {
    if (!selectedAppt) return;
    setEditMode(true);
    setForm({
      title: selectedAppt.title,
      startTime: selectedAppt.startTime,
      endTime: selectedAppt.endTime,
      notes: selectedAppt.notes,
    });
    setShowDetail(false);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!user || !selectedDay || !form.title.trim()) return;
    if (editMode && selectedAppt) {
      updateAppointment(selectedAppt.id, {
        title: form.title,
        startTime: form.startTime,
        endTime: form.endTime,
        notes: form.notes,
      });
    } else {
      addAppointment({
        title: form.title,
        date: selectedDay,
        startTime: form.startTime,
        endTime: form.endTime,
        notes: form.notes,
        completed: false,
        userId: user.id,
      });
    }
    setShowForm(false);
    refreshDay(selectedDay);
    refreshMonth();
  };

  const handleDelete = () => {
    if (!selectedAppt || !selectedDay) return;
    deleteAppointment(selectedAppt.id);
    setShowDeleteConfirm(false);
    setShowDetail(false);
    refreshDay(selectedDay);
    refreshMonth();
  };

  const openApptDetail = (appt: Appointment) => {
    setSelectedAppt(appt);
    setShowDetail(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Calendario</h1>
      </div>

      {/* Calendar card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <button onClick={prevMonth} className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <h2 className="text-lg font-semibold text-foreground">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS.map((d) => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((cell, i) => {
            const hasAppts = datesWithAppts.has(cell.dateStr);
            const isToday = cell.dateStr === todayStr;
            return (
              <button
                key={i}
                onClick={() => cell.inMonth && openDay(cell.dateStr)}
                className={`relative h-20 md:h-24 border-b border-r border-border/50 p-2 text-left transition-colors hover:bg-primary/5 ${
                  !cell.inMonth ? "opacity-30" : ""
                } ${isToday ? "bg-primary/10" : ""}`}
                disabled={!cell.inMonth}
              >
                <span
                  className={`text-sm font-medium ${
                    isToday
                      ? "h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                      : "text-foreground"
                  }`}
                >
                  {cell.day}
                </span>
                {hasAppts && cell.inMonth && (
                  <div className="absolute bottom-2 left-2 right-2 space-y-0.5">
                    {[1, 2, 3].map((line) => (
                      <div key={line} className="h-[2px] rounded-full bg-destructive/70" />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day detail dialog */}
      <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                {selectedDay &&
                  new Date(selectedDay + "T12:00:00").toLocaleDateString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
              </span>
              <Button size="sm" variant="outline" onClick={openAddForm} className="gap-1">
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <div className="space-y-1">
              {TIME_SLOTS.filter((_, idx) => idx % 2 === 0 || dayAppointments.some((a) => a.startTime === TIME_SLOTS[idx])).slice(0, 48).map((slot) => {
                const appt = dayAppointments.find((a) => a.startTime === slot);
                return (
                  <div key={slot} className="flex items-stretch gap-3 min-h-[2.5rem]">
                    <div className="w-14 flex-shrink-0 text-xs text-muted-foreground font-mono pt-2">
                      {slot}
                    </div>
                    <div className="flex-1 border-l border-border/50 pl-3">
                      {appt ? (
                        <button
                          onClick={() => openApptDetail(appt)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            appt.completed
                              ? "bg-muted/50 text-muted-foreground line-through"
                              : "bg-primary/10 text-primary hover:bg-primary/20 font-medium"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {appt.title}
                            <span className="text-xs opacity-70">
                              ({appt.startTime}-{appt.endTime})
                            </span>
                          </div>
                        </button>
                      ) : (
                        <div className="h-px bg-border/30 mt-4" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appointment form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editMode ? "Editar Cita" : "Nueva Cita"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre de la Cita</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ej: Reunión de equipo"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hora de inicio</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div>
                <Label>Hora de fin</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notas adicionales..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment detail dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Detalle de Cita</DialogTitle>
          </DialogHeader>
          {selectedAppt && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Nombre</p>
                <p className="font-medium text-foreground">{selectedAppt.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Inicio</p>
                  <p className="font-medium text-foreground">{selectedAppt.startTime}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fin</p>
                  <p className="font-medium text-foreground">{selectedAppt.endTime}</p>
                </div>
              </div>
              {selectedAppt.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Observaciones</p>
                  <p className="text-sm text-foreground">{selectedAppt.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="gap-1" onClick={openEditForm}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button
              variant="destructive"
              className="gap-1"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cita?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{selectedAppt?.title}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CalendarPage;
