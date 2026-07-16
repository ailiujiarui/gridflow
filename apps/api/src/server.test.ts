import { afterAll, describe, expect, it } from 'vitest'
import app from './server.js'

afterAll(() => app.close())
describe('企效智控 API', () => {
  it('返回健康状态', async () => expect((await app.inject({ method: 'GET', url: '/health' })).json()).toEqual({ ok: true }))
  it('Agent 返回可追踪的结构化查询', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/agent/messages', payload: { message: '找出预算超过 5 万的项目' } })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body).toMatchObject({ intent: { action: 'query', filters: [{ field: 'budget', operator: 'gt', value: 50000 }] } })
    expect(body.total).toBeGreaterThan(0)
    expect(response.headers['x-request-id']).toBeTruthy()
  })
  it('无法解析条件时追问，而不是返回全部数据', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/agent/messages', payload: { message: '列出所有清醒的项目' } })
    expect(response.json()).toMatchObject({ needsClarification: true, total: 0, rows: [] })
  })
  it('支持在上轮筛选条件上继续补充', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/agent/messages', payload: { message: '负责人是陈梅的项目', previousFilters: [{ field: 'status', operator: 'eq', value: 'Active' }] } })
    expect(response.json().intent.filters).toEqual(expect.arrayContaining([{ field: 'status', operator: 'eq', value: 'Active' }, { field: 'owner', operator: 'eq', value: '陈梅' }]))
  })
  it('预览、确认并写入追加式审计', async () => {
    const preview = await app.inject({ method: 'POST', url: '/api/agent/plans', payload: { filters: [{ field: 'owner', operator: 'eq', value: '陈梅' }], nextStatus: 'Review' } })
    expect(preview.statusCode).toBe(201)
    const plan = preview.json()
    expect(plan.affected).toBeGreaterThan(0)
    const key = crypto.randomUUID()
    const confirm = await app.inject({ method: 'POST', url: `/api/agent/plans/${plan.id}/confirm`, headers: { 'idempotency-key': key } })
    expect(confirm.statusCode).toBe(200)
    expect(confirm.json().updated).toBe(plan.affected)
    const repeated = await app.inject({ method: 'POST', url: `/api/agent/plans/${plan.id}/confirm`, headers: { 'idempotency-key': key } })
    expect(repeated.json()).toEqual(confirm.json())
    const audit = await app.inject({ method: 'GET', url: '/api/audit-events' })
    expect(audit.json().events[0]).toMatchObject({ action: 'project.status.batch_update', outcome: 'success' })
  })
  it('通过 SSE 返回有序 Agent 事件', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/agent/runs', payload: { message: '查看预算超过 5 万的项目' } })
    expect(created.statusCode).toBe(202)
    const stream = await app.inject({ method: 'GET', url: created.json().eventsUrl })
    expect(stream.headers['content-type']).toContain('text/event-stream')
    expect(stream.body).toContain('event: intent_parsed')
    expect(stream.body).toContain('event: tool_completed')
    expect(stream.body).toContain('event: completed')
  })
})
