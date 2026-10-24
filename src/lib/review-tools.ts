export type PenPoint = { x: number; y: number };

export function penBounds(points: PenPoint[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.max(0, Math.min(...xs) - 0.003);
  const y = Math.max(0, Math.min(...ys) - 0.003);
  return { x, y, w: Math.min(1 - x, Math.max(...xs) - x + 0.003), h: Math.min(1 - y, Math.max(...ys) - y + 0.003) };
}

export function canDeleteComment(authorId: string, userId: string, isAdmin: boolean) {
  return authorId === userId || isAdmin;
}