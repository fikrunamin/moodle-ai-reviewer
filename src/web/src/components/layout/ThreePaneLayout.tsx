import type { ReactNode } from "react";

interface Props {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function ThreePaneLayout({ left, center, right }: Props) {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-slate-100 text-slate-900 lg:grid-cols-[340px_minmax(360px,1fr)_minmax(420px,560px)]">
      <aside className="min-w-0 border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">{left}</aside>
      <section className="min-w-0 border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">{center}</section>
      <section className="min-w-0 bg-white">{right}</section>
    </main>
  );
}
