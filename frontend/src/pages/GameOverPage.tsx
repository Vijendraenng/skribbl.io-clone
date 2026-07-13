import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../contexts/GameContext";
import { getSocket } from "../utils/socket";
import { avatarBgColor } from "../utils/avatars";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function GameOverPage() {
  const navigate = useNavigate();
  const { gameOver, leaderboard, room, isHost, resetForNewGame, fullReset, redirectTo, clearRedirect } = useGame();
  const handleLeaderboard = () => navigate("/leaderboard");

  const winner = gameOver?.winner || leaderboard[0];
  const scores = gameOver?.leaderboard || leaderboard;

  // When server tells everyone to go to lobby (triggered by host's play_again)
  useEffect(() => {
    if (redirectTo) {
      clearRedirect();
      navigate(redirectTo);
    }
  }, [redirectTo, clearRedirect, navigate]);

  const handlePlayAgain = () => {
    // Only host can trigger this; emits play_again → server broadcasts redirect_to_lobby to all
    getSocket().emit("play_again", {}, (res: any) => {
      if (res?.error) {
        console.error("play_again error:", res.error);
        // Fallback: reset and navigate locally
        resetForNewGame();
        navigate(`/lobby/${room?.roomCode}`);
      }
      // Success: the redirect_to_lobby event will handle navigation for everyone
    });
  };

  const handleHome = () => { fullReset(); navigate("/"); };

  return (
    <div className="min-h-screen bg-game-bg flex items-center justify-center p-4">
      <div className="bg-game-card border border-game-border rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">

        {winner && (
          <div className="mb-8">
            <div className="text-6xl mb-3">🏆</div>
            <div className="font-game text-yellow-400 text-3xl mb-1">Winner!</div>
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto border-4 border-yellow-400 mb-2"
              style={{ backgroundColor: avatarBgColor(winner.nickname) }}
            >
              {winner.avatar}
            </div>
            <div className="font-game text-white text-2xl">{winner.nickname}</div>
            <div className="text-yellow-400 font-bold text-xl">{winner.score} pts</div>
          </div>
        )}

        <div className="space-y-2 mb-8">
          <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-3">Final Scores</h3>
          {scores.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                i === 0 ? "bg-yellow-600/20 border border-yellow-600/40" : "bg-game-bg"
              }`}
            >
              <span className="text-xl w-8">{MEDALS[i] || `${i + 1}.`}</span>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xl"
                style={{ backgroundColor: avatarBgColor(entry.nickname) }}
              >
                {entry.avatar}
              </div>
              <span className="flex-1 text-white font-semibold text-left">{entry.nickname}</span>
              <span className="text-yellow-400 font-bold">{entry.score} pts</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          {isHost ? (
            <button
              onClick={handlePlayAgain}
              className="flex-1 py-3 bg-blue-600 text-white font-game text-lg rounded-xl hover:bg-blue-500 transition-all hover:scale-105 active:scale-95"
            >
              🔄 Play Again
            </button>
          ) : (
            <div className="flex-1 py-3 bg-game-border text-gray-400 font-game text-base rounded-xl text-center flex items-center justify-center gap-2">
              <span className="animate-pulse">⏳</span> Waiting for host…
            </div>
          )}
          <button
            onClick={handleLeaderboard}
            className="flex-1 py-3 bg-yellow-600/20 border border-yellow-600/40 text-yellow-400 font-game text-lg rounded-xl hover:bg-yellow-600/30 transition-all hover:scale-105 active:scale-95"
          >
            🏆 Ranks
          </button>
          <button
            onClick={handleHome}
            className="flex-1 py-3 bg-game-accent text-white font-game text-lg rounded-xl hover:bg-red-500 transition-all hover:scale-105 active:scale-95"
          >
            🏠 Home
          </button>
        </div>
      </div>
    </div>
  );
}
