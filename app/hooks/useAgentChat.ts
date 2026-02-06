"use client";

import { useState, useCallback } from "react";

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

export function useAgentChat(options: UseAgentChatOptions = {}) {
    const { userId = "anonymous", onAuthRequired } = options;
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthRequired, setIsAuthRequired] = useState(false);
    const [runId, setRunId] = useState<string | null>(null);

    const sendMessage = useCallback(
        async (content: string) => {
            const userMessage: ChatMessage = {
                id: `user-${Date.now()}`,
                role: "user",
                content,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, userMessage]);
            setIsLoading(true);
            setIsAuthRequired(false);

            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: "",
                timestamp: new Date(),
                isStreaming: true,
            };

            setMessages((prev) => [...prev, assistantMessage]);

            try {
                const response = await fetch("/api/chat/proxy", {
                    method: runId ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: content,
                        runId,
                        userId,
                    }),
                });

                // Get runId from headers
                const newRunId = response.headers.get("X-Toolhouse-Run-ID");
                if (newRunId) {
                    setRunId(newRunId);
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || "Request failed");
                }

                // Handle streaming response
                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error("No response body");
                }

                const decoder = new TextDecoder();
                let fullContent = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });

                    // Parse SSE events
                    const lines = chunk.split("\n");
                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            if (data === "[DONE]") continue;

                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.content) {
                                    fullContent += parsed.content;
                                }
                                // Check for auth required
                                if (parsed.auth_required) {
                                    setIsAuthRequired(true);
                                    onAuthRequired?.();
                                }
                            } catch {
                                // Plain text content
                                fullContent += data;
                            }
                        }
                    }

                    // Update the assistant message
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === assistantMessage.id
                                ? { ...msg, content: fullContent }
                                : msg
                        )
                    );
                }

                // Mark as done streaming
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === assistantMessage.id
                            ? { ...msg, isStreaming: false }
                            : msg
                    )
                );
            } catch (error) {
                console.error("Chat error:", error);
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === assistantMessage.id
                            ? {
                                ...msg,
                                content: "Sorry, something went wrong. Please try again.",
                                isStreaming: false,
                            }
                            : msg
                    )
                );
            } finally {
                setIsLoading(false);
            }
        },
        [runId, userId, onAuthRequired]
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
        sendMessage,
        clearMessages,
        clearAuthRequired,
    };
}

export function useComposioConnection(userId: string = "anonymous") {
    const [isConnected, setIsConnected] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [accountId, setAccountId] = useState<string | null>(null);

    const checkConnection = useCallback(async () => {
        setIsChecking(true);
        try {
            const response = await fetch(
                `/api/composio/connection?userId=${userId}`
            );
            const data = await response.json();
            setIsConnected(data.connected ?? false);
            setAccountId(data.connectedAccountId ?? null);
        } catch (error) {
            console.error("Failed to check connection:", error);
            setIsConnected(false);
        } finally {
            setIsChecking(false);
        }
    }, [userId]);

    const initiateConnection = useCallback(
        async (redirectUrl: string) => {
            const response = await fetch("/api/composio/connection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    app: "google_sheets",
                    redirectUrl,
                }),
            });

            const data = await response.json();
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else {
                throw new Error(data.error || "Failed to get redirect URL");
            }
        },
        [userId]
    );

    return {
        isConnected,
        isChecking,
        accountId,
        checkConnection,
        initiateConnection,
    };
}
