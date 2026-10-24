import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";
import * as XLSX from "xlsx";
import { MARK_TONE, colLetter, type CellAnchor, type Comment } from "@/lib/papers";
import { penBounds, strokePath, type PenPoint } from "@/lib/review-tools";

type Props = {
  data: ArrayBuffer;
  pen: boolean;
  penColor: string;
  penWidth: number;
  onPen: (a: CellAnchor) => void;
  threads: Comment[];
  pending: CellAnchor | null;
  focusAnchor: CellAnchor | null;
  focusId: string | null;
  search: string;
  onCreate: (a: CellAnchor) => void;
  onFocus: (id: string) => void;
  onSheets: (names: string[]) => void;
  sheet: string | null;
  setSheet: (s: string) => void;
};

const MAX_ROWS = 3000;

export function ExcelViewer(p: Props) {
  const wb = useMemo(() => {
    try {
      return XLSX.read(p.data, { type: "array" });
    } catch {
      return null;
    }
  }, [p.data]);

  useEffect(() => {
    if (wb) {
      p.onSheets(wb.SheetNames);
      if (!p.sheet) p.setSheet(wb.SheetNames[0] ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wb]);

  useEffect(() => {
    if (p.focusAnchor && p.focusAnchor.sheet !== p.sheet) p.setSheet(p.focusAnchor.sheet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.focusAnchor]);

  const sheetName = p.sheet ?? wb?.SheetNames[0] ?? "";
  const rows = useMemo(() => {
    if (!wb || !sheetName) return [] as string[][];
    const ws = wb.Sheets[sheetName]; if (!ws) return [] as string[][];
    return XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "", blankrows: true });
  }, [wb, sheetName]);
  const cols = Math.max(1, ...rows.slice(0, MAX_ROWS).map((r) => r.length));

  const byCell = useMemo(() => {
    const m = new Map<string, Comment[]>();
    for (const t of p.threads) {
      const a = t.anchor as CellAnchor;
      if (a.sheet !== sheetName || a.points?.length) continue;
      const list = m.get(a.cell) ?? [];
      list.push(t);
      m.set(a.cell, list);
    }
    return m;
  }, [p.threads, sheetName]);

  const [sel, setSel] = useState<string | null>(null);
  const inkLayer = useRef<SVGSVGElement>(null);
  const stroke = useRef<PenPoint[]>([]);
  const strokeCell = useRef<{ cell: string; row: number; col: number } | null>(null);
  const [strokePreview, setStrokePreview] = useState<PenPoint[]>([]);

  function inkPoint(e: React.PointerEvent) {
    const bounds = inkLayer.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (e.clientY - bounds.top) / bounds.height)),
    };
  }

  function cellAtPoint(x: number, y: number) {
    const cell = document.elementsFromPoint(x, y).find((element) => element instanceof HTMLElement && element.dataset["cell"]) as HTMLElement | undefined;
    if (!cell?.dataset["cell"] || cell.dataset["row"] === undefined || cell.dataset["col"] === undefined) return null;
    return { cell: cell.dataset["cell"], row: Number(cell.dataset["row"]), col: Number(cell.dataset["col"]) };
  }
  const commentOnSelection = () => {
    if (!sel) return;
    const match = sel.match(/^([A-Z]+)(\d+)$/);
    if (!match?.[1] || !match[2]) return;
    let col = 0;
    for (const ch of match[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
    p.onCreate({ type: "cell", sheet: sheetName, cell: sel, row: Number(match[2]) - 1, col: col - 1 });
  };

  if (!wb) return <div className="p-8 text-destructive">Could not open this workbook.</div>;
  const s = p.search.trim().toLowerCase();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {sel && <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b bg-background px-3 py-2"><span className="truncate text-xs text-muted-foreground">{sheetName} · {sel}</span><Button size="sm" onClick={commentOnSelection}><MessageSquarePlus className="h-4 w-4" /><span className="hidden sm:inline">Comment on</span> {sel}</Button></div>}
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <div className="relative w-max min-w-full">
        <table className="w-full border-collapse font-sans text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 w-10 border bg-muted" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="min-w-24 border bg-muted px-2 py-1 font-medium text-muted-foreground">
                  {colLetter(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, MAX_ROWS).map((r, ri) => (
              <tr key={ri}>
                <td className="sticky left-0 border bg-muted px-2 text-right text-muted-foreground">{ri + 1}</td>
                {Array.from({ length: cols }, (_, ci) => {
                  const ref = `${colLetter(ci)}${ri + 1}`;
                  const val = r[ci] ?? "";
                  const cs = byCell.get(ref);
                  const top = cs?.find((c) => c.status === "open") ?? cs?.[0];
                  const tone = top ? MARK_TONE[top.mark] : null;
                  const isPending = p.pending?.sheet === sheetName && p.pending.cell === ref;
                  const isFocus = !!cs?.some((c) => c.id === p.focusId);
                  const hit = s && String(val).toLowerCase().includes(s);
                  return (
                    <td
                      key={ci}
                      id={`cell-${sheetName}-${ref}`}
                      data-cell={ref}
                      data-row={ri}
                      data-col={ci}
                      onClick={() => {
                        setSel(ref);
                        if (p.pen) return;
                        if (cs?.[0]) p.onFocus(cs[0].id);
                      }}
                      onDoubleClick={() => { if (!p.pen) p.onCreate({ type: "cell", sheet: sheetName, cell: ref, row: ri, col: ci }); }}
                      className={`relative max-w-80 cursor-cell border px-2 py-1 align-top whitespace-pre-wrap ${tone ? `${tone.soft} ${top?.status === "resolved" ? "" : "font-medium"}` : ""} ${hit ? "bg-warning/30" : ""} ${sel === ref || isPending ? "outline-2 outline-primary -outline-offset-2" : ""} ${isFocus ? "outline-2 outline-ring -outline-offset-2" : ""}`}
                    >
                      {val}
                      {tone && <span className={`absolute right-0 top-0 h-0 w-0 border-l-8 border-t-8 border-l-transparent ${tone.border}`} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <svg
          ref={inkLayer}
          aria-label="Spreadsheet ink surface"
          className={`absolute inset-0 h-full w-full ${p.pen ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          onPointerDown={(e) => {
            if (!p.pen) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            strokeCell.current = cellAtPoint(e.clientX, e.clientY);
            stroke.current = [inkPoint(e)];
            setStrokePreview(stroke.current);
          }}
          onPointerMove={(e) => {
            if (!p.pen || !stroke.current.length) return;
            const point = inkPoint(e);
            const last = stroke.current[stroke.current.length - 1];
            if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.002) return;
            stroke.current = [...stroke.current, point];
            setStrokePreview(stroke.current);
          }}
          onPointerCancel={() => { stroke.current = []; strokeCell.current = null; setStrokePreview([]); }}
          onPointerUp={(e) => {
            if (!p.pen || !stroke.current.length) return;
            const points = [...stroke.current, inkPoint(e)];
            const origin = strokeCell.current ?? { cell: "A1", row: 0, col: 0 };
            stroke.current = [];
            strokeCell.current = null;
            setStrokePreview([]);
            p.onPen({ type: "cell", sheet: sheetName, ...origin, ...penBounds(points), points, tool: "pen", color: p.penColor, width: p.penWidth });
          }}
        >
          {p.threads.map((comment) => {
            const anchor = comment.anchor as CellAnchor;
            if (anchor.sheet !== sheetName || !anchor.points?.length) return null;
            return <path key={comment.id} d={strokePath(anchor.points)} fill="none" stroke={anchor.color ?? "currentColor"} strokeWidth={anchor.width ?? 2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className={`${anchor.color ? "" : MARK_TONE[comment.mark].text} ${comment.status === "resolved" ? "opacity-40" : ""}`} />;
          })}
          {strokePreview.length > 0 && <path d={strokePath(strokePreview)} fill="none" stroke={p.penColor} strokeWidth={p.penWidth} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        </div>
        {rows.length > MAX_ROWS && <div className="p-3 text-xs text-muted-foreground">Showing the first {MAX_ROWS} rows.</div>}
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t bg-muted px-2 py-1">
        {wb.SheetNames.map((n) => (
          <Button variant="ghost" size="sm"
            key={n}
            onClick={() => p.setSheet(n)}
            className={`rounded px-3 py-1 text-xs ${n === sheetName ? "bg-card font-medium text-primary shadow-sm" : "text-muted-foreground hover:bg-card/60"}`}
          >
            {n}
          </Button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {sel ? `Selected ${sel}` : ""}
        </span>
        {sel && (
          <Button variant="ghost" size="sm"
            className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground"
            onClick={commentOnSelection}
          >
            Comment on {sel}
          </Button>
        )}
      </div>
    </div>
  );
}
