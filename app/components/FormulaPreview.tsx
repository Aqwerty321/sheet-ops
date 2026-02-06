"use client";

import { useMemo } from "react";

interface Column {
  id: string;
  label: string;
}

interface Row {
  id: string;
  cells: Record<string, string>;
}

interface FormulaPreviewProps {
  columns: Column[];
  rows: Row[];
  columnId: string;
  onAddSummary: (row: Row) => void;
}

export default function FormulaPreview({
  columns,
  rows,
  columnId,
  onAddSummary,
}: FormulaPreviewProps) {
  const column = columns.find((col) => col.id === columnId);

  const stats = useMemo(() => {
    const values = rows
      .map((row) => Number((row.cells[columnId] ?? "").trim()))
      .filter((value) => !Number.isNaN(value));
    const count = values.length;
    const total = values.reduce((acc, value) => acc + value, 0);
    const average = count ? total / count : 0;
    return { count, total, average };
  }, [rows, columnId]);

  const handleAddSummary = () => {
    if (!column) return;
    const labelColumn = columns[0]?.id;
    const summaryRow: Row = {
      id: `summary-${Date.now()}`,
      cells: {
        ...(labelColumn ? { [labelColumn]: "Summary" } : {}),
        [columnId]: stats.total.toFixed(2),
      },
    };
    onAddSummary(summaryRow);
  };

  return (
    <div>
      <div className="text-sm font-medium">Summary preview</div>
      <div className="mt-2 text-sm text-gray-600">
        <div>Column: {column?.label ?? "—"}</div>
        <div>Count: {stats.count}</div>
        <div>Total: {stats.total.toFixed(2)}</div>
        <div>Average: {stats.average.toFixed(2)}</div>
      </div>
      <button
        aria-label="Add summary row"
        className="mt-3 rounded-md border border-gray-300 px-3 py-2 text-sm"
        onClick={handleAddSummary}
      >
        Add summary row
      </button>
    </div>
  );
}