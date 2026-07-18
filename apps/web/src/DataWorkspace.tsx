import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDownUp,
  CalendarDays,
  Check,
  ChevronDown,
  Filter,
  Grid2X2,
  Redo2,
  RotateCcw,
  Search,
  Undo2,
} from "lucide-react";
import { parseFirstCell, serializeCell } from "./grid/clipboard";
import "./App.css";

type Status = "Active" | "Review" | "Blocked" | "Done";
type Row = {
  id: number;
  version: number;
  task: string;
  owner: string;
  status: Status;
  priority: number;
  due: string;
  budget: number;
};
type Key = keyof Omit<Row, "id" | "version">;
type Edit = {
  id: number;
  key: Key;
  before: string | number;
  after: string | number;
};
const statuses: Status[] = ["Active", "Review", "Blocked", "Done"];
const statusLabels: Record<Status, string> = {
  Active: "进行中",
  Review: "待审核",
  Blocked: "已阻塞",
  Done: "已完成",
};
const columns: { key: Key; label: string; width: number }[] = [
  { key: "task", label: "项目", width: 310 },
  { key: "owner", label: "负责人", width: 190 },
  { key: "status", label: "状态", width: 150 },
  { key: "priority", label: "优先级", width: 120 },
  { key: "due", label: "截止日期", width: 150 },
  { key: "budget", label: "预算", width: 150 },
];

export default function DataWorkspace() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "All">("All");
  const [sortAsc, setSortAsc] = useState(true);
  const [active, setActive] = useState<{ id: number; key: Key } | null>(null);
  const [editing, setEditing] = useState<{
    id: number;
    key: Key;
    value: string;
  } | null>(null);
  const [history, setHistory] = useState<Edit[]>([]);
  const [redo, setRedo] = useState<Edit[]>([]);
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    setNextCursor(null);
    const params = new URLSearchParams({
      limit: "100",
      sort: `due:${sortAsc ? "asc" : "desc"}`,
    });
    if (query.trim()) params.set("keyword", query.trim());
    if (status !== "All") params.set("status", status);
    fetch(`/api/projects?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("项目数据加载失败");
        return response.json() as Promise<{
          rows: Row[];
          total: number;
          nextCursor: string | null;
        }>;
      })
      .then((result) => {
        setRows(result.rows);
        setTotal(result.total);
        setNextCursor(result.nextCursor);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setLoadError(
          error instanceof Error ? error.message : "项目数据加载失败",
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, status, sortAsc]);

  const visible = useMemo(() => rows, [rows]);
  const virtual = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });
  const moveFocus = (rowDelta: number, columnDelta: number) => {
    const rowIndex = Math.max(
      0,
      visible.findIndex((row) => row.id === active?.id),
    );
    const columnIndex = Math.max(
      0,
      columns.findIndex((column) => column.key === active?.key),
    );
    const nextRow =
      visible[Math.min(Math.max(rowIndex + rowDelta, 0), visible.length - 1)];
    const nextColumn =
      columns[
        Math.min(Math.max(columnIndex + columnDelta, 0), columns.length - 1)
      ];
    if (!nextRow || !nextColumn) return;
    setActive({ id: nextRow.id, key: nextColumn.key });
    virtual.scrollToIndex(visible.indexOf(nextRow), { align: "auto" });
    parentRef.current?.focus();
  };
  const applyLocal = (edit: Edit, record = true) => {
    setRows((current) =>
      current.map((row) =>
        row.id === edit.id ? { ...row, [edit.key]: edit.after } : row,
      ),
    );
    if (record) {
      setHistory((items) => [...items.slice(-49), edit]);
      setRedo([]);
    }
    setSaved("saving");
  };
  const commit = async () => {
    if (!editing) return;
    const row = rows.find((item) => item.id === editing.id);
    if (!row) return;
    const before = row[editing.key];
    let after: string | number = editing.value;
    if (editing.key === "priority" || editing.key === "budget")
      after = Number(after) || 0;
    setEditing(null);
    if (before === after) return;
    const edit = { id: row.id, key: editing.key, before, after };
    applyLocal(edit);
    try {
      const response = await fetch(
        `/api/projects/${row.id}/cells/${editing.key}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ value: after, version: row.version }),
        },
      );
      const result = (await response.json()) as { row?: Row; message?: string };
      if (!response.ok || !result.row)
        throw new Error(result.message ?? "保存失败");
      setRows((current) =>
        current.map((item) => (item.id === row.id ? result.row! : item)),
      );
      setSaved("saved");
    } catch {
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, [editing.key]: before } : item,
        ),
      );
      setSaved("error");
    }
  };
  const undo = () => {
    const edit = history.at(-1);
    if (!edit) return;
    applyLocal({ ...edit, before: edit.after, after: edit.before }, false);
    setHistory((items) => items.slice(0, -1));
    setRedo((items) => [...items, edit]);
  };
  const redoEdit = () => {
    const edit = redo.at(-1);
    if (!edit) return;
    applyLocal(edit, false);
    setRedo((items) => items.slice(0, -1));
    setHistory((items) => [...items, edit]);
  };
  const copyActive = async () => {
    try {
      if (!active) return;
      const row = rows.find((item) => item.id === active.id);
      if (row)
        await navigator.clipboard?.writeText(serializeCell(row[active.key]));
    } catch {
      setSaved("error");
    }
  };
  const pasteActive = async () => {
    try {
      if (!active) return;
      const value = await navigator.clipboard?.readText();
      if (value !== undefined)
        setEditing({
          id: active.id,
          key: active.key,
          value: parseFirstCell(value),
        });
    } catch {
      setSaved("error");
    }
  };
  const loadNext = () => {
    if (!nextCursor) return;
    const params = new URLSearchParams({
      limit: "100",
      cursor: nextCursor,
      sort: `due:${sortAsc ? "asc" : "desc"}`,
    });
    if (query.trim()) params.set("keyword", query.trim());
    if (status !== "All") params.set("status", status);
    fetch(`/api/projects?${params}`)
      .then(
        (response) =>
          response.json() as Promise<{
            rows: Row[];
            total: number;
            nextCursor: string | null;
          }>,
      )
      .then((result) => {
        setRows((current) => [...current, ...result.rows]);
        setNextCursor(result.nextCursor);
        setTotal(result.total);
      });
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Grid2X2 size={17} />
          </span>
          <strong>GridFlow</strong>
        </div>
        <div className="workspace">
          <span className="crumb">项目数据</span>
          <span>/</span>
          <strong>项目跟踪</strong>
          <ChevronDown size={14} />
        </div>
        <div className="top-actions">
          <span className={`save-state ${saved}`}>
            <Check size={14} />
            {saved === "saved"
              ? "所有更改已保存"
              : saved === "saving"
                ? "正在保存..."
                : "保存失败，已回滚"}
          </span>
          <button className="avatar" title="账户">
            MC
          </button>
        </div>
      </header>
      <section className="page-head">
        <div>
          <p className="eyebrow">高性能项目数据工作台</p>
          <h1>项目跟踪</h1>
        </div>
        <div className="head-actions">
          <button
            className="icon-button"
            onClick={undo}
            disabled={!history.length}
            title="撤销"
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            onClick={redoEdit}
            disabled={!redo.length}
            title="重做"
          >
            <Redo2 size={17} />
          </button>
        </div>
      </section>
      <section className="toolbar" aria-label="数据表工具">
        <div className="search">
          <Search size={16} />
          <input
            aria-label="搜索项目"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索项目或负责人..."
          />
          <kbd>⌘ K</kbd>
        </div>
        <div className="toolbar-actions">
          <label className="tool-button">
            <Filter size={16} />
            <select
              aria-label="按状态筛选"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as Status | "All")
              }
            >
              <option value="All">全部状态</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {statusLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="tool-button"
            onClick={() => setSortAsc((value) => !value)}
          >
            <ArrowDownUp size={16} />
            截止日期 {sortAsc ? "正序" : "倒序"}
          </button>
        </div>
      </section>
      <section className="grid-frame">
        <div className="grid-header row-grid" role="row">
          <div className="row-number header-cell">#</div>
          {columns.map((column) => (
            <div
              className="header-cell"
              key={column.key}
              style={{ width: column.width }}
            >
              <span>
                {column.key === "due" && <CalendarDays size={14} />}
                {column.label}
              </span>
            </div>
          ))}
        </div>
        <div
          ref={parentRef}
          className="grid-scroll"
          role="grid"
          aria-rowcount={total}
          aria-colcount={columns.length + 1}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" && editing) void commit();
            if (event.key === "Escape") setEditing(null);
            if (!editing && event.key === "ArrowDown") {
              event.preventDefault();
              moveFocus(1, 0);
            }
            if (!editing && event.key === "ArrowUp") {
              event.preventDefault();
              moveFocus(-1, 0);
            }
            if (!editing && event.key === "ArrowRight") {
              event.preventDefault();
              moveFocus(0, 1);
            }
            if (!editing && event.key === "ArrowLeft") {
              event.preventDefault();
              moveFocus(0, -1);
            }
            if (!editing && event.key === "Tab") {
              event.preventDefault();
              moveFocus(0, event.shiftKey ? -1 : 1);
            }
            if (
              !editing &&
              (event.ctrlKey || event.metaKey) &&
              event.key.toLowerCase() === "c"
            ) {
              event.preventDefault();
              void copyActive();
            }
            if (
              !editing &&
              (event.ctrlKey || event.metaKey) &&
              event.key.toLowerCase() === "v"
            ) {
              event.preventDefault();
              void pasteActive();
            }
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key.toLowerCase() === "z"
            ) {
              event.preventDefault();
              if (event.shiftKey) redoEdit(); else undo();
            }
          }}
        >
          {loading ? (
            <div className="empty">
              <div className="loading-bar" />
              <h2>正在加载项目数据</h2>
              <p>仅请求当前页面，不会一次加载全部数据。</p>
            </div>
          ) : loadError ? (
            <div className="empty">
              <h2>数据加载失败</h2>
              <p>{loadError}</p>
              <button onClick={() => window.location.reload()}>重试</button>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <Search size={28} />
              <h2>没有找到记录</h2>
              <p>请尝试其他搜索词，或清除状态筛选。</p>
              <button
                onClick={() => {
                  setQuery("");
                  setStatus("All");
                }}
              >
                清除筛选
              </button>
            </div>
          ) : (
            <div
              className="virtual-space"
              style={{ height: virtual.getTotalSize() }}
            >
              {virtual.getVirtualItems().map((item) => {
                const row = visible[item.index];
                return (
                  <div
                    className="data-row row-grid"
                    role="row"
                    aria-rowindex={item.index + 1}
                    key={row.id}
                    style={{ transform: `translateY(${item.start}px)` }}
                  >
                    <div className="row-number">
                      <input
                        type="checkbox"
                        aria-label={`选择第 ${row.id} 行`}
                      />
                      <span>{row.id}</span>
                    </div>
                    {columns.map((column) => {
                      const isEditing =
                        editing?.id === row.id && editing.key === column.key;
                      const value = row[column.key];
                      return (
                        <div
                          key={column.key}
                          style={{ width: column.width }}
                          className={`cell ${active?.id === row.id && active.key === column.key ? "active" : ""}`}
                          onClick={() => {
                            setActive({ id: row.id, key: column.key });
                            parentRef.current?.focus();
                          }}
                          onDoubleClick={() =>
                            setEditing({
                              id: row.id,
                              key: column.key,
                              value: String(value),
                            })
                          }
                        >
                          {isEditing ? (
                            column.key === "status" ? (
                              <select
                                autoFocus
                                value={editing.value}
                                onChange={(event) =>
                                  setEditing({
                                    ...editing,
                                    value: event.target.value,
                                  })
                                }
                                onBlur={() => void commit()}
                              >
                                {statuses.map((item) => (
                                  <option key={item} value={item}>
                                    {statusLabels[item]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                autoFocus
                                value={editing.value}
                                onChange={(event) =>
                                  setEditing({
                                    ...editing,
                                    value: event.target.value,
                                  })
                                }
                                onBlur={() => void commit()}
                              />
                            )
                          ) : column.key === "status" ? (
                            <span
                              className={`status ${String(value).toLowerCase()}`}
                            >
                              <i />
                              {statusLabels[value as Status]}
                            </span>
                          ) : column.key === "priority" ? (
                            <span className={`priority p${value}`}>
                              优先级 {value}
                            </span>
                          ) : column.key === "budget" ? (
                            `¥${Number(value).toLocaleString()}`
                          ) : (
                            String(value)
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <footer className="grid-footer">
          <span>
            <strong>{total.toLocaleString()}</strong> 条匹配记录
          </span>
          <span>当前已载入 {visible.length} 条 · 仅渲染可见行</span>
          {nextCursor && (
            <button className="load-more" onClick={loadNext}>
              加载下一页
            </button>
          )}
          <span className="footer-right">
            <RotateCcw size={13} />
            刚刚更新
          </span>
        </footer>
      </section>
    </main>
  );
}
