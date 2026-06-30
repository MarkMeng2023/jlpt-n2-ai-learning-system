# Changelog

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
