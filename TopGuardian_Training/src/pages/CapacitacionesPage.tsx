import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/api";
import { Capacitacion } from "@/types";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const CapacitacionesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [capacitaciones, setCapacitaciones] = useState<Capacitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchCapacitaciones = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // user.companyId estará disponible gracias a nuestro mapeo del login
      const res = await apiService.getCapacitaciones((user as any).companyId || user.id, user.token);
      setCapacitaciones(res.capacitaciones);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCapacitaciones();
  }, [user]);

  const handleSelect = (cap: Capacitacion) => {
    navigate(`/capacitacion/${cap.codigo}`, { state: { capacitacion: cap } });
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % capacitaciones.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + capacitaciones.length) % capacitaciones.length);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (capacitaciones.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-64 text-center"
      >
        <BookOpen className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Sin capacitaciones pendientes</h2>
        <p className="text-muted-foreground">No tiene capacitaciones asignadas en este momento.</p>
      </motion.div>
    );
  }

  // Visible items (up to 3)
  const visibleCount = Math.min(capacitaciones.length, 3);
  const getVisibleItems = () => {
    const items: { cap: Capacitacion; idx: number }[] = [];
    for (let i = 0; i < visibleCount; i++) {
      const idx = (currentIndex + i) % capacitaciones.length;
      items.push({ cap: capacitaciones[idx], idx });
    }
    return items;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <h1 className="text-2xl font-bold text-foreground mb-2">Capacitaciones</h1>
      <p className="text-muted-foreground mb-8">
        Seleccione una capacitación para comenzar el proceso.
      </p>

      {/* Carousel */}
      <div className="relative">
        <div className="flex items-center gap-4">
          {capacitaciones.length > visibleCount && (
            <button
              onClick={prevSlide}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
          )}

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {getVisibleItems().map(({ cap, idx }) => (
              <motion.div
                key={cap.codigo}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => handleSelect(cap)}
                className="glass-card rounded-xl overflow-hidden cursor-pointer group hover:border-primary/30 transition-all duration-300"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted flex items-center justify-center">
                  {cap.thumbnail ? (
                    <img src={`data:image/svg+xml;base64,${cap.thumbnail}`} alt={cap.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <BookOpen className="w-16 h-16 text-muted-foreground/30 group-hover:scale-110 transition-transform duration-500" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {cap.nombre}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">Código: {cap.codigo}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {capacitaciones.length > visibleCount && (
            <button
              onClick={nextSlide}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          )}
        </div>

        {/* Dots */}
        {capacitaciones.length > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {capacitaciones.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex ? "w-6 bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CapacitacionesPage;
