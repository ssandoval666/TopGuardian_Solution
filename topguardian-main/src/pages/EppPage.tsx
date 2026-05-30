import { useState, useEffect } from "react";
import { HardHat, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiCall } from "@/services/api";

interface Epp {
  id: number;
  name: string;
  description: string;
}

export default function EppPage() {
  const [epps, setEpps] = useState<Epp[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentEpp, setCurrentEpp] = useState<Partial<Epp>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deletingEpp, setDeletingEpp] = useState<Epp | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEpps = async () => {
    try {
      setLoading(true);
      const data = await apiCall("/epp");
      setEpps(data);
    } catch (error) {
      console.error("Error al cargar EPPs:", error);
      toast.error("Error al cargar los Elementos de Protección Personal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpps();
  }, []);

  const handleOpenDialog = (epp?: Epp) => {
    if (epp) {
      setCurrentEpp(epp);
    } else {
      setCurrentEpp({ name: "", description: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentEpp.name?.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    try {
      setIsSaving(true);
      if (currentEpp.id) {
        await apiCall(`/epp/${currentEpp.id}`, {
          method: "PUT",
          body: JSON.stringify(currentEpp)
        });
        toast.success("EPP actualizado exitosamente");
      } else {
        await apiCall("/epp", {
          method: "POST",
          body: JSON.stringify(currentEpp)
        });
        toast.success("EPP creado exitosamente");
      }
      setIsDialogOpen(false);
      fetchEpps();
    } catch (error: any) {
      toast.error(error.message || "Error al guardar el EPP");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingEpp) return;
    setIsDeleting(true);
    try {
      await apiCall(`/epp/${deletingEpp.id}`, { method: "DELETE" });
      toast.success("EPP eliminado exitosamente");
      setDeletingEpp(null);
      fetchEpps();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar el EPP");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HardHat className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Elementos de Protección Personal</h1>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo EPP
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : epps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay Elementos de Protección Personal registrados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {epps.map((epp) => (
            <Card key={epp.id}>
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div>
                  <h3 className="font-semibold text-lg">{epp.name}</h3>
                  <p className="text-muted-foreground text-sm mt-1">{epp.description}</p>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => handleOpenDialog(epp)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeletingEpp(epp)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentEpp.id ? "Editar EPP" : "Nuevo EPP"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={currentEpp.name || ""}
                onChange={(e) => setCurrentEpp({ ...currentEpp, name: e.target.value })}
                placeholder="Ej. Guantes de seguridad"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={currentEpp.description || ""}
                onChange={(e) => setCurrentEpp({ ...currentEpp, description: e.target.value })}
                placeholder="Breve descripción del elemento"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingEpp} onOpenChange={(open) => !open && setDeletingEpp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar EPP?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el elemento "{deletingEpp?.name}" de forma permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}