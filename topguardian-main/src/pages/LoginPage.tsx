import { useState } from "react";
import shieldLogo from "@/assets/shield-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Lock } from "lucide-react";
import { toast } from "sonner";

const LoginPage = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate("/dashboard");
    } catch {
      toast.error("Credenciales inválidas. Usa usuario: ssandoval, contraseña: 123");
    }
  };



  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[hsl(var(--login-gradient-from))] via-[hsl(var(--primary))] to-[hsl(var(--accent))] p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Glass card */}
        <div className="rounded-2xl border border-[hsl(var(--border)/0.15)] bg-[hsl(var(--card)/0.95)] p-8 shadow-2xl backdrop-blur-xl">
          {/* Logo */}
          <div className="mb-8 text-center">
            <img src={shieldLogo} alt="TopGuardian" className="mx-auto mb-3 drop-shadow-lg" style={{ height: '60px', width: '60px', background: 'transparent' }} />
            <h1 className="text-3xl font-display font-bold text-foreground">
              <span className="text-accent">Top</span>Guardian
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">Usuario</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Nombre de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" className="text-sm text-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>
          </form>



          <p className="mt-8 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <button className="text-primary font-medium hover:underline">Regístrate</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
