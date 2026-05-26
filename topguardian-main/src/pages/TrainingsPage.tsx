import { useState, useEffect, useCallback, useMemo } from "react";
import {
  apiFetchTrainingList,
  apiCreateTraining,
  apiUpdateTraining,
  apiDeleteTraining,
  type Training,
  type RecurrenceType,
} from "@/services/trainingApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Plus, Pencil, Trash2, Loader2, GraduationCap, FileUp, FileText, RefreshCw, ImagePlus } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 5;

type TrainingForm = {
  title: string;
  description: string;
  instructor: string;
  date: string;
  duration: string;
  recurrence: RecurrenceType;
  pdfFileName?: string;
  pdfData?: number[];
  thumbnailFileName?: string;
  thumbnailData?: number[];
};

const emptyForm: TrainingForm = {
  title: "",
  description: "",
  instructor: "",
  date: "",
  duration: "",
  recurrence: "none",
};

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  none: "Sin repetición",
  monthly: "Mensual",
  yearly: "Anual",
};

const TrainingsPage = () => {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [form, setForm] = useState<TrainingForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Training | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadTrainings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetchTrainingList({ page, pageSize: PAGE_SIZE, search: search || undefined });
      setTrainings(res.data);
      setTotal(res.total);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadTrainings();
  }, [loadTrainings]);

  const handleSearch = () => {
    setPage(1);
    loadTrainings();
  };

  const openCreate = () => {
    setEditingTraining(null);
    setForm(emptyForm);
    setThumbnailPreview(null);
    setDialogOpen(true);
  };

  const openEdit = (training: Training) => {
    setEditingTraining(training);
    setForm({
      title: training.title,
      description: training.description,
      instructor: training.instructor,
      date: training.date,
      duration: training.duration,
      recurrence: training.recurrence,
      pdfFileName: training.pdfFileName,
      pdfData: training.pdfData,
      thumbnailFileName: training.thumbnailFileName,
      thumbnailData: training.thumbnailData,
    });
    // Generate preview from existing data
    if (training.thumbnailData && training.thumbnailData.length > 0) {
      const blob = new Blob([new Uint8Array(training.thumbnailData)]);
      setThumbnailPreview(URL.createObjectURL(blob));
    } else {
      setThumbnailPreview(null);
    }
    setDialogOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Solo se permiten archivos PDF");
      e.target.value = "";
      return;
    }
    const buffer = await file.arrayBuffer();
    const byteArray = Array.from(new Uint8Array(buffer));
    setForm((prev) => ({ ...prev, pdfFileName: file.name, pdfData: byteArray }));
    toast.success(`Archivo "${file.name}" cargado (${byteArray.length} bytes)`);
  };

  const handleThumbnailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten archivos de imagen");
      e.target.value = "";
      return;
    }
    const buffer = await file.arrayBuffer();
    const byteArray = Array.from(new Uint8Array(buffer));
    setForm((prev) => ({ ...prev, thumbnailFileName: file.name, thumbnailData: byteArray }));
    setThumbnailPreview(URL.createObjectURL(file));
    toast.success(`Imagen "${file.name}" cargada`);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.instructor.trim()) {
      toast.error("Título e Instructor son obligatorios");
      return;
    }
    setIsSaving(true);
    try {
      if (editingTraining) {
        await apiUpdateTraining(editingTraining.id, form);
        toast.success("Capacitación actualizada");
      } else {
        await apiCreateTraining(form);
        toast.success("Capacitación creada");
      }
      setDialogOpen(false);
      loadTrainings();
    } catch {
      toast.error("Error al guardar la capacitación");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiDeleteTraining(deleteTarget.id);
      toast.success("Capacitación eliminada");
      setDeleteTarget(null);
      loadTrainings();
    } catch {
      toast.error("Error al eliminar la capacitación");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Capacitaciones</h1>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Capacitación
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título o instructor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button variant="secondary" onClick={handleSearch} className="gap-2">
          <Search className="h-4 w-4" />
          Buscar
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thumbnail</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Instructor</TableHead>
              <TableHead className="hidden md:table-cell">Fecha</TableHead>
              <TableHead className="hidden md:table-cell">Duración</TableHead>
              <TableHead className="hidden lg:table-cell">Repetición</TableHead>
              <TableHead className="hidden lg:table-cell">PDF</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : trainings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  No se encontraron capacitaciones
                </TableCell>
              </TableRow>
            ) : (
              trainings.map((t) => {
                const thumbUrl = t.thumbnailData && t.thumbnailData.length > 0
                  ? URL.createObjectURL(new Blob([new Uint8Array(t.thumbnailData)], { type: "image/png" }))
                  : null;
                return (
                <TableRow key={t.id}>
                  <TableCell>
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={t.title}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{t.title}</TableCell>
                  <TableCell className="text-muted-foreground">{t.instructor}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{t.date || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{t.duration || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {t.recurrence !== "none" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        <RefreshCw className="h-3 w-3" />
                        {RECURRENCE_LABELS[t.recurrence]}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {t.pdfFileName ? (
                      <span className="flex items-center gap-1 text-xs">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        {t.pdfFileName}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(t)} title="Eliminar" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTraining ? "Editar Capacitación" : "Nueva Capacitación"}</DialogTitle>
            <DialogDescription>
              {editingTraining ? "Modificá los datos de la capacitación." : "Completá los datos para registrar una nueva capacitación."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Thumbnail */}
            <div className="space-y-2">
              <Label>Imagen (Thumbnail)</Label>
              <div className="flex items-center gap-4">
                {thumbnailPreview ? (
                  <img src={thumbnailPreview} alt="Thumbnail" className="h-16 w-16 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center border border-border">
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <label className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors">
                  <ImagePlus className="h-4 w-4" />
                  Seleccionar imagen
                  <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailChange} />
                </label>
              </div>
              {form.thumbnailFileName && (
                <p className="text-xs text-muted-foreground">{form.thumbnailFileName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título de la capacitación" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="instructor">Instructor *</Label>
                <Input id="instructor" value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} placeholder="Nombre del instructor" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input id="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duración</Label>
                <Input id="duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Ej: 4 horas" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurrence">Repetición</Label>
                <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v as RecurrenceType })}>
                  <SelectTrigger id="recurrence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin repetición</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Archivo PDF</Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors">
                  <FileUp className="h-4 w-4" />
                  Seleccionar PDF
                  <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileChange} />
                </label>
                {form.pdfFileName && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    {form.pdfFileName}
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTraining ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar capacitación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la capacitación <strong>{deleteTarget?.title}</strong> de forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrainingsPage;
