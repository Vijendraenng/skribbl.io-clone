import React, { useRef, useEffect, useState } from "react";
import { useGame } from "../../contexts/GameContext";
import type { ChatMessage } from "../../types";

function MessageItem({ msg }: { msg: ChatMessage }) {
  const isSystem = msg.type === "system" || msg.type === "correct";

  if (isSystem) {
    return (
      <div
        className={`text-center text-sm py-1 px-2 rounded-lg mx-1 ${
          msg.type === "correct"
            ? "bg-green-800/40 text-green-300 font-semibold"
            : "text-gray-400 italic"
        }`}
      >
        {msg.text}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 px-2 py-0.5">
      <span className="font-bold text-game-accent text-sm shrink-0">{msg.playerName}:</span>
      <span className="text-gray-200 text-sm break-words">{msg.text}</span>
    </div>
  );
}

export default function ChatPanel() {
  const { messages, sendGuess, sendChat, game, playerId } = useGame();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isDrawer = game?.currentDrawerId === playerId;
  const isDrawing = game?.phase === "drawing";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");

    if (isDrawer || !isDrawing) {
      sendChat(text);
    } else {
      sendGuess(text);
    }
    inputRef.current?.focus();
  };

  const placeholder = isDrawer
    ? "Chat with players…"
    : isDrawing
    ? "Type your guess…"
    : "Chat…";

  return (
    <div className="flex flex-col h-full bg-game-card border border-game-border rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-game-bg border-b border-game-border">
        <h3 className="font-game text-white text-sm">
          {isDrawing && !isDrawer ? "💬 Guess the word!" : "💬 Chat"}
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-1 space-y-0.5 min-h-0">
        {messages.map((m) => (
          <MessageItem key={m.id} msg={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-game-border p-2 flex gap-1.5">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          maxLength={100}
          className="flex-1 bg-game-bg border border-game-border rounded-lg px-3 py-1.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-game-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-game-accent text-white px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-red-500 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
