import { useState, useEffect, useCallback } from "react";
import {
  apiFetchAllMenuItems,
  apiCreateMenuItem,
  apiUpdateMenuItem,
  apiDeleteMenuItem,
  apiUpdateMenuStructure,
  apiFetchRoles,
  type MenuItemRaw,
} from "@/services/api";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Plus, Pencil, Trash2, Loader2, ChevronRight, ChevronDown, GripVertical,
  Settings, LayoutDashboard, Users, BarChart3, ShoppingCart, FileText,
  Building2, GraduationCap, Shield, Map, ClipboardCheck, ClipboardList, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

// Iconos disponibles para el menú
const availableIcons = [
  { name: "LayoutDashboard", icon: LayoutDashboard },
  { name: "Users", icon: Users },
  { name: "BarChart3", icon: BarChart3 },
  { name: "Settings", icon: Settings },
  { name: "ShoppingCart", icon: ShoppingCart },
  { name: "FileText", icon: FileText },
  { name: "Building2", icon: Building2 },
  { name: "GraduationCap", icon: GraduationCap },
  { name: "Shield", icon: Shield },
  { name: "Map", icon: Map },
  { name: "ClipboardCheck", icon: ClipboardCheck },
  { name: "ClipboardList", icon: ClipboardList },
  { name: "CalendarDays", icon: CalendarDays },
];

const emptyForm: Omit<MenuItemRaw, "id"> = {
  label: "",
  icon: "LayoutDashboard",
  path: "",
  requiredRoles: [],
  children: [],
};

interface MenuNodeProps {
  item: MenuItemRaw;
  level: number;
  onEdit: (item: MenuItemRaw) => void;
  onDelete: (item: MenuItemRaw) => void;
  onAddChild: (parentId: string) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (id: string) => void;
  // Props de Drag & Drop
  draggedId: string | null;
  dropTargetId: string | null;
  dropPosition: 'BEFORE' | 'AFTER' | 'INSIDE' | null;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}

const MenuNode: React.FC<MenuNodeProps> = ({
  item,
  level,
  onEdit,
  onDelete,
  onAddChild,
  expandedNodes,
  onToggleExpand,
  draggedId,
  dropTargetId,
  dropPosition,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) => {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedNodes.has(item.id);
  const IconComponent = availableIcons.find(icon => icon.name === item.icon)?.icon || LayoutDashboard;

  const isDropTarget = dropTargetId === item.id;
  const isDragging = draggedId === item.id;

  return (
    <div className={`select-none ${isDragging ? 'opacity-50' : ''}`}>
      {isDropTarget && dropPosition === 'BEFORE' && <div className="h-1 w-full bg-primary rounded-full mb-1" />}

      <div
        draggable
        onDragStart={(e) => onDragStart(e, item.id)}
        onDragOver={(e) => onDragOver(e, item.id)}
        onDrop={(e) => onDrop(e, item.id)}
        onDragEnd={onDragEnd}
        className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
          isDropTarget && dropPosition === 'INSIDE' ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-muted/50'
        } ${level > 0 ? "ml-6" : ""}`}
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        {/* Expand/collapse button */}
        {hasChildren && (
          <button
            onClick={() => onToggleExpand(item.id)}
            className="p-1 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-6" />}

        {/* Drag Handle */}
        <div className="cursor-move p-1 text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Icon */}
        <IconComponent className="h-4 w-4 flex-shrink-0" />

        {/* Label and path */}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{item.label}</div>
          {item.path && (
            <div className="text-xs text-muted-foreground truncate">{item.path}</div>
          )}
        </div>

        {/* Roles */}
        {item.requiredRoles && item.requiredRoles.length > 0 && (
          <div className="flex gap-1">
            {item.requiredRoles.slice(0, 2).map((role) => (
              <span
                key={role}
                className="px-2 py-1 text-xs bg-primary/10 text-primary rounded"
              >
                {role}
              </span>
            ))}
            {item.requiredRoles.length > 2 && (
              <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
                +{item.requiredRoles.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddChild(item.id)}
            className="h-8 w-8 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(item)}
            className="h-8 w-8 p-0"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(item)}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isDropTarget && dropPosition === 'AFTER' && <div className="h-1 w-full bg-primary rounded-full mt-1" />}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {item.children!.map((child) => (
            <MenuNode
              key={child.id}
              item={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              draggedId={draggedId}
              dropTargetId={dropTargetId}
              dropPosition={dropPosition}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MenuPage = () => {
  const { refreshMenu } = useApp();
  const [menuItems, setMenuItems] = useState<MenuItemRaw[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemRaw | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<MenuItemRaw | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  // Drag and drop states
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'BEFORE' | 'AFTER' | 'INSIDE' | null>(null);

  const loadRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    try {
      const roles = await apiFetchRoles();
      setAvailableRoles(roles);
    } catch (error) {
      console.error("Error loading roles:", error);
      toast.error("No se pudieron cargar los roles desde la API");
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const loadMenuItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await apiFetchAllMenuItems();
      setMenuItems(items);
      // Expand all nodes by default
      const allIds = new Set<string>();
      const collectIds = (items: MenuItemRaw[]) => {
        items.forEach(item => {
          allIds.add(item.id);
          if (item.children) collectIds(item.children);
        });
      };
      collectIds(items);
      setExpandedNodes(allIds);
    } catch (error) {
      console.error("Error loading menu items:", error);
      toast.error("Error al cargar los items del menú");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenuItems();
  }, [loadMenuItems]);

  const handleToggleExpand = (id: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId === id) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    let position: 'BEFORE' | 'AFTER' | 'INSIDE' = 'INSIDE';
    if (y < height * 0.25) position = 'BEFORE';
    else if (y > height * 0.75) position = 'AFTER';

    setDropTargetId(id);
    setDropPosition(position);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDropTargetId(null);
    setDropPosition(null);
  };

  const handleDrop = async (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId && dropTargetId && dropPosition) {
      await performDrop(draggedId, dropTargetId, dropPosition);
    }
    handleDragEnd();
  };

  const performDrop = async (dragId: string, targetId: string, position: 'BEFORE' | 'AFTER' | 'INSIDE') => {
    if (dragId === targetId) return;
    const clone = JSON.parse(JSON.stringify(menuItems)) as MenuItemRaw[];

    const isDescendant = (node: MenuItemRaw, searchId: string): boolean => {
      if (!node.children) return false;
      if (node.children.some(c => c.id === searchId)) return true;
      return node.children.some(c => isDescendant(c, searchId));
    };

    let targetNodeRef: MenuItemRaw | null = null;
    const findTarget = (items: MenuItemRaw[]) => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === targetId) targetNodeRef = items[i];
        if (items[i].children) findTarget(items[i].children);
      }
    };
    findTarget(clone);

    if (targetNodeRef && isDescendant(targetNodeRef, dragId)) {
      toast.error("No puedes anidar un menú dentro de su propio hijo");
      return;
    }

    let draggedNode: MenuItemRaw | null = null;
    const removeNode = (items: MenuItemRaw[]) => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === dragId) {
          draggedNode = items.splice(i, 1)[0];
          return true;
        }
        if (items[i].children && removeNode(items[i].children)) return true;
      }
      return false;
    };

    removeNode(clone);
    if (!draggedNode) return;

    const insertNode = (items: MenuItemRaw[]): boolean => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === targetId) {
          if (position === 'BEFORE') {
            items.splice(i, 0, draggedNode!);
          } else if (position === 'AFTER') {
            items.splice(i + 1, 0, draggedNode!);
          } else if (position === 'INSIDE') {
            if (!items[i].children) items[i].children = [];
            items[i].children.push(draggedNode!);
          }
          return true;
        }
        if (items[i].children && insertNode(items[i].children)) return true;
      }
      return false;
    };

    insertNode(clone);
    setMenuItems(clone);

    if (position === 'INSIDE') {
      setExpandedNodes(prev => new Set(prev).add(targetId));
    }

    setIsSaving(true);
    try {
      await apiUpdateMenuStructure(clone);
      toast.success("Orden actualizado correctamente");
      await refreshMenu();
    } catch (error) {
      toast.error("Error al guardar la estructura");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddChild = (parentId: string) => {
    setParentId(parentId);
    setEditingItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleEdit = (item: MenuItemRaw) => {
    setEditingItem(item);
    setParentId(null);
    setForm({
      label: item.label,
      icon: item.icon,
      path: item.path,
      requiredRoles: item.requiredRoles || [],
      children: item.children || [],
    });
    setDialogOpen(true);
  };

  const handleDelete = (item: MenuItemRaw) => {
    setDeleteTarget(item);
  };

  const handleSave = async () => {
    if (!form.label.trim()) {
      toast.error("El nombre del menú es requerido");
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        // Update existing item
        const updatedItem = await apiUpdateMenuItem(editingItem.id, form);
        // Update local state
        const updateItemInTree = (items: MenuItemRaw[]): MenuItemRaw[] => {
          return items.map(item => {
            if (item.id === editingItem.id) {
              return { ...item, ...updatedItem };
            }
            if (item.children) {
              return { ...item, children: updateItemInTree(item.children) };
            }
            return item;
          });
        };
        setMenuItems(updateItemInTree(menuItems));
        toast.success("Item del menú actualizado correctamente");
      } else {
        // Create new item
        const newItem = await apiCreateMenuItem({
          ...form,
          ...(parentId && { parentId }),
        });
        if (parentId) {
          // Add as child
          const addChildToTree = (items: MenuItemRaw[]): MenuItemRaw[] => {
            return items.map(item => {
              if (item.id === parentId) {
                return {
                  ...item,
                  children: [...(item.children || []), newItem],
                };
              }
              if (item.children) {
                return { ...item, children: addChildToTree(item.children) };
              }
              return item;
            });
          };
          setMenuItems(addChildToTree(menuItems));
        } else {
          // Add as root item
          setMenuItems([...menuItems, newItem]);
        }
        toast.success("Item del menú creado correctamente");
      }
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingItem(null);
      setParentId(null);
      // Refrescar el menú global después de guardar
      await refreshMenu();
    } catch (error) {
      console.error("Error saving menu item:", error);
      toast.error("Error al guardar el item del menú");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await apiDeleteMenuItem(deleteTarget.id);
      // Remove from local state
      const removeItemFromTree = (items: MenuItemRaw[]): MenuItemRaw[] => {
        return items
          .filter(item => item.id !== deleteTarget.id)
          .map(item => ({
            ...item,
            children: item.children ? removeItemFromTree(item.children) : undefined,
          }));
      };
      setMenuItems(removeItemFromTree(menuItems));
      toast.success("Item del menú eliminado correctamente");
      setDeleteTarget(null);
      // Refrescar el menú global después de eliminar
      await refreshMenu();
    } catch (error) {
      console.error("Error deleting menu item:", error);
      toast.error("Error al eliminar el item del menú");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRoleToggle = (role: string, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      requiredRoles: checked
        ? [...(prev.requiredRoles || []), role]
        : (prev.requiredRoles || []).filter(r => r !== role),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administración del Menú</h1>
          <p className="text-muted-foreground">
            Gestiona la estructura del menú, permisos y navegación
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => {
            setParentId(null);
            setEditingItem(null);
            setForm(emptyForm);
            setDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Item Raíz
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estructura del Menú</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : menuItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay items en el menú. Crea el primer item para comenzar.
            </div>
          ) : (
            <div className="space-y-1">
              {menuItems.map((item) => (
                <MenuNode
                  key={item.id}
                  item={item}
                  level={0}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAddChild={handleAddChild}
                  expandedNodes={expandedNodes}
                  onToggleExpand={handleToggleExpand}
                  draggedId={draggedId}
                  dropTargetId={dropTargetId}
                  dropPosition={dropPosition}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Item del Menú" : "Crear Nuevo Item del Menú"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="label">Nombre del Menú *</Label>
                <Input
                  id="label"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Ej: Dashboard, Configuración"
                />
              </div>
              <div>
                <Label htmlFor="icon">Ícono</Label>
                <Select
                  value={form.icon}
                  onValueChange={(value) => setForm({ ...form, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableIcons.map((icon) => (
                      <SelectItem key={icon.name} value={icon.name}>
                        <div className="flex items-center gap-2">
                          <icon.icon className="h-4 w-4" />
                          {icon.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="path">Ruta (Path)</Label>
              <Input
                id="path"
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
                placeholder="Ej: /dashboard, /dashboard/users (dejar vacío para contenedor)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Si está vacío, este item actuará como contenedor para sub-menús
              </p>
            </div>

            <div>
              <Label>Roles con Acceso</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {availableRoles.length ? (
                  availableRoles.map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={role}
                        checked={(form.requiredRoles || []).includes(role)}
                        onCheckedChange={(checked) =>
                          handleRoleToggle(role, checked as boolean)
                        }
                      />
                      <Label htmlFor={role} className="text-sm">
                        {role}
                      </Label>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground col-span-2">
                    {isLoadingRoles ? "Cargando roles..." : "No hay roles disponibles"}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Si no se selecciona ningún rol, el item será visible para todos los usuarios
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Item del Menú?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará "{deleteTarget?.label}" y todos sus sub-items de forma permanente.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MenuPage;