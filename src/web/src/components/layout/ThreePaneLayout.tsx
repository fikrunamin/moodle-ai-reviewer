import { useState, type CSSProperties, type ReactNode } from "react";

interface Props {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  leftCollapsed?: boolean;
  centerCollapsed?: boolean;
  onToggleLeft?: () => void;
  onToggleCenter?: () => void;
}

function CollapsedPaneRail({ label, onExpand }: { label: string; onExpand?: () => void }) {
  return (
    <button
      className="win-window flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted hover:text-secondary"
      onClick={onExpand}
      title={`Tampilkan ${label}`}
      style={{ writingMode: "vertical-rl" }}
    >
      {label}
    </button>
  );
}

export function ThreePaneLayout({
  left,
  center,
  right,
  leftCollapsed = false,
  centerCollapsed = false,
  onToggleLeft,
  onToggleCenter,
}: Props) {
  const [leftWidth, setLeftWidth] = useState(18);
  const [centerWidth, setCenterWidth] = useState(18);

  const startDrag = (handle: "left" | "center") => (event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const container = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const startLeft = leftWidth;
    const startCenter = centerWidth;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = ((moveEvent.clientX - startX) / container.width) * 100;
      if (handle === "left") {
        const nextLeft = Math.min(45, Math.max(18, startLeft + delta));
        const nextCenter = Math.min(45, Math.max(18, startCenter - delta));
        setLeftWidth(nextLeft);
        setCenterWidth(nextCenter);
      } else {
        const nextCenter = Math.min(50, Math.max(18, startCenter + delta));
        setCenterWidth(nextCenter);
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const leftColumn = leftCollapsed ? "44px" : `minmax(240px, ${leftWidth}%)`;
  const centerColumn = centerCollapsed ? "44px" : `minmax(280px, ${centerWidth}%)`;
  const leftResizerColumn = leftCollapsed || centerCollapsed ? "0px" : "4px";
  const centerResizerColumn = centerCollapsed ? "0px" : "4px";
  const columns = `${leftColumn} ${leftResizerColumn} ${centerColumn} ${centerResizerColumn} minmax(380px, 1fr)`;

  return (
    <main
      className="win-app grid h-screen min-h-0 grid-cols-1 gap-2 overflow-hidden p-2 lg:grid-cols-[var(--pane-cols)]"
      style={{
        "--pane-cols": columns,
      } as CSSProperties}
    >
      <aside className="min-h-0 min-w-0 overflow-hidden lg:sticky lg:top-2 lg:h-[calc(100vh-1rem)]">
        {leftCollapsed ? <CollapsedPaneRail label="Activity" onExpand={onToggleLeft} /> : left}
      </aside>
      <div
        className={`win-resizer hidden cursor-col-resize lg:block ${leftCollapsed || centerCollapsed ? "pointer-events-none opacity-0" : ""}`}
        onMouseDown={startDrag("left")}
      />
      <section className="min-h-0 min-w-0 overflow-hidden lg:sticky lg:top-2 lg:h-[calc(100vh-1rem)]">
        {centerCollapsed ? <CollapsedPaneRail label="Mahasiswa" onExpand={onToggleCenter} /> : center}
      </section>
      <div
        className={`win-resizer hidden cursor-col-resize lg:block ${centerCollapsed ? "pointer-events-none opacity-0" : ""}`}
        onMouseDown={startDrag("center")}
      />
      <section className="min-h-0 min-w-0 overflow-hidden lg:sticky lg:top-2 lg:h-[calc(100vh-1rem)]">{right}</section>
    </main>
  );
}
