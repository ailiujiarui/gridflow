import { useCallback, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  Handle,
  Position,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  GitBranch,
  History,
  Play,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  Redo2,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import "./Automation.css";

type Kind = "start" | "http" | "condition" | "transform" | "delay" | "output";
type FlowNode = Node<{
  kind: Kind;
  title: string;
  summary: string;
  config: string;
}>;
const palette: { kind: Kind; title: string; summary: string; color: string }[] =
  [
    {
      kind: "http",
      title: "查询逾期项目",
      summary: "读取符合条件的项目",
      color: "#2d72e8",
    },
    {
      kind: "condition",
      title: "检查项目风险",
      summary: "按风险等级分支",
      color: "#9a63db",
    },
    {
      kind: "transform",
      title: "按负责人分组",
      summary: "汇总负责人待办",
      color: "#13a579",
    },
    {
      kind: "delay",
      title: "等待人工确认",
      summary: "确认后继续执行",
      color: "#d18529",
    },
    {
      kind: "output",
      title: "记录处理结果",
      summary: "写入审计事件",
      color: "#da5263",
    },
  ];
const initialNodes: FlowNode[] = [
  {
    id: "start",
    type: "flow",
    position: { x: 140, y: 170 },
    data: { kind: "start", title: "开始", summary: "工作流触发器", config: "" },
  },
  {
    id: "request",
    type: "flow",
    position: { x: 380, y: 160 },
    data: {
      kind: "http",
      title: "查询逾期项目",
      summary: "截止日期早于今天",
      config: "状态=进行中，截止日期<今天",
    },
  },
  {
    id: "transform",
    type: "flow",
    position: { x: 650, y: 160 },
    data: {
      kind: "transform",
      title: "按负责人分组",
      summary: "生成负责人待办",
      config: "分组字段：负责人",
    },
  },
  {
    id: "output",
    type: "flow",
    position: { x: 900, y: 160 },
    data: {
      kind: "output",
      title: "记录处理结果",
      summary: "写入审计日志",
      config: "记录成功、失败和影响范围",
    },
  },
];
const initialEdges: Edge[] = [
  { id: "e1", source: "start", target: "request" },
  { id: "e2", source: "request", target: "transform" },
  { id: "e3", source: "transform", target: "output" },
];

function FlowNode({ data, selected }: NodeProps<FlowNode>) {
  const info: { icon: React.ReactNode; color: string } =
    data.kind === "start"
      ? { icon: <Sparkles size={15} />, color: "#5966d8" }
      : {
          icon: <GitBranch size={15} />,
          color:
            palette.find((p) => p.kind === data.kind)?.color ??
            palette[0].color,
        };
  return (
    <div
      className={`flow-node ${selected ? "selected" : ""}`}
      style={{ "--node-color": info.color } as React.CSSProperties}
    >
      {data.kind !== "start" && (
        <Handle type="target" position={Position.Left} />
      )}
      <div className="node-icon">{info.icon ?? <GitBranch size={15} />}</div>
      <div className="node-copy">
        <strong>{data.title}</strong>
        <span>{data.summary}</span>
      </div>
      <button className="node-menu" aria-label="Node settings">
        <Settings2 size={13} />
      </button>
      {data.kind !== "output" && (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}
const nodeTypes = { flow: FlowNode };

function AutomationWorkspace() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selected, setSelected] = useState<string | null>("request");
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [runState, setRunState] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<FlowNode[][]>([]);
  const [redo, setRedo] = useState<FlowNode[][]>([]);
  const current = nodes.find((n) => n.id === selected);

  const connect = useCallback(
    (c: Connection) => {
      setEdges((es) =>
        addEdge(
          {
            ...c,
            animated: true,
            style: { stroke: "#8d98a5", strokeWidth: 1.5 },
          },
          es,
        ),
      );
    },
    [setEdges],
  );
  const updateNode = (id: string, patch: Partial<FlowNode["data"]>) => {
    setHistory((h) => [...h.slice(-19), nodes]);
    setRedo([]);
    setNodes((ns) =>
      ns.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    );
  };
  const addNode = (item: (typeof palette)[number]) => {
    const id = `${item.kind}-${Date.now()}`;
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: "flow",
        position: { x: 280 + ns.length * 24, y: 340 + (ns.length % 3) * 90 },
        data: {
          kind: item.kind,
          title: item.title,
          summary: item.summary,
          config: "",
        },
      },
    ]);
    setSelected(id);
  };
  const remove = () => {
    if (!selected || selected === "start") return;
    setHistory((h) => [...h.slice(-19), nodes]);
    setNodes((ns) => ns.filter((n) => n.id !== selected));
    setEdges((es) =>
      es.filter((e) => e.source !== selected && e.target !== selected),
    );
    setSelected(null);
  };
  const validate = () => {
    const next: string[] = [];
    if (!nodes.some((n) => n.data.kind === "start"))
      next.push("工作流必须包含开始节点。");
    nodes
      .filter((n) => n.data.kind !== "start")
      .forEach((n) => {
        if (!n.data.config.trim()) next.push(`${n.data.title} 需要填写配置。`);
      });
    nodes
      .filter((n) => n.data.kind !== "start")
      .forEach((n) => {
        if (!edges.some((e) => e.target === n.id))
          next.push(`${n.data.title} 无法从开始节点到达。`);
      });
    setErrors(next);
    return !next.length;
  };
  const run = () => {
    if (!validate()) return;
    setRunning(true);
    setRunState({});
    nodes.forEach((n, i) =>
      setTimeout(
        () => setRunState((s) => ({ ...s, [n.id]: "success" })),
        500 + i * 400,
      ),
    );
    setTimeout(() => setRunning(false), 700 + nodes.length * 400);
  };
  const undo = () => {
    const prev = history.at(-1);
    if (!prev) return;
    setRedo((r) => [...r, nodes]);
    setNodes(prev);
    setHistory((h) => h.slice(0, -1));
  };
  const redoFlow = () => {
    const next = redo.at(-1);
    if (!next) return;
    setHistory((h) => [...h, nodes]);
    setNodes(next);
    setRedo((r) => r.slice(0, -1));
  };

  return (
    <main className="canvas-app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <GitBranch size={17} />
          </span>
          <strong>自动化编辑器</strong>
        </div>
        <div className="flow-title">
          <span>自动化</span>
          <span>/</span>
          <strong>客户信息补全</strong>
          <span className="draft">草稿</span>
        </div>
        <div className="top-actions">
          <span className="saved">
            <Check size={14} /> 刚刚保存
          </span>
          <button className="avatar" title="账户">
            MC
          </button>
        </div>
      </header>
      <section className="editor-toolbar">
        <div className="toolbar-left">
          <button className="back">←</button>
          <strong>客户信息补全</strong>
          <span className="divider" />
          <button
            className="toolbar-icon"
            onClick={undo}
            disabled={!history.length}
            title="撤销"
          >
            <Undo2 size={16} />
          </button>
          <button
            className="toolbar-icon"
            onClick={redoFlow}
            disabled={!redo.length}
            title="重做"
          >
            <Redo2 size={16} />
          </button>
        </div>
        <div className="toolbar-right">
          <button className="outline" onClick={validate}>
            <CircleAlert size={15} /> 校验{" "}
            {errors.length > 0 && <b>{errors.length}</b>}
          </button>
          <button className="save">
            <Save size={15} /> 保存
          </button>
          <button className="run" onClick={run} disabled={running}>
            <Play size={14} fill="currentColor" />
            {running ? "运行中..." : "试运行"}
          </button>
        </div>
      </section>
      <div className="editor-body">
        <aside className="palette">
          <div className="panel-title">
            <span>节点库</span>
            <button title="添加节点">
              <Plus size={15} />
            </button>
          </div>
          <p className="panel-hint">点击添加步骤到画布</p>
          <div className="node-list">
            {palette.map((item) => (
              <button
                className="palette-node"
                key={item.kind}
                onClick={() => addNode(item)}
              >
                <span
                  className="palette-icon"
                  style={{ background: item.color }}
                >
                  <GitBranch size={14} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.summary}</small>
                </span>
                <Plus size={14} />
              </button>
            ))}
          </div>
          <div className="library-foot">
            <History size={14} />
            <span>共 6 种节点类型</span>
          </div>
        </aside>
        <section className="canvas">
          <ReactFlow
            nodes={nodes.map((n) => ({
              ...n,
              className: runState[n.id] ? "run-success" : "",
            }))}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={connect}
            onNodeClick={(_, n) => setSelected(n.id)}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#dfe4e9" gap={22} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(n) =>
                n.data.kind === "start" ? "#5966d8" : "#aab4bf"
              }
            />
          </ReactFlow>
          <div className="canvas-legend">
            <span>
              <i className="legend-dot valid" /> 有效路径
            </span>
            <span>
              <i className="legend-dot" /> 点击节点编辑配置
            </span>
          </div>
        </section>
        <aside className="inspector">
          <div className="panel-title">
            <span>配置面板</span>
            {current && (
              <button onClick={remove} title="删除节点" className="danger-icon">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          {current ? (
            <>
              <div className="selected-heading">
                <span className="selected-icon">
                  <GitBranch size={16} />
                </span>
                <div>
                  <strong>{current.data.title}</strong>
                  <small>{current.data.kind} 节点</small>
                </div>
              </div>
              <label className="field">
                显示名称
                <input
                  value={current.data.title}
                  onChange={(e) =>
                    updateNode(current.id, { title: e.target.value })
                  }
                />
              </label>
              {current.data.kind !== "start" && (
                <label className="field">
                  节点配置
                  <textarea
                    value={current.data.config}
                    placeholder="填写配置..."
                    onChange={(e) =>
                      updateNode(current.id, { config: e.target.value })
                    }
                  />
                  <small>配置将按节点规则校验</small>
                </label>
              )}
              <div className="inspector-rule" />
              <div className="field-row">
                <span>运行状态</span>
                <span className={`run-pill ${runState[current.id] ?? ""}`}>
                  {runState[current.id] === "success"
                    ? "执行成功"
                    : running
                      ? "排队中"
                      : "尚未运行"}
                </span>
              </div>
            </>
          ) : (
            <div className="inspector-empty">
              <Settings2 size={22} />
              <p>选择一个节点编辑配置。</p>
            </div>
          )}
          {errors.length > 0 && (
            <div className="validation">
              <div>
                <CircleAlert size={15} />
                <strong>需要处理</strong>
              </div>
              {errors.slice(0, 3).map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
        </aside>
      </div>
      <footer className="statusbar">
        <span>
          <i className="live-dot" /> 自动保存已开启
        </span>
        <span>
          {nodes.length} 个节点 · {edges.length} 条连线
        </span>
        <span className="status-right">
          版本 12 <ChevronDown size={13} />
        </span>
      </footer>
    </main>
  );
}
export default AutomationWorkspace;
