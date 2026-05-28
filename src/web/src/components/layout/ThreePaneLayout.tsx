import { useState, type CSSProperties, type ReactNode } from "react";

interface Props {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function ThreePaneLayout({ left, center, right }: Props) {
  const [leftWidth, setLeftWidth] = useState(25);
  const [centerWidth, setCenterWidth] = useState(25);

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

  const rightWidth = Math.max(32, 100 - leftWidth - centerWidth);

  return (
    <main
      className="win-app grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(260px,var(--left))_6px_minmax(300px,var(--center))_6px_minmax(420px,var(--right))]"
      style={{
        "--left": `${leftWidth}%`,
        "--center": `${centerWidth}%`,
        "--right": `${rightWidth}%`,
      } as CSSProperties}
    >
      <aside className="min-w-0 p-1">{left}</aside>
      <div className="win-resizer hidden cursor-col-resize lg:block" onMouseDown={startDrag("left")} />
      <section className="min-w-0 p-1">{center}</section>
      <div className="win-resizer hidden cursor-col-resize lg:block" onMouseDown={startDrag("center")} />
      <section className="min-w-0 p-1">{right}</section>
    </main>
  );
}
