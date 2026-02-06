"use client";

import Card from "./Card";

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
  row?: Row;
  direction?: "asc" | "desc";
  author: "user" | "agent";
}

interface SheetState {
  columns: Column[];
  rows: Row[];
  pendingOps: EditOperation[];
}

interface ValidationIssue {
  id: string;
  rowId: string;
  columnId: string;
  message: string;
}

interface DiffViewerProps {
  sheetBefore: SheetState;
  sheetAfter: SheetState;
  ops: EditOperation[];
  validationIssues: ValidationIssue[];
  onClose: () => void;
}

const columnLetter = (index: number) =>
  String.fromCharCode("A".charCodeAt(0) + index);

export default function DiffViewer({
  sheetBefore,
  sheetAfter,
  ops,
  validationIssues,
  onClose,
}: DiffViewerProps) {
  const rowIndexMap = new Map<string, number>();
  sheetBefore.rows.forEach((row, idx) => rowIndexMap.set(row.id, idx));
  const colIndexMap = new Map<string, number>();
  sheetBefore.columns.forEach((col, idx) => colIndexMap.set(col.id, idx));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <Card className="w-full max-w-3xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Change Preview</h3>
          <button
            aria-label="Close preview"
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm text-gray-700">
          {ops.length === 0 ? (
            <div>No pending changes.</div>
          ) : (
            ops.map((op) => {
              if (op.type === "cell_update" && op.rowId && op.columnId) {
                const rowIndex = rowIndexMap.get(op.rowId) ?? 0;
                const colIndex = colIndexMap.get(op.columnId) ?? 0;
                const cellRef = `${columnLetter(colIndex)}${rowIndex + 1}`;
                const beforeValue =
                  sheetBefore.rows.find((row) => row.id === op.rowId)?.cells[
                    op.columnId
                  ] ?? "";
                const afterValue =
                  sheetAfter.rows.find((row) => row.id === op.rowId)?.cells[
                    op.columnId
                  ] ?? op.newValue ?? "";
                return (
                  <div key={op.id}>
                    {cellRef}: {beforeValue || "—"} → {afterValue || "—"}
                  </div>
                );
              }

              if (op.type === "column_add") {
                return (
                  <div key={op.id}>
                    Added column: {op.columnLabel ?? op.columnId}
                  </div>
                );
              }

              if (op.type === "column_delete") {
                return (
                  <div key={op.id}>Deleted column: {op.columnId}</div>
                );
              }

              if (op.type === "add_row" && op.row) {
                return <div key={op.id}>Added row: {op.row.id}</div>;
              }

              if (op.type === "row_delete") {
                return <div key={op.id}>Deleted row: {op.rowId}</div>;
              }

              if (op.type === "sort") {
                return (
                  <div key={op.id}>
                    Sorted by {op.columnId} ({op.direction})
                  </div>
                );
              }

              return (
                <div key={op.id}>Pending change ({op.type})</div>
              );
            })
          )}
        </div>

        {validationIssues.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4 text-sm text-gray-700">
            <div className="font-medium">Validation issues</div>
            <ul className="mt-2 space-y-1">
              {validationIssues.map((issue) => (
                <li key={issue.id}>
                  {issue.rowId} · {issue.columnId}: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}