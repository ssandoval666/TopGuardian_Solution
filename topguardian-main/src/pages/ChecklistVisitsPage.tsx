import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import {
  apiFetchChecklistVisits,
  apiFetchChecklistItems,
  apiCreateChecklistVisit,
  apiUpdateChecklistVisit,
  apiDeleteChecklistVisit,
  type ChecklistVisit,
  type ChecklistEntry,
  type ChecklistItem,
} from "@/services/checklistApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  ChevronLeft,
  Loader2,
  ClipboardCheck,
  Pencil,
  Calendar,
  FileDown,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ChecklistVisitsPage = () => {
  const { companies } = useApp();
  const { toast } = useToast();

  const [visits, setVisits] = useState<ChecklistVisit[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected visit for editing
  const [selectedVisit, setSelectedVisit] = useState<ChecklistVisit | null>(null);
  const [editEntries, setEditEntries] = useState<ChecklistEntry[]>([]);

  // New visit dialog
  const [showNew, setShowNew] = useState(false);
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newEntries, setNewEntries] = useState<ChecklistEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deletingVisit, setDeletingVisit] = useState<ChecklistVisit | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [items, allVisits] = await Promise.all([
        apiFetchChecklistItems(),
        apiFetchChecklistVisits(),
      ]);
      setChecklistItems(items);
      // Mapeamos los datos del backend (snake_case) al formato que espera el frontend (camelCase)
      setVisits(allVisits.map((v: any) => ({
        ...v,
        companyId: String(v.companyId || v.company_id),
        companyName: v.companyName || v.company_name,
        visitDate: v.visitDate || v.visit_date,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getApprovalPercent = (visit: ChecklistVisit) => {
    if (visit.entries.length === 0) return 0;
    const approved = visit.entries.filter((e) => e.compliant === true || e.compliant === null).length;
    return Math.round((approved / visit.entries.length) * 100);
  };

  const openNewDialog = () => {
    setNewCompanyId(companies[0]?.id || "");
    setNewDate(new Date().toISOString().split("T")[0]);
    setNewEntries(
      checklistItems.map((ci) => ({
        itemId: ci.id,
        itemName: ci.name,
        compliant: null,
        observations: "",
      }))
    );
    setShowNew(true);
  };

  const handleCreate = async () => {
    if (!newCompanyId || !newDate) return;
    const company = companies.find((c) => c.id === newCompanyId);
    setIsSaving(true);
    try {
      await apiCreateChecklistVisit({
        companyId: newCompanyId,
        companyName: company?.name || "",
        visitDate: newDate,
        entries: newEntries,
      });
      await loadData();
      setShowNew(false);
      toast({ title: "Visita creada" });
    } catch (error: any) {
      toast({
        title: "Error al crear",
        description: error.message || "Ocurrió un error en el servidor.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (visit: ChecklistVisit) => {
    setSelectedVisit(visit);
    setEditEntries(visit.entries.map((e) => ({ ...e })));
  };

  const handleSaveEdit = async () => {
    if (!selectedVisit) return;
    setIsSaving(true);
    try {
      const updatedVisit = await apiUpdateChecklistVisit(selectedVisit.id, { entries: editEntries });
      // Mapeamos también la respuesta de actualización para no perder los datos en la vista local
      const mappedUpdatedVisit = {
        ...updatedVisit,
        companyId: String(updatedVisit.companyId || (updatedVisit as any).company_id),
        companyName: updatedVisit.companyName || (updatedVisit as any).company_name,
        visitDate: updatedVisit.visitDate || (updatedVisit as any).visit_date,
      };
      // Optimización: En lugar de recargar todo, actualizamos solo la visita modificada en el estado local.
      setVisits(prevVisits => 
        prevVisits.map(v => v.id === mappedUpdatedVisit.id ? mappedUpdatedVisit : v)
      );
      setSelectedVisit(null);
      toast({ title: "Visita actualizada" });
    } catch (error: any) {
      toast({
        title: "Error al actualizar",
        description: error.message || "No se pudo actualizar la visita.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingVisit) return;
    try {
      await apiDeleteChecklistVisit(deletingVisit.id);
      await loadData();
      setDeletingVisit(null);
      toast({ title: "Visita eliminada" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleExportPDF = (visit: ChecklistVisit) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Check List de Visita", pageWidth / 2, 20, { align: "center" });

    // Company & date
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Empresa: ${visit.companyName}`, 14, 35);
    doc.text(`Fecha de visita: ${visit.visitDate}`, 14, 42);

    // Approval summary
    const totalEntries = visit.entries.length;
    const approved = visit.entries.filter((e) => e.compliant === true || e.compliant === null).length;
    const pct = totalEntries > 0 ? Math.round((approved / totalEntries) * 100) : 0;
    doc.text(`Aprobación: ${approved}/${totalEntries} ítems (${pct}%)`, 14, 49);

    // Table
    const tableData = visit.entries.map((e) => [
      e.itemName,
      e.compliant === true ? "X" : "",
      e.compliant === false ? "X" : "",
      e.compliant === null ? "X" : "",
      e.observations || "-",
    ]);

    autoTable(doc, {
      startY: 56,
      head: [["Tópico", "Cumple", "No Cumple", "No Aplica", "Observaciones"]],
      body: tableData,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", halign: "center" },
      columnStyles: {
        0: { cellWidth: 70, halign: "left" },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 25, halign: "center" },
        4: { cellWidth: "auto", halign: "left" },
      },
      didParseCell: (data) => {
        if (data.section === "body") {
          if (data.column.index === 1 && data.cell.text[0] === "X") data.cell.styles.textColor = [39, 174, 96];
          if (data.column.index === 2 && data.cell.text[0] === "X") data.cell.styles.textColor = [231, 76, 60];
          if (data.column.index === 3 && data.cell.text[0] === "X") data.cell.styles.textColor = [149, 165, 166];
        }
      },
    });

    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generado el ${new Date().toLocaleDateString()}`, 14, finalY + 10);

    doc.save(`checklist_${visit.companyName.replace(/\s+/g, "_")}_${visit.visitDate}.pdf`);
  };

  // EDIT VIEW
  if (selectedVisit) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedVisit(null)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Check List — {selectedVisit.companyName}
              </h1>
              <p className="text-sm text-muted-foreground">
                Fecha de visita: {selectedVisit.visitDate}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => handleExportPDF(selectedVisit)}>
            <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Tópico</TableHead>
                    <TableHead className="w-[120px] text-center">Cumple</TableHead>
                    <TableHead className="w-[120px] text-center">No Cumple</TableHead>
                    <TableHead className="w-[100px] text-center">No Aplica</TableHead>
                    <TableHead className="min-w-[200px]">Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editEntries.map((entry, idx) => (
                    <TableRow key={entry.itemId}>
                      <TableCell className="font-medium text-sm">{entry.itemName}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={entry.compliant === true}
                          onCheckedChange={() => {
                            const updated = [...editEntries];
                            updated[idx] = { ...updated[idx], compliant: true };
                            setEditEntries(updated);
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={entry.compliant === false}
                          onCheckedChange={() => {
                            const updated = [...editEntries];
                            updated[idx] = { ...updated[idx], compliant: false };
                            setEditEntries(updated);
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={entry.compliant === null}
                          onCheckedChange={() => {
                            const updated = [...editEntries];
                            updated[idx] = { ...updated[idx], compliant: null };
                            setEditEntries(updated);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.observations}
                          onChange={(e) => {
                            const updated = [...editEntries];
                            updated[idx] = { ...updated[idx], observations: e.target.value };
                            setEditEntries(updated);
                          }}
                          placeholder="Observaciones..."
                          className="h-8"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setSelectedVisit(null)}>Cancelar</Button>
          <Button onClick={handleSaveEdit} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Check Lista Visitas
          </h1>
          <p className="text-muted-foreground mt-1">
            Control de visitas y cumplimiento por empresa
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" /> Nueva Visita
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : visits.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 mb-4 opacity-50" />
            <p>No hay visitas registradas.</p>
            <Button variant="outline" className="mt-4" onClick={openNewDialog}>
              Registrar primera visita
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visits.map((visit) => {
            const pct = getApprovalPercent(visit);
            return (
              <Card
                key={visit.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => openEdit(visit)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2 truncate">
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                      {visit.companyName}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportPDF(visit);
                        }}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingVisit(visit);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {visit.visitDate}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct >= 80 ? "hsl(var(--primary))" : pct >= 50 ? "hsl(45, 93%, 47%)" : "hsl(var(--destructive))",
                        }}
                      />
                    </div>
                    <Badge variant={pct >= 80 ? "default" : pct >= 50 ? "secondary" : "destructive"}>
                      {pct}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {visit.entries.filter((e) => e.compliant === true || e.compliant === null).length} / {visit.entries.length} ítems aprobados
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Visit Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Empresa</Label>
                <Select value={newCompanyId} onValueChange={setNewCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha de Visita</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Check List</Label>
              <div className="border border-border rounded-lg overflow-auto mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[250px]">Tópico</TableHead>
                      <TableHead className="w-[100px] text-center">Cumple</TableHead>
                      <TableHead className="w-[100px] text-center">No Cumple</TableHead>
                      <TableHead className="w-[100px] text-center">No Aplica</TableHead>
                      <TableHead className="min-w-[200px]">Observaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newEntries.map((entry, idx) => (
                      <TableRow key={entry.itemId}>
                        <TableCell className="font-medium text-sm">{entry.itemName}</TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={entry.compliant === true}
                            onCheckedChange={() => {
                              const updated = [...newEntries];
                              updated[idx] = { ...updated[idx], compliant: true };
                              setNewEntries(updated);
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={entry.compliant === false}
                            onCheckedChange={() => {
                              const updated = [...newEntries];
                              updated[idx] = { ...updated[idx], compliant: false };
                              setNewEntries(updated);
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={entry.compliant === null}
                            onCheckedChange={() => {
                              const updated = [...newEntries];
                              updated[idx] = { ...updated[idx], compliant: null };
                              setNewEntries(updated);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={entry.observations}
                            onChange={(e) => {
                              const updated = [...newEntries];
                              updated[idx] = { ...updated[idx], observations: e.target.value };
                              setNewEntries(updated);
                            }}
                            placeholder="Observaciones..."
                            className="h-8"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isSaving || !newCompanyId || !newDate}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Visita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingVisit} onOpenChange={(open) => !open && setDeletingVisit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar visita?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente la visita de "{deletingVisit?.companyName}" del {deletingVisit?.visitDate}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChecklistVisitsPage;
