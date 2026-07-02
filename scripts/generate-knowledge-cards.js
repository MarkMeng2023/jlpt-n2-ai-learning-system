#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isKnowledgeCardComplete, KNOWLEDGE_CARD_REQUIRED_FIELDS, validateKnowledgeCards } from "../src/knowledge-card.js";

const [basePoints, grammarPoints, questions, registry, version] = await Promise.all([
  readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/questions.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/knowledge-point-sources.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/version.json", import.meta.url), "utf8").then(JSON.parse)
]);
const now = new Date().toISOString();
const grammarIds = new Set(grammarPoints.map((point) => point.knowledgePointId));
const points = [...basePoints.filter((point) => !grammarIds.has(point.knowledgePointId)), ...grammarPoints];
const registryById = new Map(registry.map((entry) => [entry.knowledgePointId, entry]));

const extraExamples = {
  "KP-ADV-ARAKAJIME-001": "会議の資料はあらかじめ読んでおいてください。",
  "KP-ADV-SHIKIRINI-001": "彼は窓の外をしきりに気にしていた。",
  "KP-ADV-ROKUNI-001": "忙しくて昼食もろくに食べられなかった。",
  "KP-ADV-ISSO-001": "新しい制度で手続きがいっそう簡単になった。",
  "KP-ADV-TAMATAMA-001": "駅でたまたま大学時代の友人に会った。",
  "KP-SYN-OOYOSO-001": "作業はおおよそ予定どおりに進んでいる。",
  "KP-SYN-TADACHINI-001": "異常があれば直ちに責任者へ報告する。",
  "KP-SYN-METTANI-001": "この地域では雪はめったに降らない。",
  "KP-SYN-DATO-001": "条件を考えると、その判断は妥当だ。",
  "KP-SYN-HABUKU-001": "時間がないので細かい説明を省いた。",
  "KP-READ-NOTICE-001": "休館日と利用できるサービスを通知文から整理する。",
  "KP-READ-MEMO-001": "メモを読み、誰が何をいつまでに行うかを特定する。",
  "KP-READ-MAINIDEA-001": "対比の後に置かれた筆者の結論から主張を捉える。",
  "KP-READ-GUIDE-001": "案内文の対象者、期限、持ち物、例外条件を照合する。",
  "KP-READ-REASON-001": "「ため」「ので」だけでなく、前後の因果関係から理由を確認する。"
};

function kind(point) {
  if (point.category === "grammar") return "grammar";
  if (point.category === "reading") return "reading";
  if (point.knowledgePointId.startsWith("KP-ADV-")) return "adverb";
  if ((point.tags || []).includes("固定搭配")) return "fixed_expression";
  return "vocabulary";
}
function examples(point) {
  const result = [...new Set(point.examples || [])];
  if (result.length < 2) result.push(extraExamples[point.knowledgePointId] || `${point.title}を使って、文脈に合う文を作る。`);
  return result;
}
function fields(point) {
  const type = kind(point);
  if (type === "grammar") return {
    usage: point.usage,
    grammarPattern: point.structure,
    notes: `语体：${point.formality}。使用时需同时确认接续、前后句逻辑和语气。`,
    commonMistakes: [point.confusablePointIds.length ? "只按中文含义选择，忽略与易混文法在语气和接续上的差别。" : "只记中文翻译，忽略接续形式和前后句逻辑。"],
    memoryTips: `把「${point.title}」与核心含义「${point.meaning}」及一个完整语境一起记忆。`,
    reviewTips: ["先遮住中文解释，口头说出接续和使用场景。", "用易混表达改写例句，再比较语气是否发生变化。"]
  };
  if (type === "reading") return {
    usage: point.description,
    grammarPattern: "阅读技能：定位题干要求，再核对原文中的对象、条件、时间、否定与例外。",
    notes: "答案必须由原文信息支持，不凭常识补充未写出的条件。",
    commonMistakes: ["只抓单个关键词，忽略否定、时间范围或例外条件。"],
    memoryTips: `看到「${point.title}」题型时，先圈出题干要求，再回原文定位证据。`,
    reviewTips: ["答题后指出支持正确选项的原文句。", "逐项说明三个干扰项与原文冲突的位置。"]
  };
  if (type === "adverb") return {
    usage: point.description,
    grammarPattern: "副词＋谓语；同时确认是否要求否定呼应或特定语气。",
    notes: "副词的自然度依赖语境、程度和肯定／否定形式。",
    commonMistakes: ["只记中文意思，忽略与否定形式或特定谓语的呼应。"],
    memoryTips: `把「${point.title}」放进一组肯定或否定的固定语境中记忆。`,
    reviewTips: ["判断该副词能否用于肯定句和否定句。", "替换近义副词，比较程度与语气差异。"]
  };
  if (type === "fixed_expression") return {
    usage: point.description,
    grammarPattern: `固定搭配：${point.title}`,
    notes: "搭配作为整体记忆，动词或名词不能仅凭中文近义随意替换。",
    commonMistakes: ["用中文意思相近的动词替换，形成不自然的日语搭配。"],
    memoryTips: `把「${point.title}」作为一个不可拆的词块朗读和默写。`,
    reviewTips: ["遮住动词，根据名词补全固定搭配。", "造一个与原例句场景不同的新句子。"]
  };
  return {
    usage: point.description,
    grammarPattern: "词汇表达：根据句中搭配、语体和语境选择最接近的表达。",
    notes: "近义不等于所有语境都可互换，需检查搭配和语体。",
    commonMistakes: ["只比较中文释义，不检查日语搭配、语体和语境限制。"],
    memoryTips: `将「${point.title}」与典型搭配和反义／近义表达一起记忆。`,
    reviewTips: ["用自己的话解释目标词与近义词的差别。", "在新语境中替换词语并检查句子是否自然。"]
  };
}

const cards = points.map((point) => {
  const source = registryById.get(point.knowledgePointId) || {};
  const detail = fields(point);
  return {
    knowledgePointId: point.knowledgePointId, title: point.title, category: kind(point), level: point.level,
    meaning: point.meaning, ...detail, examples: examples(point),
    relatedPointIds: [...(point.relatedPointIds || [])], confusablePointIds: [...(point.confusablePointIds || [])],
    linkedQuestionIds: questions.filter((question) => question.knowledgePointIds.includes(point.knowledgePointId)).map((question) => question.questionId),
    verificationStatus: source.verificationStatus || source.validationStatus || "unverified",
    sourceType: source.sourceType || "ai_structured", version: 1, updatedAt: now
  };
});
const validation = validateKnowledgeCards(cards, questions);
const missing = Object.fromEntries(KNOWLEDGE_CARD_REQUIRED_FIELDS.map((field) => [field, cards.filter((card) => {
  const value = card[field]; return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0 && !["relatedPointIds", "confusablePointIds", "linkedQuestionIds"].includes(field));
}).length]));
const complete = cards.filter(isKnowledgeCardComplete).length;
const coverage = [
  "# 知识卡覆盖率报告", "", "## 摘要", "",
  `- Knowledge Card 总数：**${cards.length}**`, `- 已完成：**${complete}**`,
  `- 完成率：**${(complete / cards.length * 100).toFixed(2)}%**`,
  `- 缺失字段数量：**${Object.values(missing).reduce((sum, count) => sum + count, 0)}**`,
  `- 缺失例句数量：**${cards.filter((card) => card.examples.length < 2).length}**`,
  `- 缺失 Review Tips 数量：**${cards.filter((card) => card.reviewTips.length === 0).length}**`,
  `- 缺失 Common Mistakes 数量：**${cards.filter((card) => card.commonMistakes.length === 0).length}**`,
  `- 缺失 Related Points 数量：**${cards.filter((card) => card.relatedPointIds.length === 0).length}**`,
  "", "## 必填字段覆盖率", "", "| 字段 | 缺失卡片数 |", "| --- | ---: |",
  ...Object.entries(missing).map(([field, count]) => `| ${field} | ${count} |`), ""
];
const validationReport = [
  "# 知识卡校验报告", "", `- 结果：**${validation.valid ? "✅ 通过" : "❌ 未通过"}**`,
  `- Cards：**${cards.length}**`, `- Errors：**${validation.errors.length}**`, "", "## Errors", "",
  ...(validation.errors.length ? validation.errors.map((error) => `- ${error}`) : ["- None"]), ""
];
await mkdir(new URL("../knowledge/reports/", import.meta.url), { recursive: true });
await Promise.all([
  writeFile(new URL("../data/knowledge-cards.json", import.meta.url), `${JSON.stringify(cards, null, 2)}\n`),
  writeFile(new URL("../knowledge/reports/knowledge-card-coverage-report.md", import.meta.url), `${coverage.join("\n")}\n`),
  writeFile(new URL("../knowledge/reports/knowledge-card-validation-report.md", import.meta.url), `${validationReport.join("\n")}\n`),
  writeFile(new URL("../data/version.json", import.meta.url), `${JSON.stringify({ ...version, lastUpdated: now }, null, 2)}\n`)
]);
console.log(`Knowledge Cards generated: ${cards.length}, complete ${complete}, validation ${validation.valid ? "PASS" : "FAIL"}.`);
if (!validation.valid) process.exitCode = 1;
