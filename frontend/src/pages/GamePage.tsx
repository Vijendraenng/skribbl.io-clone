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
import { getSocket } from "../utils/socket";

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
    fullReset,
  } = useGame();
  const [showPlayers, setShowPlayers] = useState(false);
  const [skipVotes, setSkipVotes] = useState({ votes: 0, needed: 0 });
  const [hasVotedSkip, setHasVotedSkip] = useState(false);

  useEffect(() => {
    if (!room && !nickname) navigate("/");
  }, [room, nickname, navigate]);

  // Listen for skip vote updates and kick events
  useEffect(() => {
    const socket = getSocket();
    socket.on(
      "skip_vote_update",
      (data: { votes: number; needed: number; triggered: boolean }) => {
        setSkipVotes({ votes: data.votes, needed: data.needed });
        if (data.triggered) setHasVotedSkip(false);
      },
    );
    // Reset skip vote on new round
    socket.on("round_start", () => {
      setSkipVotes({ votes: 0, needed: 0 });
      setHasVotedSkip(false);
    });
    return () => {
      socket.off("skip_vote_update");
    };
  }, []);
  useEffect(() => {
    if (gameOver) navigate(`/game-over/${room?.roomCode}`);
  }, [gameOver, navigate, room]);

  const isDrawer = game?.currentDrawerId === playerId;
  const isDrawing = game?.phase === "drawing";
  const drawTime = game?.drawTime || 80;
  const { timeLeft } = useTimer(drawTime, isDrawing && !wordChoices);

  if (!room || !game) return null;

  const topBarHeight = 44;

  return (
    <div
      className="flex flex-col bg-game-bg"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      {wordChoices && <WordChooser />}
      {roundEnd && game.phase === "round_end" && (
        <RoundEndOverlay data={roundEnd} />
      )}

      {/* ── Top bar ── */}
      <div
        className="bg-game-card border-b border-game-border px-3 flex items-center gap-2 shrink-0"
        style={{ height: topBarHeight }}
      >
        <span className="font-game text-game-accent text-base hidden sm:block">
          Skribbl
        </span>
        <span className="text-gray-400 text-xs shrink-0">
          R{(game.currentRound || 0) + 1}/{game.totalRounds}
        </span>

        {isDrawing ? (
          <div className="flex-1 mx-1">
            <TimerBar timeLeft={timeLeft} totalTime={drawTime} />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {game.currentDrawerName && (
          <span className="text-xs text-gray-300 shrink-0 hidden md:block">
            {isDrawer ? "✏️ You're drawing!" : `✏️ ${game.currentDrawerName}`}
          </span>
        )}

        {/* Skip vote button — shown to non-drawers during drawing */}
        {isDrawing && !isDrawer && (
          <button
            onClick={() => {
              if (hasVotedSkip) return;
              setHasVotedSkip(true);
              getSocket().emit("vote_skip", {});
            }}
            disabled={hasVotedSkip}
            className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border transition-all shrink-0 ${
              hasVotedSkip
                ? "border-yellow-700 text-yellow-500 bg-yellow-900/20"
                : "border-game-border text-gray-400 hover:border-yellow-500 hover:text-yellow-400"
            }`}
            title="Vote to skip this drawer"
          >
            ⏭ Skip{" "}
            {skipVotes.needed > 0
              ? `(${skipVotes.votes}/${skipVotes.needed})`
              : ""}
          </button>
        )}

        {/* Mobile: players toggle only */}
        <button
          onClick={() => setShowPlayers((s) => !s)}
          className={`lg:hidden px-2 py-1 rounded text-xs font-bold border transition-all shrink-0 ${
            showPlayers
              ? "bg-game-accent border-game-accent text-white"
              : "border-game-border text-gray-400"
          }`}
        >
          👥
        </button>

        <button
          onClick={() => {
            fullReset();
            navigate("/");
          }}
          className="px-2 py-1 rounded text-xs border border-game-border text-gray-400 hover:border-red-500 hover:text-red-400 transition-all shrink-0"
        >
          Exit
        </button>
      </div>

      {/* ── MOBILE (< lg): scroll page — canvas on top, chat below ── */}
      <div className="lg:hidden flex-1 overflow-y-auto">
        {/* Players collapse */}
        {showPlayers && (
          <div className="border-b border-game-border p-2">
            <PlayerList
              players={game.players}
              currentDrawerId={game.currentDrawerId}
              hostId={room.hostId}
              myId={playerId}
              showScores
            />
          </div>
        )}

        {/* Canvas */}
        <div className="p-2">
          <DrawingCanvas
            isDrawer={isDrawer}
            word={isDrawer ? currentWord : undefined}
            hint={!isDrawer ? currentHint : undefined}
          />
        </div>

        {/* Chat — always visible below canvas, 280px tall, scrollable inside */}
        <div className="px-2 pb-3" style={{ height: 300 }}>
          <ChatPanel isDrawer={isDrawer} />
        </div>
      </div>

      {/* ── DESKTOP (>= lg): fixed 3-col, everything fits viewport ── */}
      <div className="hidden lg:flex flex-1 gap-2 p-2 min-h-0 overflow-hidden">
        {/* Players sidebar */}
        <div className="w-44 shrink-0 overflow-y-auto">
          <PlayerList
            players={game.players}
            currentDrawerId={game.currentDrawerId}
            hostId={room.hostId}
            myId={playerId}
            showScores
          />
        </div>

        {/* Canvas column — flex-1, toolbar always visible */}
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
          <DrawingCanvas
            isDrawer={isDrawer}
            word={isDrawer ? currentWord : undefined}
            hint={!isDrawer ? currentHint : undefined}
          />
        </div>

        {/* Chat sidebar */}
        <div className="w-60 xl:w-64 shrink-0 flex flex-col min-h-0 overflow-hidden">
          <ChatPanel isDrawer={isDrawer} />
        </div>
      </div>
    </div>
  );
}
