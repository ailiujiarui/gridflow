import Fastify from 'fastify'
import cors from '@fastify/cors'
import { z } from 'zod'
import { parseIntent } from './agent.js'
import { projects } from './data.js'

const app = Fastify({ logger: true, genReqId: () => crypto.randomUUID() })
await app.register(cors, { origin: true })

app.get('/health', async () => ({ ok: true }))
app.post('/api/agent/messages', async (request, reply) => {
  const { message } = z.object({ message: z.string().min(2).max(500) }).parse(request.body)
  const intent = parseIntent(message)
  const matched = projects.filter(row => intent.filters.every(f => f.operator === 'eq' ? String(row[f.field]) === String(f.value) : f.operator === 'gt' ? Number(row[f.field]) > Number(f.value) : f.field === 'due' ? String(row.due) < String(f.value) : Number(row[f.field]) < Number(f.value)))
  reply.header('x-request-id', request.id)
  return { runId: crypto.randomUUID(), requestId: request.id, intent, total: matched.length, rows: matched.slice(0, 100) }
})

app.get('/api/projects', async request => {
  const query = z.object({ keyword: z.string().optional(), status: z.string().optional(), limit: z.coerce.number().min(1).max(200).default(100), offset: z.coerce.number().min(0).default(0) }).parse(request.query)
  const filtered = projects.filter(p => (!query.status || p.status === query.status) && (!query.keyword || `${p.task} ${p.owner}`.includes(query.keyword)))
  return { total: filtered.length, rows: filtered.slice(query.offset, query.offset + query.limit) }
})

if (process.env.NODE_ENV !== 'test') await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
export default app
