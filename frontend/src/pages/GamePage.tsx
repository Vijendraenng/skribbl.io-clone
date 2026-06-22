import React, { useEffect } from "react";
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

  useEffect(() => {
    if (!room && !nickname) navigate("/");
  }, [room, nickname, navigate]);

  useEffect(() => {
    if (gameOver) navigate(`/game-over/${room?.roomCode}`);
  }, [gameOver, navigate, room]);

  const isDrawer = game?.currentDrawerId === playerId;
  const isDrawing = game?.phase === "drawing";
  const drawTime = game?.drawTime || 80;

  const { timeLeft } = useTimer(
    drawTime,
    isDrawing && !wordChoices
  );

  if (!room || !game) return null;

  return (
    <div className="min-h-screen bg-game-bg flex flex-col">
      {/* Word chooser overlay */}
      {wordChoices && <WordChooser />}

      {/* Round end overlay */}
      {roundEnd && game.phase === "round_end" && <RoundEndOverlay data={roundEnd} />}

      {/* Top bar */}
      <div className="bg-game-card border-b border-game-border px-4 py-2 flex items-center gap-4">
        <div className="font-game text-game-accent text-xl">Skribbl</div>
        <div className="flex-1 flex items-center gap-3">
          <span className="text-gray-400 text-sm shrink-0">
            Round {(game.currentRound || 0) + 1} / {game.totalRounds}
          </span>
          {isDrawing && (
            <div className="flex-1 max-w-xs">
              <TimerBar timeLeft={timeLeft} totalTime={drawTime} />
            </div>
          )}
          {game.currentDrawerName && (
            <span className="text-sm text-gray-300 shrink-0">
              {isDrawer ? "You're drawing!" : `${game.currentDrawerName} is drawing…`}
            </span>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 gap-3 p-3 min-h-0">
        {/* Left: players */}
        <div className="w-48 shrink-0 overflow-y-auto">
          <PlayerList
            players={game.players}
            currentDrawerId={game.currentDrawerId}
            hostId={room.hostId}
            myId={playerId}
            showScores
          />
        </div>

        {/* Center: canvas */}
        <div className="flex-1 min-w-0">
          <DrawingCanvas
            isDrawer={isDrawer}
            word={isDrawer ? currentWord : undefined}
            hint={!isDrawer ? currentHint : undefined}
          />
        </div>

        {/* Right: chat */}
        <div className="w-64 shrink-0 flex flex-col min-h-0" style={{ maxHeight: "calc(100vh - 120px)" }}>
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
