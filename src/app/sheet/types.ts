export interface Column {
  id: string;
  label: string;
  align?: "left" | "right";
}

export type ColumnType = "number" | "string" | "email" | "date";

export interface Row {
  id: string;
  cells: Record<string, string>;
}

export interface EditOperation {
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

export interface SheetState {
  columns: Column[];
  rows: Row[];
  pendingOps: EditOperation[];
}

export interface ValidationIssue {
  id: string;
  rowId: string;
  columnId: string;
  message: string;
}