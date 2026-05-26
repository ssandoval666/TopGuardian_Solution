import { useState, useEffect, useCallback } from "react";
import {
  apiFetchCompanyList,
  apiCreateCompany,
  apiUpdateCompany,
  apiDeleteCompany,
  type CompanyDetail,
} from "@/services/api";
import {
  apiFetchCompanyUsers,
  apiUpdateCompanyUsers,
  apiFetchAllActiveUsers,
} from "@/services/companyUsersApi";
import { type UserDetail } from "@/services/userApi";
import EmployeeDialog from "@/components/EmployeeDialog";
import CompanyTrainingsDialog from "@/components/CompanyTrainingsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Search, Plus, Pencil, Trash2, Loader2, Building2, Users, ClipboardList, GraduationCap } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 5;

const emptyForm: Omit<CompanyDetail, "id"> = {
  name: "",
  ruc: "",
  address: "",
  phone: "",
  email: "",
};

const CompaniesPage = () => {
  const [companies, setCompanies] = useState<CompanyDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyDetail | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<CompanyDetail | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Users assignment state
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [usersCompany, setUsersCompany] = useState<CompanyDetail | null>(null);
  const [allActiveUsers, setAllActiveUsers] = useState<UserDetail[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSavingUsers, setIsSavingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Employee roster state
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [employeeCompany, setEmployeeCompany] = useState<CompanyDetail | null>(null);

  // Company trainings state
  const [trainingsDialogOpen, setTrainingsDialogOpen] = useState(false);
  const [trainingsCompany, setTrainingsCompany] = useState<CompanyDetail | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetchCompanyList({ page, pageSize: PAGE_SIZE, search: search || undefined });
      setCompanies(res.data);
      setTotal(res.total);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleSearch = () => {
    setPage(1);
    loadCompanies();
  };

  const openCreate = () => {
    setEditingCompany(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (company: CompanyDetail) => {
    setEditingCompany(company);
    setForm({ name: company.name, ruc: company.ruc, address: company.address || "", phone: company.phone || "", email: company.email || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.ruc.trim()) {
      toast.error("Nombre y RUC son obligatorios");
      return;
    }
    setIsSaving(true);
    try {
      if (editingCompany) {
        await apiUpdateCompany(editingCompany.id, form);
        toast.success("Empresa actualizada");
      } else {
        await apiCreateCompany(form);
        toast.success("Empresa creada");
      }
      setDialogOpen(false);
      loadCompanies();
    } catch {
      toast.error("Error al guardar la empresa");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiDeleteCompany(deleteTarget.id);
      toast.success("Empresa eliminada");
      setDeleteTarget(null);
      loadCompanies();
    } catch {
      toast.error("Error al eliminar la empresa");
    } finally {
      setIsDeleting(false);
    }
  };

  // Users assignment
  const openUsersDialog = async (company: CompanyDetail) => {
    setUsersCompany(company);
    setUsersDialogOpen(true);
    setIsLoadingUsers(true);
    setUserSearch("");
    try {
      const [activeUsers, assignedIds] = await Promise.all([
        apiFetchAllActiveUsers(),
        apiFetchCompanyUsers(company.id),
      ]);
      setAllActiveUsers(activeUsers);
      setAssignedUserIds(assignedIds);
    } catch {
      toast.error("Error al cargar usuarios");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const toggleUser = (userId: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSaveUsers = async () => {
    if (!usersCompany) return;
    setIsSavingUsers(true);
    try {
      await apiUpdateCompanyUsers(usersCompany.id, assignedUserIds);
      toast.success("Usuarios asignados correctamente");
      setUsersDialogOpen(false);
    } catch {
      toast.error("Error al asignar usuarios");
    } finally {
      setIsSavingUsers(false);
    }
  };

  const filteredActiveUsers = userSearch
    ? allActiveUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.username.toLowerCase().includes(userSearch.toLowerCase())
      )
    : allActiveUsers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Empresas</h1>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Empresa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o RUC..."
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
              <TableHead>Nombre</TableHead>
              <TableHead>RUC</TableHead>
              <TableHead className="hidden md:table-cell">Dirección</TableHead>
              <TableHead className="hidden md:table-cell">Teléfono</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
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
            ) : companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No se encontraron empresas
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium text-foreground">{company.name}</TableCell>
                  <TableCell className="text-muted-foreground">{company.ruc}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{company.address || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{company.phone || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{company.email || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEmployeeCompany(company); setEmployeeDialogOpen(true); }} title="Nómina de empleados">
                        <ClipboardList className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setTrainingsCompany(company); setTrainingsDialogOpen(true); }} title="Capacitaciones asignadas">
                        <GraduationCap className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openUsersDialog(company)} title="Usuarios asignados">
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(company)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(company)} title="Eliminar" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Editar Empresa" : "Nueva Empresa"}</DialogTitle>
            <DialogDescription>
              {editingCompany ? "Modificá los datos de la empresa." : "Completá los datos para dar de alta una nueva empresa."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre de la empresa" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruc">RUC *</Label>
              <Input id="ruc" value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} placeholder="RUC" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Dirección" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Teléfono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCompany ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users Assignment Dialog */}
      <Dialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Usuarios habilitados — {usersCompany?.name}</DialogTitle>
            <DialogDescription>
              Seleccioná los usuarios que pueden trabajar con esta empresa.
            </DialogDescription>
          </DialogHeader>
          {isLoadingUsers ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuario..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-64 overflow-y-auto border border-border rounded-md divide-y divide-border">
                {filteredActiveUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 text-sm">No se encontraron usuarios activos</p>
                ) : (
                  filteredActiveUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={assignedUserIds.includes(user.id)}
                        onCheckedChange={() => toggleUser(user.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.username} · {user.email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{user.role}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {assignedUserIds.length} usuario{assignedUserIds.length !== 1 ? "s" : ""} seleccionado{assignedUserIds.length !== 1 ? "s" : ""}
              </p>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUsersDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveUsers} disabled={isSavingUsers || isLoadingUsers}>
              {isSavingUsers && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la empresa <strong>{deleteTarget?.name}</strong> de forma permanente.
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
      {/* Employee Roster Dialog */}
      {employeeCompany && (
        <EmployeeDialog
          open={employeeDialogOpen}
          onOpenChange={setEmployeeDialogOpen}
          companyId={employeeCompany.id}
          companyName={employeeCompany.name}
        />
      )}
      {/* Company Trainings Dialog */}
      {trainingsCompany && (
        <CompanyTrainingsDialog
          open={trainingsDialogOpen}
          onOpenChange={setTrainingsDialogOpen}
          companyId={trainingsCompany.id}
          companyName={trainingsCompany.name}
        />
      )}
    </div>
  );
};

export default CompaniesPage;
