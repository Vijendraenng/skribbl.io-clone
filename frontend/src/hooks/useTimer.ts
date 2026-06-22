import { useState, useEffect, useRef } from "react";

/**
 * Count-down timer hook
 * @param initialSeconds - seconds to count down from
 * @param running - whether timer is active
 */
export function useTimer(initialSeconds: number, running: boolean) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setTimeLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const percentage = initialSeconds > 0 ? (timeLeft / initialSeconds) * 100 : 0;
  return { timeLeft, percentage };
}
