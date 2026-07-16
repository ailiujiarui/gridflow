export type Project = { id: number; version: number; task: string; owner: string; status: string; priority: number; due: string; budget: number }
const owners = ['陈梅', '诺亚', '艾娃', '李欧', '苏菲亚']
const statuses = ['Active', 'Review', 'Blocked', 'Done']
const tasks = ['更新入职流程', '整理企业反馈', '准备季度预测', '审查设计系统', '解决接口延迟', '更新帮助中心']
export const projects: Project[] = Array.from({ length: 100000 }, (_, i) => ({ id: i + 1, version: 1, task: `${tasks[i % tasks.length]} ${String(i + 1).padStart(5, '0')}`, owner: owners[(i * 7) % owners.length], status: statuses[(i * 3) % statuses.length], priority: (i % 4) + 1, due: `2026-${String((i % 6) + 7).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`, budget: 1200 + ((i * 137) % 68000) }))
