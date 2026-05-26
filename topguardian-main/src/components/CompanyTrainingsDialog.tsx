import { useState, useEffect } from "react";
import { apiFetchAllTrainings, type Training } from "@/services/trainingApi";
import {
  apiFetchCompanyTrainings,
  apiAssignTrainingToCompany,
  apiUnassignCompanyTraining,
  apiMarkCompanyTrainingCompleted,
  type CompanyTraining,
} from "@/services/companyTrainingApi";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, CheckCircle2, AlertTriangle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  completed: { label: "Cumplida", variant: "default", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  pending: { label: "Pendiente", variant: "secondary", icon: <Clock className="h-3.5 w-3.5" /> },
  expired: { label: "Vencida", variant: "destructive", icon: <XCircle className="h-3.5 w-3.5" /> },
  expiring_soon: { label: "Por vencer", variant: "outline", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
};

const CompanyTrainingsDialog = ({ open, onOpenChange, companyId, companyName }: Props) => {
  const [allTrainings, setAllTrainings] = useState<Training[]>([]);
  const [assigned, setAssigned] = useState<CompanyTraining[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("assigned");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [trainings, companyTrainings] = await Promise.all([
        apiFetchAllTrainings(),
        apiFetchCompanyTrainings(companyId),
      ]);
      setAllTrainings(trainings);
      setAssigned(companyTrainings);
    } catch {
      toast.error("Error al cargar capacitaciones");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
      setSearch("");
      setTab("assigned");
    }
  }, [open, companyId]);

  const assignedTrainingIds = assigned.map((a) => a.trainingId);

  const unassignedTrainings = allTrainings.filter(
    (t) => !assignedTrainingIds.includes(t.id)
  );

  const filteredUnassigned = search
    ? unassignedTrainings.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
    : unassignedTrainings;

  const filteredAssigned = search
    ? assigned.filter((a) => a.trainingTitle.toLowerCase().includes(search.toLowerCase()))
    : assigned;

  const handleAssign = async (training: Training) => {
    setIsSaving(true);
    try {
      await apiAssignTrainingToCompany({
        companyId,
        companyName,
        trainingId: training.id,
        trainingTitle: training.title,
        assignedDate: format(new Date(), "yyyy-MM-dd"),
        recurrence: training.recurrence,
      });
      toast.success(`"${training.title}" asignada`);
      await loadData();
    } catch {
      toast.error("Error al asignar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnassign = async (id: string) => {
    setIsSaving(true);
    try {
      await apiUnassignCompanyTraining(id);
      toast.success("Capacitación desasignada");
      await loadData();
    } catch {
      toast.error("Error al desasignar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkCompleted = async (id: string) => {
    setIsSaving(true);
    try {
      await apiMarkCompanyTrainingCompleted(id, format(new Date(), "yyyy-MM-dd"));
      toast.success("Marcada como cumplida");
      await loadData();
    } catch {
      toast.error("Error al marcar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Capacitaciones — {companyName}</DialogTitle>
          <DialogDescription>
            Asigná y gestioná las capacitaciones que debe realizar esta empresa.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar capacitación..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="assigned">
                  Asignadas ({assigned.length})
                </TabsTrigger>
                <TabsTrigger value="catalog">
                  Catálogo ({unassignedTrainings.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="assigned" className="flex-1 min-h-0 mt-2">
                <div className="max-h-60 overflow-y-auto border border-border rounded-md divide-y divide-border">
                  {filteredAssigned.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">
                      No hay capacitaciones asignadas
                    </p>
                  ) : (
                    filteredAssigned.map((a) => {
                      const cfg = statusConfig[a.status] || statusConfig.pending;
                      return (
                        <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {a.trainingTitle}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={cfg.variant} className="gap-1 text-xs">
                                {cfg.icon} {cfg.label}
                              </Badge>
                              {a.dueDate && (
                                <span className="text-xs text-muted-foreground">
                                  Vence: {a.dueDate}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {a.status !== "completed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkCompleted(a.id)}
                                disabled={isSaving}
                                title="Marcar cumplida"
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnassign(a.id)}
                              disabled={isSaving}
                              title="Desasignar"
                              className="text-destructive hover:text-destructive"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              <TabsContent value="catalog" className="flex-1 min-h-0 mt-2">
                <div className="max-h-60 overflow-y-auto border border-border rounded-md divide-y divide-border">
                  {filteredUnassigned.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">
                      {unassignedTrainings.length === 0
                        ? "Todas las capacitaciones ya están asignadas"
                        : "No se encontraron capacitaciones"}
                    </p>
                  ) : (
                    filteredUnassigned.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {t.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t.instructor} · {t.duration}
                            {t.recurrence !== "none" && ` · ${t.recurrence === "monthly" ? "Mensual" : "Anual"}`}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssign(t)}
                          disabled={isSaving}
                        >
                          Asignar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompanyTrainingsDialog;
