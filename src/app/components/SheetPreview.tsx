"use client";

import { useMemo, useState } from "react";

interface Column {
  id: string;
  label: string;
  align?: "left" | "right";
}

interface Row {
  id: string;
  cells: Record<string, string>;
}

interface SheetPreviewProps {
  mode: "agent" | "manual";
  columns: Column[];
  rows: Row[];
  validationIssues: { rowId: string; columnId: string; message: string }[];
  onCellCommit: (
    rowId: string,
    columnId: string,
    oldValue: string,
    newValue: string,
  ) => void;
}

interface EditingCell {
  rowId: string;
  columnId: string;
  oldValue: string;
}

export default function SheetPreview({
  mode,
  columns,
  rows,
  validationIssues,
  onCellCommit,
}: SheetPreviewProps) {
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [draft, setDraft] = useState("");

  const invalidMap = useMemo(() => {
    const map = new Map<string, string>();
    validationIssues.forEach((issue) => {
      map.set(`${issue.rowId}:${issue.columnId}`, issue.message);
    });
    return map;
  }, [validationIssues]);

  const startEdit = (rowId: string, columnId: string, oldValue: string) => {
    if (mode !== "manual") return;
    setEditing({ rowId, columnId, oldValue });
    setDraft(oldValue);
  };

  const commitEdit = () => {
    if (!editing) return;
    const nextValue = draft.trim();
    const { rowId, columnId, oldValue } = editing;
    setEditing(null);
    onCellCommit(rowId, columnId, oldValue, nextValue);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
  };

  return (
    <div className="w-full">
      <table className="w-full border-collapse">
        <thead className="bg-gray-100 text-left">
          <tr>
            {columns.map((column) => (
              <th key={column.id} className="p-3 text-sm font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="odd:bg-white even:bg-gray-50">
              {columns.map((column) => {
                const value = row.cells[column.id] ?? "";
                const isEditing =
                  editing?.rowId === row.id &&
                  editing?.columnId === column.id;

                const invalidMessage = invalidMap.get(
                  `${row.id}:${column.id}`,
                );

                return (
                  <td
                    key={column.id}
                    className={`p-3 text-sm ${
                      column.align === "right" ? "text-right" : "text-left"
                    } ${mode === "manual" ? "cursor-text" : ""} ${
                      invalidMessage ? "text-red-600" : ""
                    }`}
                    title={
                      invalidMessage ||
                      (mode === "agent" ? "Switch to Manual to edit" : undefined)
                    }
                    onClick={() => startEdit(row.id, column.id, value)}
                  >
                    {isEditing ? (
                      <input
                        aria-label={`${column.label} value`}
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                        value={draft}
                        autoFocus
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    ) : (
                      <span className={value ? "" : "text-gray-400"}>
                        {value || "—"}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* TODO: wire up Sheets API */}
    </div>
  );
}