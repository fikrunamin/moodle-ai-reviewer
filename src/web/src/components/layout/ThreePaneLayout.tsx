import type { ReactNode } from "react";

interface Props {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function ThreePaneLayout({ left, center, right }: Props) {
  return (
    <main className="app-shell">
      <aside className="pane pane-left">{left}</aside>
      <section className="pane pane-center">{center}</section>
      <section className="pane pane-right">{right}</section>
    </main>
  );
}
