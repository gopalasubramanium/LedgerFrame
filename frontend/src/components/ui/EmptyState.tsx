import type { ReactNode } from "react";
import "./structure.css";

// Every empty / "—" region shows a REASON (Product Guarantee 3: "—" with a
// reason, never blank). DESIGN-SYSTEM §5.4.
export interface EmptyStateProps {
  message: string;
  reason: string;
  action?: ReactNode;
}

export function EmptyState({ message, reason, action }: EmptyStateProps) {
  return (
    <div className="lf-empty" role="status">
      <div className="lf-empty__message">{message}</div>
      <div className="lf-empty__reason">{reason}</div>
      {action}
    </div>
  );
}
