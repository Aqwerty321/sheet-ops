interface AgentMessageProps {
  from: "user" | "agent";
  text: string;
}

export default function AgentMessage({ from, text }: AgentMessageProps) {
  const isUser = from === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg p-3 text-sm ${
          isUser ? "bg-gray-800 text-white" : "bg-gray-100 text-black"
        }`}
      >
        {text}
      </div>
    </div>
  );
}