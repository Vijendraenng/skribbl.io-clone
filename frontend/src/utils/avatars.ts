export const AVATARS = [
  "🎨", "🦊", "🐼", "🐸", "🦄", "🐙", "🦋", "🐯",
  "🦁", "🐺", "🐨", "🦊", "🐻", "🐧", "🦅", "🐬",
  "🦀", "🐉", "👾", "🤖", "🎭", "🎃", "🌈", "⭐",
];

export function randomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

export const AVATAR_BG_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#82E0AA",
];

export function avatarBgColor(nickname: string): string {
  let hash = 0;
  for (const c of nickname) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_BG_COLORS.length;
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}
