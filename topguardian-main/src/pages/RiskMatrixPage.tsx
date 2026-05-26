import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import {
  apiFetchRiskMatrices,
  apiCreateRiskMatrix,
  apiSaveRiskMatrix,
  apiDeleteRiskMatrix,
  getRiskLevel,
  HAZARD_CATEGORIES,
  addHazardCategory,
  removeHazardCategory,
  type RiskMatrix,
  type RiskCell,
  type Hazard,
  type Sector,
  type RiskLevel,
} from "@/services/riskMatrixApi";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  Shield,
  ChevronLeft,
  PlusCircle,
  X,
  Loader2,
  Copy,
  FileDown,
  Pencil,
  Check,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const RISK_COLORS: Record<RiskLevel, string> = {
  trivial: "bg-green-500/80 text-green-950",
  tolerable: "bg-yellow-400/80 text-yellow-950",
  moderado: "bg-amber-500/80 text-amber-950",
  importante: "bg-orange-600/80 text-orange-50",
  intolerable: "bg-red-600/80 text-red-50",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  trivial: "Trivial",
  tolerable: "Tolerable",
  moderado: "Moderado",
  importante: "Importante",
  intolerable: "Intolerable",
};

const RiskMatrixPage = () => {
  const { companies, selectedCompany } = useApp();
  const { toast } = useToast();

  const [matrices, setMatrices] = useState<RiskMatrix[]>([]);
  const [selectedMatrix, setSelectedMatrix] = useState<RiskMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [showNewMatrix, setShowNewMatrix] = useState(false);
  const [newMatrixName, setNewMatrixName] = useState("");
  const [newMatrixCompanyId, setNewMatrixCompanyId] = useState("");
  const [showAddSector, setShowAddSector] = useState(false);
  const [newSectorName, setNewSectorName] = useState("");
  const [showAddHazard, setShowAddHazard] = useState(false);
  const [newHazardNames, setNewHazardNames] = useState<string[]>([""]);
  const [newHazardCategory, setNewHazardCategory] = useState(HAZARD_CATEGORIES[0]);
  const [showCellEditor, setShowCellEditor] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    sectorId: string;
    hazardId: string;
    probability: number;
    severity: number;
    controlMeasure: string;
  } | null>(null);

  // Duplicate dialog
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<RiskMatrix | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateCompanyId, setDuplicateCompanyId] = useState("");

  // Delete confirmation
  const [deletingMatrix, setDeletingMatrix] = useState<RiskMatrix | null>(null);

  // Rename matrix
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Custom category
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [hazardCategories, setHazardCategories] = useState<string[]>(HAZARD_CATEGORIES);

  // Load matrices for ALL user companies
  const loadMatrices = useCallback(async () => {
    setLoading(true);
    try {
      const allResults = await Promise.all(
        companies.map((c) => apiFetchRiskMatrices(c.id))
      );
      // Sanitizar la respuesta: Asegurar que los arrays estén inicializados para evitar el error "is not iterable"
      const flatMatrices = allResults.flat().map(m => ({
        ...m,
        sectors: m.sectors || [],
        hazards: m.hazards || [],
        cells: m.cells || []
      }));
      setMatrices(flatMatrices);
      setSelectedMatrix(null);
    } finally {
      setLoading(false);
    }
  }, [companies]);

  useEffect(() => {
    if (companies.length > 0) loadMatrices();
  }, [loadMatrices, companies]);

  const handleCreateMatrix = async () => {
    if (!newMatrixName.trim() || !newMatrixCompanyId) return;
    try {
      const created = await apiCreateRiskMatrix(newMatrixCompanyId, newMatrixName.trim());
      
      // Asegurar que la matriz tenga los arrays inicializados para evitar crasheos en la UI
      const newMatrix: RiskMatrix = {
        ...created,
        sectors: created.sectors || [],
        hazards: created.hazards || [],
        cells: created.cells || []
      };

      setMatrices((prev) => [...prev, newMatrix]);
      setSelectedMatrix(newMatrix);
      setNewMatrixName("");
      setNewMatrixCompanyId("");
      setShowNewMatrix(false);
      toast({ title: "Matriz creada", description: `${newMatrix.name} — ${companies.find(c => c.id === newMatrixCompanyId)?.name || ""}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo crear la matriz", variant: "destructive" });
    }
  };

  const handleConfirmDeleteMatrix = async () => {
    if (!deletingMatrix) return;
    try {
      await apiDeleteRiskMatrix(deletingMatrix.companyId, deletingMatrix.id);
      setMatrices((prev) => prev.filter((m) => m.id !== deletingMatrix.id));
      if (selectedMatrix?.id === deletingMatrix.id) setSelectedMatrix(null);
      toast({ title: "Matriz eliminada" });
    } catch (error: any) {
      toast({
        title: "Error al eliminar",
        description: error.message || "No se pudo eliminar la matriz de riesgo.",
        variant: "destructive"
      });
    } finally {
      setDeletingMatrix(null);
    }
  };

  const handleRenameMatrix = () => {
    if (!selectedMatrix || !renameValue.trim()) return;
    const updated = { ...selectedMatrix, name: renameValue.trim() };
    setSelectedMatrix(updated);
    setMatrices((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setShowRename(false);
    toast({ title: "Nombre actualizado" });
  };

  const handleAddCustomCategory = () => {
    if (!newCustomCategory.trim()) return;
    addHazardCategory(newCustomCategory.trim());
    setHazardCategories([...HAZARD_CATEGORIES]);
    setNewCustomCategory("");
  };

  const handleRemoveCategory = (cat: string) => {
    removeHazardCategory(cat);
    setHazardCategories([...HAZARD_CATEGORIES]);
  };

  const handleDuplicate = async () => {
    if (!duplicateSource || !duplicateName.trim() || !duplicateCompanyId) return;
    try {
      const created = await apiCreateRiskMatrix(duplicateCompanyId, duplicateName.trim());
      // Copy sectors, hazards and cells with new IDs
      const sectorMap: Record<string, string> = {};
      const newSectors = (duplicateSource.sectors || []).map((s) => {
        const newId = "s" + Date.now() + Math.random().toString(36).slice(2, 6);
        sectorMap[s.id] = newId;
        return { ...s, id: newId };
      });
      const hazardMap: Record<string, string> = {};
      const newHazards = (duplicateSource.hazards || []).map((h) => {
        const newId = "h" + Date.now() + Math.random().toString(36).slice(2, 6);
        hazardMap[h.id] = newId;
        return { ...h, id: newId };
      });
      const newCells = (duplicateSource.cells || []).map((c) => ({
        ...c,
        sectorId: sectorMap[c.sectorId] || c.sectorId,
        hazardId: hazardMap[c.hazardId] || c.hazardId,
      }));
      const duplicated: RiskMatrix = {
        ...created,
        sectors: newSectors,
        hazards: newHazards,
        cells: newCells,
      };
      await apiSaveRiskMatrix(duplicated);
      setMatrices((prev) => [...prev, duplicated]);
      setShowDuplicate(false);
      setDuplicateSource(null);
      toast({ title: "Matriz duplicada", description: duplicated.name });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo duplicar la matriz", variant: "destructive" });
    }
  };

  const openDuplicateDialog = (matrix: RiskMatrix) => {
    setDuplicateSource(matrix);
    setDuplicateName(matrix.name + " (copia)");
    setDuplicateCompanyId(matrix.companyId);
    setShowDuplicate(true);
  };

  const handleAddSector = () => {
    if (!selectedMatrix || !newSectorName.trim()) return;
    const newSector: Sector = { id: "s" + Date.now(), name: newSectorName.trim() };
    setSelectedMatrix({
      ...selectedMatrix,
      sectors: [...(selectedMatrix.sectors || []), newSector],
    });
    setNewSectorName("");
    setShowAddSector(false);
  };

  const handleRemoveSector = (sectorId: string) => {
    if (!selectedMatrix) return;
    setSelectedMatrix({
      ...selectedMatrix,
      sectors: (selectedMatrix.sectors || []).filter((s) => s.id !== sectorId),
      cells: (selectedMatrix.cells || []).filter((c) => c.sectorId !== sectorId),
    });
  };

  const handleAddHazard = () => {
    if (!selectedMatrix) return;
    const validNames = newHazardNames.map((n) => n.trim()).filter(Boolean);
    if (validNames.length === 0) return;
    const newHazards: Hazard[] = validNames.map((name, i) => ({
      id: "h" + Date.now() + i,
      name,
      category: newHazardCategory,
    }));
    setSelectedMatrix({
      ...selectedMatrix,
      hazards: [...(selectedMatrix.hazards || []), ...newHazards],
    });
    setNewHazardNames([""]);
    setShowAddHazard(false);
  };

  const handleRemoveHazard = (hazardId: string) => {
    if (!selectedMatrix) return;
    setSelectedMatrix({
      ...selectedMatrix,
      hazards: (selectedMatrix.hazards || []).filter((h) => h.id !== hazardId),
      cells: (selectedMatrix.cells || []).filter((c) => c.hazardId !== hazardId),
    });
  };

  const handleCellClick = (sectorId: string, hazardId: string) => {
    if (!selectedMatrix) return;
    const existing = (selectedMatrix.cells || []).find(
      (c) => c.sectorId === sectorId && c.hazardId === hazardId
    );
    setEditingCell({
      sectorId,
      hazardId,
      probability: existing?.probability || 1,
      severity: existing?.severity || 1,
      controlMeasure: existing?.controlMeasure || "",
    });
    setShowCellEditor(true);
  };

  const handleSaveCell = () => {
    if (!selectedMatrix || !editingCell) return;
    const score = editingCell.probability * editingCell.severity;
    const level = getRiskLevel(score);
    const newCell: RiskCell = {
      sectorId: editingCell.sectorId,
      hazardId: editingCell.hazardId,
      probability: editingCell.probability,
      severity: editingCell.severity,
      riskScore: score,
      riskLevel: level,
      controlMeasure: editingCell.controlMeasure,
    };
    const otherCells = (selectedMatrix.cells || []).filter(
      (c) => !(c.sectorId === editingCell.sectorId && c.hazardId === editingCell.hazardId)
    );
    setSelectedMatrix({ ...selectedMatrix, cells: [...otherCells, newCell] });
    setShowCellEditor(false);
    setEditingCell(null);
  };

  const handleSaveMatrix = async () => {
    if (!selectedMatrix) return;
    setSaving(true);
    try {
      await apiSaveRiskMatrix(selectedMatrix);
      
      // Sincronizar los cambios con la lista principal para que al volver atrás no se pierdan
      setMatrices((prev) => prev.map((m) => (m.id === selectedMatrix.id ? selectedMatrix : m)));
      toast({ title: "Matriz guardada exitosamente" });
    } catch (error: any) {
      toast({ title: "Error al guardar", description: error.message || "No se pudo guardar la matriz", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getCell = (sectorId: string, hazardId: string): RiskCell | undefined =>
    (selectedMatrix?.cells || []).find((c) => c.sectorId === sectorId && c.hazardId === hazardId);

  // Group hazards by category
  const groupedHazards = selectedMatrix
    ? hazardCategories.filter((cat) =>
        (selectedMatrix.hazards || []).some((h) => h.category === cat)
      ).map((cat) => ({
        category: cat,
        hazards: (selectedMatrix.hazards || []).filter((h) => h.category === cat),
      }))
    : [];

  const allHazardsFlat = groupedHazards.flatMap((g) => g.hazards);

  // Open new matrix dialog with pre-selected company
  const openNewMatrixDialog = () => {
    setNewMatrixCompanyId(selectedCompany?.id || companies[0]?.id || "");
    setNewMatrixName("");
    setShowNewMatrix(true);
  };

  const handleExportPDF = (matrix: RiskMatrix) => {
    const companyName = companies.find((c) => c.id === matrix.companyId)?.name || "—";
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(matrix.name, 14, 18);

    // Metadata
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Empresa: ${companyName}`, 14, 26);
    doc.text(`Fecha: ${matrix.date}`, 14, 32);
    doc.text(`Sectores: ${matrix.sectors.length}  |  Peligros: ${matrix.hazards.length}  |  Evaluaciones: ${matrix.cells.length}`, 14, 38);

    // Risk level legend
    const legendY = 44;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Niveles de Riesgo:", 14, legendY);
    const legendItems: { label: string; color: [number, number, number]; range: string }[] = [
      { label: "Trivial", color: [34, 197, 94], range: "1-4" },
      { label: "Tolerable", color: [250, 204, 21], range: "5-8" },
      { label: "Moderado", color: [245, 158, 11], range: "9-12" },
      { label: "Importante", color: [234, 88, 12], range: "13-16" },
      { label: "Intolerable", color: [220, 38, 38], range: "17-25" },
    ];
    let lx = 50;
    legendItems.forEach((item) => {
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.rect(lx, legendY - 3.5, 4, 4, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${item.label} (${item.range})`, lx + 6, legendY);
      lx += 40;
    });

    // Probability & Severity scales
    const scaleY = legendY + 7;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Probabilidad:", 14, scaleY);
    doc.setFont("helvetica", "normal");
    doc.text("1-Raro  2-Improbable  3-Posible  4-Probable  5-Casi seguro", 40, scaleY);
    doc.setFont("helvetica", "bold");
    doc.text("Severidad:", 14, scaleY + 5);
    doc.setFont("helvetica", "normal");
    doc.text("1-Insignificante  2-Menor  3-Moderado  4-Mayor  5-Catastrófico", 40, scaleY + 5);

    // Build table
    const grouped = hazardCategories.filter((cat) =>
      (matrix.hazards || []).some((h) => h.category === cat)
    ).map((cat) => ({
      category: cat,
      hazards: (matrix.hazards || []).filter((h) => h.category === cat),
    }));
    const flatHazards = grouped.flatMap((g) => g.hazards);

    // Header rows
    const categoryRow = [{ content: "SECTOR", rowSpan: 2, styles: { halign: "center" as const, fontStyle: "bold" as const } }];
    grouped.forEach((g) => {
      categoryRow.push({
        content: g.category,
        rowSpan: 1,
        styles: { halign: "center" as const, fontStyle: "bold" as const },
        // @ts-ignore
        colSpan: g.hazards.length,
      });
    });

    const hazardRow = flatHazards.map((h) => ({
      content: h.name,
      styles: { halign: "center" as const, fontSize: 7 },
    }));

    // Body
    const body = (matrix.sectors || []).map((sector) => {
      const row: any[] = [{ content: sector.name, styles: { fontStyle: "bold" as const } }];
      flatHazards.forEach((hazard) => {
        const cell = (matrix.cells || []).find(
          (c) => c.sectorId === sector.id && c.hazardId === hazard.id
        );
        if (cell) {
          const colorMap: Record<RiskLevel, [number, number, number]> = {
            trivial: [34, 197, 94],
            tolerable: [250, 204, 21],
            moderado: [245, 158, 11],
            importante: [234, 88, 12],
            intolerable: [220, 38, 38],
          };
          const textColorMap: Record<RiskLevel, [number, number, number]> = {
            trivial: [0, 0, 0],
            tolerable: [0, 0, 0],
            moderado: [0, 0, 0],
            importante: [255, 255, 255],
            intolerable: [255, 255, 255],
          };
          row.push({
            content: `${cell.riskScore}\nP:${cell.probability} S:${cell.severity}\n${cell.controlMeasure}`,
            styles: {
              halign: "center" as const,
              fontSize: 6,
              fillColor: colorMap[cell.riskLevel],
              textColor: textColorMap[cell.riskLevel],
            },
          });
        } else {
          row.push({ content: "—", styles: { halign: "center" as const, textColor: [180, 180, 180] } });
        }
      });
      return row;
    });

    autoTable(doc, {
      startY: scaleY + 10,
      head: [categoryRow as any, hazardRow as any],
      body,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [50, 50, 60], textColor: [255, 255, 255], fontSize: 7 },
      margin: { left: 10, right: 10 },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `${matrix.name} — ${companyName} — Página ${i}/${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 5,
        { align: "center" }
      );
    }

    doc.save(`${matrix.name.replace(/\s+/g, "_")}_${matrix.date}.pdf`);
    toast({ title: "PDF exportado", description: matrix.name });
  };

  // LIST VIEW
  if (!selectedMatrix) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Matrices de Riesgo (IPERC)
            </h1>
            <p className="text-muted-foreground mt-1">
              Identificación de Peligros, Evaluación de Riesgos y Medidas de Control
            </p>
          </div>
          <Button onClick={openNewMatrixDialog}>
            <Plus className="h-4 w-4 mr-2" /> Nueva Matriz
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : matrices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
              <p>No hay matrices de riesgo cargadas.</p>
              <Button variant="outline" className="mt-4" onClick={openNewMatrixDialog}>
                Crear primera matriz
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {matrices.map((m) => {
              const totalCells = m.cells.length;
              const critical = m.cells.filter(
                (c) => c.riskLevel === "importante" || c.riskLevel === "intolerable"
              ).length;
              const companyName = companies.find((c) => c.id === m.companyId)?.name || "—";
              return (
                <Card
                  key={m.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedMatrix(m)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="truncate">{m.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDuplicateDialog(m);
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Duplicar matriz</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportPDF(m);
                              }}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Exportar PDF</TooltipContent>
                        </Tooltip>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingMatrix(m);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground/80">{companyName}</p>
                    <p>Fecha: {m.date}</p>
                    <p>Sectores: {m.sectors.length} | Peligros: {m.hazards.length}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{totalCells} evaluaciones</Badge>
                      {critical > 0 && (
                        <Badge variant="destructive">{critical} críticos</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* New Matrix Dialog */}
        <Dialog open={showNewMatrix} onOpenChange={setShowNewMatrix}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Matriz de Riesgo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={newMatrixName}
                  onChange={(e) => setNewMatrixName(e.target.value)}
                  placeholder="Ej: Matriz IPERC - Planta Norte"
                />
              </div>
              <div>
                <Label>Empresa</Label>
                <Select value={newMatrixCompanyId} onValueChange={setNewMatrixCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewMatrix(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateMatrix} disabled={!newMatrixName.trim() || !newMatrixCompanyId}>
                Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Duplicate Matrix Dialog */}
        <Dialog open={showDuplicate} onOpenChange={setShowDuplicate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Duplicar Matriz de Riesgo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  placeholder="Nombre de la copia"
                />
              </div>
              <div>
                <Label>Empresa</Label>
                <Select value={duplicateCompanyId} onValueChange={setDuplicateCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDuplicate(false)}>Cancelar</Button>
              <Button onClick={handleDuplicate} disabled={!duplicateName.trim() || !duplicateCompanyId}>
                Duplicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Matrix Confirmation (list view) */}
        <AlertDialog open={!!deletingMatrix} onOpenChange={(open) => !open && setDeletingMatrix(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar matriz de riesgo?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará permanentemente la matriz "{deletingMatrix?.name}". Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDeleteMatrix} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // MATRIX EDITOR VIEW
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedMatrix(null)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{selectedMatrix.name}</h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                onClick={() => {
                  setRenameValue(selectedMatrix.name);
                  setShowRename(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {companies.find((c) => c.id === selectedMatrix.companyId)?.name || ""} — {selectedMatrix.date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddSector(true)}>
            <PlusCircle className="h-4 w-4 mr-1" /> Sector
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddHazard(true)}>
            <PlusCircle className="h-4 w-4 mr-1" /> Peligro
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportPDF(selectedMatrix)}>
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button onClick={handleSaveMatrix} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(RISK_COLORS) as RiskLevel[]).map((level) => (
          <div key={level} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded ${RISK_COLORS[level]}`} />
            <span className="text-xs text-muted-foreground">{RISK_LABELS[level]}</span>
          </div>
        ))}
      </div>

      {/* Matrix Table */}
      {(selectedMatrix.sectors || []).length === 0 || (selectedMatrix.hazards || []).length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
            <p className="mb-4">Para visualizar la tabla de evaluación, debe agregar al menos un sector y un peligro.</p>
            <div className="flex gap-4 mt-2">
              <Badge variant={(selectedMatrix.sectors || []).length > 0 ? "default" : "secondary"} className="text-sm py-1 px-3">
                Sectores listos: {(selectedMatrix.sectors || []).length}
              </Badge>
              <Badge variant={(selectedMatrix.hazards || []).length > 0 ? "default" : "secondary"} className="text-sm py-1 px-3">
                Peligros listos: {(selectedMatrix.hazards || []).length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <div className="min-w-max">
              <table className="w-full border-collapse text-sm">
                <thead>
                  {/* Category header row */}
                  <tr className="bg-muted/50">
                    <th
                      rowSpan={2}
                      className="border border-border px-3 py-2 text-left font-semibold text-foreground min-w-[160px] sticky left-0 bg-muted/50 z-10"
                    >
                      SECTOR / ACTIVIDAD
                    </th>
                    {groupedHazards.map((g) => (
                      <th
                        key={g.category}
                        colSpan={g.hazards.length}
                        className="border border-border px-2 py-1 text-center text-xs font-semibold text-primary uppercase tracking-wider"
                      >
                        {g.category}
                      </th>
                    ))}
                  </tr>
                  {/* Hazard names */}
                  <tr className="bg-muted/30">
                    {allHazardsFlat.map((h) => (
                      <th
                        key={h.id}
                        className="border border-border px-1 py-1 text-center min-w-[80px] group"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs font-medium text-foreground leading-tight">
                            {h.name}
                          </span>
                          <button
                            onClick={() => handleRemoveHazard(h.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedMatrix.sectors.map((sector) => (
                    <tr key={sector.id} className="group/row hover:bg-muted/20">
                      <td className="border border-border px-3 py-2 font-medium text-foreground sticky left-0 bg-background z-10">
                        <div className="flex items-center justify-between gap-2">
                          <span>{sector.name}</span>
                          <button
                            onClick={() => handleRemoveSector(sector.id)}
                            className="opacity-0 group-hover/row:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      </td>
                      {allHazardsFlat.map((hazard) => {
                        const cell = getCell(sector.id, hazard.id);
                        return (
                          <td
                            key={hazard.id}
                            className={`border border-border text-center cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${
                              cell ? RISK_COLORS[cell.riskLevel] : "bg-muted/10"
                            }`}
                            onClick={() => handleCellClick(sector.id, hazard.id)}
                          >
                            {cell ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="px-1 py-2 font-bold text-sm">
                                    {cell.riskScore}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px]">
                                  <p className="font-semibold">{RISK_LABELS[cell.riskLevel]}</p>
                                  <p className="text-xs">P:{cell.probability} × S:{cell.severity}</p>
                                  <p className="text-xs mt-1">{cell.controlMeasure}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <div className="px-1 py-2 text-muted-foreground/30 text-xs">—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Add Sector Dialog */}
      <Dialog open={showAddSector} onOpenChange={setShowAddSector}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Sector / Actividad</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nombre del sector</Label>
            <Input
              value={newSectorName}
              onChange={(e) => setNewSectorName(e.target.value)}
              placeholder="Ej: Servicio de Limpieza"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSector(false)}>Cancelar</Button>
            <Button onClick={handleAddSector} disabled={!newSectorName.trim()}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Hazard Dialog */}
      <Dialog open={showAddHazard} onOpenChange={(open) => { setShowAddHazard(open); if (!open) setNewHazardNames([""]); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar Peligro(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Categoría</Label>
              <Select value={newHazardCategory} onValueChange={setNewHazardCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hazardCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={newCustomCategory}
                  onChange={(e) => setNewCustomCategory(e.target.value)}
                  placeholder="Nueva categoría..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddCustomCategory(); }}
                />
                <Button variant="outline" size="sm" onClick={handleAddCustomCategory} disabled={!newCustomCategory.trim()}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar
                </Button>
              </div>
              {hazardCategories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {hazardCategories.map((cat) => (
                    <Badge key={cat} variant="secondary" className="text-xs gap-1">
                      {cat}
                      <button onClick={() => handleRemoveCategory(cat)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Nombres de peligros (sub-columnas)</Label>
              <p className="text-xs text-muted-foreground">
                Agregue uno o más peligros que se mostrarán como sub-columnas bajo la categoría seleccionada.
              </p>
              {newHazardNames.map((name, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={name}
                    onChange={(e) => {
                      const updated = [...newHazardNames];
                      updated[idx] = e.target.value;
                      setNewHazardNames(updated);
                    }}
                    placeholder={`Peligro ${idx + 1}, ej: Caída a distinto nivel`}
                  />
                  {newHazardNames.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive"
                      onClick={() => setNewHazardNames(newHazardNames.filter((_, i) => i !== idx))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => setNewHazardNames([...newHazardNames, ""])}
              >
                <Plus className="h-3 w-3 mr-1" /> Agregar otro peligro
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddHazard(false); setNewHazardNames([""]); }}>Cancelar</Button>
            <Button onClick={handleAddHazard} disabled={!newHazardNames.some((n) => n.trim())}>
              Agregar {newHazardNames.filter((n) => n.trim()).length > 1 ? `(${newHazardNames.filter((n) => n.trim()).length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cell Editor Dialog */}
      <Dialog open={showCellEditor} onOpenChange={setShowCellEditor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evaluar Riesgo</DialogTitle>
          </DialogHeader>
          {editingCell && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Probabilidad (1-5)</Label>
                  <Select
                    value={String(editingCell.probability)}
                    onValueChange={(v) =>
                      setEditingCell({ ...editingCell, probability: Number(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} - {["Raro", "Improbable", "Posible", "Probable", "Casi seguro"][n - 1]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severidad (1-5)</Label>
                  <Select
                    value={String(editingCell.severity)}
                    onValueChange={(v) =>
                      setEditingCell({ ...editingCell, severity: Number(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} - {["Insignificante", "Menor", "Moderado", "Mayor", "Catastrófico"][n - 1]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Risk preview */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Nivel de riesgo:</span>
                {(() => {
                  const score = editingCell.probability * editingCell.severity;
                  const level = getRiskLevel(score);
                  return (
                    <Badge className={RISK_COLORS[level]}>
                      {score} — {RISK_LABELS[level]}
                    </Badge>
                  );
                })()}
              </div>

              <div>
                <Label>Medida de control</Label>
                <Textarea
                  value={editingCell.controlMeasure}
                  onChange={(e) =>
                    setEditingCell({ ...editingCell, controlMeasure: e.target.value })
                  }
                  placeholder="Describir la medida de control..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCellEditor(false)}>Cancelar</Button>
            <Button onClick={handleSaveCell}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Matrix Dialog */}
      <Dialog open={showRename} onOpenChange={setShowRename}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar Matriz</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nuevo nombre</Label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Nombre de la matriz"
              onKeyDown={(e) => { if (e.key === "Enter") handleRenameMatrix(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRename(false)}>Cancelar</Button>
            <Button onClick={handleRenameMatrix} disabled={!renameValue.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Matrix Confirmation */}
      <AlertDialog open={!!deletingMatrix} onOpenChange={(open) => !open && setDeletingMatrix(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar matriz de riesgo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente la matriz "{deletingMatrix?.name}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteMatrix} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RiskMatrixPage;
