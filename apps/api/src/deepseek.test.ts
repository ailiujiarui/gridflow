import { describe, expect, it } from 'vitest'
import { parseIntentWithDeepSeek } from './deepseek.js'

describe('DeepSeek 意图解析', () => {
  it('校验结构化模型输出', async () => {
    const fetcher = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: 'query', resource: 'project', filters: [{ field: 'budget', operator: 'gt', value: 50000 }], requiresConfirmation: false }) } }] }), { status: 200 })
    const result = await parseIntentWithDeepSeek('预算超过五万', { apiKey: 'test-key', fetcher })
    expect(result.source).toBe('deepseek')
    expect(result.intent.filters[0]).toEqual({ field: 'budget', operator: 'gt', value: 50000 })
  })
  it('非法输出降级到确定性解析器', async () => {
    const fetcher = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"action":"delete"}' } }] }), { status: 200 })
    const result = await parseIntentWithDeepSeek('查看进行中的项目', { apiKey: 'test-key', fetcher })
    expect(result.source).toBe('fallback')
    expect(result.intent.filters[0]).toMatchObject({ field: 'status', value: 'Active' })
  })
  it('没有 Key 时不会调用外部服务', async () => expect((await parseIntentWithDeepSeek('负责人是陈梅的项目', { apiKey: '' })).source).toBe('fallback'))
})
