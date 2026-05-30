import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import {
  apiFetchEmployees,
  type Employee,
} from "@/services/employeeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Loader2, Users, HardHat, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import EmployeeEppsDialog from "@/components/EmployeeEppsDialog";
import EmployeeEppsPdfDialog from "@/components/EmployeeEppsPdfDialog";

const PAGE_SIZE = 10;

export default function NominaEmpleadosPage() {
  const { selectedCompany } = useApp();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [eppDialogOpen, setEppDialogOpen] = useState(false);
  const [eppPdfDialogOpen, setEppPdfDialogOpen] = useState(false);
  const [selectedEmployeeForEpp, setSelectedEmployeeForEpp] = useState<Employee | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadData = useCallback(async () => {
    if (!selectedCompany) {
      setEmployees([]);
      setTotal(0);
      return;
    }
    setIsLoading(true);
    try {
      const res = await apiFetchEmployees({
        companyId: selectedCompany.id,
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
      });
      setEmployees(res.data);
      setTotal(res.total);
    } catch {
      toast.error("Error al cargar la nómina");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompany, page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        Por favor, seleccione una empresa en el menú superior para ver su nómina.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Nómina de Empleados</h1>
            <p className="text-sm text-muted-foreground">{selectedCompany.name}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o documento..."
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="hidden md:table-cell">Puesto / Depto</TableHead>
                <TableHead className="hidden lg:table-cell">Contacto</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No se encontraron empleados
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp) => (
                  <TableRow key={emp.id} className={!emp.active ? "opacity-60 bg-muted/50" : ""}>
                    <TableCell className="font-medium">
                      {emp.firstName} {emp.lastName}
                    </TableCell>
                    <TableCell>{emp.documentNumber}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-sm">{emp.position}</p>
                      <p className="text-xs text-muted-foreground">{emp.department}</p>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {emp.email && <p className="text-sm">{emp.email}</p>}
                      {emp.phone && <p className="text-xs text-muted-foreground">{emp.phone}</p>}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          emp.active
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {emp.active ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Seguimiento de Entrega de Epps"
                          onClick={() => {
                            setSelectedEmployeeForEpp(emp);
                            setEppPdfDialogOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Asignar EPP"
                          onClick={() => {
                            setSelectedEmployeeForEpp(emp);
                            setEppDialogOpen(true);
                          }}
                        >
                          <HardHat className="h-4 w-4 text-primary" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink isActive={p === page} onClick={() => setPage(p)} className="cursor-pointer">
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <EmployeeEppsDialog
        open={eppDialogOpen}
        onOpenChange={setEppDialogOpen}
        employeeId={selectedEmployeeForEpp ? selectedEmployeeForEpp.id : null}
        employeeName={selectedEmployeeForEpp ? `${selectedEmployeeForEpp.firstName} ${selectedEmployeeForEpp.lastName}` : ""}
      />

      <EmployeeEppsPdfDialog
        open={eppPdfDialogOpen}
        onOpenChange={setEppPdfDialogOpen}
        employeeId={selectedEmployeeForEpp ? selectedEmployeeForEpp.id : null}
        employeeName={selectedEmployeeForEpp ? `${selectedEmployeeForEpp.firstName} ${selectedEmployeeForEpp.lastName}` : ""}
        employeeDocument={selectedEmployeeForEpp?.documentNumber || ""}
        companyName={selectedCompany.name}
      />
    </div>
  );
}