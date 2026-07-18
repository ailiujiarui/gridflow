import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { z } from 'zod'
import { parseIntent } from './agent.js'
import { parseIntentWithDeepSeek } from './deepseek.js'
import { projects } from './data.js'

const app = Fastify({ logger: true, genReqId: () => crypto.randomUUID() })
await app.register(cors, { origin: true })
type Filter = { field: 'status' | 'budget' | 'due' | 'owner'; operator: 'eq' | 'gt' | 'lt'; value: string | number }
type Plan = { id: string; filters: Filter[]; recordVersions: Array<{ id: number; version: number; before: string }>; nextStatus: string; expiresAt: number; confirmed: boolean }
type AuditEvent = { id: string; sequence: number; action: string; actorId: string; requestId: string; recordIds: number[]; outcome: 'success' | 'failure'; createdAt: string; parentEventId?: string }
const plans = new Map<string, Plan>()
const auditEvents: AuditEvent[] = []
const idempotentResults = new Map<string, unknown>()
type AgentEvent = { id: number; type: 'model_started' | 'model_completed' | 'intent_parsed' | 'tool_started' | 'tool_completed' | 'completed' | 'failed'; data: Record<string, unknown> }
const agentRuns = new Map<string, AgentEvent[]>()
const matches = (row: typeof projects[number], filters: Filter[]) => filters.every(f => f.operator === 'eq' ? String(row[f.field]) === String(f.value) : f.operator === 'gt' ? Number(row[f.field]) > Number(f.value) : f.field === 'due' ? String(row.due) < String(f.value) : Number(row[f.field]) < Number(f.value))

app.get('/health', async () => ({ ok: true }))
app.post('/api/agent/messages', async (request, reply) => {
  const { message, previousFilters } = z.object({ message: z.string().min(2).max(500), previousFilters: z.array(z.object({ field: z.enum(['status', 'budget', 'due', 'owner']), operator: z.enum(['eq', 'gt', 'lt']), value: z.union([z.string(), z.number()]) })).default([]) }).parse(request.body)
  const parsed = await parseIntentWithDeepSeek(message, { apiKey: process.env.NODE_ENV === 'test' ? '' : undefined })
  const intent = { ...parsed.intent, filters: [...previousFilters.filter(previous => !parsed.intent.filters.some(current => current.field === previous.field)), ...parsed.intent.filters] } as typeof parsed.intent
  if (intent.filters.length === 0) return { runId: crypto.randomUUID(), requestId: request.id, intent, total: 0, rows: [], needsClarification: true, clarification: '我还不能确定你想按什么条件筛选。可以试试“列出进行中的项目”“预算超过 5 万的项目”或“负责人是陈梅的项目”。', source: parsed.source }
  const matched = projects.filter(row => matches(row, intent.filters))
  reply.header('x-request-id', request.id)
  return { runId: crypto.randomUUID(), requestId: request.id, intent, total: matched.length, rows: matched.slice(0, 100), needsClarification: false, source: parsed.source }
})

app.post('/api/agent/runs', async (request, reply) => {
  const { message } = z.object({ message: z.string().min(2).max(500) }).parse(request.body)
  const runId = crypto.randomUUID()
  try {
    const parsed = await parseIntentWithDeepSeek(message, { apiKey: process.env.NODE_ENV === 'test' ? '' : undefined })
    const intent = parsed.intent
    const matched = projects.filter(row => matches(row, intent.filters))
    agentRuns.set(runId, [
      { id: 1, type: 'model_started', data: { model: parsed.model } } as AgentEvent,
      { id: 2, type: 'model_completed', data: { model: parsed.model, durationMs: Math.round(parsed.durationMs), source: parsed.source, fallbackReason: parsed.fallbackReason } } as AgentEvent,
      { id: 3, type: 'intent_parsed', data: { intent } },
      { id: 4, type: 'tool_started', data: { tool: 'query_projects' } },
      { id: 5, type: 'tool_completed', data: { tool: 'query_projects', total: matched.length } },
      { id: 6, type: 'completed', data: { total: matched.length, requestId: request.id } },
    ])
  } catch {
    agentRuns.set(runId, [{ id: 1, type: 'failed', data: { code: 'INTENT_PARSE_FAILED', message: '无法解析当前请求' } }])
  }
  reply.code(202)
  return { runId, eventsUrl: `/api/agent/runs/${runId}/events`, requestId: request.id }
})

app.get('/api/agent/runs/:runId/events', async (request, reply) => {
  const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params)
  const events = agentRuns.get(runId)
  if (!events) return reply.code(404).send({ code: 'RUN_NOT_FOUND', message: 'Agent 运行不存在', requestId: request.id })
  reply.hijack()
  reply.raw.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' })
  for (const event of events) reply.raw.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)
  reply.raw.end()
})

app.post('/api/agent/plans', async (request, reply) => {
  const body = z.object({ filters: z.array(z.object({ field: z.enum(['status', 'budget', 'due', 'owner']), operator: z.enum(['eq', 'gt', 'lt']), value: z.union([z.string(), z.number()]) })), nextStatus: z.enum(['Active', 'Review', 'Blocked', 'Done']).default('Review') }).parse(request.body)
  const affected = projects.filter(row => matches(row, body.filters)).slice(0, 100)
  const plan: Plan = { id: crypto.randomUUID(), filters: body.filters, recordVersions: affected.map(row => ({ id: row.id, version: row.version, before: row.status })), nextStatus: body.nextStatus, expiresAt: Date.now() + 5 * 60_000, confirmed: false }
  plans.set(plan.id, plan)
  reply.code(201)
  return { id: plan.id, affected: plan.recordVersions.length, preview: plan.recordVersions.slice(0, 5), nextStatus: plan.nextStatus, expiresAt: new Date(plan.expiresAt).toISOString() }
})

app.post('/api/agent/plans/:planId/confirm', async (request, reply) => {
  const { planId } = z.object({ planId: z.string().uuid() }).parse(request.params)
  const key = z.string().min(8).parse(request.headers['idempotency-key'])
  if (idempotentResults.has(key)) return idempotentResults.get(key)
  const plan = plans.get(planId)
  if (!plan) return reply.code(404).send({ code: 'PLAN_NOT_FOUND', message: '执行计划不存在', requestId: request.id })
  if (plan.expiresAt < Date.now()) return reply.code(410).send({ code: 'PLAN_EXPIRED', message: '数据预览已过期，请重新生成', requestId: request.id })
  const stale = plan.recordVersions.find(snapshot => projects[snapshot.id - 1]?.version !== snapshot.version)
  if (stale) return reply.code(409).send({ code: 'VERSION_CONFLICT', message: `记录 ${stale.id} 已发生变化，请重新预览`, requestId: request.id })
  for (const snapshot of plan.recordVersions) { const row = projects[snapshot.id - 1]; row.status = plan.nextStatus; row.version += 1 }
  plan.confirmed = true
  const event: AuditEvent = { id: crypto.randomUUID(), sequence: auditEvents.length + 1, action: 'project.status.batch_update', actorId: 'demo-operator', requestId: request.id, recordIds: plan.recordVersions.map(item => item.id), outcome: 'success', createdAt: new Date().toISOString() }
  auditEvents.push(event)
  const result = { planId, updated: plan.recordVersions.length, auditEventId: event.id, requestId: request.id }
  idempotentResults.set(key, result)
  return result
})

app.get('/api/audit-events', async () => ({ events: [...auditEvents].reverse() }))

app.get('/api/projects', async request => {
  const query = z.object({ keyword: z.string().optional(), status: z.string().optional(), limit: z.coerce.number().min(1).max(200).default(100), cursor: z.string().optional(), sort: z.string().regex(/^(due|budget|priority|task):(asc|desc)$/).default('due:asc') }).parse(request.query)
  const offset = query.cursor ? Number(Buffer.from(query.cursor, 'base64url').toString()) : 0
  const filtered = projects.filter(p => (!query.status || p.status === query.status) && (!query.keyword || `${p.task} ${p.owner}`.includes(query.keyword)))
  const [field, direction] = query.sort.split(':') as ['due' | 'budget' | 'priority' | 'task', 'asc' | 'desc']
  filtered.sort((a, b) => { const left = a[field]; const right = b[field]; const result = left < right ? -1 : left > right ? 1 : a.id - b.id; return direction === 'asc' ? result : -result })
  const rows = filtered.slice(offset, offset + query.limit)
  return { total: filtered.length, rows, nextCursor: offset + rows.length < filtered.length ? Buffer.from(String(offset + rows.length)).toString('base64url') : null }
})

app.patch('/api/projects/:id/cells/:column', async (request, reply) => {
  const params = z.object({ id: z.coerce.number().int().positive(), column: z.enum(['task', 'owner', 'status', 'priority', 'due', 'budget']) }).parse(request.params)
  const body = z.object({ value: z.union([z.string(), z.number()]), version: z.number().int().positive() }).parse(request.body)
  const row = projects[params.id - 1]
  if (!row) return reply.code(404).send({ code: 'ROW_NOT_FOUND', message: '项目不存在', requestId: request.id })
  if (row.version !== body.version) return reply.code(409).send({ code: 'VERSION_CONFLICT', message: '项目已被其他操作更新', requestId: request.id, row })
  const next = params.column === 'priority' || params.column === 'budget' ? Number(body.value) : body.value
  if ((params.column === 'priority' && (!Number.isInteger(Number(next)) || Number(next) < 1 || Number(next) > 4)) || (params.column === 'budget' && (!Number.isFinite(Number(next)) || Number(next) < 0)) || (params.column === 'status' && !['Active', 'Review', 'Blocked', 'Done'].includes(String(next)))) return reply.code(422).send({ code: 'VALIDATION_ERROR', message: '字段值不符合类型约束', requestId: request.id })
  row[params.column] = next as never
  row.version += 1
  return { row, requestId: request.id }
})

if (process.env.NODE_ENV !== 'test') await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
export default app
