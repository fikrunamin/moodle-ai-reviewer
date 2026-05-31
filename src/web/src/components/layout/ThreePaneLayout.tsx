import { useState, type CSSProperties, type ReactNode } from "react";

interface Props {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function ThreePaneLayout({ left, center, right }: Props) {
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

  const rightWidth = Math.max(32, 100 - leftWidth - centerWidth);

  return (
    <main
      className="win-app grid min-h-screen grid-cols-1 gap-2 p-2 lg:grid-cols-[minmax(240px,var(--left))_4px_minmax(280px,var(--center))_4px_minmax(380px,var(--right))]"
      style={{
        "--left": `${leftWidth}%`,
        "--center": `${centerWidth}%`,
        "--right": `${rightWidth}%`,
      } as CSSProperties}
    >
      <aside className="min-w-0">{left}</aside>
      <div className="win-resizer hidden cursor-col-resize lg:block" onMouseDown={startDrag("left")} />
      <section className="min-w-0">{center}</section>
      <div className="win-resizer hidden cursor-col-resize lg:block" onMouseDown={startDrag("center")} />
      <section className="min-w-0">{right}</section>
    </main>
  );
}
