#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { buildExamCoverage } from "../src/exam-coverage.js";
import { createQuestionMetadata } from "../src/question-factory.js";

const questionsUrl = new URL("../data/questions.json", import.meta.url);
const cardsUrl = new URL("../data/knowledge-cards.json", import.meta.url);
const grammarUrl = new URL("../knowledge/grammar/grammar-points.json", import.meta.url);
const versionUrl = new URL("../data/version.json", import.meta.url);
const [questions, cards, grammarPoints, version] = await Promise.all([
  readFile(questionsUrl, "utf8").then(JSON.parse),
  readFile(cardsUrl, "utf8").then(JSON.parse),
  readFile(grammarUrl, "utf8").then(JSON.parse),
  readFile(versionUrl, "utf8").then(JSON.parse)
]);

const before = questions.filter((question) => !question.questionId.startsWith("Q-N2-FAC-S15-"));
const coverage = buildExamCoverage({ knowledgeCards: cards, questions: before, grammarPoints });
const cardById = new Map(cards.map((point) => [point.knowledgePointId, point]));
const grammarById = new Map(grammarPoints.map((point) => [point.knowledgePointId, point]));
const diversityRiskCount = (point) => Number(point.risks.missingReading)
  + Number(point.risks.missingLongText) + Number(point.risks.missingHardQuestion);
const selected = [...coverage.points]
  .sort((a, b) => a.coverageScore - b.coverageScore
    || (grammarById.get(b.knowledgePointId)?.examFrequency || 0) - (grammarById.get(a.knowledgePointId)?.examFrequency || 0)
    || diversityRiskCount(b) - diversityRiskCount(a)
    || a.questionCount - b.questionCount
    || a.knowledgePointId.localeCompare(b.knowledgePointId))
  .slice(0, 32);

const expectedIds = [
  "KP-GRA-NAGARAMO-001", "KP-GRA-NISHITEWA-001", "KP-GRA-RASHII-001", "KP-GRA-SAICHUUNI-001",
  "KP-GRA-TOTOMONI-001", "KP-GRA-WARINI-001", "KP-GRA-YOUDA-001", "KP-GRA-YOUMONONARA-001",
  "KP-ADV-ARAKAJIME-001", "KP-ADV-ISSO-001", "KP-ADV-ROKUNI-001", "KP-ADV-SHIKIRINI-001",
  "KP-ADV-TAMATAMA-001", "KP-GRA-KOTODA-001", "KP-GRA-NIKIMATTEIRU-001", "KP-GRA-NOMINARAZU-001",
  "KP-GRA-TEWANARANAI-001", "KP-GRA-MAI-001", "KP-GRA-NAIKOTOWANAI-001", "KP-GRA-WAKEDEWANAI-001",
  "KP-VOC-KITASU-001", "KP-VOC-TASSURU-001", "KP-GRA-DOKOROKA-001", "KP-GRA-MONODAKARA-001",
  "KP-GRA-MONONARA-001", "KP-GRA-NIKAGIRAZU-001", "KP-GRA-NIKAGITTE-001", "KP-GRA-NISAISHITE-001",
  "KP-GRA-NISAKIDATTE-001", "KP-GRA-TOKORONI-001", "KP-GRA-TSUTSUMO-001", "KP-VOC-HATASU-001"
];
const selectedIds = selected.map((point) => point.knowledgePointId);
if (JSON.stringify(selectedIds) !== JSON.stringify(expectedIds)) {
  throw new Error(`Sprint 15 selection changed: ${selectedIds.join(", ")}`);
}

const formats = [
  { name: "sentence", difficulty: 2, estimatedTime: 60, reviewWeight: 1 },
  { name: "dialogue", difficulty: 3, estimatedTime: 75, reviewWeight: 1.1 },
  { name: "notice", difficulty: 3, estimatedTime: 90, reviewWeight: 1.1 },
  { name: "email", difficulty: 4, estimatedTime: 105, reviewWeight: 1.2 },
  { name: "explanation", difficulty: 4, estimatedTime: 150, reviewWeight: 1.2 },
  { name: "reason", difficulty: 4, estimatedTime: 120, reviewWeight: 1.2 },
  { name: "author_viewpoint", difficulty: 5, estimatedTime: 180, reviewWeight: 1.3 },
  { name: "short_reading", difficulty: 5, estimatedTime: 150, reviewWeight: 1.3 }
];
const generatedAt = new Date();
const answerKeys = ["A", "B", "C", "D"];

function displayExpression(point) {
  return point.title.replace(/^～/, "");
}

function blankExpression(point, example) {
  const specials = {
    "KP-ADV-ROKUNI-001": /ろくに/,
    "KP-GRA-TOKORONI-001": /ところ(?:に|へ|を)/,
    "KP-GRA-TSUTSUMO-001": /つつ(?:も)?/,
    "KP-GRA-NAIKOTOWANAI-001": /ないことは(?:ない|ありません)/,
    "KP-GRA-WAKEDEWANAI-001": /わけでは(?:ない|ありません)/
  };
  if (specials[point.knowledgePointId]) {
    const replaced = example.replace(specials[point.knowledgePointId], "（　　）");
    if (replaced !== example) return replaced;
  }
  const candidates = [displayExpression(point).split(/[／（～]/)[0], point.title, point.title.replace(/^～/, "")]
    .filter(Boolean).sort((a, b) => b.length - a.length);
  for (const candidate of candidates) {
    if (example.includes(candidate)) return example.replace(candidate, "（　　）");
  }
  throw new Error(`${point.knowledgePointId}: cannot blank expression in example: ${example}`);
}

function optionText(point, formatName) {
  return formatName === "sentence" ? displayExpression(point)
    : formatName === "dialogue" || formatName === "notice" || formatName === "email" ? point.meaning
      : point.usage;
}

function distractorsFor(point, formatName) {
  const sameCategory = cards.filter((candidate) => candidate.category === point.category && candidate.knowledgePointId !== point.knowledgePointId);
  const pool = sameCategory.length >= 3 ? sameCategory : cards.filter((candidate) => candidate.knowledgePointId !== point.knowledgePointId);
  const target = optionText(point, formatName);
  const targetLength = [...target].length;
  const relatedIds = new Set([...(point.relatedPointIds || []), ...(point.confusablePointIds || [])]);
  const used = new Set([target.normalize("NFKC")]);
  return pool.sort((a, b) => Math.abs([...optionText(a, formatName)].length - targetLength) - Math.abs([...optionText(b, formatName)].length - targetLength)
    || Number(!relatedIds.has(a.knowledgePointId)) - Number(!relatedIds.has(b.knowledgePointId))
    || a.knowledgePointId.localeCompare(b.knowledgePointId)).filter((candidate) => {
    const normalized = optionText(candidate, formatName).normalize("NFKC");
    if (used.has(normalized)) return false;
    used.add(normalized);
    return true;
  }).slice(0, 3);
}

function rotateChoices(items, answerIndex) {
  const correctAnswer = answerKeys[answerIndex % 4];
  const ordered = [...items];
  const correct = ordered.shift();
  ordered.splice(answerKeys.indexOf(correctAnswer), 0, correct);
  return {
    choices: Object.fromEntries(answerKeys.map((key, index) => [key, ordered[index].text])),
    optionPoints: Object.fromEntries(answerKeys.map((key, index) => [key, ordered[index].point])),
    correctAnswer
  };
}

function promptFor(point, formatName) {
  const expression = displayExpression(point);
  if (formatName === "sentence") return blankExpression(point, point.examples[0]);
  if (formatName === "dialogue") return `A「『${point.examples[1]}』という文を見ました。」\nB「ここで使われた『${expression}』は、どんな意味ですか。」`;
  if (formatName === "notice") return `【お知らせ】\n${point.examples[0]}\nこの案内で使われた「${expression}」の意味として最も適切なものはどれか。`;
  if (formatName === "email") return `件名：表現の確認\n本文：資料に「${point.examples[1]}」とあります。ここでの「${expression}」は何を表していますか。`;
  if (formatName === "explanation") return `次の説明文を読んで答えなさい。\n「${point.examples[0]}」「${point.examples[1]}」では、どちらも「${expression}」が使われている。この表現の用法として最も適切なものはどれか。`;
  if (formatName === "reason") return `「${point.examples[0]}」と述べた理由を理解するうえで、「${expression}」の働きとして最も適切なものはどれか。`;
  if (formatName === "author_viewpoint") return `筆者は「${point.examples[0]}」と述べ、さらに「${point.examples[1]}」という例を挙げている。筆者が「${expression}」によって示している関係はどれか。`;
  return `次の短文を読んで答えなさい。\n${point.examples[0]} また、${point.examples[1]} この二つに共通する「${expression}」の用法はどれか。`;
}

function explanationFor(point, optionPoints, choices, answer, formatName) {
  const reason = formatName === "sentence"
    ? `空欄には「${point.title}」が入り、接续「${point.grammarPattern}」と语义「${point.meaning}」の両方に合う。`
    : `本文の「${point.title}」は「${point.meaning}」を表し、用法「${point.usage}」に一致する。`;
  const analyses = answerKeys.map((key) => {
    const optionPoint = optionPoints[key];
    return key === answer
      ? `${key}「${choices[key]}」：正确。${reason}`
      : `${key}「${choices[key]}」：错误。该选项对应「${optionPoint.title}」，含义是「${optionPoint.meaning}」，用法是「${optionPoint.usage}」，与本文语境不符。`;
  }).join(" ");
  return `知识点：${point.title}（${point.meaning}）。接续：${point.grammarPattern}。正确答案：${answer}。正确理由：${reason} 选项分析：${analyses} 涉及知识点：${point.title}。类似例句1：${point.examples[0]} 类似例句2：${point.examples[1]}`;
}

const generated = [];
selected.forEach((coveragePoint, pointIndex) => {
  const point = cardById.get(coveragePoint.knowledgePointId);
  for (let localIndex = 0; localIndex < 4; localIndex += 1) {
    const format = formats[(pointIndex * 4 + localIndex) % formats.length];
    const optionPoints = [point, ...distractorsFor(point, format.name)];
    const rotated = rotateChoices(optionPoints.map((optionPoint) => ({ point: optionPoint, text: optionText(optionPoint, format.name) })), pointIndex + localIndex);
    const number = pointIndex * 4 + localIndex + 1;
    const readingFormat = !["sentence", "dialogue"].includes(format.name);
    generated.push({
      questionId: `Q-N2-FAC-S15-${String(number).padStart(4, "0")}`,
      level: "N2",
      section: readingFormat ? "reading" : point.category === "adverb" || point.category === "fixed_expression" ? "vocabulary" : "grammar",
      type: readingFormat ? "short_reading" : point.category === "fixed_expression" ? "vocabulary_collocation" : point.category === "adverb" ? "adverb" : format.name === "sentence" ? "grammar_choice" : "grammar_meaning",
      subType: `question_factory_${format.name}`,
      prompt: promptFor(point, format.name),
      choices: rotated.choices,
      correctAnswer: rotated.correctAnswer,
      explanation: explanationFor(point, rotated.optionPoints, rotated.choices, rotated.correctAnswer, format.name),
      knowledgePointIds: [point.knowledgePointId],
      knowledgePointTitles: [point.title],
      ...createQuestionMetadata({ knowledgePointId: point.knowledgePointId, generationType: "question_factory", difficulty: format.difficulty, now: generatedAt }),
      reviewWeight: format.reviewWeight,
      sourceName: "JLPT N2 AI Learning System Question Factory",
      tags: ["question_factory", "sprint15", format.name, ...(readingFormat && ["explanation", "author_viewpoint"].includes(format.name) ? ["long_text"] : []), point.category],
      estimatedTime: format.estimatedTime
    });
  }
});

if (generated.length !== 128) throw new Error(`Expected 128 questions, received ${generated.length}`);
for (let index = 1; index < generated.length; index += 1) {
  if (generated[index].subType === generated[index - 1].subType) throw new Error(`Repeated adjacent type at ${index}`);
}
const generatedIds = new Set(generated.map((question) => question.questionId));
const retained = questions.filter((question) => !generatedIds.has(question.questionId));
await Promise.all([
  writeFile(questionsUrl, `${JSON.stringify([...retained, ...generated], null, 2)}\n`),
  writeFile(versionUrl, `${JSON.stringify({ ...version, version: "v1.15.0", sprint: "Sprint 15", lastUpdated: generatedAt.toISOString() }, null, 2)}\n`)
]);
console.log(`Sprint 15 Question Factory: ${generated.length} questions across ${selected.length} knowledge points; bank total ${retained.length + generated.length}.`);
