import { z } from 'zod'

export const intentSchema = z.object({
  action: z.literal('query'),
  resource: z.literal('project'),
  filters: z.array(z.discriminatedUnion('field', [
    z.object({ field: z.literal('status'), operator: z.literal('eq'), value: z.enum(['Active', 'Review', 'Blocked', 'Done']) }),
    z.object({ field: z.literal('budget'), operator: z.enum(['gt', 'lt']), value: z.number().nonnegative() }),
    z.object({ field: z.literal('due'), operator: z.enum(['gt', 'lt']), value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    z.object({ field: z.literal('owner'), operator: z.literal('eq'), value: z.string().min(2).max(20) }),
  ])),
  requiresConfirmation: z.literal(false),
})
export type AgentIntent = z.infer<typeof intentSchema>

export function parseIntent(input: string): AgentIntent {
  const text = input.trim()
  const filters: AgentIntent['filters'] = []
  if (/逾期|过期/.test(text)) filters.push({ field: 'due', operator: 'lt', value: new Date().toISOString().slice(0, 10) })
  if (/进行中/.test(text)) filters.push({ field: 'status', operator: 'eq', value: 'Active' })
  const budget = text.match(/(?:预算|金额)[^\d]*(\d+(?:\.\d+)?)\s*万/)
  if (budget) filters.push({ field: 'budget', operator: /低于|小于/.test(text) ? 'lt' : 'gt', value: Number(budget[1]) * 10000 })
  const owner = text.match(/负责人(?:是|为|：|:)?\s*([\u4e00-\u9fa5]{2,4}?)(?:的项目|的任务|项目|任务|$)/)
  if (owner) filters.push({ field: 'owner', operator: 'eq', value: owner[1] })
  return intentSchema.parse({ action: 'query', resource: 'project', filters, requiresConfirmation: false })
}
