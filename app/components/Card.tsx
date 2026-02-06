import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={`bg-white text-black rounded-lg border-2 border-black p-6 shadow-[10px_10px_0_rgba(0,0,0,0.15)] ${
        className ?? ""
      }`}
    >
      {children}
    </div>
  );
}