# GridFlow

GridFlow 是一个使用 React、TypeScript、Vite 和 TanStack Virtual 构建的高密度数据工作台，用于展示 10 万条数据下的浏览与编辑交互。

## 已实现

- 固定行高虚拟滚动与确定性的 100,000 条演示数据
- 搜索、状态筛选、排序和字段工具
- 文本、状态、数字、日期和金额单元格展示
- 双击编辑、回车确认、Esc 取消和失焦保存
- 撤销/重做、保存状态、空结果状态和键盘快捷键
- 适合密集数据的响应式浏览布局

## 运行

```bash
npm install
npm run dev
npm run build
```

当前版本使用客户端演示数据，便于直接体验虚拟化和交互。Fastify/SQLite 持久化属于下一阶段后端增量。
