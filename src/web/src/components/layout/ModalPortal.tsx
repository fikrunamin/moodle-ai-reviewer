import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  children: ReactNode;
}

export function ModalPortal({ children }: Props) {
  if (typeof document === "undefined") return <>{children}</>;
  return createPortal(children, document.body);
}
