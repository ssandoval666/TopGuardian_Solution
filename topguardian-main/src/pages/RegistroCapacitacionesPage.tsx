import { useState, useEffect } from "react";
import { apiFetchTrainingRecordsReport, apiFetchEmployeeSignatures, type CompanyReport, type EmployeeReport } from "@/services/trainingApi";
import { ChevronDown, ChevronRight, FileText, Loader2, Building2, User, Download, GraduationCap, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import shieldLogo from "@/assets/shield-logo.png";

// Transforma el buffer de SQLite nuevamente en imagen compatible con el PDF
const toBase64DataUri = (byteArray: number[]) => {
  if (!byteArray || byteArray.length === 0) return null;
  let binary = '';
  for (let i = 0; i < byteArray.length; i++) {
    binary += String.fromCharCode(byteArray[i]);
  }
  return 'data:image/png;base64,' + window.btoa(binary);
};

// Componente de gráfico circular para mostrar el porcentaje
const CircularProgress = ({ value }: { value: number }) => {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  
  let colorClass = "text-green-500";
  if (value < 50) colorClass = "text-red-500";
  else if (value < 80) colorClass = "text-amber-500";

  return (
    <div className="relative flex items-center justify-center w-10 h-10 ml-2 shrink-0" title={`Cumplimiento general: ${value}%`}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={radius} stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-muted/30" />
        <circle
          cx="18" cy="18" r={radius}
          stroke="currentColor" strokeWidth="2.5" fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`${colorClass} transition-all duration-1000 ease-out`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-foreground">
        {value}%
      </span>
    </div>
  );
};

export default function RegistroCapacitacionesPage() {
  const [companies, setCompanies] = useState<CompanyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pdfPreview, setPdfPreview] = useState<{ url: string; filename: string } | null>(null);
  const [trainingListDialog, setTrainingListDialog] = useState<{ open: boolean; companyId: string; companyName: string; trainings: {title: string, date: string}[] }>({ open: false, companyId: "", companyName: "", trainings: [] });

  useEffect(() => {
    apiFetchTrainingRecordsReport()
      .then(setCompanies)
      .catch((error) => {
        console.error("Error cargando los reportes:", error);
        toast.error("Error al cargar reportes");
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleCompany = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePdfClick = async (company: CompanyReport, employee: EmployeeReport) => {
    const toastId = toast.loading("Procesando firmas y generando PDF...");

    try {
      // Carga perezosa (Lazy Loading): Solo descargamos las firmas pesadas para la persona solicitada al momento de generar el PDF
      const signatures = await apiFetchEmployeeSignatures(employee.id);

      // Filtro asíncrono para limpiar fondos oscuros de las firmas antiguas en memoria
      const processSignature = (byteArray: number[] | undefined): Promise<string | null> => {
        return new Promise((resolve) => {
          if (!byteArray) return resolve(null);
          const uri = toBase64DataUri(byteArray);
          if (!uri) return resolve(null);
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(uri);
            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            // Si el fondo es oscuro (firmas viejas), le quitamos el fondo y ponemos la tinta negra
            if (data[3] > 0 && data[0] < 80 && data[1] < 80 && data[2] < 80) {
              for (let i = 0; i < data.length; i += 4) {
                 const luma = 0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2];
                 if (luma < 100) { data[i+3] = 0; } // Fondo a transparente
                 else { data[i] = 0; data[i+1] = 0; data[i+2] = 0; } // Tinta a negro puro
              }
              ctx.putImageData(imgData, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } else {
              resolve(uri); // Si ya es transparente, se devuelve como está
            }
          };
          img.onerror = () => resolve(uri);
          img.src = uri;
        });
      };

      const processedSignatures = await Promise.all(employee.records.map(r => processSignature(signatures[r.id])));

      const drawPDF = (img: HTMLImageElement | null) => {
        const doc = new jsPDF();
        let startY = 65;

        // Logo
        if (img) {
          doc.addImage(img, 'PNG', 14, 10, 20, 20);
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text("Registro de Capacitaciones", 40, 22);
        } else {
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text("Registro de Capacitaciones", 14, 22);
        }

        // Info
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Empresa: ${company.name}`, 14, 40);
        doc.text(`Empleado: ${employee.firstName} ${employee.lastName}`, 14, 46);
        doc.text(`Documento: ${employee.documentNumber}`, 14, 52);

        // Armar la grilla
        const tableData = employee.records.map(r => [
          r.completionDate,
          r.trainingTitle,
          "" // Espacio vacío para insertar la imagen luego
        ]);

        autoTable(doc, {
          startY: startY,
          head: [["Fecha", "Capacitación", "Firma"]],
          body: tableData,
          styles: { valign: 'middle', cellPadding: 3 },
          columnStyles: { 
            0: { cellWidth: 35 },
            1: { cellWidth: 'auto' },
            2: { minCellHeight: 20, cellWidth: 50, halign: 'center' } 
          },
          didDrawCell: (data) => {
            // Dibuja la firma dentro de la celda de la 3ra columna (índice 2)
            if (data.column.index === 2 && data.cell.section === 'body') {
              const uri = processedSignatures[data.row.index];
              if (uri) {
                // Ajustar la posición y tamaño de la firma dentro de la celda
                doc.addImage(uri, 'PNG', data.cell.x + 2, data.cell.y + 2, 46, 16);
              }
            }
          }
        });

        const pdfBlob = doc.output("blob");
        const url = URL.createObjectURL(pdfBlob) + "#toolbar=0&navpanes=0";
        setPdfPreview({ url, filename: `Registro_${employee.firstName}_${employee.lastName}_${employee.documentNumber}.pdf` });
        toast.success("PDF generado exitosamente", { id: toastId });
      };

      // Cargar la imagen del logo en memoria antes de pasársela a jsPDF
      const img = new Image();
      img.src = shieldLogo;
      img.onload = () => drawPDF(img);
      img.onerror = () => drawPDF(null);
    } catch (error) {
      console.error("Error al procesar el PDF:", error);
      toast.error("Ocurrió un error inesperado al armar el PDF", { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Registro de Capacitaciones</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay registros de capacitaciones disponibles.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {companies.map(company => {
            // Calcular porcentaje global de la empresa
            const totalRequired = company.totalTrainings * company.employees.length;
            const totalCompleted = company.employees.reduce((acc, emp) => acc + new Set(emp.records.map(r => r.trainingTitle)).size, 0);
            const companyPct = totalRequired > 0 ? Math.min(100, Math.round((totalCompleted / totalRequired) * 100)) : 0;

            return (
            <div key={company.id} className="border border-border rounded-lg bg-card">
              <div onClick={() => toggleCompany(company.id)} className={`w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer ${expanded.has(company.id) ? 'rounded-t-lg' : 'rounded-lg'}`}>
                <div className="flex items-center gap-3">
                  {expanded.has(company.id) ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-foreground text-lg">{company.name}</span>
                  <CircularProgress value={companyPct} />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground hidden sm:inline">{company.employees.length} empleados</span>
                  <div className="relative">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="h-8 gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (trainingListDialog.open && trainingListDialog.companyId === company.id) {
                          setTrainingListDialog({ open: false, companyId: "", companyName: "", trainings: [] });
                        } else {
                          setTrainingListDialog({ open: true, companyId: company.id, companyName: company.name, trainings: company.assignedTrainings });
                        }
                      }}
                    >
                      <GraduationCap className="h-4 w-4 text-primary" />
                      {company.totalTrainings} asignadas
                    </Button>

                    {trainingListDialog.open && trainingListDialog.companyId === company.id && (
                      <>
                        {/* Overlay invisible para cerrar al hacer clic afuera */}
                        <div className="fixed inset-0 z-40 bg-transparent" onClick={(e) => { e.stopPropagation(); setTrainingListDialog(prev => ({ ...prev, open: false })); }} />
                        
                        {/* Popover desplegable */}
                        <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-lg border border-border bg-card shadow-xl animate-slide-in-right cursor-default" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
                            <div>
                              <h3 className="font-display font-semibold text-card-foreground text-sm">Capacitaciones asignadas</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">{company.name}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTrainingListDialog(prev => ({ ...prev, open: false }))}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            {trainingListDialog.trainings.length === 0 ? (
                              <p className="text-center text-muted-foreground py-8 text-sm">No hay capacitaciones asignadas a esta empresa.</p>
                            ) : (
                              trainingListDialog.trainings.map((t, idx) => (
                                <div key={idx} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <GraduationCap className="h-4 w-4 text-primary shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm text-foreground truncate">{t.title}</p>
                                      <p className="text-xs text-muted-foreground mt-1">Asignada: {t.date}</p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {expanded.has(company.id) && (
                <div className="p-4 bg-muted/20 border-t border-border">
                  {company.employees.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No hay empleados registrados en esta empresa.</p>
                  ) : (
                    <div className="space-y-3">
                      {company.employees.map(emp => {
                        // Calculamos cuántas capacitaciones ÚNICAS tiene realizadas este empleado
                        const uniqueTrainings = new Set(emp.records.map(r => r.trainingTitle)).size;
                        const pct = company.totalTrainings > 0 ? Math.min(100, Math.round((uniqueTrainings / company.totalTrainings) * 100)) : 0;

                        return (
                          <div key={emp.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-background border border-border rounded-lg gap-3">
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-foreground">{emp.firstName} {emp.lastName}</p>
                                <p className="text-xs text-muted-foreground">Doc: {emp.documentNumber}</p>
                              </div>
                            </div>
                            <Button variant="outline" className={`font-bold w-full sm:w-auto ${pct === 100 ? 'text-green-600 border-green-600/30 bg-green-50 dark:bg-green-950/20' : 'text-primary'}`} onClick={() => handlePdfClick(company, emp)}>
                              {pct}% Realizado
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* PDF Preview Dialog */}
      <Dialog open={!!pdfPreview} onOpenChange={(open) => {
        if (!open) {
          if (pdfPreview) URL.revokeObjectURL(pdfPreview.url.split('#')[0]);
          setPdfPreview(null);
        }
      }}>
        <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{pdfPreview?.filename}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted/20 rounded-md overflow-hidden relative border border-border">
            {pdfPreview && (
              <iframe
                src={pdfPreview.url}
                className="absolute inset-0 w-full h-full border-0"
                title={pdfPreview.filename}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (pdfPreview) URL.revokeObjectURL(pdfPreview.url.split('#')[0]);
              setPdfPreview(null);
            }}>
              Cerrar
            </Button>
            <Button onClick={() => {
              if (pdfPreview) {
                const link = document.createElement("a");
                link.href = pdfPreview.url.split('#')[0];
                link.download = pdfPreview.filename;
                link.click();
              }
            }}>
              <Download className="mr-2 h-4 w-4" />
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}