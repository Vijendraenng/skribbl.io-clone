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

// Persistent storage helpers
const storage = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, val: string) => {
    try {
      localStorage.setItem(key, val);
      sessionStorage.setItem(key, val);
    } catch {}
  },
  clear: () => {
    try {
      ["playerId", "nickname", "avatar", "roomCode"].forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    } catch {}
  },
};

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [playerId, setPlayerIdState] = useState<string | null>(() =>
    storage.get("playerId"),
  );
  const [nickname, setNicknameState] = useState(
    () => storage.get("nickname") || "",
  );
  const [avatar, setAvatarState] = useState(
    () => storage.get("avatar") || "🎨",
  );
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

  const setPlayerId = (id: string | null) => {
    setPlayerIdState(id);
    if (id) storage.set("playerId", id);
  };
  const setNickname = (n: string) => {
    setNicknameState(n);
    storage.set("nickname", n);
  };
  const setAvatar = (a: string) => {
    setAvatarState(a);
    storage.set("avatar", a);
  };

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

  const resetForNewGame = useCallback(() => {
    setGame(null);
    setMessages([]);
    setCurrentWord(null);
    setCurrentHint(null);
    setWordChoices(null);
    setRoundEnd(null);
    setGameOver(null);
    setLeaderboard([]);
    setRoom((r) => (r ? { ...r, status: "waiting" } : r));
  }, []);

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
    storage.clear();
  }, []);

  // ─── Auto-reconnect on page refresh ──────────────────────────────────
  useEffect(() => {
    const socket = connectSocket();
    const savedPlayerId = storage.get("playerId");
    const savedRoomCode = storage.get("roomCode");
    const savedNickname = storage.get("nickname");
    const savedAvatar = storage.get("avatar");

    if (savedPlayerId && savedRoomCode && savedNickname) {
      socket.emit(
        "reconnect_room",
        {
          roomCode: savedRoomCode,
          playerId: savedPlayerId,
          nickname: savedNickname,
          avatar: savedAvatar || "🎨",
        },
        (res: any) => {
          if (res?.success) {
            setRoom(res.room);
            if (res.game) setGame(res.game);
            console.log("✅ Reconnected to room", savedRoomCode);
          }
        },
      );
    }
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
      "player_reconnected",
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
      setGameOver(null);
      setRoundEnd(null);
      setCurrentWord(null);
      setCurrentHint(null);
      setWordChoices(null);
      setLeaderboard([]);
      setGame(g);
      setMessages([]);
      // Mark room as playing so all clients (including lobby) redirect to game
      setRoom((r) => (r ? { ...r, status: "playing" } : r));
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
        text: `Round ${payload.round}/${payload.totalRounds} — ${payload.drawerName} is drawing!`,
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
      setWordChoices(null);
      setGame((g) => (g ? { ...g, phase: "drawing" } : g));
    });
    socket.on("hint_update", ({ hint }: { hint: string }) =>
      setCurrentHint(hint),
    );
    socket.on("player_guessed", (payload: PlayerGuessedPayload) => {
      setRoom((r) => (r ? { ...r, players: payload.players } : r));
      addMessage({
        playerId: "system",
        playerName: "",
        text: `✅ ${payload.playerName} guessed it! (+${payload.points}pts)`,
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
        if (correct && word)
          addMessage({
            playerId: "system",
            playerName: "",
            text: `🎉 You got it! "${word}" (+${points}pts)`,
            type: "correct",
          });
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
    socket.on("chat_message", (msg: Omit<ChatMessage, "id" | "timestamp">) =>
      addMessage(msg),
    );
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
        text: `⏱️ Round over! Word was "${payload.word}"`,
        type: "system",
      });
    });
    socket.on("game_over", (payload: GameOverPayload) => {
      setGameOver(payload);
      setLeaderboard(payload.leaderboard);
      setGame((g) => (g ? { ...g, phase: "game_over" } : g));
      setRoom((r) => (r ? { ...r, status: "finished" } : r));
    });

    return () => {
      [
        "player_joined",
        "player_reconnected",
        "player_left",
        "player_ready_update",
        "game_started",
        "round_start",
        "word_choices",
        "word_assigned",
        "word_hint",
        "hint_update",
        "player_guessed",
        "guess_result",
        "close_guess",
        "chat_message",
        "round_end",
        "game_over",
      ].forEach((e) => socket.off(e));
    };
  }, [addMessage]);

  // ─── Actions ─────────────────────────────────────────────────────────

  const createRoom = useCallback(
    async (
      nick: string,
      av: string,
      settings: Partial<Room["settings"]>,
    ): Promise<{ roomCode: string }> => {
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
        getSocket().emit(
          "create_room",
          { nickname: nick, avatar: av, settings },
          (res: any) => {
            if (res.error) return reject(new Error(res.error));
            setNickname(nick);
            setAvatar(av);
            setPlayerId(res.playerId);
            setRoom(res.room);
            storage.set("roomCode", res.roomCode);
            resolve({ roomCode: res.roomCode });
          },
        );
      });
    },
    [],
  );

  const joinRoom = useCallback(
    async (roomCode: string, nick: string, av: string) => {
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
        getSocket().emit(
          "join_room",
          { roomCode: roomCode.toUpperCase(), nickname: nick, avatar: av },
          (res: any) => {
            if (res.error) return reject(new Error(res.error));
            setNickname(nick);
            setAvatar(av);
            setPlayerId(res.playerId);
            setRoom(res.room);
            storage.set("roomCode", roomCode.toUpperCase());
            resolve();
          },
        );
      });
    },
    [],
  );

  const startGame = useCallback(() => {
    getSocket().emit("start_game", {}, (res: any) => {
      if (res?.error) console.error(res.error);
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
