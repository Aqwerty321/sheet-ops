"use client";

import ClickSpark from "../../components/ClickSpark";

interface GlobalClickSparkProps {
  children: React.ReactNode;
}

export default function GlobalClickSpark({ children }: GlobalClickSparkProps) {
  return (
    <ClickSpark
      sparkColor="#000000"
      sparkSize={21}
      sparkRadius={15}
      sparkCount={7}
      duration={400}
    >
      <div className="min-h-screen w-full">{children}</div>
    </ClickSpark>
  );
}