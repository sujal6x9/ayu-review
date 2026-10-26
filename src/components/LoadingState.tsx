import { LoaderCircle } from "lucide-react";

type LoadingStateProps = {
  label?: string;
  detail?: string;
  variant?: "overlay" | "page" | "inline" | "floating";
};

export function LoadingState({
  label = "Loading…",
  detail,
  variant = "inline",
}: LoadingStateProps) {
  const content = (
    <div
      className="flex flex-col items-center justify-center text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative grid h-14 w-14 place-items-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/15 border-r-primary border-t-primary" />
        <img
          src="/ayu-scholar-mark.png"
          alt=""
          className="h-8 w-8 object-contain"
          aria-hidden="true"
        />
      </div>
      <p className="mt-4 font-semibold text-foreground">{label}</p>
      {detail && <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">{detail}</p>}
      <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <span className="sr-only">Please wait</span>
    </div>
  );

  if (variant === "overlay") {
    return (
      <div className="fixed inset-0 z-[200] grid place-items-center bg-background/90 px-6 backdrop-blur-md">
        <div className="w-full max-w-sm rounded-3xl border border-border/70 bg-card/95 px-8 py-10 shadow-[0_30px_90px_-35px_rgba(0,75,70,.55)]">
          {content}
        </div>
      </div>
    );
  }

  if (variant === "page") {
    return <main className="grid min-h-[55svh] place-items-center px-6 py-16">{content}</main>;
  }

  if (variant === "floating") {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100]" role="status">
        <div className="h-1 w-full overflow-hidden bg-primary/15">
          <div className="h-full w-1/2 animate-[pulse_900ms_ease-in-out_infinite] rounded-r-full bg-primary shadow-[0_0_14px_rgba(0,127,105,.65)]" />
        </div>
        <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/95 px-3 py-2 text-xs font-semibold text-primary shadow-lg backdrop-blur">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          {label}
        </div>
      </div>
    );
  }

  return <div className="grid min-h-48 place-items-center px-4 py-10">{content}</div>;
}
