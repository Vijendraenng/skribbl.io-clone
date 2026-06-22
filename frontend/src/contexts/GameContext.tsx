import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { connectSocket, getSocket } from "../utils/socket";
import type {
  Room,
  GameState,
  Player,
  ChatMessage,
  RoundStartPayload,
  RoundEndPayload,
  GameOverPayload,
  PlayerGuessedPayload,
  LeaderboardEntry,
} from "../types";

// ─── Context Shape ────────────────────────────────────────────────────────

interface GameContextValue {
  playerId: string | null;
  nickname: string;
  avatar: string;
  room: Room | null;
  game: GameState | null;
  isHost: boolean;
  messages: ChatMessage[];
  currentWord: string | null;
  currentHint: string | null;
  wordChoices: string[] | null;
  wordChoiceTimeLimit: number;
  roundEnd: RoundEndPayload | null;
  gameOver: GameOverPayload | null;
  leaderboard: LeaderboardEntry[];
  createRoom: (
    nickname: string,
    avatar: string,
    settings: Partial<Room["settings"]>,
  ) => Promise<{ roomCode: string }>;
  joinRoom: (
    roomCode: string,
    nickname: string,
    avatar: string,
  ) => Promise<void>;
  startGame: () => void;
  chooseWord: (word: string) => void;
  sendGuess: (text: string) => void;
  sendChat: (text: string) => void;
  setReady: (ready: boolean) => void;
  resetForNewGame: () => void;
  fullReset: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [playerId, setPlayerId] = useState<string | null>(() =>
    sessionStorage.getItem("playerId"),
  );
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("🎨");
  const [room, setRoom] = useState<Room | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [wordChoices, setWordChoices] = useState<string[] | null>(null);
  const [wordChoiceTimeLimit, setWordChoiceTimeLimit] = useState(15);
  const [roundEnd, setRoundEnd] = useState<RoundEndPayload | null>(null);
  const [gameOver, setGameOver] = useState<GameOverPayload | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const msgIdRef = useRef(0);

  const addMessage = useCallback(
    (msg: Omit<ChatMessage, "id" | "timestamp">) => {
      setMessages((prev) => [
        ...prev.slice(-199),
        { ...msg, id: String(++msgIdRef.current), timestamp: Date.now() },
      ]);
    },
    [],
  );

  const isHost = room ? playerId === room.hostId : false;

  /**
   * Reset only game-round state — keeps room + identity intact.
   * Used when going back to lobby for "Play Again".
   */
  const resetForNewGame = useCallback(() => {
    setGame(null);
    setMessages([]);
    setCurrentWord(null);
    setCurrentHint(null);
    setWordChoices(null);
    setRoundEnd(null);
    setGameOver(null);
    setLeaderboard([]);
    // Also reset room status so host can start again
    setRoom((r) => (r ? { ...r, status: "waiting" } : r));
  }, []);

  /**
   * Full reset — used when going to Home or creating a new room.
   * Clears everything including identity and room.
   */
  const fullReset = useCallback(() => {
    setGame(null);
    setRoom(null);
    setMessages([]);
    setCurrentWord(null);
    setCurrentHint(null);
    setWordChoices(null);
    setRoundEnd(null);
    setGameOver(null);
    setLeaderboard([]);
  }, []);

  // ─── Socket Events ────────────────────────────────────────────────────

  useEffect(() => {
    const socket = connectSocket();

    socket.on(
      "player_joined",
      ({ players }: { player: Player; players: Player[] }) => {
        setRoom((r) => (r ? { ...r, players } : r));
      },
    );

    socket.on(
      "player_left",
      ({ players, newHostId }: { players: Player[]; newHostId: string }) => {
        setRoom((r) => (r ? { ...r, players, hostId: newHostId } : r));
      },
    );

    socket.on("player_ready_update", ({ players }: { players: Player[] }) => {
      setRoom((r) => (r ? { ...r, players } : r));
    });

    socket.on("game_started", ({ game: g }: { game: GameState }) => {
      // Clear any leftover game state from previous round before starting fresh
      setGameOver(null);
      setRoundEnd(null);
      setCurrentWord(null);
      setCurrentHint(null);
      setWordChoices(null);
      setLeaderboard([]);
      setGame(g);
      setMessages([]);
      addMessage({
        playerId: "system",
        playerName: "",
        text: "🎮 Game started!",
        type: "system",
      });
    });

    socket.on("round_start", (payload: RoundStartPayload) => {
      setGame((g) =>
        g
          ? {
              ...g,
              phase: "choosing",
              currentRound: payload.round - 1,
              totalRounds: payload.totalRounds,
              currentDrawerId: payload.drawerId,
              currentDrawerName: payload.drawerName,
              drawTime: payload.drawTime,
            }
          : g,
      );
      setCurrentWord(null);
      setCurrentHint(null);
      setWordChoices(null);
      setRoundEnd(null);
      addMessage({
        playerId: "system",
        playerName: "",
        text: `Round ${payload.round} / ${payload.totalRounds} — ${payload.drawerName} is drawing!`,
        type: "system",
      });
    });

    socket.on(
      "word_choices",
      ({ words, timeLimit }: { words: string[]; timeLimit: number }) => {
        setWordChoices(words);
        setWordChoiceTimeLimit(timeLimit);
        setGame((g) => (g ? { ...g, phase: "choosing" } : g));
      },
    );

    socket.on(
      "word_assigned",
      ({ word, hint }: { word: string; hint: string }) => {
        setCurrentWord(word);
        setCurrentHint(hint);
        setWordChoices(null);
        setGame((g) => (g ? { ...g, phase: "drawing" } : g));
      },
    );

    socket.on("word_hint", ({ hint }: { hint: string }) => {
      setCurrentHint(hint);
      setGame((g) => (g ? { ...g, phase: "drawing" } : g));
      setWordChoices(null);
    });

    socket.on("hint_update", ({ hint }: { hint: string }) => {
      setCurrentHint(hint);
    });

    socket.on("player_guessed", (payload: PlayerGuessedPayload) => {
      setRoom((r) => (r ? { ...r, players: payload.players } : r));
      addMessage({
        playerId: "system",
        playerName: "",
        text: `✅ ${payload.playerName} guessed the word! (+${payload.points} pts)`,
        type: "correct",
      });
    });

    socket.on(
      "guess_result",
      ({
        correct,
        points,
        word,
      }: {
        correct: boolean;
        points?: number;
        word?: string;
      }) => {
        if (correct && word) {
          addMessage({
            playerId: "system",
            playerName: "",
            text: `🎉 You guessed it! The word was "${word}" (+${points} pts)`,
            type: "correct",
          });
        }
      },
    );

    socket.on("close_guess", ({ text }: { text: string }) => {
      addMessage({
        playerId: "system",
        playerName: "",
        text: `🔥 "${text}" is close!`,
        type: "system",
      });
    });

    socket.on("chat_message", (msg: Omit<ChatMessage, "id" | "timestamp">) => {
      addMessage(msg);
    });

    socket.on("round_end", (payload: RoundEndPayload) => {
      setRoundEnd(payload);
      setCurrentWord(null);
      setCurrentHint(null);
      setGame((g) =>
        g ? { ...g, phase: "round_end", players: payload.scores as any } : g,
      );
      addMessage({
        playerId: "system",
        playerName: "",
        text: `⏱️ Round over! The word was "${payload.word}"`,
        type: "system",
      });
    });

    socket.on("game_over", (payload: GameOverPayload) => {
      setGameOver(payload);
      setLeaderboard(payload.leaderboard);
      setGame((g) => (g ? { ...g, phase: "game_over" } : g));
      // Mark room as finished so lobby allows restart
      setRoom((r) => (r ? { ...r, status: "finished" } : r));
    });

    return () => {
      socket.off("player_joined");
      socket.off("player_left");
      socket.off("player_ready_update");
      socket.off("game_started");
      socket.off("round_start");
      socket.off("word_choices");
      socket.off("word_assigned");
      socket.off("word_hint");
      socket.off("hint_update");
      socket.off("player_guessed");
      socket.off("guess_result");
      socket.off("close_guess");
      socket.off("chat_message");
      socket.off("round_end");
      socket.off("game_over");
    };
  }, [addMessage]);

  // ─── Actions ─────────────────────────────────────────────────────────

  const createRoom = useCallback(
    async (
      nick: string,
      av: string,
      settings: Partial<Room["settings"]>,
    ): Promise<{ roomCode: string }> => {
      // Always full-reset before creating a new room
      setGame(null);
      setRoom(null);
      setMessages([]);
      setCurrentWord(null);
      setCurrentHint(null);
      setWordChoices(null);
      setRoundEnd(null);
      setGameOver(null);
      setLeaderboard([]);

      return new Promise((resolve, reject) => {
        const socket = getSocket();
        socket.emit(
          "create_room",
          { nickname: nick, avatar: av, settings },
          (res: {
            success?: boolean;
            roomCode?: string;
            playerId?: string;
            room?: Room;
            error?: string;
          }) => {
            if (res.error) return reject(new Error(res.error));
            setNickname(nick);
            setAvatar(av);
            setPlayerId(res.playerId!);
            setRoom(res.room!);
            sessionStorage.setItem("playerId", res.playerId!);
            resolve({ roomCode: res.roomCode! });
          },
        );
      });
    },
    [],
  );

  const joinRoom = useCallback(
    async (roomCode: string, nick: string, av: string) => {
      // Always full-reset before joining a new room
      setGame(null);
      setRoom(null);
      setMessages([]);
      setCurrentWord(null);
      setCurrentHint(null);
      setWordChoices(null);
      setRoundEnd(null);
      setGameOver(null);
      setLeaderboard([]);

      return new Promise<void>((resolve, reject) => {
        const socket = getSocket();
        socket.emit(
          "join_room",
          { roomCode: roomCode.toUpperCase(), nickname: nick, avatar: av },
          (res: {
            success?: boolean;
            playerId?: string;
            room?: Room;
            error?: string;
          }) => {
            if (res.error) return reject(new Error(res.error));
            setNickname(nick);
            setAvatar(av);
            setPlayerId(res.playerId!);
            setRoom(res.room!);
            sessionStorage.setItem("playerId", res.playerId!);
            resolve();
          },
        );
      });
    },
    [],
  );

  const startGame = useCallback(() => {
    getSocket().emit("start_game", {}, (res: { error?: string }) => {
      if (res?.error) console.error("Start game error:", res.error);
    });
  }, []);

  const chooseWord = useCallback((word: string) => {
    setWordChoices(null);
    getSocket().emit("word_chosen", { word });
  }, []);

  const sendGuess = useCallback((text: string) => {
    getSocket().emit("guess", { text });
  }, []);

  const sendChat = useCallback((text: string) => {
    getSocket().emit("chat", { text });
  }, []);

  const setReady = useCallback((ready: boolean) => {
    getSocket().emit("player_ready", { ready });
  }, []);

  return (
    <GameContext.Provider
      value={{
        playerId,
        nickname,
        avatar,
        room,
        game,
        isHost,
        messages,
        currentWord,
        currentHint,
        wordChoices,
        wordChoiceTimeLimit,
        roundEnd,
        gameOver,
        leaderboard,
        createRoom,
        joinRoom,
        startGame,
        chooseWord,
        sendGuess,
        sendChat,
        setReady,
        resetForNewGame,
        fullReset,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
