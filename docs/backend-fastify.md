# 后端技术选型：Node.js 与 Fastify

## 1. 技术关系

企效智控后端采用以下组合：

```text
Node.js：后端 JavaScript 运行环境
Fastify：HTTP 服务框架
TypeScript：开发语言与编译期类型检查
Zod：运行时输入校验
SQLite：本地开发数据库
```

Node.js 负责运行服务端程序，Fastify 负责接收 HTTP 请求、匹配路由、执行处理函数并返回响应。Fastify 不是新的后端语言，也不能替代 Node.js。

## 2. Fastify 是什么

Fastify 是一个 Node.js Web 框架，定位类似 Express、Koa 和 NestJS。企效智控使用它提供以下接口：

```text
POST /api/agent/messages
GET  /api/projects
POST /api/agent/plans/:id/confirm
GET  /api/agent/runs/:id/events
GET  /api/audit-events
```

一个经过运行时校验的接口示例：

```ts
const bodySchema = z.object({
  message: z.string().min(2).max(500),
})

app.post("/api/agent/messages", async request => {
  const body = bodySchema.parse(request.body)
  return runAgent(body.message)
})
```

TypeScript 只在编译阶段检查类型，不能保证真实 HTTP 请求符合类型声明；Zod 用于校验运行时数据，两者职责不同。

## 3. 选择 Fastify 的原因

### 3.1 与项目规模匹配

企效智控需要实现：

- 服务端筛选与分页。
- Agent 工具调用。
- 变更计划预览与确认。
- 工作流执行与状态查询。
- SSE 事件流。
- 追加式审计日志。

Fastify 提供路由、插件、请求生命周期、统一错误处理和结构化日志，能够覆盖这些需求，同时没有引入大型框架的额外结构。

### 3.2 TypeScript 支持较好

项目可以为请求参数、请求体和响应建立明确类型，并通过 schema 连接编译期类型与运行时校验。这有助于约束 Agent 工具参数、版本号、幂等键和审计事件。

### 3.3 请求处理开销较低

Fastify 的路由和序列化开销较低，适合需要频繁查询数据和轮询工作流状态的场景。

框架性能不是系统性能的唯一决定因素。数据库索引、游标分页、数据结构、缓存策略和业务算法通常具有更大影响，因此项目不会仅凭使用 Fastify 宣称高性能。

### 3.4 内置结构化日志

Fastify 默认使用 Pino，可以直接记录：

- `requestId`。
- 请求路径和 HTTP 状态码。
- 接口执行耗时。
- Agent 工具调用结果。
- 工作流失败位置。
- 慢请求信息。

企效智控已经为请求生成 UUID，并在响应和日志中保留 requestId，便于串联前端错误、Agent 调用和工作流执行记录。

### 3.5 插件边界清晰

数据库连接、CORS、认证、SSE 和错误处理可以拆成独立 Fastify 插件，避免所有初始化和业务逻辑集中在单个入口文件。

## 4. 与其他方案的比较

| 方案 | 优点 | 代价 | 当前结论 |
| --- | --- | --- | --- |
| Express | 生态成熟、资料多、招聘市场认知高 | 类型、日志和 schema 约束通常需要自行组合 | 完全可用，但当前项目更重视契约约束 |
| Fastify | 轻量、TypeScript 友好、结构化日志和插件体系完整 | 市场普及度低于 Express | 与当前项目规模最匹配 |
| NestJS | 模块、依赖注入和团队规范完整 | 样板代码和框架复杂度较高 | 当前个人项目不需要 |
| Koa | 中间件模型简洁、控制灵活 | 需要自行组合更多工程能力 | 当前收益不足以替换 Fastify |

选择 Fastify 并不意味着它在所有场景都优于其他框架。这里的取舍是在 Express 的轻量和 NestJS 的完整工程体系之间选择一个适合当前规模的方案。

## 5. 当前实现

当前 Node.js API 已实现：

- Fastify HTTP 服务。
- 10 万条确定性项目演示数据。
- 服务端项目筛选接口。
- 只读 Agent 结构化意图解析。
- Zod 请求参数校验。
- requestId 与结构化请求日志。
- Agent 固定评测和 API 集成测试。

尚未完成：

- SQLite 持久化与数据库迁移。
- SSE 流式 Agent 事件。
- 带版本校验的确认式写操作。
- 追加式审计存储。
- 完整认证和权限检查。

## 6. 面试表达

推荐表达：

> 项目后端运行在 Node.js 上，使用 Fastify 提供 HTTP API。选择 Fastify 是因为它在保持轻量的同时，提供了较好的 TypeScript 支持、结构化日志、插件边界和请求生命周期管理。项目真正关注的不是框架名称，而是运行时校验、权限边界、幂等、审计、SSE、错误处理和自动化测试。

不建议表达：

> 因为 Fastify 比 Express 快，所以项目性能更好。

在没有统一环境、统一接口和真实压测结果时，不能把框架基准直接写成项目性能结论。
