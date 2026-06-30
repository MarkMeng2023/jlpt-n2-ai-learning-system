# Question Bank Standard

本标准适用于 JLPT N2 AI Learning System 的 AI 生成题、人工录入题、官方样题索引和教材来源题。N1/N3 也应复用同一结构，只改变 `level` 与对应知识点数据。

## Questions Schema

`data/questions.json` 是题目数组。每道题必须包含以下字段：

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `questionId` | string | 全局唯一且长期稳定，如 `Q-N2-GRC-0021` |
| `level` | string | 当前为 `N2`，未来可使用 `N1`、`N3` |
| `section` | string | `vocabulary` / `grammar` / `reading` / `listening` |
| `type` | string | 题型大类，如 `grammar_choice` |
| `subType` | string | 更细的答题形式，如 `grammar_sentence_completion` |
| `prompt` | string | 完整题干 |
| `choices` | object | 必须有非空的 `A`、`B`、`C`、`D` |
| `correctAnswer` | string | `A` / `B` / `C` / `D` |
| `explanation` | string | 必须说明正确项依据，并解释其他选项为何不合适 |
| `knowledgePointIds` | string[] | 至少一个，且必须存在于知识点目录 |
| `knowledgePointTitles` | string[] | 与 IDs 按顺序一一对应 |
| `difficulty` | integer | 1–5 |
| `sourceType` | string | 见“来源标记规则” |
| `sourceName` | string | 可追溯的来源名称 |
| `tags` | string[] | 可检索标签 |
| `estimatedTime` | number | 建议作答秒数，必须大于 0 |
| `reviewWeight` | number | 复习权重，默认 `1`，必须大于 0 |
| `version` | integer | 从 `1` 开始；实质修改题干或答案时递增 |
| `createdAt` | string | ISO 8601 时间 |
| `updatedAt` | string | ISO 8601 时间 |

不要修改已发布题目的 `questionId`。历史进度、错题和 Review Queue 都以该 ID 关联。

## Knowledge Point Schema

`data/knowledge-points.json` 是知识点数组：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `knowledgePointId` | string | 全局唯一且稳定 |
| `level` | string | JLPT 等级 |
| `category` | string | `vocabulary` / `grammar` / `reading` / `listening` |
| `title` | string | 页面显示名称 |
| `reading` | string | 日语读法 |
| `meaning` | string | 简明含义 |
| `description` | string | 用法、语义或解题要点 |
| `examples` | string[] | 至少一个原创例句或解题示例 |
| `relatedPointIds` | string[] | 相关知识点 ID，允许空数组 |
| `confusablePointIds` | string[] | 易混知识点 ID，允许空数组 |
| `tags` | string[] | 分类标签 |
| `masteryRule` | object | 掌握条件，例如正确率、连续正确数和练习次数 |
| `createdAt` | string | ISO 8601 时间 |
| `updatedAt` | string | ISO 8601 时间 |

关系字段中的每个 ID 也必须存在于知识点目录。

## 如何添加知识点

1. 先在 `knowledge-points.json` 中创建稳定且唯一的 ID。
2. 填写含义、说明、原创例句和掌握规则。
3. 如填写相关或易混关系，确认目标 ID 已存在。
4. 运行 `npm run validate:bank`。

## 如何添加题目

1. 先确认题目所考查的知识点已经存在。
2. 使用对应等级和题型的下一个未占用 ID；不要复用或重编号旧 ID。
3. 填写全部 schema 字段，确保解析能解释正确项，并能排除干扰项。
4. `knowledgePointIds` 与 `knowledgePointTitles` 必须按顺序对应。
5. 运行校验与测试：

```bash
npm run validate:bank
npm test
```

校验失败会输出 JSON 路径和具体原因，例如：

```text
questions[12].knowledgePointIds[0]: unknown knowledge point "KP-UNKNOWN"
```

## 来源标记规则

知识点的验证证据单独登记在 `data/knowledge-point-sources.json`。完整来源优先级、版权边界和质量门禁见 [`question-bank-source-strategy.md`](question-bank-source-strategy.md)。

- `ai_generated`：AI 生成并经人工检查的原创 JLPT 风格题；`sourceName` 写系统或生成流程名称。
- `manual`：人工原创题；`sourceName` 写作者或维护团队。
- `official_sample`：官方公开样题；`sourceName` 必须写明官方机构和样题名称。只收录有权使用的内容，不复制版权不明真题。
- `textbook`：已获得使用许可的教材来源；`sourceName` 写书名、版本或出版信息。

无法确认授权状态时，不得把真题或教材原文加入题库。可以根据考点重新创作题目，并标记为 `ai_generated` 或 `manual`。

## 扩展 N1 / N3

1. 沿用相同 JSON schema 和校验工具。
2. 新 ID 使用等级前缀，例如 `Q-N1-...`、`KP-N3-...`。
3. 将 `level` 设置为对应等级，不为新等级复制前端逻辑。
4. 保持 `section` 和通用 `type` 命名稳定；只有确有新答题形式时才增加 `subType`。
5. 添加跨等级相关知识点时，仍需保证所有引用存在。

当前校验器允许任意非空等级字符串，以便后续扩展；发布流程应另外检查等级命名是否符合项目约定。
