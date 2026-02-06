"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AgentMessage from "./AgentMessage";
import AgentLoadingState from "./AgentLoadingState";

interface Message {
  id: string;
  from: "user" | "agent";
  text: string;
  isStreaming?: boolean;
}

interface Column {
  id: string;
  label: string;
}

interface Row {
  id: string;
  cells: Record<string, string>;
}

interface EditOperation {
  id: string;
  type:
  | "cell_update"
  | "column_add"
  | "column_delete"
  | "add_row"
  | "row_delete"
  | "sort";
  rowId?: string;
  columnId?: string;
  oldValue?: string;
  newValue?: string;
  columnLabel?: string;
  direction?: "asc" | "desc";
  row?: Row;
  author: "user" | "agent";
}

interface AgentSidebarProps {
  mode: "agent" | "manual";
  pendingOps: EditOperation[];
  columns: Column[];
  rows: Row[];
  sheetId?: string;
  sheetName?: string;
  tabName?: string;
  userId?: string;
  validationIssues: { id: string; rowId: string; columnId: string; message: string }[];
  onProposeOps: (ops: EditOperation[]) => void;
  onPreview: () => void;
  onRun?: (text: string) => void;
  onAgentComplete?: () => void;
}

type AgentStatus = "idle" | "thinking" | "streaming" | "auth_required";

export default function AgentSidebar({
  mode,
  pendingOps,
  columns,
  rows,
  sheetId,
  sheetName,
  tabName,
  userId,
  validationIssues,
  onProposeOps,
  onPreview,
  onRun,
  onAgentComplete,
}: AgentSidebarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: "m1", from: "agent", text: "Connect to a sheet to get started. Once connected, I can help you edit, clean, and transform your data." },
  ]);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedSheet, setConnectedSheet] = useState<{ id: string; name: string } | null>(null);
  const [isConnectingSheet, setIsConnectingSheet] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Check Composio connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(
          `/api/composio/connection?userId=${userId || "anonymous"}&app=google_sheets`
        );
        const data = (await res.json()) as { connected?: boolean };
        setIsConnected(data.connected ?? false);
      } catch {
        setIsConnected(false);
      }
    };
    checkConnection();
  }, [userId]);

  const handleConnect = async () => {
    console.log("handleConnect called");
    alert("Connecting to Google Sheets...");
    try {
      const res = await fetch("/api/composio/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || "anonymous",
          app: "google_sheets",
          redirectUrl: window.location.href,
        }),
      });
      const data = (await res.json()) as { redirectUrl?: string; error?: string; details?: unknown };
      console.log("Connect response:", data);

      if (data.error) {
        alert(`Connection failed: ${data.error}\n${JSON.stringify(data.details, null, 2)}`);
        return;
      }

      if (data.redirectUrl) {
        // Redirect to OAuth page
        window.location.href = data.redirectUrl;
      } else {
        alert("No redirect URL returned. Check the console and Composio dashboard.");
      }
    } catch (err) {
      console.error("Failed to initiate connection:", err);
      alert(`Failed to connect: ${err}`);
    }
  };

  const handleConnectSheet = async () => {
    if (!sheetId) return;

    setIsConnectingSheet(true);
    setAgentConnected(false);

    // Set connected sheet immediately for UI
    setConnectedSheet({
      id: sheetId,
      name: sheetName || `Sheet ${sheetId.slice(0, 8)}...`,
    });

    try {
      // Build the CONTEXT message
      const contextMessage = {
        type: "CONTEXT",
        spreadsheetId: sheetId,
        spreadsheetName: sheetName || `Sheet ${sheetId.slice(0, 8)}...`,
        tabName: tabName || "Sheet1",
        connectedAccountId: userId || "anonymous", // Will be replaced with actual account ID in production
        columns: columns.map((col, idx) => ({
          letter: String.fromCharCode(65 + idx), // A, B, C, etc.
          name: col.label,
          id: col.id,
        })),
        dataTypes: columns.reduce((acc: Record<string, string>, col) => {
          acc[col.label] = "text"; // Default to text, could be more sophisticated
          return acc;
        }, {}),
        // Include row indices so agent knows exact row numbers to reference
        // Row 1 = first data row (r1), Row 2 = second data row (r2), etc.
        currentData: rows.slice(0, 10).map((row, idx) => ({
          rowIndex: idx + 1, // 1-based row number for agent to use
          rowId: row.id,     // Our internal ID (r1, r2, etc.)
          values: columns.map((col) => row.cells[col.id] || ""),
        })),
        rowCount: rows.length,
        note: "Row indices are 1-based. Use rowIndex value when specifying row in operations.",
      };

      // Send context message to agent
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      const contextMsg: Message = {
        id: `ctx-${Date.now()}`,
        from: "user",
        text: JSON.stringify(contextMessage, null, 2),
      };
      setMessages((prev) => [...prev, contextMsg]);

      const agentMsgId = `a-ctx-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: agentMsgId, from: "agent", text: "", isStreaming: true },
      ]);

      const response = await fetch("/api/chat/proxy", {
        method: runId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: JSON.stringify(contextMessage),
          runId,
          userId: userId || "anonymous",
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const newRunId = response.headers.get("X-Toolhouse-Run-ID");
      if (newRunId) {
        setRunId(newRunId);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId ? { ...m, text: accumulated } : m
          )
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId ? { ...m, isStreaming: false } : m
        )
      );

      // Check if agent confirmed connection
      try {
        const jsonMatch = accumulated.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.status === "CONNECTED" && parsed.confirmed === true) {
            setAgentConnected(true);
          } else {
            throw new Error("Agent did not confirm connection");
          }
        } else {
          throw new Error("No JSON response from agent");
        }
      } catch (e) {
        console.error("Connection confirmation failed:", e);
        setIsConnectingSheet(false);
        setConnectedSheet(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            from: "agent",
            text: "Failed to connect to the agent. Please try again.",
          },
        ]);
        return;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("Connection error:", err);
      setConnectedSheet(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          from: "agent",
          text: `Connection failed: ${(err as Error).message}`,
        },
      ]);
    } finally {
      setIsConnectingSheet(false);
      abortRef.current = null;
    }
  };

  const handleDisconnectSheet = () => {
    setConnectedSheet(null);
    setRunId(null);
    setMessages([
      {
        id: `m-${Date.now()}`,
        from: "agent",
        text: "Disconnected from sheet. Select another sheet and connect to continue editing.",
      },
    ]);
  };

  const parseOperationsFromResponse = useCallback((text: string): EditOperation[] => {
    const ops: EditOperation[] = [];

    // Helper to convert column letter to index
    const columnLetterToIndex = (letter: string): number => {
      let index = 0;
      for (let i = 0; i < letter.length; i++) {
        index = index * 26 + (letter.charCodeAt(i) - 64);
      }
      return index - 1;
    };

    console.log("Parsing agent response for operations...");

    // Look for JSON blocks in the response
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        console.log("Parsed JSON from agent:", parsed);

        // Handle the new format with "operations" array
        if (parsed.operations && Array.isArray(parsed.operations)) {
          const result = parsed.operations.map((op: any, idx: number) => {
            console.log("Processing operation:", op);
            if (op.type === "cell_update") {
              // Convert column letter to columnId
              const colIndex = columnLetterToIndex(op.column.toUpperCase());
              const columnId = columns[colIndex]?.id || `col_${colIndex}`;
              // Agent row numbers are 1-based and refer to data rows (headers excluded)
              // Our internal rowId r1 = first data row, so agent row 1 = r1
              // No offset needed - direct mapping
              const rowNum = op.row;
              console.log("Cell update row mapping:", {
                agentRow: op.row,
                rowId: `r${rowNum}`,
                column: op.column,
                columnId,
                value: op.value
              });
              return {
                id: `op-${Date.now()}-${idx}`,
                type: "cell_update" as const,
                rowId: `r${rowNum}`,
                columnId,
                newValue: String(op.value),
                author: "agent" as const,
              };
            } else if (op.type === "row_insert") {
              const newRowId = `r-new-${Date.now()}-${idx}`;
              if (Array.isArray(op.values)) {
                return op.values.map((val: string, colIdx: number) => {
                  const col = columns[colIdx];
                  return {
                    id: `op-${Date.now()}-insert-${idx}-${colIdx}`,
                    type: "cell_update" as const,
                    rowId: newRowId,
                    columnId: col?.id || `col_${colIdx}`,
                    newValue: String(val),
                    author: "agent" as const,
                  };
                });
              }
            } else if (op.type === "row_delete") {
              // Agent row numbers are 1-based data rows, no offset needed
              const rowNum = op.row;
              return {
                id: `op-${Date.now()}-del-${idx}`,
                type: "row_delete" as const,
                rowId: `r${rowNum}`,
                author: "agent" as const,
              };
            } else if (op.type === "sort") {
              // Handle sort operation - rearrange all rows
              // The agent should provide sorted_data with all rows in new order
              if (Array.isArray(op.sorted_data)) {
                return op.sorted_data.flatMap((rowData: string[], rowIdx: number) => {
                  return columns.map((col, colIdx) => ({
                    id: `op-${Date.now()}-sort-${rowIdx}-${colIdx}`,
                    type: "cell_update" as const,
                    rowId: `r${rowIdx + 1}`, // 1-indexed for display row
                    columnId: col.id,
                    newValue: String(rowData[colIdx] ?? ""),
                    author: "agent" as const,
                  }));
                });
              }
              // Alternative: just mark as a sort op
              return {
                id: `op-${Date.now()}-sort-${idx}`,
                type: "sort" as const,
                columnId: columns[columnLetterToIndex(op.column?.toUpperCase() || "A")]?.id,
                direction: op.direction || "asc",
                author: "agent" as const,
              };
            }
            return null;
          }).flat().filter(Boolean);
          console.log("Final operations:", result);
          return result;
        }

        // Fallback to old format
        if (Array.isArray(parsed)) {
          return parsed.map((op: any, idx: number) => {
            if (op.type === "row_insert") {
              const newRowId = `r-inserted-${Date.now()}-${idx}`;
              if (Array.isArray(op.values)) {
                return op.values.map((val: string, colIdx: number) => {
                  const col = columns[colIdx];
                  return {
                    id: `op-${Date.now()}-insert-${idx}-${colIdx}`,
                    type: "cell_update" as const,
                    rowId: newRowId,
                    columnId: col?.id || `col_${colIdx}`,
                    newValue: val,
                    author: "agent" as const,
                  };
                });
              }
              return {
                id: `op-${Date.now()}-insert-${idx}`,
                type: "row_insert" as const,
                rowId: newRowId,
                author: "agent" as const,
              };
            }
            return {
              id: `op-${Date.now()}-${idx}`,
              type: op.type || "cell_update",
              rowId: op.rowId,
              columnId: op.columnId,
              oldValue: op.oldValue,
              newValue: op.newValue,
              author: "agent" as const,
            };
          }).flat();
        }
      } catch (e) {
        console.error("Failed to parse operations JSON:", e, "Raw:", jsonMatch[1]);
      }
    }

    // Fallback: detect patterns like "delete row X"
    const deleteMatch = text.match(/delete\s+row\s+(\d+)/gi);
    if (deleteMatch) {
      deleteMatch.forEach((match, idx) => {
        const rowNum = match.match(/\d+/)?.[0];
        if (rowNum && rows[parseInt(rowNum) - 1]) {
          ops.push({
            id: `op-${Date.now()}-del-${idx}`,
            type: "row_delete",
            rowId: rows[parseInt(rowNum) - 1].id,
            author: "agent",
          });
        }
      });
    }

    return ops;
  }, [rows, columns]);

  // Helper to convert column letter to index
  const columnLetterToIndex = (letter: string): number => {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
      index = index * 26 + (letter.charCodeAt(i) - 64);
    }
    return index - 1;
  };

  const handleRun = async () => {
    if (mode !== "agent") return;
    if (!input.trim()) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      from: "user",
      text: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    onRun?.(userMessage.text);

    const agentMsgId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: agentMsgId, from: "agent", text: "", isStreaming: true },
    ]);
    setStatus("thinking");

    try {
      // Just send the user message directly - context was already sent during connection
      const method = runId ? "PUT" : "POST";
      const response = await fetch("/api/chat/proxy", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.text,
          runId,
          userId: userId || "anonymous",
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const newRunId = response.headers.get("X-Toolhouse-Run-ID");
      if (newRunId) {
        setRunId(newRunId);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";
      setStatus("streaming");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        if (accumulated.trim() === "AUTH_REQUIRED") {
          setStatus("auth_required");
          setMessages((prev) => prev.filter((m) => m.id !== agentMsgId));
          break;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId ? { ...m, text: accumulated } : m
          )
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId ? { ...m, isStreaming: false } : m
        )
      );

      if (accumulated && accumulated.trim() !== "AUTH_REQUIRED") {
        const ops = parseOperationsFromResponse(accumulated);
        console.log("Parsed operations from agent:", ops);
        if (ops.length > 0) {
          onProposeOps(ops);
          // Don't auto-open preview, let user see the pending ops in sidebar
          // onPreview();
        }
        // Note: We don't call onAgentComplete here anymore because
        // the agent doesn't write to sheets directly - it only generates
        // operations that the user must review and push
      }

      setStatus("idle");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;

      console.error("Agent error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? { ...m, text: "Sorry, something went wrong. Please try again.", isStreaming: false }
            : m
        )
      );
      setStatus("idle");
    } finally {
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRun();
    }
  };

  useEffect(() => {
    const el = messagesRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const statusConfig = {
    idle: { color: "bg-gray-400", label: "Idle" },
    thinking: { color: "bg-yellow-400 animate-pulse", label: "Thinking..." },
    streaming: { color: "bg-green-400 animate-pulse", label: "Responding..." },
    auth_required: { color: "bg-red-400", label: "Auth Required" },
  };

  return (
    <>
      {isConnectingSheet && !agentConnected ? (
        <AgentLoadingState sheetName={sheetName || sheetId || "Sheet"} />
      ) : (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-semibold">Agent</div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={`h-2 w-2 rounded-full ${statusConfig[status].color}`} />
              {statusConfig[status].label}
            </div>
          </div>

          {/* Connected Sheet Info or Connect Button */}
          {connectedSheet && agentConnected ? (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div>
                    <div className="text-sm font-medium text-green-800">Connected</div>
                    <div className="text-xs text-green-600 truncate max-w-[180px]" title={connectedSheet.name}>
                      {connectedSheet.name}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleDisconnectSheet}
                  className="text-xs text-green-600 hover:text-green-800 underline"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : sheetId ? (
            <div className="mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6">
              <div className="mb-2 text-center text-sm text-gray-600">
                {sheetName || `Sheet ${sheetId.slice(0, 12)}...`}
              </div>
              <button
                onClick={handleConnectSheet}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Connect to this Sheet
              </button>
              <div className="mt-2 text-xs text-gray-500 text-center">
                Click to give the agent full access to edit this spreadsheet
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center text-sm text-yellow-700">
              Select a sheet from the dropdown to get started
            </div>
          )}

          <div ref={messagesRef} className="flex-1 overflow-auto space-y-3 p-2">
            {messages.map((m) => (
              <AgentMessage
                key={m.id}
                from={m.from}
                text={m.text || (m.isStreaming ? "..." : "")}
              />
            ))}

            <div className="border-t border-gray-100 pt-2 text-sm text-gray-600">
              {pendingOps.length === 0 ? (
                <span>No pending changes</span>
              ) : (
                <div className="space-y-1">
                  <div className="font-medium text-gray-700">
                    Pending changes ({pendingOps.length})
                  </div>
                  <ul className="space-y-1 max-h-32 overflow-auto">
                    {pendingOps.map((op) => (
                      <li key={op.id}>
                        <button
                          className="text-left underline text-xs"
                          aria-label="Preview pending change"
                          onClick={onPreview}
                        >
                          {op.type}: {op.rowId ?? "-"} · {op.columnId ?? "-"}
                          {op.newValue ? ` → "${op.newValue}"` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {validationIssues.length > 0 && (
              <div className="border-t border-gray-100 pt-2 text-sm text-gray-600">
                <div className="font-medium text-gray-700">
                  Validation issues ({validationIssues.length})
                </div>
                <ul className="mt-1 space-y-1 max-h-24 overflow-auto">
                  {validationIssues.map((issue) => (
                    <li key={issue.id} className="text-xs text-red-600">
                      {issue.rowId} · {issue.columnId}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 bg-white p-2">
            <textarea
              aria-label="Agent input"
              placeholder={
                !connectedSheet
                  ? "Connect to a sheet first to start editing"
                  : mode === "agent"
                    ? "Ask: remove duplicates, sort by amount, clean emails..."
                    : "Switch to Agent mode to use AI"
              }
              className="w-full resize-none rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-500"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!connectedSheet || mode !== "agent" || status === "streaming" || status === "thinking"}
            />
            <button
              aria-label="Run agent"
              className="rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
              onClick={handleRun}
              disabled={!connectedSheet || mode !== "agent" || !input.trim() || status === "streaming" || status === "thinking"}
            >
              {status === "thinking" || status === "streaming" ? "Processing..." : "Run"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
