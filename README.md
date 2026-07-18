# GridFlow

GridFlow 是面向运营人员的高性能项目数据工作台，核心目标是快速定位、批量编辑并可靠保存大量结构化数据。

当前重构聚焦：

- React + TypeScript 数据网格架构
- 10 万行确定性压力数据下的虚拟滚动
- 服务端筛选、排序和游标分页
- 多类型单元格与键盘编辑
- 框选、复制粘贴、撤销重做
- 乐观更新、版本冲突和失败回滚
- 前端组件测试、Playwright 和性能证据

OpsPilot Agent 与自动化画布已退出主产品。历史实现保存在 `opspilot-archive` 标签中，不作为当前 GridFlow 能力宣传。

## 当前运行

```bash
npm install
npm run dev
```

默认地址：Web `http://localhost:5173`，API `http://localhost:3001`。

## 验证

```bash
npm run lint
npm run test
npm run build
```

当前处于核心重构阶段，README 只描述已经保留或正在落地的 GridFlow 范围，不填写未经测量的性能数字。
