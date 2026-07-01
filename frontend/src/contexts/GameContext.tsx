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
    passcode?: string,
  ) => Promise<void>;
  joinAsSpectator: (
    roomCode: string,
    nickname: string,
    avatar: string,
    passcode?: string,
  ) => Promise<{ roomStatus: string }>;
  startGame: () => void;
  chooseWord: (word: string) => void;
  sendGuess: (text: string) => void;
  sendChat: (text: string) => void;
  setReady: (ready: boolean) => void;
  passcode: string | null;
  resetForNewGame: () => void;
  fullReset: () => void;
  redirectTo: string | null;
  clearRedirect: () => void;
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
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [passcode, setPasscode] = useState<string | null>(null);
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
    // Tell server we're intentionally leaving so the room can be cleaned up immediately
    try {
      const socket = getSocket();
      if (socket.connected) {
        socket.emit("leave_room", {});
      }
    } catch {}
    setGame(null);
    setRoom(null);
    setMessages([]);
    setCurrentWord(null);
    setCurrentHint(null);
    setWordChoices(null);
    setRoundEnd(null);
    setGameOver(null);
    setLeaderboard([]);
    setPasscode(null);
    storage.clear(); // storage.clear() already removes 'passcode' key
  }, []);

  // ─── Auto-reconnect on page refresh ──────────────────────────────────
  useEffect(() => {
    // Don't auto-reconnect if user is on join/create pages — they're starting fresh
    const path = window.location.pathname;
    if (path === "/" || path.startsWith("/join") || path.startsWith("/create"))
      return;

    const socket = connectSocket();
    const savedPlayerId = storage.get("playerId");
    const savedRoomCode = storage.get("roomCode");
    const savedNickname = storage.get("nickname");
    const savedAvatar = storage.get("avatar");

    // Restore passcode from storage if host reconnects
    const savedPasscode = storage.get("passcode");
    if (savedPasscode) setPasscode(savedPasscode);

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
      ({
        playerId,
        players,
        newHostId,
      }: {
        playerId: string;
        players: Player[];
        newHostId: string;
      }) => {
        setRoom((r) => {
          if (!r) return r;
          // Find the leaving player's name from current list before updating
          const leaving = r.players.find((p) => p.id === playerId);
          if (leaving) {
            addMessage({
              playerId: "system",
              playerName: "",
              text: `👋 ${leaving.nickname} left the game`,
              type: "system",
            });
          }
          return { ...r, players, hostId: newHostId };
        });
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
      setCurrentWord(null);
      setCurrentHint(null);
      setWordChoices(null);
      setGame((g) => (g ? { ...g, phase: "game_over" } : g));
      setRoom((r) => (r ? { ...r, status: "finished" } : r));
    });

    socket.on("kicked", ({ reason }: { reason: string }) => {
      // Will be handled at page level, just reset state here
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
      alert(reason || "You have been removed from the room");
      window.location.href = "/";
    });

    socket.on("player_kicked", ({ players }: { players: any[] }) => {
      setRoom((r) => (r ? { ...r, players } : r));
    });

    socket.on("skip_vote_update", (data: any) => {
      // Forward as a system message
      if (data.triggered) return;
      // handled in GamePage via direct socket listener
    });

    socket.on("redirect_to_lobby", ({ roomCode }: { roomCode: string }) => {
      // Reset game state, keep room + identity
      setGame(null);
      setCurrentWord(null);
      setCurrentHint(null);
      setWordChoices(null);
      setRoundEnd(null);
      setGameOver(null);
      setLeaderboard([]);
      setMessages([]);
      setRoom((r) => (r ? { ...r, status: "waiting", game: undefined } : r));
      // Store the redirect target so components can react to it
      setRedirectTo(`/lobby/${roomCode}`);
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
        "redirect_to_lobby",
        "kicked",
        "player_kicked",
        "skip_vote_update",
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
            if (res.passcode) {
              setPasscode(res.passcode);
              storage.set("passcode", res.passcode); // persist so LobbyPage always has it
            }
            storage.set("roomCode", res.roomCode);
            resolve({ roomCode: res.roomCode });
          },
        );
      });
    },
    [],
  );

  const joinRoom = useCallback(
    async (roomCode: string, nick: string, av: string, passcode?: string) => {
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
          {
            roomCode: roomCode.toUpperCase(),
            nickname: nick,
            avatar: av,
            passcode,
          },
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

  const joinAsSpectator = useCallback(
    async (roomCode: string, nick: string, av: string, passcode?: string) => {
      setGame(null);
      setRoom(null);
      setMessages([]);
      setCurrentWord(null);
      setCurrentHint(null);
      setWordChoices(null);
      setRoundEnd(null);
      setGameOver(null);
      setLeaderboard([]);
      return new Promise<{ roomStatus: string }>((resolve, reject) => {
        getSocket().emit(
          "join_spectator",
          {
            roomCode: roomCode.toUpperCase(),
            nickname: nick,
            avatar: av,
            passcode,
          },
          (res: any) => {
            if (res?.error) return reject(new Error(res.error));
            setNickname(nick);
            setAvatar(av);
            setPlayerId(res.playerId);
            setRoom(res.room);
            if (res.game) setGame(res.game);
            storage.set("roomCode", roomCode.toUpperCase());
            resolve({ roomStatus: res.room?.status || "waiting" });
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
  const clearRedirect = useCallback(() => setRedirectTo(null), []);

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
        joinAsSpectator,
        startGame,
        chooseWord,
        sendGuess,
        sendChat,
        setReady,
        resetForNewGame,
        fullReset,
        passcode,
        redirectTo,
        clearRedirect,
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
