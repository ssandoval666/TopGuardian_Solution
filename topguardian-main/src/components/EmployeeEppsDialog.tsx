import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2, Plus, HardHat, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { apiCall } from "@/services/api";

interface AssignedEpp {
  id: number;
  employee_id: number;
  epp_id: number;
  epp_name: string;
  delivery_date: string;
}

interface Epp {
  id: number;
  name: string;
}

interface SelectedEpp {
  id: number;
  quantity: number;
}

interface EmployeeEppsDialogProps {
  employeeId: string | number | null;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EmployeeEppsDialog({ employeeId, employeeName, open, onOpenChange }: EmployeeEppsDialogProps) {
  const [assignedEpps, setAssignedEpps] = useState<AssignedEpp[]>([]);
  const [availableEpps, setAvailableEpps] = useState<Epp[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [isAssigning, setIsAssigning] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedEpps, setSelectedEpps] = useState<SelectedEpp[]>([]);
  const [deliveryDate, setDeliveryDate] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const loadData = async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const [assigned, available] = await Promise.all([
        apiCall(`/employee-epps/employee/${employeeId}`),
        apiCall(`/epp`)
      ]);
      setAssignedEpps(assigned);
      setAvailableEpps(available);
    } catch (error: any) {
      toast.error("Error al cargar datos de EPPs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && employeeId) {
      setShowAssignForm(false);
      setSelectedEpps([]);
      setDeliveryDate(new Date().toISOString().split("T")[0]);
      loadData();
    }
  }, [open, employeeId]);

  useEffect(() => {
    if (showAssignForm) {
      setTimeout(clearSignature, 50);
    }
  }, [showAssignForm]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasSignature(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleAssign = async () => {
    if (selectedEpps.length === 0) {
      toast.error("Seleccione al menos un EPP");
      return;
    }
    if (!deliveryDate) {
      toast.error("La fecha de entrega es requerida");
      return;
    }
    if (!hasSignature) {
      toast.error("La firma del empleado es requerida");
      return;
    }

    const canvas = canvasRef.current;
    let signatureData: number[] = [];
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      const binaryStr = window.atob(base64);
      const byteArray = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        byteArray[i] = binaryStr.charCodeAt(i);
      }
      signatureData = Array.from(byteArray);
    }

    setIsAssigning(true);
    try {
      await apiCall(`/employee-epps`, {
        method: "POST",
        body: JSON.stringify({ employeeId, epps: selectedEpps, deliveryDate, signatureData })
      });
      toast.success("EPPs asignados exitosamente");
      setShowAssignForm(false);
      setSelectedEpps([]);
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Error al asignar EPPs");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm("¿Eliminar asignación de EPP?")) return;
    try {
      await apiCall(`/employee-epps/${id}`, { method: "DELETE" });
      toast.success("Asignación eliminada");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-primary" />
            Asignar EPPs
          </DialogTitle>
          <DialogDescription>
            Empleado: {employeeName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 min-h-0 pr-2">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">EPPs Asignados</h3>
              <Button size="sm" onClick={() => setShowAssignForm(true)}>
                <Plus className="h-4 w-4 mr-2" /> Entregar EPP
              </Button>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Elemento</TableHead>
                    <TableHead>Fecha de Entrega</TableHead>
                    <TableHead className="w-[80px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedEpps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        No hay EPPs asignados a este empleado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignedEpps.map(epp => (
                      <TableRow key={epp.id}>
                        <TableCell className="font-medium">{epp.epp_name}</TableCell>
                        <TableCell>{epp.delivery_date}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 hover:text-destructive" onClick={() => handleRemove(epp.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>

      <Dialog open={showAssignForm} onOpenChange={setShowAssignForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Entrega de EPP</DialogTitle>
            <DialogDescription>
              Entregar elementos a {employeeName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Fecha de Entrega</Label>
              <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="mb-2 block">Seleccionar Elementos</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-md bg-background">
                {availableEpps.map(epp => {
                  const selectedItem = selectedEpps.find(s => s.id === epp.id);
                  const isSelected = !!selectedItem;
                  return (
                    <div key={epp.id} className="flex items-center space-x-2 p-1">
                      <Checkbox 
                        id={`epp-${epp.id}`} 
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedEpps([...selectedEpps, { id: epp.id, quantity: 1 }]);
                          else setSelectedEpps(selectedEpps.filter(s => s.id !== epp.id));
                        }}
                      />
                      <Label htmlFor={`epp-${epp.id}`} className="font-normal cursor-pointer text-sm flex-1 truncate">
                        {epp.name}
                      </Label>
                      {isSelected && (
                        <Input 
                          type="number"
                          min="1"
                          className="w-16 h-7 text-xs px-2 ml-auto"
                          value={selectedItem.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setSelectedEpps(selectedEpps.map(s => s.id === epp.id ? { ...s, quantity: val } : s));
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="block">Firma del Empleado</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearSignature}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Limpiar
                </Button>
              </div>
              <div className="border rounded-md bg-background overflow-hidden relative touch-none">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full h-[150px] cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                {!hasSignature && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-muted-foreground/30 opacity-50">
                    <span className="text-sm select-none">Firme aquí</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignForm(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={isAssigning || selectedEpps.length === 0 || !deliveryDate}>
              {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}