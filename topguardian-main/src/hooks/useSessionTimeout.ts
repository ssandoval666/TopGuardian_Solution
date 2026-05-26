import { useEffect, useRef, useCallback } from "react";

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousedown", "mousemove", "keydown", "scroll", "touchstart", "click",
];

/**
 * Hook que cierra sesión automáticamente tras un período de inactividad.
 * @param timeoutMinutes — minutos de inactividad permitidos (default: 15)
 * @param onTimeout — callback ejecutado al expirar el tiempo
 */
export const useSessionTimeout = (timeoutMinutes: number, onTimeout: () => void) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      console.log(`[SessionTimeout] Inactividad de ${timeoutMinutes} min, cerrando sesión...`);
      onTimeout();
    }, timeoutMinutes * 60 * 1000);
  }, [timeoutMinutes, onTimeout]);

  useEffect(() => {
    resetTimer();

    const handler = () => resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => document.addEventListener(evt, handler, true));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => document.removeEventListener(evt, handler, true));
    };
  }, [resetTimer]);
};
