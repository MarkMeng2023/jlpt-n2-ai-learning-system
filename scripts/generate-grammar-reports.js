#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";

const categories = ["逆接/让步", "原因/结果", "推量/判断", "限定/强调", "条件", "目的", "变化/结果", "禁止/义务", "比较/程度", "时间关系"];
const [points, relations, questions, sourceRegistry] = await Promise.all([
  readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../knowledge/grammar/grammar-relations.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/questions.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/knowledge-point-sources.json", import.meta.url), "utf8").then(JSON.parse)
]);
const byId = new Map(points.map((point) => [point.knowledgePointId, point]));
const cell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");

const map = [
  "# JLPT N2 Grammar Master Map",
  "",
  `总计 **${points.length}** 个文法知识点：${points.filter((point) => point.status === "verified").length} 个 verified，${points.filter((point) => point.status === "draft").length} 个 draft。verified 表示通过项目来源规则，不代表官方 JLPT 清单确认。`,
  "",
  "JLPT 官方公布 N2 的文法测试能力包含文法形式判断、句子组成和文章文法，但不公布封闭的逐项文法清单。本地图以常见 N2 资料交叉整理，例句为项目原创。",
  "",
  "## 来源与状态说明",
  "",
  "- 题型边界：[JLPT 官方 N2 测试项目目的](https://www.jlpt.jp/e/guideline/pdf/n2_e.pdf)",
  "- 常见 N2 候选交叉参考：[JLPT Sensei N2 Grammar List](https://jlptsensei.com/jlpt-n2-grammar-list/)、[Bunpro Grammar](https://bunpro.jp/grammar_points)、[JapaneseTest4You N2 Grammar List](https://japanesetest4you.com/jlpt-n2-grammar-list/)",
  "- 非官方资料只用于候选整理和交叉检查，不视为官方封闭清单；所有条目暂为 `draft`。",
  "- `examFrequency` 是学习优先级估计，不是 JLPT 官方出题概率。",
  "",
  "## N2 文法总览",
  "",
  "| 功能分类 | 数量 |",
  "| --- | ---: |",
  ...categories.map((category) => `| ${category} | ${points.filter((point) => point.tags[0] === category).length} |`),
  ""
];
for (const category of categories) {
  map.push(`## ${category}`, "", "| 文法 | 中文含义 | 接续 | 频度 | 状态 |", "| --- | --- | --- | ---: | --- |");
  points.filter((point) => point.tags[0] === category).forEach((point) => {
    map.push(`| ${cell(point.title)} | ${cell(point.meaning)} | ${cell(point.structure)} | ${point.examFrequency} | ${point.status} |`);
  });
  map.push("");
}
map.push("## 易混组", "");
relations.filter((relation) => relation.relationType === "confusable").forEach((relation) => {
  map.push(`- **${byId.get(relation.from).title} ↔ ${byId.get(relation.to).title}**：${relation.note}`);
});
map.push("", "## 其他强弱与变体关系", "");
relations.filter((relation) => relation.relationType !== "confusable").forEach((relation) => {
  map.push(`- **${byId.get(relation.from).title} → ${byId.get(relation.to).title}**（${relation.relationType}）：${relation.note}`);
});

const coveredIds = new Set(questions.flatMap((question) => question.knowledgePointIds || []).filter((id) => byId.has(id)));
const uncovered = points.filter((point) => !coveredIds.has(point.knowledgePointId));
const noRelated = points.filter((point) => point.relatedPointIds.length === 0);
const noConfusable = points.filter((point) => point.confusablePointIds.length === 0);
const frequency = Object.fromEntries([1, 2, 3, 4, 5].map((value) => [value, points.filter((point) => point.examFrequency === value).length]));
const status = Object.fromEntries(["draft", "verified"].map((value) => [value, points.filter((point) => point.status === value).length]));
const report = [
  "# Grammar Coverage Report",
  "",
  "## Summary",
  "",
  `- 文法点总数：**${points.length}**`,
  `- 关系总数：**${relations.length}**`,
  `- 易混关系数量：**${relations.filter((relation) => relation.relationType === "confusable").length}**`,
  `- 已有题目覆盖：**${coveredIds.size}**`,
  `- 暂无题目覆盖：**${uncovered.length}**`,
  "",
  "## 功能分类分布",
  "",
  "| 分类 | 数量 |",
  "| --- | ---: |",
  ...categories.map((category) => `| ${category} | ${points.filter((point) => point.tags[0] === category).length} |`),
  "",
  "## examFrequency 分布",
  "",
  "| examFrequency | 数量 |",
  "| ---: | ---: |",
  ...Object.entries(frequency).map(([value, count]) => `| ${value} | ${count} |`),
  "",
  "## status 分布",
  "",
  "| status | 数量 |",
  "| --- | ---: |",
  ...Object.entries(status).map(([value, count]) => `| ${value} | ${count} |`),
  "",
  "## 没有 relatedPointIds 的文法点",
  "",
  ...(noRelated.length ? noRelated.map((point) => `- ${point.knowledgePointId} · ${point.title}`) : ["- 无"]),
  "",
  "## 没有 confusablePointIds 的文法点",
  "",
  ...(noConfusable.length ? noConfusable.map((point) => `- ${point.knowledgePointId} · ${point.title}`) : ["- 无"]),
  "",
  "## 已有 questions.json 覆盖的文法点",
  "",
  ...[...coveredIds].sort().map((id) => `- ${id} · ${byId.get(id).title} · ${questions.filter((question) => question.knowledgePointIds?.includes(id)).length} 题`),
  "",
  "## 暂无题目覆盖的文法点",
  "",
  ...uncovered.map((point) => `- ${point.knowledgePointId} · ${point.title}`),
  ""
];

const grammarRegistry = sourceRegistry.filter((entry) => byId.has(entry.knowledgePointId));
const verifiedPoints = points.filter((point) => point.status === "verified");
const draftPoints = points.filter((point) => point.status === "draft");
const highFrequency = points.filter((point) => point.examFrequency >= 4);
const verifiedHighFrequency = highFrequency.filter((point) => point.status === "verified");
const sourceTypeCounts = grammarRegistry.reduce((counts, entry) => {
  counts[entry.sourceType || "legacy"] = (counts[entry.sourceType || "legacy"] || 0) + 1;
  return counts;
}, {});
const verification = [
  "# Grammar Verification Report",
  "",
  "## Summary",
  "",
  `- 总文法点数量：**${points.length}**`,
  `- verified：**${verifiedPoints.length}**`,
  `- draft：**${draftPoints.length}**`,
  `- 本次新验证：**${verifiedPoints.length}**`,
  `- 高频文法（examFrequency 4–5）验证完成率：**${verifiedHighFrequency.length}/${highFrequency.length}（${Math.round(verifiedHighFrequency.length / highFrequency.length * 10000) / 100}%）**`,
  `- 是否可以解除 Expansion gate：**${draftPoints.length === 0 ? "YES" : "NO"}**`,
  "",
  "verified 表示条目在两个独立 N2 学习资料目录中交叉出现，且 meaning、structure、usage、relations 与项目原创 examples 已完成一致性检查；不表示 JLPT 官方认证。",
  "",
  "## Source Type 分布",
  "",
  "| sourceType | 数量 |",
  "| --- | ---: |",
  ...Object.entries(sourceTypeCounts).sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => `| ${type} | ${count} |`),
  "",
  "## 本次 Verified 文法点",
  "",
  ...verifiedPoints.map((point) => `- ${point.knowledgePointId} · ${point.title} · frequency ${point.examFrequency}`),
  "",
  "## 未验证文法点",
  "",
  ...draftPoints.map((point) => `- ${point.knowledgePointId} · ${point.title} · 现有独立 N2 来源交叉证据不足，保持 draft。`),
  "",
  "## 需要用户资料协助验证的文法点",
  "",
  "以下 draft 条目若出现在用户持有的 N2 教材、真题或课程资料中，可登记书名、版本和页码后优先复核：",
  "",
  ...draftPoints.map((point) => `- ${point.knowledgePointId} · ${point.title}`),
  "",
  "## Expansion Gate",
  "",
  draftPoints.length === 0
    ? "Grammar Map 来源门禁可以解除；仍需检查全题库的其他质量门禁。"
    : `暂不可解除。仍有 ${draftPoints.length} 个文法点为 draft，且题库其他非文法知识点也需独立验证。`,
  "",
  "## 下一步建议",
  "",
  "1. 优先复核剩余 examFrequency 5 与已被 questions.json 覆盖的 draft 条目。",
  "2. 对等级归属存在差异的基础文法，使用用户教材或权威语法辞典确认其在 N2 地图中的定位。",
  "3. 只在 evidence 完整后将 draft 改为 verified，不使用 AI 自证。",
  "4. Grammar Map 达到 80/80 后，再处理词汇与阅读知识点来源，最后重新评估整体 Expansion gate。",
  ""
];

await mkdir(new URL("../knowledge/reports/", import.meta.url), { recursive: true });
await Promise.all([
  writeFile(new URL("../knowledge/grammar/grammar-master-map.md", import.meta.url), `${map.join("\n")}\n`),
  writeFile(new URL("../knowledge/reports/grammar-coverage-report.md", import.meta.url), `${report.join("\n")}\n`),
  writeFile(new URL("../knowledge/reports/grammar-verification-report.md", import.meta.url), `${verification.join("\n")}\n`)
]);
console.log(`Grammar reports generated: ${points.length} points, ${verifiedPoints.length} verified, ${draftPoints.length} draft.`);
