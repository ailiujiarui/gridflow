import Fastify from 'fastify'
import cors from '@fastify/cors'
import { z } from 'zod'
import { parseIntent } from './agent.js'
import { projects } from './data.js'

const app = Fastify({ logger: true, genReqId: () => crypto.randomUUID() })
await app.register(cors, { origin: true })
type Filter = { field: 'status' | 'budget' | 'due' | 'owner'; operator: 'eq' | 'gt' | 'lt'; value: string | number }
type Plan = { id: string; filters: Filter[]; recordVersions: Array<{ id: number; version: number; before: string }>; nextStatus: string; expiresAt: number; confirmed: boolean }
type AuditEvent = { id: string; sequence: number; action: string; actorId: string; requestId: string; recordIds: number[]; outcome: 'success' | 'failure'; createdAt: string; parentEventId?: string }
const plans = new Map<string, Plan>()
const auditEvents: AuditEvent[] = []
const idempotentResults = new Map<string, unknown>()
type AgentEvent = { id: number; type: 'intent_parsed' | 'tool_started' | 'tool_completed' | 'completed' | 'failed'; data: Record<string, unknown> }
const agentRuns = new Map<string, AgentEvent[]>()
const matches = (row: typeof projects[number], filters: Filter[]) => filters.every(f => f.operator === 'eq' ? String(row[f.field]) === String(f.value) : f.operator === 'gt' ? Number(row[f.field]) > Number(f.value) : f.field === 'due' ? String(row.due) < String(f.value) : Number(row[f.field]) < Number(f.value))

app.get('/health', async () => ({ ok: true }))
app.post('/api/agent/messages', async (request, reply) => {
  const { message } = z.object({ message: z.string().min(2).max(500) }).parse(request.body)
  const intent = parseIntent(message)
  const matched = projects.filter(row => matches(row, intent.filters))
  reply.header('x-request-id', request.id)
  return { runId: crypto.randomUUID(), requestId: request.id, intent, total: matched.length, rows: matched.slice(0, 100) }
})

app.post('/api/agent/runs', async (request, reply) => {
  const { message } = z.object({ message: z.string().min(2).max(500) }).parse(request.body)
  const runId = crypto.randomUUID()
  try {
    const intent = parseIntent(message)
    const matched = projects.filter(row => matches(row, intent.filters))
    agentRuns.set(runId, [
      { id: 1, type: 'intent_parsed', data: { intent } },
      { id: 2, type: 'tool_started', data: { tool: 'query_projects' } },
      { id: 3, type: 'tool_completed', data: { tool: 'query_projects', total: matched.length } },
      { id: 4, type: 'completed', data: { total: matched.length, requestId: request.id } },
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
  const query = z.object({ keyword: z.string().optional(), status: z.string().optional(), limit: z.coerce.number().min(1).max(200).default(100), offset: z.coerce.number().min(0).default(0) }).parse(request.query)
  const filtered = projects.filter(p => (!query.status || p.status === query.status) && (!query.keyword || `${p.task} ${p.owner}`.includes(query.keyword)))
  return { total: filtered.length, rows: filtered.slice(query.offset, query.offset + query.limit) }
})

if (process.env.NODE_ENV !== 'test') await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
export default app
