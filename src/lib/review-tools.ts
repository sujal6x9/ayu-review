export type PenPoint = { x: number; y: number };

export function strokePath(points: PenPoint[]) {
  if (!points.length) return "";
  const scaled = points.map((point) => ({ x: point.x * 1000, y: point.y * 1000 }));
  const first = scaled[0];
  if (!first) return "";
  if (scaled.length === 1) return `M ${first.x} ${first.y} l 0.01 0`;
  if (scaled.length === 2) return `M ${first.x} ${first.y} L ${scaled[1]?.x} ${scaled[1]?.y}`;
  let path = `M ${first.x} ${first.y}`;
  for (let index = 1; index < scaled.length - 1; index += 1) {
    const point = scaled[index];
    const next = scaled[index + 1];
    if (point && next) path += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  }
  const last = scaled[scaled.length - 1];
  return last ? `${path} L ${last.x} ${last.y}` : path;
}

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
