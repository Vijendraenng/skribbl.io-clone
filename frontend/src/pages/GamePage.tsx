import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  const { roomCode } = useParams<{ roomCode: string }>();
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
  const [showChat, setShowChat] = useState(false);

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
    <div className="h-screen bg-game-bg flex flex-col overflow-hidden">
      {wordChoices && <WordChooser />}
      {roundEnd && game.phase === "round_end" && (
        <RoundEndOverlay data={roundEnd} />
      )}

      {/* Top bar */}
      <div className="bg-game-card border-b border-game-border px-3 py-2 flex items-center gap-2 shrink-0">
        <div className="font-game text-game-accent text-lg hidden sm:block">
          Skribbl
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
          <span>
            R{(game.currentRound || 0) + 1}/{game.totalRounds}
          </span>
        </div>

        {/* Timer — center */}
        {isDrawing && (
          <div className="flex-1 max-w-xs mx-auto">
            <TimerBar timeLeft={timeLeft} totalTime={drawTime} />
          </div>
        )}

        {/* Drawer name */}
        {game.currentDrawerName && (
          <span className="text-xs text-gray-300 shrink-0 hidden sm:block">
            {isDrawer ? "✏️ You're drawing!" : `✏️ ${game.currentDrawerName}`}
          </span>
        )}

        {/* Mobile toggle buttons */}
        <div className="flex gap-1 ml-auto lg:hidden">
          <button
            onClick={() => {
              setShowPlayers((s) => !s);
              setShowChat(false);
            }}
            className={`px-2 py-1 rounded text-xs font-bold border transition-all ${showPlayers ? "bg-game-accent border-game-accent text-white" : "border-game-border text-gray-400"}`}
          >
            👥 {room.players.length}
          </button>
          <button
            onClick={() => {
              setShowChat((s) => !s);
              setShowPlayers(false);
            }}
            className={`px-2 py-1 rounded text-xs font-bold border transition-all ${showChat ? "bg-game-accent border-game-accent text-white" : "border-game-border text-gray-400"}`}
          >
            💬
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: players — hidden on mobile unless toggled */}
        <div
          className={`
          ${showPlayers ? "flex" : "hidden"} lg:flex
          flex-col w-full lg:w-44 xl:w-48 shrink-0 overflow-y-auto p-2 gap-1
          absolute lg:relative inset-0 z-30 bg-game-bg lg:bg-transparent
        `}
        >
          {showPlayers && (
            <button
              onClick={() => setShowPlayers(false)}
              className="lg:hidden self-end text-gray-400 text-xs mb-1"
            >
              ✕ Close
            </button>
          )}
          <PlayerList
            players={game.players}
            currentDrawerId={game.currentDrawerId}
            hostId={room.hostId}
            myId={playerId}
            showScores
          />
        </div>

        {/* Center: canvas */}
        <div
          className={`flex-1 min-w-0 flex flex-col p-2 overflow-y-auto ${showPlayers || showChat ? "hidden lg:flex" : "flex"}`}
        >
          <DrawingCanvas
            isDrawer={isDrawer}
            word={isDrawer ? currentWord : undefined}
            hint={!isDrawer ? currentHint : undefined}
          />
        </div>

        {/* Right: chat — hidden on mobile unless toggled */}
        <div
          className={`
          ${showChat ? "flex" : "hidden"} lg:flex
          flex-col w-full lg:w-56 xl:w-64 shrink-0
          absolute lg:relative inset-0 z-30 bg-game-bg lg:bg-transparent
          p-2
        `}
          style={{ maxHeight: "100%" }}
        >
          {showChat && (
            <button
              onClick={() => setShowChat(false)}
              className="lg:hidden self-end text-gray-400 text-xs mb-1"
            >
              ✕ Close
            </button>
          )}
          <div className="flex-1 min-h-0">
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
