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
    room,
    game,
    playerId,
    currentWord,
    currentHint,
    wordChoices,
    roundEnd,
    gameOver,
    nickname,
  } = useGame();
  const [showPlayers, setShowPlayers] = useState(false);

  useEffect(() => {
    if (!room && !nickname) navigate("/");
  }, [room, nickname, navigate]);
  useEffect(() => {
    if (gameOver) navigate(`/game-over/${room?.roomCode}`);
  }, [gameOver, navigate, room]);

  const isDrawer = game?.currentDrawerId === playerId;
  const isDrawing = game?.phase === "drawing";
  const drawTime = game?.drawTime || 80;
  const { timeLeft } = useTimer(drawTime, isDrawing && !wordChoices);

  if (!room || !game) return null;

  return (
    <>
      {wordChoices && <WordChooser />}
      {roundEnd && game.phase === "round_end" && (
        <RoundEndOverlay data={roundEnd} />
      )}

      {/* ── MOBILE layout (< lg) — scrollable vertical stack ── */}
      <div className="lg:hidden min-h-screen bg-game-bg flex flex-col">
        {/* Top bar */}
        <div className="bg-game-card border-b border-game-border px-3 py-2 flex items-center gap-2 shrink-0">
          <span className="text-gray-400 text-xs shrink-0">
            R{(game.currentRound || 0) + 1}/{game.totalRounds}
          </span>

          {isDrawing ? (
            <div className="flex-1">
              <TimerBar timeLeft={timeLeft} totalTime={drawTime} />
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {game.currentDrawerName && (
            <span className="text-xs text-gray-300 shrink-0">
              {isDrawer ? "✏️ You!" : `✏️ ${game.currentDrawerName}`}
            </span>
          )}

          <button
            onClick={() => setShowPlayers((s) => !s)}
            className={`px-2 py-1 rounded text-xs font-bold border transition-all shrink-0 ${
              showPlayers
                ? "bg-game-accent border-game-accent text-white"
                : "border-game-border text-gray-400"
            }`}
          >
            👥 {room.players.filter((p) => p.isConnected !== false).length}
          </button>
        </div>

        {/* Players drawer (collapsible) */}
        {showPlayers && (
          <div className="bg-game-bg border-b border-game-border p-2">
            <PlayerList
              players={game.players}
              currentDrawerId={game.currentDrawerId}
              hostId={room.hostId}
              myId={playerId}
              showScores
            />
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Canvas */}
          <div className="p-2">
            <DrawingCanvas
              isDrawer={isDrawer}
              word={isDrawer ? currentWord : undefined}
              hint={!isDrawer ? currentHint : undefined}
            />
          </div>

          {/* Chat — always visible below canvas, fixed height with scroll inside */}
          <div className="px-2 pb-4">
            <div
              className="bg-game-card border border-game-border rounded-xl overflow-hidden flex flex-col"
              style={{ height: "320px" }}
            >
              <ChatPanel />
            </div>
          </div>
        </div>
      </div>

      {/* ── DESKTOP layout (>= lg) — fixed 3-column side-by-side ── */}
      <div className="hidden lg:flex h-screen bg-game-bg flex-col">
        {/* Top bar */}
        <div className="bg-game-card border-b border-game-border px-4 py-2 flex items-center gap-3 shrink-0">
          <div className="font-game text-game-accent text-xl">Skribbl</div>
          <span className="text-gray-400 text-sm">
            R{(game.currentRound || 0) + 1}/{game.totalRounds}
          </span>

          {isDrawing && (
            <div className="flex-1 max-w-sm mx-auto">
              <TimerBar timeLeft={timeLeft} totalTime={drawTime} />
            </div>
          )}

          {game.currentDrawerName && (
            <span className="text-sm text-gray-300 ml-auto">
              {isDrawer
                ? "✏️ You're drawing!"
                : `✏️ ${game.currentDrawerName} is drawing…`}
            </span>
          )}
        </div>

        {/* 3-column layout */}
        <div className="flex flex-1 gap-3 p-3 overflow-hidden">
          {/* Players */}
          <div className="w-44 xl:w-48 shrink-0 overflow-y-auto">
            <PlayerList
              players={game.players}
              currentDrawerId={game.currentDrawerId}
              hostId={room.hostId}
              myId={playerId}
              showScores
            />
          </div>

          {/* Canvas */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <DrawingCanvas
              isDrawer={isDrawer}
              word={isDrawer ? currentWord : undefined}
              hint={!isDrawer ? currentHint : undefined}
            />
          </div>

          {/* Chat */}
          <div className="w-56 xl:w-64 shrink-0 flex flex-col min-h-0">
            <ChatPanel />
          </div>
        </div>
      </div>
    </>
  );
}
