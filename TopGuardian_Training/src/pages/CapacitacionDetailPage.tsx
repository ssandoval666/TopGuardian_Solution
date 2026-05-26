import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/api";
import { Capacitacion, PreguntaCuestionario } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import {
  PenTool,
  FileText,
  ClipboardList,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Eraser,
  AlertCircle,
} from "lucide-react";

const STEPS = [
  { icon: PenTool, label: "Firma" },
  { icon: FileText, label: "Material" },
  { icon: ClipboardList, label: "Cuestionario" },
  { icon: CheckCircle2, label: "Completado" },
];

const CapacitacionDetailPage: React.FC = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const capacitacion = (location.state as { capacitacion?: Capacitacion })?.capacitacion;

  const [currentStep, setCurrentStep] = useState(0);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [cuestionario, setCuestionario] = useState<PreguntaCuestionario[]>([]);
  const [porcentaje, setPorcentaje] = useState(0);
  const [quizError, setQuizError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fullTraining, setFullTraining] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (codigo && user) {
      apiService.getCapacitacionCompleta(codigo, user.token).then(data => {
        setFullTraining(data);
        // Map API questionnaire to local state
        if (data.questionnaire && data.questionnaire.questions) {
          const mappedQuestions = data.questionnaire.questions.map((q: any) => ({
            id: q.id,
            pregunta: q.text,
            opciones: q.options.map((o: any) => o.text),
            respuestaCorrecta: q.options.findIndex((o: any) => o.isCorrect)
          }));
          setCuestionario(mappedQuestions);
        }
        
        // Generate PDF preview
        if (data.pdfData && data.pdfData.length > 0) {
          const blob = new Blob([new Uint8Array(data.pdfData)], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
        }
      }).catch(err => console.error(err));
    }
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [codigo, user]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = "hsl(220, 18%, 14%)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "hsl(210, 70%, 50%)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [currentStep]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    isDrawing.current = false;
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "hsl(220, 18%, 14%)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const handleNext = useCallback(async () => {
    if (currentStep === 2) {
      // Validate quiz
      const total = cuestionario.length;
      const correct = cuestionario.filter((q) => respuestas[q.id] === q.respuestaCorrecta).length;
      const requiredCorrect = fullTraining?.questionnaire?.minPassingScore || Math.ceil(total * 0.5);
      const pct = Math.round((correct / total) * 100);
      setPorcentaje(pct);
      if (correct < requiredCorrect) {
        setQuizError(`Debe responder correctamente al menos ${requiredCorrect} preguntas. Su resultado: ${correct}/${total}. Intente nuevamente.`);
        return;
      }
      setQuizError("");
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Submit
      if (!user || !codigo || submitted) return;
      setSubmitting(true);
      await apiService.registrarCapacitacion({
        token: user.token,
        codigoCapacitacion: codigo,
        codigoUsuario: user.id,
        porcentajeAprobacion: porcentaje,
      });
      setSubmitted(true);
      setSubmitting(false);
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, cuestionario, respuestas, user, codigo, porcentaje, submitted]);

  const canAdvance = () => {
    if (currentStep === 0) return !!signatureData;
    if (currentStep === 1) return true;
    if (currentStep === 2) return Object.keys(respuestas).length === cuestionario.length;
    return true;
  };

  if (!capacitacion) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Capacitación no encontrada.</p>
        <button onClick={() => navigate("/capacitaciones")} className="text-primary mt-4 hover:underline">
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/capacitaciones")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{capacitacion.nombre}</h1>
          <p className="text-sm text-muted-foreground">{capacitacion.codigo}</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((step, i) => (
          <React.Fragment key={i}>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                i === currentStep
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : i < currentStep
                  ? "bg-success/10 text-success"
                  : "text-muted-foreground"
              }`}
            >
              <step.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < currentStep ? "bg-success" : "bg-border"}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="glass-card rounded-xl p-6"
        >
          {/* Step 0: Signature */}
          {currentStep === 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Dibuje su firma</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Utilice el recuadro para dibujar su firma. Esta será registrada como constancia.
              </p>
              <div className="relative border border-border rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="w-full h-48 cursor-crosshair touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
              </div>
              <button
                onClick={clearSignature}
                className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Eraser className="w-4 h-4" /> Limpiar firma
              </button>
            </div>
          )}

          {/* Step 1: PDF Viewer */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Material de Capacitación</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Lea el material completo antes de continuar al cuestionario.
              </p>
              <div className="border border-border rounded-lg bg-secondary overflow-hidden h-[500px] flex flex-col items-center justify-center relative">
                {pdfUrl ? (
                  <iframe src={pdfUrl} className="w-full h-full border-0 absolute inset-0" title="PDF de Capacitación" />
                ) : (
                  <>
                    <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">Cargando material...</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Questionnaire */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Cuestionario</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Responda todas las preguntas. Debe aprobar al menos el 50%.
              </p>
              <div className="space-y-6">
                {cuestionario.map((q, qi) => (
                  <div key={q.id} className="space-y-3">
                    <p className="font-medium text-foreground">
                      {qi + 1}. {q.pregunta}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.opciones.map((op, oi) => (
                        <button
                          key={oi}
                          onClick={() => setRespuestas((prev) => ({ ...prev, [q.id]: oi }))}
                          className={`text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                            respuestas[q.id] === oi
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-secondary text-foreground hover:border-muted-foreground"
                          }`}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {quizError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 flex items-center gap-2 text-destructive text-sm"
                >
                  <AlertCircle className="w-4 h-4" />
                  {quizError}
                </motion.div>
              )}
            </div>
          )}

          {/* Step 3: Completed */}
          {currentStep === 3 && (
            <div className="text-center py-8">
              {!submitted ? (
                <>
                  <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-foreground mb-2">¡Capacitación Aprobada!</h2>
                  <p className="text-muted-foreground mb-2">
                    Ha completado exitosamente: <span className="text-foreground font-medium">{capacitacion.nombre}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Porcentaje de aprobación: <span className="text-success font-semibold">{porcentaje}%</span>
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-foreground mb-2">¡Registro Exitoso!</h2>
                  <p className="text-muted-foreground mb-6">
                    La capacitación ha sido registrada correctamente.
                  </p>
                  <button
                    onClick={() => navigate("/capacitaciones")}
                    className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all"
                  >
                    Volver a Capacitaciones
                  </button>
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      {!(currentStep === 3 && submitted) && (
        <div className="flex justify-between mt-6">
          <button
            onClick={() => currentStep > 0 && currentStep < 3 && setCurrentStep((s) => s - 1)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
              currentStep > 0 && currentStep < 3
                ? "bg-secondary text-foreground hover:bg-muted"
                : "opacity-0 pointer-events-none"
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <button
            onClick={handleNext}
            disabled={!canAdvance() || submitting}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Registrando...
              </>
            ) : currentStep === 3 ? (
              "Registrar Capacitación"
            ) : (
              <>
                Siguiente <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default CapacitacionDetailPage;
