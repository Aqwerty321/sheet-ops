"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AgentSidebar from "../../components/AgentSidebar";
import AuthModeToggle from "../../components/AuthModeToggle";
import Card from "../../components/Card";
import DiffViewer from "../../components/DiffViewer";
import SheetPreview from "../../components/SheetPreview";
import ToolsPanel from "../../components/ToolsPanel";
import {
  Column,
  ColumnType,
  Row,
  EditOperation,
  SheetState,
  ValidationIssue,
} from "../types";

type Mode = "agent" | "manual";
type AuthMode = "service" | "oauth";

const MAX_INFER_ROWS = 20;

const inferColumnType = (rows: Row[], columnId: string): ColumnType => {
  const sample = rows.slice(0, MAX_INFER_ROWS).map((row) =>
    (row.cells[columnId] ?? "").trim(),
  );
  let emailHits = 0;
  let numberHits = 0;
  let dateHits = 0;
  let stringHits = 0;

  sample.forEach((value) => {
    if (!value) return;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      emailHits += 1;
      return;
    }
    if (!Number.isNaN(Number(value))) {
      numberHits += 1;
      return;
    }
    if (!Number.isNaN(Date.parse(value))) {
      dateHits += 1;
      return;
    }
    stringHits += 1;
  });

  if (emailHits >= Math.max(numberHits, dateHits, stringHits)) return "email";
  if (numberHits >= Math.max(emailHits, dateHits, stringHits)) return "number";
  if (dateHits >= Math.max(emailHits, numberHits, stringHits)) return "date";
  return "string";
};

const validateRows = (columns: Column[], rows: Row[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  columns.forEach((column) => {
    const inferred = inferColumnType(rows, column.id);
    rows.forEach((row) => {
      const value = (row.cells[column.id] ?? "").trim();
      if (!value) return;
      if (inferred === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        issues.push({
          id: `val-${row.id}-${column.id}`,
          rowId: row.id,
          columnId: column.id,
          message: "Invalid email format",
        });
      }
      if (inferred === "number" && Number.isNaN(Number(value))) {
        issues.push({
          id: `val-${row.id}-${column.id}`,
          rowId: row.id,
          columnId: column.id,
          message: "Expected a number",
        });
      }
    });
  });
  return issues;
};

const applyOpsToState = (state: SheetState, ops: EditOperation[]): SheetState => {
  let columns = [...state.columns];
  let rows = state.rows.map((row) => ({
    ...row,
    cells: { ...row.cells },
  }));

  ops.forEach((op) => {
    if (op.type === "cell_update" && op.rowId && op.columnId) {
      // Check if this is a new row (rowId starts with "r-new-" or "r-inserted-")
      const isNewRow = op.rowId.startsWith("r-new-") || op.rowId.startsWith("r-inserted-");
      const existingRow = rows.find((row) => row.id === op.rowId);
      
      if (isNewRow && !existingRow) {
        // Create a new row with empty cells for all columns
        const newRow = {
          id: op.rowId,
          cells: Object.fromEntries(columns.map((col) => [col.id, ""])),
        };
        rows = [...rows, newRow];
      }
      
      // Now update the cell
      rows = rows.map((row) =>
        row.id === op.rowId
          ? {
              ...row,
              cells: {
                ...row.cells,
                [op.columnId!]: op.newValue ?? "",
              },
            }
          : row,
      );
    }

    if (op.type === "column_add" && op.columnId) {
      columns = [
        ...columns,
        { id: op.columnId, label: op.columnLabel ?? op.columnId },
      ];
      rows = rows.map((row) => ({
        ...row,
        cells: { ...row.cells, [op.columnId!]: "" },
      }));
    }

    if (op.type === "column_delete" && op.columnId) {
      columns = columns.filter((column) => column.id !== op.columnId);
      rows = rows.map((row) => {
        const nextCells = { ...row.cells };
        delete nextCells[op.columnId!];
        return { ...row, cells: nextCells };
      });
    }

    if (op.type === "add_row" && op.row) {
      rows = [...rows, op.row];
    }

    if (op.type === "row_delete" && op.rowId) {
      rows = rows.filter((row) => row.id !== op.rowId);
    }

    if (op.type === "sort" && op.columnId) {
      const direction = op.direction ?? "asc";
      rows = [...rows].sort((a, b) => {
        const av = (a.cells[op.columnId!] ?? "").toString();
        const bv = (b.cells[op.columnId!] ?? "").toString();
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return direction === "asc" ? cmp : -cmp;
      });
    }
  });

  return { ...state, columns, rows };
};

export default function Page({ params }: { params: { sheetId: string } }) {
  const { sheetId } = params;
  const [mode, setMode] = useState<Mode>("agent");
  // Initialize authMode from localStorage to persist across navigation
  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sheetops-authMode");
      if (saved === "oauth" || saved === "service") return saved;
    }
    return "oauth"; // Default to oauth for Composio flow
  });
  const [oauthTokens, setOauthTokens] = useState<
    { accessToken: string; refreshToken?: string } | null
  >(null);
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [sheetIdInput, setSheetIdInput] = useState(sheetId);
  const [composioConnected, setComposioConnected] = useState(false);
  const [composioAccountId, setComposioAccountId] = useState<string | null>(null);
  const [availableSheets, setAvailableSheets] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<{ id: string; name: string } | null>(null);
  
  // Sheet tabs (worksheets within a spreadsheet)
  const [availableTabs, setAvailableTabs] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedTab, setSelectedTab] = useState<string>("Sheet1");
  const [loadingTabs, setLoadingTabs] = useState(false);

  const initialState = useMemo<SheetState>(() => {
    const columns: Column[] = [
      { id: "name", label: "Name" },
      { id: "email", label: "Email" },
      { id: "amount", label: "Amount", align: "right" },
    ];

    const rows: Row[] =
      sheetId === "sample"
        ? [
            {
              id: "r1",
              cells: {
                name: "Alice Smith",
                email: "alice@example.com",
                amount: "1200",
              },
            },
            {
              id: "r2",
              cells: {
                name: "Bob Chen",
                email: "bob@example.com",
                amount: "540",
              },
            },
            {
              id: "r3",
              cells: {
                name: "Cara Diaz",
                email: "cara@example.com",
                amount: "2300",
              },
            },
          ]
        : [
            { id: "r1", cells: { name: "", email: "", amount: "" } },
            { id: "r2", cells: { name: "", email: "", amount: "" } },
            { id: "r3", cells: { name: "", email: "", amount: "" } },
          ];

    return { columns, rows, pendingOps: [] };
  }, [sheetId]);

  // Persist authMode to localStorage
  useEffect(() => {
    localStorage.setItem("sheetops-authMode", authMode);
  }, [authMode]);

  const [sheetState, setSheetState] = useState<SheetState>(initialState);
  const baseStateRef = useRef<SheetState>(initialState);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    [],
  );
  const [isDiffOpen, setIsDiffOpen] = useState(false);

  // Check Composio connection on mount and when authMode changes
  useEffect(() => {
    const checkComposioConnection = async () => {
      console.log("Checking Composio connection for authMode:", authMode);
      try {
        const res = await fetch("/api/composio/connection?userId=anonymous&app=google_sheets");
        const data = (await res.json()) as { connected?: boolean; connectedAccountId?: string; accounts?: unknown[] };
        console.log("Composio connection response:", data);
        setComposioConnected(data.connected ?? false);
        
        // If connected, save account ID and load available sheets
        if (data.connected && data.connectedAccountId) {
          console.log("Connected! Account ID:", data.connectedAccountId);
          setComposioAccountId(data.connectedAccountId);
          loadAvailableSheets(data.connectedAccountId);
          
          // If we have a real sheet ID, auto-load the data
          if (isRealSheetId(sheetId)) {
            console.log("Auto-loading sheet data for:", sheetId);
            // Call handlePull directly with the accountId since state might not be updated yet
            handlePullWithAccountId(sheetId, data.connectedAccountId);
          }
        } else {
          console.log("Not connected. Accounts:", data.accounts);
          setComposioAccountId(null);
        }
      } catch (err) {
        console.error("Connection check error:", err);
        setComposioConnected(false);
        setComposioAccountId(null);
      }
    };
    
    // Helper to pull data with explicit accountId and tab name
    const handlePullWithAccountId = async (targetSheetId: string, accountId: string, tabName: string = "Sheet1") => {
      setSyncing(true);
      setAuthError(null);
      try {
        // Use tab name in range (e.g., "Sheet1!A1:Z1000")
        const range = `${tabName}!A1:Z1000`;
        const res = await fetch("/api/composio/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "anonymous",
            sheetId: targetSheetId,
            connectedAccountId: accountId,
            range,
          }),
        });
        
        const data = (await res.json()) as { values?: string[][]; error?: string; debug?: string };
        
        if (data.error) {
          console.error("Pull error:", data.error, data.debug);
          setAuthError(data.error);
          return;
        }
        
        const values = data.values ?? [];
        if (values.length === 0) {
          setAuthError("Sheet is empty or inaccessible.");
          return;
        }

        const headerRow = values[0];
        const columns: Column[] = headerRow.map((label, idx) => ({
          id: slugify(label) || `col_${idx + 1}`,
          label: label || `Column ${idx + 1}`,
        }));

        const rows: Row[] = values.slice(1).map((row, rowIndex) => ({
          id: `r${rowIndex + 1}`,
          cells: Object.fromEntries(
            columns.map((col, colIndex) => [col.id, row[colIndex] ?? ""]),
          ),
        }));

        const nextState: SheetState = { columns, rows, pendingOps: [] };
        baseStateRef.current = nextState;
        setSheetState(nextState);
        setValidationIssues([]);
        setLastSyncedAt(new Date().toISOString());
      } catch (error) {
        console.error("Pull failed:", error);
        setAuthError("Failed to pull sheet data.");
      } finally {
        setSyncing(false);
      }
    };
    
    // Always check on mount, and when authMode is oauth
    if (authMode === "oauth") {
      checkComposioConnection();
    }
  }, [authMode, sheetId]);

  const loadAvailableSheets = async (accountId?: string) => {
    const connectedAccountId = accountId || composioAccountId;
    setLoadingSheets(true);
    try {
      const url = connectedAccountId
        ? `/api/composio/sheets?userId=anonymous&connectedAccountId=${connectedAccountId}`
        : "/api/composio/sheets?userId=anonymous";
      const res = await fetch(url);
      const data = (await res.json()) as { sheets?: Array<{ id: string; name: string }>; error?: string; debug?: unknown };
      console.log("Load sheets response:", data);
      if (data.error) {
        console.error("Sheet listing error:", data.error, data.debug);
      }
      setAvailableSheets(data.sheets ?? []);
    } catch (err) {
      console.error("Failed to load sheets:", err);
    } finally {
      setLoadingSheets(false);
    }
  };

  // Load sheet tabs (worksheets) for a spreadsheet
  const loadSheetTabs = async (spreadsheetId: string, accountId?: string) => {
    const connectedAccountId = accountId || composioAccountId;
    if (!spreadsheetId || !isRealSheetId(spreadsheetId)) return;
    
    setLoadingTabs(true);
    try {
      const url = connectedAccountId
        ? `/api/composio/sheet-tabs?spreadsheetId=${spreadsheetId}&connectedAccountId=${connectedAccountId}`
        : `/api/composio/sheet-tabs?spreadsheetId=${spreadsheetId}&userId=anonymous`;
      const res = await fetch(url);
      const data = (await res.json()) as { tabs?: Array<{ id: number; name: string }>; error?: string };
      console.log("Load tabs response:", data);
      
      const tabs = data.tabs ?? [{ id: 0, name: "Sheet1" }];
      setAvailableTabs(tabs);
      
      // Select first tab if not already selected or current selection doesn't exist
      if (tabs.length > 0 && !tabs.find((t) => t.name === selectedTab)) {
        setSelectedTab(tabs[0].name);
      }
    } catch (err) {
      console.error("Failed to load sheet tabs:", err);
      setAvailableTabs([{ id: 0, name: "Sheet1" }]);
    } finally {
      setLoadingTabs(false);
    }
  };

  useEffect(() => {
    setSheetState(initialState);
    baseStateRef.current = initialState;
    setValidationIssues([]);
    setSheetIdInput(sheetId);
  }, [initialState]);

  useEffect(() => {
    if (authMode === "service" && isRealSheetId(sheetId)) {
      void loadSheetData();
    }
    // For oauth mode, we'll load data via Composio after connection check
    // Don't use old oauth tokens path
  }, [authMode, sheetId]);

  // Load sheet tabs when spreadsheet changes and we have a connection
  useEffect(() => {
    if (authMode === "oauth" && composioConnected && isRealSheetId(sheetId) && composioAccountId) {
      loadSheetTabs(sheetId, composioAccountId);
    }
  }, [authMode, composioConnected, sheetId, composioAccountId]);

  const pendingCount = sheetState.pendingOps.length;

  const handleCellCommit = (
    rowId: string,
    columnId: string,
    oldValue: string,
    newValue: string,
  ) => {
    if (newValue === oldValue) return;
    const op: EditOperation = {
      id: `op-${Date.now()}`,
      type: "cell_update",
      rowId,
      columnId,
      oldValue,
      newValue,
      author: "user",
    };

    setSheetState((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              cells: { ...row.cells, [columnId]: newValue },
            }
          : row,
      ),
      pendingOps: [...prev.pendingOps, op],
    }));
  };

  const handleApply = async () => {
    console.log("handleApply called:", { 
      pendingOps: sheetState.pendingOps.length, 
      authMode, 
      composioConnected,
      composioAccountId 
    });
    
    if (sheetState.pendingOps.length === 0) {
      console.log("No pending ops, returning early");
      return;
    }
    setAuthError(null);

    // If using Composio OAuth, use the Push flow instead
    if (authMode === "oauth" && composioConnected) {
      console.log("Using Composio Push flow...");
      await handlePush();
      return;
    }

    // Legacy OAuth flow (direct OAuth tokens)
    if (authMode === "oauth" && !oauthTokens) {
      setAuthError("Connect your Google account first.");
      return;
    }

    try {
      const response = await fetch("/api/sheets/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId,
          ops: sheetState.pendingOps,
          mode: authMode,
          oauthTokens: authMode === "oauth" ? oauthTokens : undefined,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setAuthError(err.error ?? "Execution failed.");
        return;
      }

      const applied = applyOpsToState(
        baseStateRef.current,
        sheetState.pendingOps,
      );
      baseStateRef.current = { ...applied, pendingOps: [] };
      setSheetState({ ...applied, pendingOps: [] });
      setValidationIssues([]);
      setIsDiffOpen(false);
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      setAuthError("Network error while syncing.");
    }
  };

  const handleDiscard = () => {
    setSheetState({ ...baseStateRef.current, pendingOps: [] });
    setValidationIssues([]);
    setIsDiffOpen(false);
  };

  const handleAgentOps = (ops: EditOperation[]) => {
    if (!ops.length) return;
    setSheetState((prev) => ({
      ...prev,
      pendingOps: [...prev.pendingOps, ...ops],
    }));
    setIsDiffOpen(true);
  };

  const handleToolOps = (ops: EditOperation[]) => {
    if (!ops.length) return;
    setSheetState((prev) => ({
      ...prev,
      pendingOps: [...prev.pendingOps, ...ops],
    }));
    setIsDiffOpen(true);
  };

  const handleValidate = () => {
    const issues = validateRows(sheetState.columns, sheetState.rows);
    setValidationIssues(issues);
    setIsDiffOpen(true);
  };

  const handleConnect = async () => {
    setConnecting(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/composio/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "anonymous",
          app: "google_sheets",
          redirectUrl: window.location.href,
        }),
      });
      const data = (await res.json()) as { 
        redirectUrl?: string; 
        error?: string; 
        details?: unknown;
        ok?: boolean;
      };
      
      console.log("Connect response:", data);
      
      if (data.error) {
        setAuthError(`Connection failed: ${data.error}`);
        return;
      }
      
      if (data.redirectUrl) {
        // Redirect to Google OAuth page
        window.location.href = data.redirectUrl;
      } else {
        setAuthError("No redirect URL returned. Check Composio setup.");
      }
    } catch (error) {
      console.error("Connect error:", error);
      setAuthError("Failed to connect to Google Sheets.");
    } finally {
      setConnecting(false);
    }
  };

  const slugify = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const isRealSheetId = (value: string) =>
    value !== "sample" && value !== "new" && value.trim().length > 5;

  const loadSheetData = async () => {
    if (!isRealSheetId(sheetId)) {
      setAuthError("Enter a real Google Sheet ID to sync.");
      return;
    }
    setSyncing(true);
    setAuthError(null);
    try {
      const response = await fetch("/api/sheets/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId,
          mode: authMode,
          oauthTokens: authMode === "oauth" ? oauthTokens : undefined,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setAuthError(err.error ?? "Read failed.");
        return;
      }

      const payload = (await response.json()) as {
        ok: boolean;
        result: { values: string[][] };
      };
      const values = payload.result.values ?? [];
      if (values.length === 0) return;

      const headerRow = values[0];
      const columns: Column[] = headerRow.map((label, idx) => ({
        id: slugify(label) || `col_${idx + 1}`,
        label: label || `Column ${idx + 1}`,
      }));

      const rows: Row[] = values.slice(1).map((row, rowIndex) => ({
        id: `r${rowIndex + 1}`,
        cells: Object.fromEntries(
          columns.map((col, colIndex) => [col.id, row[colIndex] ?? ""]),
        ),
      }));

      const nextState: SheetState = { columns, rows, pendingOps: [] };
      baseStateRef.current = nextState;
      setSheetState(nextState);
      setValidationIssues([]);
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      setAuthError("Failed to load sheet data.");
    } finally {
      setSyncing(false);
    }
  };

  // Pull: Fetch latest data from Google Sheets via Composio
  const handlePull = async (accountIdOverride?: string, tabNameOverride?: string) => {
    const targetSheetId = selectedSheet?.id || sheetId;
    const accountId = accountIdOverride || composioAccountId;
    const tabName = tabNameOverride || selectedTab;
    if (!isRealSheetId(targetSheetId)) {
      setAuthError("Select a sheet first.");
      return;
    }
    setSyncing(true);
    setAuthError(null);
    try {
      // Use tab name in range (e.g., "Sheet1!A1:Z1000")
      const range = `${tabName}!A1:Z1000`;
      console.log("Pulling from range:", range);
      const res = await fetch("/api/composio/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "anonymous",
          sheetId: targetSheetId,
          connectedAccountId: accountId,
          range,
        }),
      });
      
      const data = (await res.json()) as { values?: string[][]; error?: string };
      
      if (data.error) {
        setAuthError(data.error);
        return;
      }
      
      const values = data.values ?? [];
      if (values.length === 0) {
        setAuthError("Sheet is empty.");
        return;
      }

      const headerRow = values[0];
      const columns: Column[] = headerRow.map((label, idx) => ({
        id: slugify(label) || `col_${idx + 1}`,
        label: label || `Column ${idx + 1}`,
      }));

      const rows: Row[] = values.slice(1).map((row, rowIndex) => ({
        id: `r${rowIndex + 1}`,
        cells: Object.fromEntries(
          columns.map((col, colIndex) => [col.id, row[colIndex] ?? ""]),
        ),
      }));

      const nextState: SheetState = { columns, rows, pendingOps: [] };
      baseStateRef.current = nextState;
      setSheetState(nextState);
      setValidationIssues([]);
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      console.error("Pull failed:", error);
      setAuthError("Failed to pull sheet data.");
    } finally {
      setSyncing(false);
    }
  };

  // Push: Send pending changes to Google Sheets via Composio
  const handlePush = async () => {
    const targetSheetId = selectedSheet?.id || sheetId;
    console.log("Push started:", { targetSheetId, composioAccountId, selectedTab, pendingOps: sheetState.pendingOps.length });
    
    if (!isRealSheetId(targetSheetId)) {
      setAuthError("Select a sheet first.");
      return;
    }
    if (sheetState.pendingOps.length === 0) {
      setAuthError("No changes to push.");
      return;
    }
    
    setPushing(true);
    setAuthError(null);
    
    try {
      // Apply pending ops to get the final state to push
      const stateTosPush = sheetState.pendingOps.length > 0
        ? applyOpsToState(baseStateRef.current, sheetState.pendingOps)
        : sheetState;
      
      // Convert state to 2D array for full push
      const headerRow = stateTosPush.columns.map((col) => col.label);
      const dataRows = stateTosPush.rows.map((row) =>
        stateTosPush.columns.map((col) => row.cells[col.id] ?? "")
      );
      const fullData = [headerRow, ...dataRows];
      
      console.log("Pushing data:", { rows: fullData.length, cols: fullData[0]?.length, sheetName: selectedTab });
      
      const res = await fetch("/api/composio/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "anonymous",
          sheetId: targetSheetId,
          sheetName: selectedTab,
          connectedAccountId: composioAccountId,
          fullData,
        }),
      });
      
      const data = (await res.json()) as { ok?: boolean; error?: string; updated?: number; details?: string };
      console.log("Push response:", data);
      
      if (data.error) {
        setAuthError(data.error + (data.details ? `: ${data.details}` : ""));
        return;
      }
      
      // Update base state and current state to the pushed state
      baseStateRef.current = { ...stateTosPush, pendingOps: [] };
      setSheetState({ ...stateTosPush, pendingOps: [] });
      setIsDiffOpen(false);
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      console.error("Push failed:", error);
      setAuthError("Failed to push changes.");
    } finally {
      setPushing(false);
    }
  };

  // Handle sheet selection from dropdown
  const handleSheetSelect = (sheet: { id: string; name: string }) => {
    setSelectedSheet(sheet);
    setSheetIdInput(sheet.id);
    // Navigate to the sheet
    window.location.href = `/sheet/${sheet.id}`;
  };

  const previewState = useMemo(() => {
    if (sheetState.pendingOps.length === 0) return sheetState;
    return applyOpsToState(baseStateRef.current, sheetState.pendingOps);
  }, [sheetState.pendingOps, sheetState, baseStateRef]);

  return (
    <div className="min-h-screen bg-white text-black antialiased">
      <main className="max-w-7xl mx-auto px-1 py-12">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <nav>
            <a href="/" className="text-sm underline" aria-label="Back">
              Back
            </a>
          </nav>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Mode</span>
              <div className="inline-flex rounded-md border border-gray-300 p-1">
                <button
                  aria-label="Switch to Agent mode"
                  className={`px-3 py-1 rounded ${
                    mode === "agent" ? "bg-black text-white" : "text-black"
                  }`}
                  onClick={() => setMode("agent")}
                >
                  Agent
                </button>
                <button
                  aria-label="Switch to Manual mode"
                  className={`px-3 py-1 rounded ${
                    mode === "manual" ? "bg-black text-white" : "text-black"
                  }`}
                  onClick={() => setMode("manual")}
                >
                  Manual
                </button>
              </div>
            </div>
            <AuthModeToggle
              mode={authMode}
              onChange={setAuthMode}
              connecting={connecting}
              connected={!!oauthTokens}
              onConnect={handleConnect}
              error={authMode === "oauth" ? authError : null}
            />
          </div>
        </header>
        {authMode === "service" && authError && (
          <div className="mb-4 text-sm text-red-600">{authError}</div>
        )}

        <div className="flex flex-col md:flex-row md:items-stretch gap-6">
          <div className="flex-1">
            <Card>
              <header className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-medium">Sheet Preview</h2>
                <div className="text-sm text-gray-600 text-right">
                  <div>Backup created: backup_YYYYMMDD</div>
                  {lastSyncedAt && (
                    <div>Last synced: {new Date(lastSyncedAt).toLocaleTimeString()}</div>
                  )}
                </div>
              </header>

              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span>
                  {pendingCount === 0
                    ? "No pending changes"
                    : `${pendingCount} pending changes`}
                </span>
                {pendingCount > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      aria-label="Preview changes"
                      className="rounded-md border border-gray-300 px-3 py-1.5"
                      onClick={() => setIsDiffOpen(true)}
                    >
                      Preview changes
                    </button>
                    <button
                      aria-label="Apply pending changes"
                      className="rounded-md bg-black px-3 py-1.5 text-white"
                      onClick={handleApply}
                    >
                      Apply
                    </button>
                    <button
                      aria-label="Discard pending changes"
                      className="rounded-md border border-gray-300 px-3 py-1.5"
                      onClick={handleDiscard}
                    >
                      Discard
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                {/* Sheet selector - shows when connected via Composio */}
                {authMode === "oauth" && composioConnected && (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Select sheet"
                      className="w-64 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      value={selectedSheet?.id || sheetId}
                      onChange={(e) => {
                        const sheet = availableSheets.find((s) => s.id === e.target.value);
                        if (sheet) handleSheetSelect(sheet);
                      }}
                      disabled={loadingSheets}
                    >
                      <option value="">
                        {loadingSheets ? "Loading sheets..." : "Select a sheet..."}
                      </option>
                      {availableSheets.map((sheet) => (
                        <option key={sheet.id} value={sheet.id}>
                          {sheet.name}
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label="Refresh sheets list"
                      className="rounded-md border border-gray-300 px-2 py-1.5"
                      onClick={() => loadAvailableSheets()}
                      disabled={loadingSheets}
                    >
                      ↻
                    </button>
                  </div>
                )}

                {/* Tab (worksheet) selector - shows when a sheet is loaded */}
                {authMode === "oauth" && composioConnected && isRealSheetId(selectedSheet?.id || sheetId) && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Tab:</span>
                    <select
                      aria-label="Select worksheet tab"
                      className="w-40 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      value={selectedTab}
                      onChange={(e) => {
                        setSelectedTab(e.target.value);
                        // Pull data from the new tab
                        handlePull(composioAccountId ?? undefined, e.target.value);
                      }}
                      disabled={loadingTabs}
                    >
                      {loadingTabs ? (
                        <option value="">Loading tabs...</option>
                      ) : availableTabs.length === 0 ? (
                        <option value="Sheet1">Sheet1</option>
                      ) : (
                        availableTabs.map((tab) => (
                          <option key={tab.id} value={tab.name}>
                            {tab.name}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      aria-label="Refresh tabs list"
                      className="rounded-md border border-gray-300 px-2 py-1.5"
                      onClick={() => loadSheetTabs(selectedSheet?.id || sheetId)}
                      disabled={loadingTabs}
                    >
                      ↻
                    </button>
                  </div>
                )}

                {/* Manual sheet ID input - shows when not using Composio */}
                {(authMode === "service" || !composioConnected) && (
                  <div className="flex items-center gap-2">
                    <input
                      aria-label="Sheet ID"
                      className="w-64 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="Paste Google Sheet ID"
                      value={sheetIdInput}
                      onChange={(e) => setSheetIdInput(e.target.value)}
                    />
                    <button
                      aria-label="Go to sheet"
                      className="rounded-md border border-gray-300 px-3 py-1.5"
                      onClick={() => {
                        if (sheetIdInput.trim()) {
                          window.location.href = `/sheet/${sheetIdInput.trim()}`;
                        }
                      }}
                    >
                      Go
                    </button>
                  </div>
                )}

                {/* Pull button (sync from Google) */}
                <button
                  aria-label="Pull from Google Sheets"
                  className="rounded-md border border-gray-300 px-3 py-1.5 flex items-center gap-1"
                  onClick={() => authMode === "oauth" && composioConnected ? handlePull() : loadSheetData()}
                  disabled={syncing}
                >
                  <span>↓</span>
                  {syncing ? "Pulling..." : "Pull"}
                </button>

                {/* Push button (send to Google) */}
                <button
                  aria-label="Push to Google Sheets"
                  className={`rounded-md px-3 py-1.5 flex items-center gap-1 ${
                    pendingCount > 0
                      ? "bg-black text-white"
                      : "border border-gray-300 text-gray-400"
                  }`}
                  onClick={handlePush}
                  disabled={pushing || pendingCount === 0}
                >
                  <span>↑</span>
                  {pushing ? "Pushing..." : `Push${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
                </button>

                {authError && (
                  <span className="text-red-600">{authError}</span>
                )}
              </div>

              <div className="mt-4 max-h-[420px] overflow-auto rounded-md border border-gray-100">
                <SheetPreview
                  mode={mode}
                  columns={sheetState.columns}
                  rows={sheetState.rows}
                  onCellCommit={handleCellCommit}
                  validationIssues={validationIssues}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                  aria-label="Open in Google Sheets"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
                  href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Sheets
                </a>
                {/* TODO: wire up Sheets API */}
                <button
                  aria-label="Download CSV"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700"
                >
                  Download CSV
                </button>
              </div>
            </Card>

            <div className="mt-4">
              <ToolsPanel
                columns={sheetState.columns}
                rows={sheetState.rows}
                onProposeOps={handleToolOps}
                onValidate={handleValidate}
              />
            </div>
          </div>
          <div className="w-full md:w-[420px] md:sticky md:top-6 md:h-[calc(100vh-140px)] self-start">
            <Card className="h-full">
              <AgentSidebar
                mode={mode}
                pendingOps={sheetState.pendingOps}
                columns={sheetState.columns}
                rows={sheetState.rows}
                sheetId={selectedSheet?.id || sheetId}
                sheetName={selectedSheet?.name}
                tabName={selectedTab}
                userId="anonymous"
                onProposeOps={handleAgentOps}
                validationIssues={validationIssues}
                onPreview={() => setIsDiffOpen(true)}
                onAgentComplete={() => {
                  // Agent completed - operations have been proposed
                  // User must review and click Push to apply changes
                  console.log("Agent completed. Pending ops ready for review.");
                }}
              />
            </Card>
          </div>
        </div>
      </main>

      {isDiffOpen && (
        <DiffViewer
          sheetBefore={baseStateRef.current}
          sheetAfter={previewState}
          ops={sheetState.pendingOps}
          validationIssues={validationIssues}
          onClose={() => setIsDiffOpen(false)}
        />
      )}
    </div>
  );
}