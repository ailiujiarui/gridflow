# 企效智控

企效智控是一个融合数据工作台、企业 Agent 和可视化自动化的运营管理产品。

## 模块

- `/`：统一工作台与企效助手入口
- `/data`：10 万条演示数据的虚拟化数据工作台
- `/automation`：节点式工作流编辑器
- `/audit`：审计与失败重试入口

## 本地运行

```bash
# 终端一：API
cd apps/api
npm install
npm run dev

# 终端二：Web
cd apps/web
npm install
npm run dev
```

验证命令：

```bash
npm run lint
npx tsc -b
npm run build
```

自动化模块由原 CanvasFlow 项目迁入。原仓库保留为归档，只读保存迁移前历史。

当前 Agent 支持确定性的只读意图解析，并由 Fastify API 对 10 万条演示项目数据执行真实筛选。写操作仍停留在预览入口，不直接修改业务数据，也不执行任意 HTTP 请求。

配置 `apps/api/.env` 后，Agent 使用 DeepSeek 将自然语言转换为结构化查询意图；输出必须通过字段级 Zod schema 和工具白名单。模型不可用、超时或输出非法时自动降级到确定性解析器。

Agent 固定评测：

```bash
cd apps/api
npm run eval
```
