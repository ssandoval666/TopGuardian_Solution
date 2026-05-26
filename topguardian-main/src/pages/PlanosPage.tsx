import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import {
  apiFetchPlanos,
  apiCreatePlano,
  apiUpdatePlano,
  apiDeletePlano,
  fileToByteArray,
  byteArrayToUrl,
  type Plano,
} from "@/services/planosApi";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  ChevronLeft,
  Loader2,
  FileText,
  Download,
  X,
  Pencil,
  Check,
  ChevronLeftIcon,
  ChevronRightIcon,
  Map,
} from "lucide-react";

const PlanosPage = () => {
  const { companies } = useApp();
  const { toast } = useToast();

  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(false);

  // Group by company for card view
  type CompanyGroup = { companyId: string; companyName: string; planos: Plano[] };
  const [groups, setGroups] = useState<CompanyGroup[]>([]);

  // Selected group for editing
  const [selectedGroup, setSelectedGroup] = useState<CompanyGroup | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // New planos dialog
  const [showNew, setShowNew] = useState(false);
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newItems, setNewItems] = useState<{ name: string; file: File | null }[]>([{ name: "", file: null }]);

  // Delete confirmation
  const [deletingPlano, setDeletingPlano] = useState<Plano | null>(null);

  // Delete all planos for a company
  const [deletingGroup, setDeletingGroup] = useState<CompanyGroup | null>(null);

  // Rename inline
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const loadPlanos = useCallback(async () => {
    setLoading(true);
    try {
      const allResults = await Promise.all(
        companies.map((c) => apiFetchPlanos(c.id))
      );
      const flat = allResults.flat();
      setPlanos(flat);

      const grouped: CompanyGroup[] = companies
        .map((c) => ({
          companyId: c.id,
          companyName: c.name,
          planos: flat.filter((p) => p.companyId === c.id),
        }))
        .filter((g) => g.planos.length > 0);
      setGroups(grouped);
    } finally {
      setLoading(false);
    }
  }, [companies]);

  useEffect(() => {
    if (companies.length > 0) loadPlanos();
  }, [loadPlanos, companies]);

  // Refresh selected group when planos change
  useEffect(() => {
    if (selectedGroup) {
      const updated = groups.find((g) => g.companyId === selectedGroup.companyId);
      if (updated) {
        setSelectedGroup(updated);
        if (carouselIndex >= updated.planos.length) {
          setCarouselIndex(Math.max(0, updated.planos.length - 1));
        }
      } else {
        setSelectedGroup(null);
      }
    }
  }, [groups]);

  const handleCreate = async () => {
    if (!newCompanyId) return;
    const validItems = newItems.filter((it) => it.name.trim());
    if (validItems.length === 0) return;

    for (const item of validItems) {
      const fileData = item.file ? await fileToByteArray(item.file) : [];
      await apiCreatePlano({
        name: item.name.trim(),
        companyId: newCompanyId,
        fileName: item.file?.name || "sin_archivo.pdf",
        fileData,
      });
    }

    await loadPlanos();
    setShowNew(false);
    setNewItems([{ name: "", file: null }]);
    setNewCompanyId("");
    toast({ title: "Plano(s) creado(s)" });
  };

  const handleDelete = async () => {
    if (!deletingPlano) return;
    await apiDeletePlano(deletingPlano.id);
    await loadPlanos();
    setDeletingPlano(null);
    toast({ title: "Plano eliminado" });
  };

  const handleDeleteAll = async () => {
    if (!deletingGroup) return;
    for (const p of deletingGroup.planos) {
      await apiDeletePlano(p.id);
    }
    await loadPlanos();
    setDeletingGroup(null);
    toast({ title: "Todos los planos eliminados" });
  };

  const handleRename = async (plano: Plano) => {
    if (!renameValue.trim()) return;
    await apiUpdatePlano(plano.id, { name: renameValue.trim() });
    await loadPlanos();
    setRenamingId(null);
    toast({ title: "Nombre actualizado" });
  };

  const handleDownload = (plano: Plano) => {
    if (plano.fileData && plano.fileData.length > 0) {
      const url = byteArrayToUrl(plano.fileData);
      const link = document.createElement("a");
      link.href = url;
      link.download = plano.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      toast({ title: "Sin archivo", description: "Este plano no tiene un PDF asociado.", variant: "destructive" });
    }
  };

  const openNewDialog = () => {
    setNewCompanyId(companies[0]?.id || "");
    setNewItems([{ name: "", file: null }]);
    setShowNew(true);
  };

  // DETAIL/EDIT VIEW
  if (selectedGroup) {
    const currentPlano = selectedGroup.planos[carouselIndex];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Planos — {selectedGroup.companyName}</h1>
              <p className="text-sm text-muted-foreground">
                {selectedGroup.planos.length} plano(s) cargado(s)
              </p>
            </div>
          </div>
        </div>

        {selectedGroup.planos.length > 0 && currentPlano ? (
          <Card>
            <CardContent className="p-6">
              {/* Carousel navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={carouselIndex === 0}
                  onClick={() => setCarouselIndex((i) => i - 1)}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {carouselIndex + 1} / {selectedGroup.planos.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={carouselIndex === selectedGroup.planos.length - 1}
                  onClick={() => setCarouselIndex((i) => i + 1)}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>

              {/* Plano name & actions on top */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-2">
                  {renamingId === currentPlano.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-8 w-64"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(currentPlano);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRename(currentPlano)}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRenamingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">{currentPlano.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setRenamingId(currentPlano.id);
                          setRenameValue(currentPlano.name);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(currentPlano)}>
                    <Download className="h-4 w-4 mr-1" /> Descargar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeletingPlano(currentPlano)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                  </Button>
                </div>
              </div>

              {/* PDF Preview placeholder */}
              <div className="border border-border rounded-lg bg-muted/20 flex flex-col items-center justify-center h-[400px] mb-4">
                <FileText className="h-16 w-16 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">{currentPlano.fileName}</p>
                <p className="text-xs text-muted-foreground mt-1">Vista previa del PDF</p>
              </div>

              <p className="text-xs text-muted-foreground">Creado: {currentPlano.createdAt}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No hay planos para esta empresa.
            </CardContent>
          </Card>
        )}

        {/* Delete confirmation */}
        <AlertDialog open={!!deletingPlano} onOpenChange={(open) => !open && setDeletingPlano(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar plano?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará permanentemente el plano "{deletingPlano?.name}". Esta acción no se puede deshacer.
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
  }

  // LIST VIEW (cards grouped by company)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Map className="h-6 w-6 text-primary" />
            Planos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión de planos por empresa
          </p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Plano
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p>No hay planos cargados.</p>
            <Button variant="outline" className="mt-4" onClick={openNewDialog}>
              Cargar primer plano
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card
              key={g.companyId}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => {
                setSelectedGroup(g);
                setCarouselIndex(0);
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2 truncate">
                    <Map className="h-4 w-4 text-primary" />
                    {g.companyName}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingGroup(g);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <Badge variant="secondary">{g.planos.length} plano(s)</Badge>
                <div className="text-xs space-y-0.5 mt-2">
                  {g.planos.slice(0, 3).map((p) => (
                    <p key={p.id} className="truncate">• {p.name}</p>
                  ))}
                  {g.planos.length > 3 && (
                    <p className="text-muted-foreground/60">+{g.planos.length - 3} más...</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Planos Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo(s) Plano(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Empresa</Label>
              <Select value={newCompanyId} onValueChange={setNewCompanyId}>
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
            <div className="space-y-3">
              <Label>Planos</Label>
              {newItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 border border-border rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={item.name}
                      onChange={(e) => {
                        const updated = [...newItems];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setNewItems(updated);
                      }}
                      placeholder={`Nombre del plano ${idx + 1}`}
                    />
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        const updated = [...newItems];
                        updated[idx] = { ...updated[idx], file };
                        if (file && !updated[idx].name) {
                          updated[idx].name = file.name.replace(/\.pdf$/i, "");
                        }
                        setNewItems(updated);
                      }}
                    />
                  </div>
                  {newItems.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive mt-1"
                      onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewItems([...newItems, { name: "", file: null }])}
              >
                <Plus className="h-3 w-3 mr-1" /> Agregar otro plano
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={!newCompanyId || !newItems.some((it) => it.name.trim())}
            >
              Crear {newItems.filter((it) => it.name.trim()).length > 1 ? `(${newItems.filter((it) => it.name.trim()).length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation (single plano - not used in list view but kept) */}
      <AlertDialog open={!!deletingPlano} onOpenChange={(open) => !open && setDeletingPlano(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el plano "{deletingPlano?.name}". Esta acción no se puede deshacer.
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

      {/* Delete ALL planos for company */}
      <AlertDialog open={!!deletingGroup} onOpenChange={(open) => !open && setDeletingGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar todos los planos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán permanentemente los {deletingGroup?.planos.length} plano(s) de "{deletingGroup?.companyName}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlanosPage;
