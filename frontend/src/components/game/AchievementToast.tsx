import React, { useEffect, useState } from "react";
import { getSocket } from "../../utils/socket";

interface Achievement {
  id: string;
  icon: string;
  title: string;
  desc: string;
}

interface Toast {
  id: number;
  achievement: Achievement;
}

let _toastId = 0;

export default function AchievementToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const socket = getSocket();
    const handler = ({ achievement }: { achievement: Achievement }) => {
      const id = ++_toastId;
      setToasts((t) => [...t, { id, achievement }]);
      // Auto-remove after 5s
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    };
    socket.on("achievement_unlocked", handler);
    return () => {
      socket.off("achievement_unlocked", handler);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="bg-game-card border border-yellow-500/60 rounded-xl px-4 py-3 shadow-2xl
                     flex items-center gap-3 min-w-[240px] max-w-[300px]
                     animate-slide-in pointer-events-auto"
          style={{ animation: "slideIn 0.3s ease-out" }}
        >
          <div className="text-3xl shrink-0">{toast.achievement.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-yellow-400 font-bold text-xs uppercase tracking-wider mb-0.5">
              🏅 Achievement Unlocked!
            </div>
            <div className="text-white font-bold text-sm">
              {toast.achievement.title}
            </div>
            <div className="text-gray-400 text-xs truncate">
              {toast.achievement.desc}
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
