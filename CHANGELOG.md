# Changelog

本项目的主要版本变更记录于此。

## [Unreleased]

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
