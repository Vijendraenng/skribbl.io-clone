import React, { useRef, useEffect, useState } from "react";
import { useGame } from "../../contexts/GameContext";
import type { ChatMessage } from "../../types";

interface ChatPanelProps {
  isDrawer?: boolean;
}

function MessageItem({ msg, isDrawer }: { msg: ChatMessage; isDrawer: boolean }) {
  const isSystem = msg.type === "system" || msg.type === "correct";

  // Hide guess messages from the drawer during drawing phase
  if (isDrawer && msg.type === "guess") return null;

  if (isSystem) {
    return (
      <div className={`text-center text-xs py-1 px-2 rounded-lg mx-1 my-0.5 ${
        msg.type === "correct"
          ? "bg-green-800/40 text-green-300 font-semibold"
          : "text-gray-500 italic"
      }`}>
        {msg.text}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 px-2 py-0.5">
      <span className="font-bold text-game-accent text-xs shrink-0">{msg.playerName}:</span>
      <span className="text-gray-200 text-xs break-words leading-relaxed">{msg.text}</span>
    </div>
  );
}

export default function ChatPanel({ isDrawer = false }: ChatPanelProps) {
  const { messages, sendGuess, sendChat, game, playerId } = useGame();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const amDrawer = isDrawer || game?.currentDrawerId === playerId;
  const isDrawing = game?.phase === "drawing";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (amDrawer || !isDrawing) sendChat(text);
    else sendGuess(text);
    inputRef.current?.focus();
  };

  const placeholder = amDrawer
    ? "Chat with players…"
    : isDrawing ? "Type your guess…" : "Chat…";

  return (
    <div className="flex flex-col h-full bg-game-card border border-game-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 py-1.5 bg-game-bg border-b border-game-border shrink-0">
        <h3 className="font-game text-white text-sm">
          {isDrawing && !amDrawer ? "💬 Guess the word!" : "💬 Chat"}
        </h3>
      </div>

      {/* Messages — scrollable */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-1 min-h-0">
        {messages.map((m) => (
          <MessageItem key={m.id} msg={m} isDrawer={amDrawer} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-game-border p-2 flex gap-1.5 shrink-0">
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
          className="bg-game-accent text-white px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-red-500 transition-colors shrink-0"
        >
          ↵
        </button>
      </form>
    </div>
  );
}