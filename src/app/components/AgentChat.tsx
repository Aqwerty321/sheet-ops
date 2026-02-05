"use client";

import { useState, useRef, useEffect } from "react";
import { useAgentChat, useComposioConnection, type ChatMessage } from "../hooks/useAgentChat";

interface AgentChatProps {
  userId?: string;
  sheetId?: string;
  onOperationsGenerated?: (ops: any[]) => void;
}

export function AgentChat({ userId, sheetId, onOperationsGenerated }: AgentChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    isAuthRequired,
    sendMessage,
    clearMessages,
    clearAuthRequired,
  } = useAgentChat({
    userId,
    onAuthRequired: () => {
      console.log("Auth required - prompting user to connect Google Sheets");
    },
  });

  const { isConnected, isChecking, checkConnection, initiateConnection } =
    useComposioConnection(userId);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const message = sheetId
      ? `[Sheet: ${sheetId}] ${input}`
      : input;

    setInput("");
    await sendMessage(message);
  };

  const handleConnect = async () => {
    try {
      await initiateConnection(window.location.href);
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-2 border-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black">
        <h3 className="font-bold text-lg">AI Agent</h3>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-gray-300"
            }`}
          />
          <span className="text-sm text-gray-600">
            {isChecking ? "Checking..." : isConnected ? "Connected" : "Not connected"}
          </span>
          {!isConnected && (
            <button
              onClick={handleConnect}
              className="text-sm underline hover:no-underline"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="text-lg font-medium mb-2">Ask me anything about your sheet</p>
            <p className="text-sm">Try: "Remove duplicate emails" or "Sort by amount descending"</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Auth Required Banner */}
        {isAuthRequired && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
            <p className="font-medium text-yellow-800 mb-2">
              Connect Google Sheets to continue
            </p>
            <p className="text-sm text-yellow-700 mb-3">
              The agent needs access to your Google Sheets to perform this action.
            </p>
            <button
              onClick={handleConnect}
              className="px-4 py-2 bg-yellow-500 text-white font-medium rounded hover:bg-yellow-600 transition-colors"
            >
              Connect Google Sheets
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t-2 border-black p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the agent..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border-2 border-black rounded-none focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearMessages}
            className="mt-2 text-sm text-gray-500 hover:text-black underline"
          >
            Clear conversation
          </button>
        )}
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] px-4 py-2 rounded-lg ${
          isUser
            ? "bg-black text-white"
            : "bg-gray-100 text-black border border-gray-200"
        } ${message.isStreaming ? "animate-pulse" : ""}`}
      >
        <p className="whitespace-pre-wrap">{message.content || "..."}</p>
        <span className="text-xs opacity-60 mt-1 block">
          {message.timestamp.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
