import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GameProvider } from "./contexts/GameContext";
import HomePage from "./pages/HomePage";
import CreateRoomPage from "./pages/CreateRoomPage";
import JoinRoomPage from "./pages/JoinRoomPage";
import PublicRoomsPage from "./pages/PublicRoomsPage";
import LobbyPage from "./pages/LobbyPage";
import GamePage from "./pages/GamePage";
import GameOverPage from "./pages/GameOverPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import AchievementToast from "./components/game/AchievementToast";

export default function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <AchievementToast />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateRoomPage />} />
          <Route path="/join" element={<JoinRoomPage />} />
          <Route path="/rooms" element={<PublicRoomsPage />} />
          <Route path="/lobby/:roomCode" element={<LobbyPage />} />
          <Route path="/game/:roomCode" element={<GamePage />} />
          <Route path="/game-over/:roomCode" element={<GameOverPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GameProvider>
    </BrowserRouter>
  );
}
