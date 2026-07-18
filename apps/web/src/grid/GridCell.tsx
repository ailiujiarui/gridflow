import type { ChangeEvent } from "react";
import { statusLabels, statuses, type Column, type EditState, type Row } from "./model";

type Props = {
  row: Row;
  column: Column;
  active: boolean;
  editing: EditState | null;
  onActivate: () => void;
  onEditStart: () => void;
  onEditChange: (value: string) => void;
  onCommit: () => void;
};

export default function GridCell({ row, column, active, editing, onActivate, onEditStart, onEditChange, onCommit }: Props) {
  const value = row[column.key];
  const isEditing = editing?.id === row.id && editing.key === column.key;
  const change = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onEditChange(event.target.value);
  return <div style={{ width: column.width }} className={`cell ${active ? "active" : ""}`} onClick={onActivate} onDoubleClick={onEditStart}>
    {isEditing ? column.key === "status" ? <select autoFocus value={editing.value} onChange={change} onBlur={onCommit}>{statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select> : <input autoFocus value={editing.value} onChange={change} onBlur={onCommit} /> : column.key === "status" ? <span className={`status ${String(value).toLowerCase()}`}><i />{statusLabels[value as keyof typeof statusLabels]}</span> : column.key === "priority" ? <span className={`priority p${value}`}>优先级 {value}</span> : column.key === "budget" ? `¥${Number(value).toLocaleString()}` : String(value)}
  </div>;
}
