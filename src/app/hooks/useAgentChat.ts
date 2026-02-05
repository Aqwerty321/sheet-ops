"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface UseAgentChatOptions {
  userId?: string;
  onAuthRequired?: () => void;
}

interface UseAgentChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isAuthRequired: boolean;
  runId: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearMessages: () => void;
  clearAuthRequired: () => void;
}

export function useAgentChat(options: UseAgentChatOptions = {}): UseAgentChatReturn {
  const { userId, onAuthRequired } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) return;

      // Abort any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        timestamp: new Date(),
      };

      // Add placeholder for assistant response
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);
      setIsAuthRequired(false);

      try {
        const method = runId ? "PUT" : "POST";
        const response = await fetch("/api/chat/proxy", {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            runId,
            userId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        // Extract run ID from headers
        const newRunId = response.headers.get("X-Toolhouse-Run-ID");
        if (newRunId) {
          setRunId(newRunId);
        }

        // Read the streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          // Check for AUTH_REQUIRED signal
          if (accumulatedContent.trim() === "AUTH_REQUIRED") {
            setIsAuthRequired(true);
            onAuthRequired?.();

            // Remove the streaming message since it's just an auth signal
            setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
            break;
          }

          // Update the assistant message with accumulated content
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: accumulatedContent }
                : m,
            ),
          );
        }

        // Mark streaming as complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, isStreaming: false } : m,
          ),
        );
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          // Request was aborted, ignore
          return;
        }

        console.error("Chat error:", error);

        // Update assistant message with error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: "Sorry, something went wrong. Please try again.",
                  isStreaming: false,
                }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [isLoading, runId, userId, onAuthRequired],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setRunId(null);
    setIsAuthRequired(false);
  }, []);

  const clearAuthRequired = useCallback(() => {
    setIsAuthRequired(false);
  }, []);

  return {
    messages,
    isLoading,
    isAuthRequired,
    runId,
    sendMessage,
    clearMessages,
    clearAuthRequired,
  };
}

/**
 * Hook to manage Composio connection status
 */
export function useComposioConnection(userId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [connectionUrl, setConnectionUrl] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const response = await fetch(
        `/api/composio/connection?userId=${userId || "anonymous"}&app=google_sheets`,
      );
      const data = (await response.json()) as { connected?: boolean };
      setIsConnected(data.connected ?? false);
      return data.connected ?? false;
    } catch (error) {
      console.error("Failed to check connection:", error);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [userId]);

  const initiateConnection = useCallback(
    async (redirectUrl?: string) => {
      try {
        const response = await fetch("/api/composio/connection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: userId || "anonymous",
            app: "google_sheets",
            redirectUrl: redirectUrl || window.location.href,
          }),
        });

        const data = (await response.json()) as { redirectUrl?: string };

        if (data.redirectUrl) {
          setConnectionUrl(data.redirectUrl);
          // Redirect to OAuth flow
          window.location.href = data.redirectUrl;
        }

        return data;
      } catch (error) {
        console.error("Failed to initiate connection:", error);
        throw error;
      }
    },
    [userId],
  );

  return {
    isConnected,
    isChecking,
    connectionUrl,
    checkConnection,
    initiateConnection,
  };
}
