import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { MARK_TONE, type Comment, type PdfAnchor } from "@/lib/papers";
import { penBounds, type PenPoint } from "@/lib/review-tools";
import type { MarkStatus } from "@/lib/papers";

type Props = {
  data: ArrayBuffer;
  zoom: number;
  marking: boolean;
  pen: boolean;
  penMark: MarkStatus;
  onPen: (a: PdfAnchor) => void;
  threads: Comment[];
  pending: PdfAnchor | null;
  focusId: string | null;
  onCreate: (a: PdfAnchor) => void;
  onFocus: (id: string) => void;
  onPages: (n: number) => void;
};

function strokePath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  const scaled = points.map((point) => ({ x: point.x * 1000, y: point.y * 1000 }));
  if (scaled.length === 1) return `M ${scaled[0]?.x} ${scaled[0]?.y} l 0.01 0`;
  if (scaled.length === 2) return `M ${scaled[0]?.x} ${scaled[0]?.y} L ${scaled[1]?.x} ${scaled[1]?.y}`;
  let path = `M ${scaled[0]?.x} ${scaled[0]?.y}`;
  for (let index = 1; index < scaled.length - 1; index += 1) {
    const point = scaled[index]; const next = scaled[index + 1];
    if (point && next) path += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
  }
  const last = scaled[scaled.length - 1];
  return last ? `${path} L ${last.x} ${last.y}` : path;
}

export function PdfViewer(props: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(600);
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setAvailableWidth(Math.max(100, entry.contentRect.width)); });
    observer.observe(node);
    return () => observer.disconnect();
  }, [doc]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const d = await pdfjs.getDocument({ data: props.data.slice(0) }).promise;
        if (!cancelled) {
          setDoc(d);
          props.onPages(d.numPages);
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.data]);

  if (err) return <div className="p-8 text-destructive">Could not open this PDF: {err}</div>;
  if (!doc) return <div className="p-8 text-muted-foreground">Opening PDF…</div>;

  return (
    <div ref={containerRef} className="flex w-full flex-col items-center gap-5 px-2 py-4 sm:px-4 sm:py-6">
      {Array.from({ length: doc.numPages }, (_, i) => (
        <PdfPage key={i} doc={doc} pageNumber={i + 1} availableWidth={availableWidth} {...props} />
      ))}
    </div>
  );
}

function PdfPage({
  doc,
  availableWidth,
  pageNumber,
  zoom,
  marking,
  pen,
  penMark,
  onPen,
  threads,
  pending,
  focusId,
  onCreate,
  onFocus,
}: Props & { doc: PDFDocumentProxy; pageNumber: number; availableWidth: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 600, h: 800 });
  const [draft, setDraft] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const stroke = useRef<PenPoint[]>([]);
  const [strokePreview, setStrokePreview] = useState<PenPoint[]>([]);

  useEffect(() => {
    let task: { cancel: () => void } | null = null;
    let alive = true;
    doc.getPage(pageNumber).then((page) => {
      if (!alive || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: zoom * 1.4 });
      const canvas = canvasRef.current;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * ratio;
      canvas.height = viewport.height * ratio;
      setSize({ w: viewport.width, h: viewport.height });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const t = page.render({
        canvas,
        canvasContext: ctx,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      task = t;
      t.promise.catch(() => {});
    });
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [doc, pageNumber, zoom]);

  function frac(e: React.PointerEvent) {
    const r = overlay.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }

  const mine = threads.filter((t) => (t.anchor as PdfAnchor).page === pageNumber);

  return (
    <div id={`pdf-page-${pageNumber}`} className="relative shrink-0 bg-card shadow-[0_16px_45px_-24px_rgba(15,45,55,.7)]" style={{ width: Math.min(size.w, availableWidth * zoom), aspectRatio: `${size.w} / ${size.h}` }}>
      <canvas ref={canvasRef} className="block h-auto w-full" />
      <div
        ref={overlay}
        aria-label={`Page ${pageNumber} annotation surface`}
        className={`absolute inset-0 ${marking || pen ? "cursor-crosshair touch-none" : ""}`}
        onPointerDown={(e) => {
          if (pen) {
            e.currentTarget.setPointerCapture(e.pointerId);
            stroke.current = [frac(e)];
            setStrokePreview(stroke.current);
            return;
          }
          if (!marking) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = frac(e);
          setDraft({ x0: p.x, y0: p.y, x: p.x, y: p.y });
        }}
        onPointerMove={(e) => {
          if (pen && stroke.current.length) {
            const point = frac(e);
            const last = stroke.current[stroke.current.length - 1];
            if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.002) return;
            stroke.current = [...stroke.current, point];
            setStrokePreview(stroke.current);
            return;
          }
          if (!draft) return;
          const p = frac(e);
          setDraft({ ...draft, x: p.x, y: p.y });
        }}
        onPointerCancel={() => { stroke.current = []; setStrokePreview([]); setDraft(null); }}
        onPointerUp={(e) => {
          if (pen && stroke.current.length) {
            const points = [...stroke.current, frac(e)];
            stroke.current = [];
            setStrokePreview([]);
            onPen({ type: "pdf", page: pageNumber, ...penBounds(points), points, tool: "pen" });
            return;
          }
          if (!draft) return;
          let x = Math.min(draft.x0, draft.x);
          let y = Math.min(draft.y0, draft.y);
          let w = Math.abs(draft.x - draft.x0);
          let h = Math.abs(draft.y - draft.y0);
          if (w < 0.01 && h < 0.01) {
            w = 0.04;
            h = 0.025;
            x = Math.max(0, x - 0.02);
            y = Math.max(0, y - 0.0125);
          }
          setDraft(null);
          onCreate({ type: "pdf", page: pageNumber, x, y, w, h });
        }}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          {mine.map((t) => {
            const a = t.anchor as PdfAnchor;
            return a.points ? <path key={t.id} d={strokePath(a.points)} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className={`${MARK_TONE[t.mark].text} ${t.status === "resolved" ? "opacity-40" : ""}`} /> : null;
          })}
          {strokePreview.length > 0 && <path d={strokePath(strokePreview)} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className={MARK_TONE[penMark].text} />}
        </svg>
        {mine.map((t, i) => {
          const a = t.anchor as PdfAnchor;
          const tone = MARK_TONE[t.mark];
          return (
            <Button variant="ghost"
              key={t.id}
              id={`anchor-${t.id}`}
              onPointerDown={(e) => { if (!pen && !marking) e.stopPropagation(); }}
              onClick={() => { if (!pen && !marking) onFocus(t.id); }}
              title={t.body}
              aria-label={a.points ? "Select pen mark" : "Select area comment"}
              className={`absolute min-h-0 p-0 ${a.points ? "border-0 hover:bg-transparent" : `border-2 ${tone.border} ${tone.soft}`} ${pen || marking ? "pointer-events-none" : ""} ${t.status === "resolved" ? "opacity-40" : ""} ${focusId === t.id ? "ring-2 ring-ring ring-offset-1" : ""}`}
              style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
            >
              <span className={`absolute -left-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-primary-foreground ${tone.bg}`}>
                {t.question_ref || i + 1}
              </span>
            </Button>
          );
        })}
        {pending && pending.page === pageNumber && (
          <div
            className="absolute animate-pulse border-2 border-dashed border-primary bg-primary/10"
            style={{ left: `${pending.x * 100}%`, top: `${pending.y * 100}%`, width: `${pending.w * 100}%`, height: `${pending.h * 100}%` }}
          />
        )}
        {draft && (
          <div
            className="absolute border-2 border-primary bg-primary/10"
            style={{
              left: `${Math.min(draft.x0, draft.x) * 100}%`,
              top: `${Math.min(draft.y0, draft.y) * 100}%`,
              width: `${Math.abs(draft.x - draft.x0) * 100}%`,
              height: `${Math.abs(draft.y - draft.y0) * 100}%`,
            }}
          />
        )}
      </div>
      <div className="absolute bottom-1 right-1 text-xs text-muted-foreground">{pageNumber}</div>
    </div>
  );
}
