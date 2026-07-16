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
})
