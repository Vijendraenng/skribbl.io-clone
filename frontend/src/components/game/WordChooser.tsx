import React, { useState, useEffect } from "react";
import { useGame } from "../../contexts/GameContext";

export default function WordChooser() {
  const { wordChoices, wordChoiceTimeLimit, chooseWord } = useGame();
  const [timeLeft, setTimeLeft] = useState(wordChoiceTimeLimit);

  useEffect(() => {
    setTimeLeft(wordChoiceTimeLimit);
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(iv);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [wordChoiceTimeLimit]);

  if (!wordChoices) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-game-card border-2 border-game-accent rounded-2xl p-8 max-w-lg w-full animate-bounce-in shadow-2xl">
        <div className="text-center mb-6">
          <div className="font-game text-game-accent text-2xl mb-1">Choose a word!</div>
          <div className="text-gray-400 text-sm">
            You have <span className="text-yellow-400 font-bold">{timeLeft}s</span> to choose
          </div>
        </div>

        <div className="grid gap-3">
          {wordChoices.map((word) => (
            <button
              key={word}
              onClick={() => chooseWord(word)}
              className="w-full py-4 px-6 bg-game-bg border-2 border-game-border rounded-xl text-white font-game text-2xl 
                         hover:border-game-accent hover:bg-game-accent/10 hover:text-game-accent 
                         transition-all duration-200 hover:scale-105 active:scale-95"
            >
              {word}
            </button>
          ))}
        </div>

        <div className="mt-4 h-1.5 bg-game-border rounded-full overflow-hidden">
          <div
            className="h-full bg-game-accent rounded-full transition-all duration-1000"
            style={{ width: `${(timeLeft / wordChoiceTimeLimit) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
