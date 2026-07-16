# 代码审查记录

## 2026-07-16

- TypeScript 严格检查与 Vite 生产构建通过。
- 虚拟行使用稳定业务 ID，并由虚拟器定位。
- 已提供空数据、保存中、已保存和筛选无结果状态。
- 撤销/重做限制为最近 50 次编辑。
- 待完成：Fastify/SQLite 持久化、Playwright 覆盖和真实网络失败回滚。

## 2026-07-16 融合版本

- 新增 Fastify API 与 100,000 条确定性项目数据，筛选在服务端真实执行。
- 新增只读 Agent 结构化意图解析、Zod 校验、requestId 和固定 Eval。
- 修复 Eval 发现的负责人姓名边界解析错误。
- API 构建、7 个测试、Web lint 和生产构建通过。
- 待完成：SQLite 持久化、SSE、确认式写计划、追加式审计和 Playwright。

## 2026-07-16 确认式执行

- 执行计划保存记录版本快照和五分钟过期时间。
- 确认前重新比较版本；冲突返回 409，过期返回 410。
- 重试使用 `Idempotency-Key`，同一键返回相同结果，不重复修改数据。
- 执行成功后追加审计事件，业务接口没有修改或删除入口。
- 前端完成“查询 -> 预览 -> 确认 -> 执行 -> 审计”交互闭环。
- API 8 个测试、Web lint、TypeScript 和生产构建通过。

## 2026-07-16 SSE 流式交互

- 新增 Agent run 创建接口和 SSE 事件接口。
- 事件按序输出 `intent_parsed`、`tool_started`、`tool_completed` 和 `completed`。
- 工作台首页使用 EventSource 展示实时阶段和服务端命中数量。
- 保留同步查询接口，避免数据工作台现有流程回归。
- API 9 个测试、Web lint、TypeScript 和生产构建通过。

## 2026-07-16 DeepSeek 接入

- DeepSeek API Key 只从服务端 `.env` 读取，浏览器和 Git 不接触真实 Key。
- 模型只生成只读结构化意图，工具执行、计划确认和审计仍由 Node.js 控制。
- 新增 15 秒超时、非法输出降级和模型阶段 SSE 事件。
- 字段级 Zod schema 约束状态枚举、金额类型、日期格式和操作符。
- 真实冒烟测试发现并修复状态枚举和 filters 形状问题；修复后 DeepSeek 正确解析复合查询。
- API 12 个测试、Web lint、TypeScript 和生产构建通过。
