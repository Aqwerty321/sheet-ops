"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "./Card";
import FormulaPreview from "./FormulaPreview";

interface Column {
  id: string;
  label: string;
  align?: "left" | "right";
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

interface ToolsPanelProps {
  columns: Column[];
  rows: Row[];
  onProposeOps: (ops: EditOperation[]) => void;
  onValidate: () => void;
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export default function ToolsPanel({
  columns,
  rows,
  onProposeOps,
  onValidate,
}: ToolsPanelProps) {
  const [selectedColumn, setSelectedColumn] = useState(
    columns[0]?.id ?? "",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterValue, setFilterValue] = useState("");

  const selectedColumnLabel = useMemo(
    () => columns.find((col) => col.id === selectedColumn)?.label ?? "",
    [columns, selectedColumn],
  );

  useEffect(() => {
    if (!selectedColumn && columns[0]) {
      setSelectedColumn(columns[0].id);
    }
  }, [columns, selectedColumn]);

  const handleRemoveDuplicates = () => {
    if (!selectedColumn) return;
    const seen = new Set<string>();
    const ops: EditOperation[] = [];

    rows.forEach((row) => {
      const value = (row.cells[selectedColumn] ?? "").trim();
      if (!value) return;
      if (seen.has(value)) {
        ops.push({
          id: `op-${Date.now()}-${row.id}`,
          type: "row_delete",
          rowId: row.id,
          author: "agent",
        });
      } else {
        seen.add(value);
      }
    });

    onProposeOps(ops);
  };

  const handleNormalizeEmails = () => {
    if (!selectedColumn) return;
    const ops: EditOperation[] = [];
    rows.forEach((row) => {
      const value = row.cells[selectedColumn] ?? "";
      const normalized = value.toLowerCase();
      if (value && value !== normalized) {
        ops.push({
          id: `op-${Date.now()}-${row.id}`,
          type: "cell_update",
          rowId: row.id,
          columnId: selectedColumn,
          oldValue: value,
          newValue: normalized,
          author: "agent",
        });
      }
    });
    onProposeOps(ops);
  };

  const handleAddColumn = () => {
    const name = window.prompt("Column name", "New Column");
    if (!name) return;
    const columnId = slugify(name) || `col_${Date.now()}`;
    const op: EditOperation = {
      id: `op-${Date.now()}-col-add`,
      type: "column_add",
      columnId,
      columnLabel: name,
      author: "agent",
    };
    onProposeOps([op]);
  };

  const handleDeleteColumn = () => {
    const name = window.prompt("Column id to delete", selectedColumn);
    if (!name) return;
    const op: EditOperation = {
      id: `op-${Date.now()}-col-del`,
      type: "column_delete",
      columnId: name,
      author: "agent",
    };
    onProposeOps([op]);
  };

  const handleAddRow = () => {
    const rowId = window.prompt("Row id", `r${rows.length + 1}`);
    if (!rowId) return;
    const row: Row = {
      id: rowId,
      cells: Object.fromEntries(columns.map((col) => [col.id, ""])),
    };
    const op: EditOperation = {
      id: `op-${Date.now()}-row-add`,
      type: "add_row",
      row,
      author: "agent",
    };
    onProposeOps([op]);
  };

  const handleDeleteRow = () => {
    const rowId = window.prompt("Row id to delete", rows[rows.length - 1]?.id);
    if (!rowId) return;
    const op: EditOperation = {
      id: `op-${Date.now()}-row-del`,
      type: "row_delete",
      rowId,
      author: "agent",
    };
    onProposeOps([op]);
  };

  const handleSort = () => {
    if (!selectedColumn) return;
    const op: EditOperation = {
      id: `op-${Date.now()}-sort`,
      type: "sort",
      columnId: selectedColumn,
      direction: sortDirection,
      author: "agent",
    };
    onProposeOps([op]);
  };

  const handleFilter = () => {
    if (!selectedColumn) return;
    const target = filterValue.trim();
    if (!target) return;
    const ops: EditOperation[] = rows
      .filter((row) => (row.cells[selectedColumn] ?? "").trim() !== target)
      .map((row) => ({
        id: `op-${Date.now()}-filter-${row.id}`,
        type: "row_delete",
        rowId: row.id,
        author: "agent",
      }));
    onProposeOps(ops);
  };

  const handleAddSummary = (summaryRow: Row) => {
    const op: EditOperation = {
      id: `op-${Date.now()}-summary`,
      type: "add_row",
      row: summaryRow,
      author: "agent",
    };
    onProposeOps([op]);
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-medium">Tools</h3>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="columnSelect" className="text-gray-600">
            Column
          </label>
          <select
            id="columnSelect"
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <button
          aria-label="Remove duplicates"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          onClick={handleRemoveDuplicates}
        >
          Remove duplicates
        </button>
        <button
          aria-label="Normalize emails"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          onClick={handleNormalizeEmails}
        >
          Normalize emails
        </button>
        <button
          aria-label="Add column"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          onClick={handleAddColumn}
        >
          Add column
        </button>
        <button
          aria-label="Delete column"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          onClick={handleDeleteColumn}
        >
          Delete column
        </button>
        <button
          aria-label="Add row"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          onClick={handleAddRow}
        >
          Add row
        </button>
        <button
          aria-label="Delete row"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          onClick={handleDeleteRow}
        >
          Delete row
        </button>
        <div className="flex items-center gap-2">
          <select
            aria-label="Sort direction"
            className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
            value={sortDirection}
            onChange={(e) =>
              setSortDirection(e.target.value as "asc" | "desc")
            }
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <button
            aria-label="Sort by column"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            onClick={handleSort}
          >
            Sort by {selectedColumnLabel || "column"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            aria-label="Filter value"
            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
            placeholder="Filter value"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
          <button
            aria-label="Filter rows"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            onClick={handleFilter}
          >
            Filter
          </button>
        </div>
      </div>

      <div className="mt-2 border-t border-gray-100 pt-2">
        <FormulaPreview
          columns={columns}
          rows={rows}
          columnId={selectedColumn}
          onAddSummary={handleAddSummary}
        />
      </div>

      <div className="mt-2 border-t border-gray-100 pt-2">
        <button
          aria-label="Validate data"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          onClick={onValidate}
        >
          Validate data
        </button>
      </div>
    </Card>
  );
}