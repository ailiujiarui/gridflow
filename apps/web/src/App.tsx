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

const owners = ['Maya Chen', 'Noah Williams', 'Ava Patel', 'Leo Martins', 'Sofia Kim']
const statuses: Status[] = ['Active', 'Review', 'Blocked', 'Done']
const tasks = ['Launch onboarding refresh', 'Review enterprise feedback', 'Prepare Q3 forecast', 'Audit design system', 'Resolve API latency', 'Update help center']
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
      <div className="workspace"><span className="crumb">Operations</span><span>/</span><strong>Project tracker</strong><ChevronDown size={14}/></div>
      <div className="top-actions"><span className={`save-state ${saved}`}><Check size={14}/>{saved === 'saved' ? 'All changes saved' : 'Saving...'}</span><button className="avatar" title="Account">MC</button></div>
    </header>

    <section className="page-head">
      <div><p className="eyebrow">OPERATIONS DATABASE</p><h1>Project tracker</h1></div>
      <div className="head-actions"><button className="icon-button" onClick={undo} disabled={!history.length} title="Undo"><Undo2 size={17}/></button><button className="icon-button" onClick={redoEdit} disabled={!redo.length} title="Redo"><Redo2 size={17}/></button><button className="primary"><span>New record</span><ChevronDown size={15}/></button></div>
    </section>

    <section className="toolbar" aria-label="Table controls">
      <div className="search"><Search size={16}/><input aria-label="Search records" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search 100,000 records..."/><kbd>⌘ K</kbd></div>
      <div className="toolbar-actions">
        <label className="tool-button"><Filter size={16}/><select aria-label="Filter status" value={status} onChange={e => setStatus(e.target.value as Status | 'All')}><option>All</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>
        <button className="tool-button" onClick={() => setSortAsc(v => !v)}><ArrowDownUp size={16}/>Sort {sortAsc ? 'A–Z' : 'Z–A'}</button>
        <button className="tool-button"><Columns3 size={16}/>Fields</button>
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
        {visible.length === 0 ? <div className="empty"><Search size={28}/><h2>No records found</h2><p>Try another search or clear the status filter.</p><button onClick={() => {setQuery(''); setStatus('All')}}>Clear filters</button></div> :
        <div className="virtual-space" style={{ height: virtual.getTotalSize() }}>
          {virtual.getVirtualItems().map(item => { const row = visible[item.index]; return <div className="data-row row-grid" key={row.id} style={{ transform: `translateY(${item.start}px)` }}>
            <div className="row-number"><input type="checkbox" aria-label={`Select row ${row.id}`}/><span>{row.id}</span></div>
            {columns.map(c => { const isEditing = editing?.id === row.id && editing.key === c.key; const value = row[c.key]; return <div key={c.key} style={{ width: c.width }} className={`cell ${active?.id === row.id && active.key === c.key ? 'active' : ''}`} onClick={() => setActive({id: row.id, key: c.key})} onDoubleClick={() => setEditing({id: row.id, key: c.key, value: String(value)})}>
              {isEditing ? (c.key === 'status' ? <select autoFocus value={editing.value} onChange={e => setEditing({...editing, value:e.target.value})} onBlur={commit}>{statuses.map(s=><option key={s}>{s}</option>)}</select> : <input autoFocus value={editing.value} onChange={e => setEditing({...editing, value:e.target.value})} onBlur={commit}/>) : c.key === 'status' ? <span className={`status ${String(value).toLowerCase()}`}><i/>{value}</span> : c.key === 'priority' ? <span className={`priority p${value}`}>P{value}</span> : c.key === 'budget' ? `$${Number(value).toLocaleString()}` : String(value)}
            </div>})}
          </div>})}
        </div>}
      </div>
      <footer className="grid-footer"><span><strong>{visible.length.toLocaleString()}</strong> records</span><span>Only visible rows are rendered</span><span className="footer-right"><RotateCcw size={13}/> Updated just now</span></footer>
    </section>
  </main>
}

export default App
