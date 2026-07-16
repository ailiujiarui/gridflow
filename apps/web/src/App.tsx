import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDownUp, CalendarDays, Check, ChevronDown, Columns3, Filter,
  Grid2X2, Redo2, RotateCcw, Search, Undo2,
} from 'lucide-react'
import './App.css'

type Status = 'Active' | 'Review' | 'Blocked' | 'Done'
type Row = { id: number; task: string; owner: string; status: Status; priority: number; due: string; budget: number }
type Key = keyof Omit<Row, 'id'>
type Edit = { id: number; key: Key; before: string | number; after: string | number }

const owners = ['陈梅', '诺亚', '艾娃', '李欧', '苏菲亚']
const statuses: Status[] = ['Active', 'Review', 'Blocked', 'Done']
const statusLabels: Record<Status, string> = { Active: '进行中', Review: '待审核', Blocked: '已阻塞', Done: '已完成' }
const tasks = ['更新入职流程', '整理企业反馈', '准备第三季度预测', '审查设计系统', '解决接口延迟', '更新帮助中心']
const columns: { key: Key; label: string; width: number; kind?: string }[] = [
  { key: 'task', label: 'Task', width: 310 }, { key: 'owner', label: 'Owner', width: 190 },
  { key: 'status', label: 'Status', width: 150 }, { key: 'priority', label: 'Priority', width: 120 },
  { key: 'due', label: 'Due date', width: 150 }, { key: 'budget', label: 'Budget', width: 150 },
]

function makeRows(count = 100000): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1, task: `${tasks[i % tasks.length]} ${String(i + 1).padStart(5, '0')}`,
    owner: owners[(i * 7) % owners.length], status: statuses[(i * 3) % statuses.length],
    priority: (i % 4) + 1, due: `2026-${String((i % 6) + 7).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    budget: 1200 + ((i * 137) % 48000),
  }))
}

function App() {
  const [rows, setRows] = useState(() => makeRows())
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status | 'All'>('All')
  const [sortAsc, setSortAsc] = useState(true)
  const [active, setActive] = useState<{ id: number; key: Key } | null>(null)
  const [editing, setEditing] = useState<{ id: number; key: Key; value: string } | null>(null)
  const [history, setHistory] = useState<Edit[]>([])
  const [redo, setRedo] = useState<Edit[]>([])
  const [saved, setSaved] = useState<'saved' | 'saving'>('saved')
  const parentRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const result = rows.filter(r => (status === 'All' || r.status === status) && (!q || `${r.task} ${r.owner}`.toLowerCase().includes(q)))
    return sortAsc ? result : [...result].reverse()
  }, [rows, query, status, sortAsc])
  const virtual = useVirtualizer({ count: visible.length, getScrollElement: () => parentRef.current, estimateSize: () => 40, overscan: 10 })

  const apply = (edit: Edit, record = true) => {
    setRows(old => old.map(r => r.id === edit.id ? { ...r, [edit.key]: edit.after } : r))
    if (record) { setHistory(h => [...h.slice(-49), edit]); setRedo([]) }
    setSaved('saving'); window.setTimeout(() => setSaved('saved'), 650)
  }
  const commit = () => {
    if (!editing) return
    const row = rows[editing.id - 1]; const before = row[editing.key]
    let after: string | number = editing.value
    if (editing.key === 'priority' || editing.key === 'budget') after = Number(after) || 0
    if (before !== after) apply({ id: editing.id, key: editing.key, before, after })
    setEditing(null)
  }
  const undo = () => {
    const edit = history.at(-1); if (!edit) return
    apply({ ...edit, before: edit.after, after: edit.before }, false)
    setHistory(h => h.slice(0, -1)); setRedo(r => [...r, edit])
  }
  const redoEdit = () => {
    const edit = redo.at(-1); if (!edit) return
    apply(edit, false); setRedo(r => r.slice(0, -1)); setHistory(h => [...h, edit])
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Grid2X2 size={17}/></span><strong>GridFlow</strong></div>
      <div className="workspace"><span className="crumb">运营管理</span><span>/</span><strong>项目跟踪</strong><ChevronDown size={14}/></div>
      <div className="top-actions"><span className={`save-state ${saved}`}><Check size={14}/>{saved === 'saved' ? '所有更改已保存' : '正在保存...'}</span><button className="avatar" title="账户">MC</button></div>
    </header>

    <section className="page-head">
      <div><p className="eyebrow">运营数据表</p><h1>项目跟踪</h1></div>
      <div className="head-actions"><button className="icon-button" onClick={undo} disabled={!history.length} title="撤销"><Undo2 size={17}/></button><button className="icon-button" onClick={redoEdit} disabled={!redo.length} title="重做"><Redo2 size={17}/></button><button className="primary"><span>新建记录</span><ChevronDown size={15}/></button></div>
    </section>

    <section className="toolbar" aria-label="Table controls">
      <div className="search"><Search size={16}/><input aria-label="搜索记录" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索 100,000 条记录..."/><kbd>⌘ K</kbd></div>
      <div className="toolbar-actions">
        <label className="tool-button"><Filter size={16}/><select aria-label="按状态筛选" value={status} onChange={e => setStatus(e.target.value as Status | 'All')}><option>All</option>{statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
        <button className="tool-button" onClick={() => setSortAsc(v => !v)}><ArrowDownUp size={16}/>排序 {sortAsc ? '正序' : '倒序'}</button>
        <button className="tool-button"><Columns3 size={16}/>字段</button>
      </div>
    </section>

    <section className="grid-frame">
      <div className="grid-header row-grid">
        <div className="row-number header-cell">#</div>
        {columns.map(c => <div className="header-cell" key={c.key} style={{ width: c.width }}><span>{c.key === 'due' && <CalendarDays size={14}/>} {c.label}</span><ChevronDown size={13}/></div>)}
      </div>
      <div ref={parentRef} className="grid-scroll" tabIndex={0} onKeyDown={e => {
        if (e.key === 'Enter' && editing) commit()
        if (e.key === 'Escape') setEditing(null)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redoEdit(); else undo() }
      }}>
        {visible.length === 0 ? <div className="empty"><Search size={28}/><h2>没有找到记录</h2><p>请尝试其他搜索词，或清除状态筛选。</p><button onClick={() => {setQuery(''); setStatus('All')}}>清除筛选</button></div> :
        <div className="virtual-space" style={{ height: virtual.getTotalSize() }}>
          {virtual.getVirtualItems().map(item => { const row = visible[item.index]; return <div className="data-row row-grid" key={row.id} style={{ transform: `translateY(${item.start}px)` }}>
            <div className="row-number"><input type="checkbox" aria-label={`选择第 ${row.id} 行`}/><span>{row.id}</span></div>
            {columns.map(c => { const isEditing = editing?.id === row.id && editing.key === c.key; const value = row[c.key]; return <div key={c.key} style={{ width: c.width }} className={`cell ${active?.id === row.id && active.key === c.key ? 'active' : ''}`} onClick={() => setActive({id: row.id, key: c.key})} onDoubleClick={() => setEditing({id: row.id, key: c.key, value: String(value)})}>
              {isEditing ? (c.key === 'status' ? <select autoFocus value={editing.value} onChange={e => setEditing({...editing, value:e.target.value})} onBlur={commit}>{statuses.map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select> : <input autoFocus value={editing.value} onChange={e => setEditing({...editing, value:e.target.value})} onBlur={commit}/>) : c.key === 'status' ? <span className={`status ${String(value).toLowerCase()}`}><i/>{statusLabels[value as Status]}</span> : c.key === 'priority' ? <span className={`priority p${value}`}>优先级 {value}</span> : c.key === 'budget' ? `¥${Number(value).toLocaleString()}` : String(value)}
            </div>})}
          </div>})}
        </div>}
      </div>
      <footer className="grid-footer"><span><strong>{visible.length.toLocaleString()}</strong> 条记录</span><span>仅渲染当前可见行</span><span className="footer-right"><RotateCcw size={13}/> 刚刚更新</span></footer>
    </section>
  </main>
}

export default App
