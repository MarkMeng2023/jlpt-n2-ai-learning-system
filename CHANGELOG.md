# Changelog

## Sprint 17 · Final Release

- 最后一批按考试覆盖率为32个优先知识点新增128题，最终题库达到705题。
- 优先覆盖阅读技能、近义词、固定表达与低覆盖文法，并均衡八种考试语境。
- N2考试覆盖率由66.50%提升至70.90%，题量目标完成率由68.28%提升至83.43%。
- 发布最终报告，版本更新为 `v1.17.0` / `Sprint 17`。

## Sprint 16

- 按 Exam Coverage Score、考试频率与题型缺口，为32个低覆盖知识点新增128题，题库达到577题。
- 八种考试语境均衡生成，并保持难度、答案位置与复习权重分布。
- N2考试覆盖率由59.09%提升至66.50%，题量目标完成率由53.14%提升至68.28%。
- 版本更新为 `v1.16.0` / `Sprint 16`，并刷新全部 Coverage、Factory 与 Quality 报告。

## Sprint 15

- 按 Exam Coverage Score、考试频率与题型缺口，为32个低覆盖知识点新增128题，题库达到449题。
- 单句、对话、通知、邮件、说明文、理由判断、作者观点、短文八种形式均衡生成且不连续重复。
- N2考试覆盖率由48.86%提升至59.09%，题量目标完成率由37.99%提升至53.14%。
- 版本更新为 `v1.15.0` / `Sprint 15`，并刷新全部 Coverage、Factory 与 Quality 报告。

## Sprint 14

- 按 N2 Exam Coverage Score、考试频率和题型缺口，为29个低覆盖文法点新增116题，题库达到321题。
- 每个知识点新增单句、对话、辨析、短文四类题，难度2/3/4/5与答案A/B/C/D均衡分布。
- N2考试覆盖率由37.26%提升至48.86%，题量目标完成率由24.26%提升至37.99%。
- 版本更新为 `v1.14.0` / `Sprint 14`，并刷新全部 Coverage、Factory 与 Quality 报告。

## Sprint 13

- 新增 N2 Exam Coverage Engine，以题量、知识卡、题型与难度多样性、来源验证计算每个 Knowledge Point 的 Coverage Score。
- 首页新增可展开的 N2 考试覆盖率 Dashboard，显示六类覆盖率及风险最高 Top20。
- 新增 Exam Coverage Report 与 Coverage Validation；Question Factory 改为按 Coverage Score 优先补题。
- 版本更新为 `v1.13.0` / `Sprint 13`，题库维持205题。

## Sprint 12

- 首页用户可见文案完成简体中文化，Project Status 显示 `v1.12.0`、`Sprint 12`、题库总量、知识点、知识卡、覆盖率、目标题量和最后更新时间。
- Question Factory Phase 3 按当前缺口 Top 10 文法知识点各补充4题，题库扩展至205题。
- 新增题保持 `question_factory` / `ai_generated` 元数据、完整 A/B/C/D 干扰项分析和两个类似例句。
- 自动报告标题中文化：题库覆盖率报告、出题计划、题库质量报告、知识卡覆盖率报告。

## Sprint 11

- 新增100张统一 Knowledge Card，包含用法、接续、注意事项、常见错误、记忆技巧、例句、复习建议和题目反向关联。
- Question Bank运行时、Review上下文与Question Factory统一接入 Knowledge Card 数据源。
- 新增 Knowledge Card Validation、覆盖报告、验证报告及首页 Knowledge Card 状态。

## Sprint 10

- Question Factory Phase 2 为第二批10个高优先级文法点各补充4题，并将题库扩展至165题。
- 首页新增由 `version.json`、题库和知识点数据驱动的 Project Status，自动显示版本、Sprint、题量、知识点、Coverage、目标和更新时间。
- 题库校验器和浏览器加载器统一支持基础知识点与 Grammar Master Map 的合并引用。

## Sprint 9

- Question Factory Phase 1 为计划 Top 10 知识点自动补充首批题目，并以稳定 ID 保证重复运行幂等。
- 新增题自动填写 Factory 元数据和完整选项解析，并刷新 Coverage、Generation Plan 与 Quality Report。

## Sprint 8

- 新增可配置的 Knowledge Point Coverage Engine 与确定性 Question Factory。
- 新增知识点覆盖报告、题目生成计划及未来候选题元数据模板；Factory 只规划缺口，不直接生成题目。

本项目的主要版本变更记录于此。

## [Unreleased]

### Added

- Added an 80-point N2 Grammar Master Map, 55 typed grammar relations, validation, and coverage reporting.
- Added a knowledge-point source registry and automated question-bank quality report.
- Added source, copyright, AI-generation, human-review, and staged expansion policies for Sprint 6.
- Standardized Question Schema and Knowledge Point Schema for long-term N1/N2/N3 expansion.
- Expanded the N2 question bank from 30 to 80 original JLPT-style questions.
- Added `knowledge-points.json` with 30 structured knowledge points.
- Added a shared browser/CLI question-bank validator and maintenance documentation.

### Changed

- Verified 30 Grammar Master Map entries against two independent N2 learning-resource catalogs; retained 50 entries as draft.
- Expanded the knowledge-point source registry with auditable grammar evidence and verification status.
- Expanded all 80 explanations with the tested knowledge point, correct-answer rationale, A/B/C/D analysis, and a similar example.
- Incremented all question versions to 2 without changing question IDs, answers, or question count.
- Frontend now validates both data files before starting and reports actionable schema errors.
- Existing 30 question IDs remain stable so stored learning progress is preserved.

## [1.4.0] - 2026-06-30

### Added

- Review Engine：根据历史正确率、错误、确定度和复习间隔生成确定性复习计划。
- Continue Mode：从下一道未完成题继续学习。
- Review Mode：按知识点弱点优先级生成 Today's Review Queue。
- Mistakes Mode：按最近错误时间倒序重做错题。
- Random Mode：从已完成和未完成题目中随机练习。
- Learning Profile：在 Google Sheets 中保存学习总量、正确率和知识点状态统计。
- Review Queue：每道复习题必须来自对应知识点，不使用随机跨知识点抽题。
- Knowledge Status：支持 `NEW`、`LEARNING`、`REVIEW`、`MASTERED` 四种状态。
- Sprint 4 自动测试，覆盖状态判定、复习排序、错题排序和学习档案字段。

### Changed

- 首页升级为今日学习计划入口，显示新题、今日复习、错题和知识点状态数量。
- Apps Script 新增 `getReviewData` 与 `saveLearningProfile` 接口。
- Web App 地址更新为 Sprint 4 正式部署地址。

### Google Sheets

- 新增 `learning_profile` 工作表。
- `answer_records` 与 `weak_points` 的既有字段结构保持不变。
- Apps Script 需要重新部署，并运行一次 `setupSheets()` 创建新工作表。

### Validation

- Sprint 1–4 自动测试全部通过。
- Sprint 4 已通过人工验收。
