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

  // Top bar shared between mobile and desktop
  const TopBar = () => (
    <div className="bg-game-card border-b border-game-border px-3 py-2 flex items-center gap-2 shrink-0">
      <span className="font-game text-game-accent text-base hidden sm:block">
        Skribbl
      </span>
      <span className="text-gray-400 text-xs shrink-0">
        R{(game.currentRound || 0) + 1}/{game.totalRounds}
      </span>

      {isDrawing ? (
        <div className="flex-1 mx-2">
          <TimerBar timeLeft={timeLeft} totalTime={drawTime} />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {game.currentDrawerName && (
        <span className="text-xs text-gray-300 shrink-0">
          {isDrawer ? "✏️ You're drawing!" : `✏️ ${game.currentDrawerName}`}
        </span>
      )}

      {/* Mobile only: players toggle */}
      <button
        onClick={() => setShowPlayers((s) => !s)}
        className={`lg:hidden px-2 py-1 rounded text-xs font-bold border transition-all shrink-0 ${
          showPlayers
            ? "bg-game-accent border-game-accent text-white"
            : "border-game-border text-gray-400"
        }`}
      >
        👥 {room.players.length}
      </button>
    </div>
  );

  return (
    <>
      {wordChoices && <WordChooser />}
      {roundEnd && game.phase === "round_end" && (
        <RoundEndOverlay data={roundEnd} />
      )}

      {/* ─── MOBILE (< lg): scrollable vertical stack ─── */}
      <div className="lg:hidden min-h-screen bg-game-bg flex flex-col">
        <TopBar />

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

        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <DrawingCanvas
              isDrawer={isDrawer}
              word={isDrawer ? currentWord : undefined}
              hint={!isDrawer ? currentHint : undefined}
            />
          </div>
          {/* Chat always below canvas, fixed height, scrollable inside */}
          <div className="px-2 pb-4">
            <div
              className="rounded-xl overflow-hidden border border-game-border"
              style={{ height: 300 }}
            >
              <ChatPanel isDrawer={isDrawer} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── DESKTOP (>= lg): fixed viewport, no scroll ─── */}
      <div
        className="hidden lg:flex flex-col bg-game-bg"
        style={{ height: "100vh", overflow: "hidden" }}
      >
        <TopBar />

        {/* 3-column layout — fills remaining height exactly */}
        <div
          className="flex gap-2 p-2 min-h-0"
          style={{ flex: 1, overflow: "hidden" }}
        >
          {/* Players — fixed width, scrollable */}
          <div className="w-44 shrink-0 overflow-y-auto">
            <PlayerList
              players={game.players}
              currentDrawerId={game.currentDrawerId}
              hostId={room.hostId}
              myId={playerId}
              showScores
            />
          </div>

          {/* Canvas — fills remaining width, no overflow */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <DrawingCanvas
              isDrawer={isDrawer}
              word={isDrawer ? currentWord : undefined}
              hint={!isDrawer ? currentHint : undefined}
            />
          </div>

          {/* Chat — fixed width, full height, no page scroll */}
          <div className="w-60 shrink-0 flex flex-col overflow-hidden">
            <ChatPanel isDrawer={isDrawer} />
          </div>
        </div>
      </div>
    </>
  );
}
