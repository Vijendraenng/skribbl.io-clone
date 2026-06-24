import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../contexts/GameContext";
import DrawingCanvas from "../components/canvas/DrawingCanvas";
import ChatPanel from "../components/chat/ChatPanel";
import PlayerList from "../components/game/PlayerList";
import TimerBar from "../components/game/TimerBar";
import WordChooser from "../components/game/WordChooser";
import RoundEndOverlay from "../components/game/RoundEndOverlay";
import { useTimer } from "../hooks/useTimer";

export default function GamePage() {
  const navigate = useNavigate();
  const {
    room, game, playerId, currentWord, currentHint,
    wordChoices, roundEnd, gameOver, nickname, fullReset,
  } = useGame();
  const [showPlayers, setShowPlayers] = useState(false);
  const [tab, setTab] = useState<"canvas" | "chat">("canvas");

  useEffect(() => { if (!room && !nickname) navigate("/"); }, [room, nickname, navigate]);
  useEffect(() => { if (gameOver) navigate(`/game-over/${room?.roomCode}`); }, [gameOver, navigate, room]);

  const isDrawer = game?.currentDrawerId === playerId;
  const isDrawing = game?.phase === "drawing";
  const drawTime = game?.drawTime || 80;
  const { timeLeft } = useTimer(drawTime, isDrawing && !wordChoices);

  const handleExit = () => { fullReset(); navigate("/"); };

  if (!room || !game) return null;

  return (
    <>
      {wordChoices && <WordChooser />}
      {roundEnd && game.phase === "round_end" && <RoundEndOverlay data={roundEnd} />}

      {/* ── Shared top bar ── */}
      <div className="bg-game-card border-b border-game-border px-3 py-2 flex items-center gap-2 shrink-0">
        <span className="font-game text-game-accent text-base hidden sm:block">Skribbl</span>
        <span className="text-gray-400 text-xs shrink-0">
          R{(game.currentRound || 0) + 1}/{game.totalRounds}
        </span>

        {isDrawing
          ? <div className="flex-1 mx-1"><TimerBar timeLeft={timeLeft} totalTime={drawTime} /></div>
          : <div className="flex-1" />
        }

        {game.currentDrawerName && (
          <span className="text-xs text-gray-300 shrink-0 hidden sm:block">
            {isDrawer ? "✏️ You're drawing!" : `✏️ ${game.currentDrawerName}`}
          </span>
        )}

        {/* Mobile tab switcher */}
        <div className="flex gap-1 lg:hidden">
          <button
            onClick={() => setTab("canvas")}
            className={`px-2 py-1 rounded text-xs font-bold border transition-all ${
              tab === "canvas" ? "bg-game-accent border-game-accent text-white" : "border-game-border text-gray-400"
            }`}
          >
            🎨
          </button>
          <button
            onClick={() => setTab("chat")}
            className={`px-2 py-1 rounded text-xs font-bold border transition-all ${
              tab === "chat" ? "bg-game-accent border-game-accent text-white" : "border-game-border text-gray-400"
            }`}
          >
            💬
          </button>
          <button
            onClick={() => setShowPlayers(s => !s)}
            className={`px-2 py-1 rounded text-xs font-bold border transition-all ${
              showPlayers ? "bg-game-accent border-game-accent text-white" : "border-game-border text-gray-400"
            }`}
          >
            👥
          </button>
        </div>

        {/* Exit button */}
        <button
          onClick={handleExit}
          className="px-2 py-1 rounded text-xs font-bold border border-game-border text-gray-400 hover:border-red-500 hover:text-red-400 transition-all shrink-0"
        >
          Exit
        </button>
      </div>

      {/* ── MOBILE layout — single canvas instance, tab-switched ── */}
      <div className="lg:hidden flex flex-col bg-game-bg" style={{ height: "calc(100vh - 45px)" }}>
        {showPlayers && (
          <div className="border-b border-game-border p-2 bg-game-bg shrink-0">
            <PlayerList players={game.players} currentDrawerId={game.currentDrawerId}
              hostId={room.hostId} myId={playerId} showScores />
          </div>
        )}

        {/* Canvas tab */}
        <div className={`flex-1 overflow-y-auto p-2 ${tab !== "canvas" ? "hidden" : ""}`}>
          <DrawingCanvas
            isDrawer={isDrawer}
            word={isDrawer ? currentWord : undefined}
            hint={!isDrawer ? currentHint : undefined}
          />
        </div>

        {/* Chat tab */}
        <div className={`flex-1 flex flex-col min-h-0 ${tab !== "chat" ? "hidden" : ""}`}>
          <ChatPanel isDrawer={isDrawer} />
        </div>
      </div>

      {/* ── DESKTOP layout — fixed 3-col, no scroll ── */}
      <div
        className="hidden lg:flex gap-2 p-2 bg-game-bg"
        style={{ height: "calc(100vh - 45px)", overflow: "hidden" }}
      >
        {/* Players */}
        <div className="w-44 shrink-0 overflow-y-auto flex flex-col gap-1">
          <PlayerList players={game.players} currentDrawerId={game.currentDrawerId}
            hostId={room.hostId} myId={playerId} showScores />
        </div>

        {/* Canvas — fills remaining space */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <DrawingCanvas
            isDrawer={isDrawer}
            word={isDrawer ? currentWord : undefined}
            hint={!isDrawer ? currentHint : undefined}
          />
        </div>

        {/* Chat */}
        <div className="w-60 xl:w-64 shrink-0 flex flex-col overflow-hidden">
          <ChatPanel isDrawer={isDrawer} />
        </div>
      </div>
    </>
  );
}