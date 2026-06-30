# Sprint 3 Delivery Report — 学习分析引擎

## 1. 交付概览

Sprint 3 在现有“本地做题 → 判题 → Google Sheets 同步”流程上增加了学习统计与弱点分析能力，同时保持原有做题和同步流程不变。

本次完成：

- Apps Script 新增 `getLearningStats` action。
- 汇总总做题数、正确数、错误数、总正确率和最近作答时间。
- 按题型聚合作答数量、正确数、错误数和正确率。
- 按知识点聚合作答表现、确定度及弱点分数。
- 页面下方新增简单的“学习统计”区域。
- 页面加载及答案同步成功后自动刷新远端统计。
- 统计接口不可用时显示降级提示，不阻断做题。
- 新增 Sprint 3 自动测试和部署、手动验证文档。

## 2. `getLearningStats` 数据来源与计算规则

数据来自 Google Sheets 的 `answer_records` 工作表。Apps Script 按现有表头读取每条作答记录，主要使用以下字段：

- `recordId`
- `questionType`
- `isCorrect`
- `confidence`
- `answeredAt`
- `knowledgePointIds`
- `knowledgePointTitles`

整体统计规则：

- `totalAnswered`：有效作答记录总数。
- `correctCount`：`isCorrect` 为真的记录数。
- `wrongCount`：总数减去正确数。
- `accuracy`：`correctCount / totalAnswered * 100`，保留最多两位小数；空表返回 0。
- `lastAnsweredAt`：有效 `answeredAt` 中时间最近的一条。

题型统计按 `questionType` 聚合，返回 `type`、`total`、`correct`、`wrong` 和 `accuracy`。

知识点统计会解析每条记录的 `knowledgePointIds` 与 `knowledgePointTitles` JSON 数组；同一知识点跨多条记录累计，返回：

- `knowledgePointId`
- `knowledgePointTitle`
- `total`
- `correct`
- `wrong`
- `uncertainCount`
- `guessedCount`
- `accuracy`
- `weaknessScore`

弱点分数使用本 Sprint 约定的简单规则：

```text
wrong * 3 + uncertainCount * 2 + guessedCount * 2 + (accuracy < 70 ? 5 : 0)
```

分数越高，表示越需要优先复习。知识点结果按弱点分降序排列，并使用正确率、样本数和知识点 ID 处理并列情况。

## 3. 前端学习统计区域

当前页面下方展示：

- 总做题数。
- 总正确率。
- 最弱 5 个知识点：显示知识点标题、弱点分和正确率。
- 最弱 3 个题型：显示题型、正确率和作答数量。

题型按正确率从低到高排列，再按错题数和样本数处理并列。没有作答数据时显示零值及“暂无数据”。读取失败时显示：

> 暂时无法读取学习统计，但不影响继续做题。

## 4. 学习统计链路验证

自动测试覆盖：

1. `answer_records` 为空时返回零值且不报错。
2. 多条记录能正确计算总正确率和题型统计。
3. 同一 `knowledgePointId` 能跨记录聚合。
4. `guessed` 与 `uncertain` 会按规则提高 `weaknessScore`。
5. 页面包含学习统计区域，客户端支持 `getLearningStats`。
6. Sprint 1、Sprint 2 的作答快照、本地队列、进度恢复和题库测试继续通过。

部署链路已使用实际 Web App `/exec` 验证：

- 服务状态返回 `success: true` 和 `service: jlpt-n2-sprint-3`。
- `getLearningStats` 返回 `success: true`。
- 验证时成功读取 27 条作答记录，总正确率为 48.15%。
- 页面刷新后正常显示统计，原有做题和同步流程正常。

## 5. 已知问题与限制

- 当前没有登录或用户隔离；统计覆盖该 Spreadsheet 中的全部 `answer_records`，适用于单人学习原型。
- 统计以远端已同步记录为准，本地待同步答案需同步成功后才会进入统计。
- 弱点分是固定权重的简单启发式规则，暂未考虑样本量置信度、时间衰减或题目难度。
- 题型区域显示内部 `questionType` 值，尚未维护独立的本地化名称映射。
- 本 Sprint 按范围约束未实现图表、知识图谱、复习模式或 AI 自动总结。

## 6. Git 状态（提交前）

```text
## main...origin/main
 M README.md
 M apps-script/Code.gs
 M index.html
 M src/app.js
 M src/config.js
 M src/sync-client.js
 M styles/main.css
?? SPRINT_3_DELIVERY_REPORT.md
?? tests/sprint3.test.js
```

## 7. 发布信息

Commit message：

```text
feat: add learning stats and weakness analysis
```

