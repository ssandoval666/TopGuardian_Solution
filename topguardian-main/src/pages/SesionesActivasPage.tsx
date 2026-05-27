import { useState, useEffect } from "react";
import { chatService, type ChatUser } from "@/services/chatService";
import { apiForceLogoutUser } from "@/services/userApi";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SesionesActivasPage() {
  const [onlineUsers, setOnlineUsers] = useState<ChatUser[]>([]);
  const [logoutTarget, setLogoutTarget] = useState<ChatUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      const snapshot = chatService.getSnapshot();
      // Filtramos únicamente los usuarios en línea
      setOnlineUsers(snapshot.users.filter((u) => u.online));
    };

    const unsubscribe = chatService.subscribe(handleUpdate);
    handleUpdate();

    return unsubscribe;
  }, []);

  const handleConfirmLogout = async () => {
    if (!logoutTarget) return;
    setIsLoggingOut(true);
    try {
      await apiForceLogoutUser(logoutTarget.id.toString());
      toast.success(`Se ha enviado la orden de cierre de sesión a ${logoutTarget.name}`);
    } catch (error) {
      toast.error("Error al forzar el cierre de sesión");
    } finally {
      setIsLoggingOut(false);
      setLogoutTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Sesiones Activas</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios conectados actualmente ({onlineUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {onlineUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No hay otros usuarios conectados en este momento.</p>
          ) : (
            <div className="space-y-3">
              {onlineUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                        {user.name.charAt(0)}
                      </div>
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => setLogoutTarget(user)}>
                    <LogOut className="h-4 w-4 mr-2" /> Desconectar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!logoutTarget} onOpenChange={(open) => !open && setLogoutTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Forzar cierre de sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              El usuario <strong>{logoutTarget?.name}</strong> será desconectado inmediatamente del sistema y perderá cualquier trabajo no guardado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLogout} disabled={isLoggingOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isLoggingOut && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Desconectar Usuario
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}