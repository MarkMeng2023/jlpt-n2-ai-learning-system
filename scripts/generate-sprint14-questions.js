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

const before = questions.filter((question) => !question.questionId.startsWith("Q-N2-FAC-S14-"));
const coverage = buildExamCoverage({ knowledgeCards: cards, questions: before, grammarPoints });
const grammarById = new Map(grammarPoints.map((point) => [point.knowledgePointId, point]));
const selected = coverage.points
  .filter((point) => point.category === "grammar" && point.questionCount < 4)
  .sort((a, b) => a.coverageScore - b.coverageScore
    || (grammarById.get(b.knowledgePointId)?.examFrequency || 0) - (grammarById.get(a.knowledgePointId)?.examFrequency || 0)
    || a.questionCount - b.questionCount
    || a.knowledgePointId.localeCompare(b.knowledgePointId))
  .slice(0, 29);

const expectedIds = [
  "KP-GRA-KOTONINATTEIRU-001", "KP-GRA-NAIKAGIRI-001", "KP-GRA-TABINI-001", "KP-GRA-UCHINI-001",
  "KP-GRA-WAKEGANAI-001", "KP-GRA-YOUNINARU-001", "KP-GRA-KOTOWANAI-001", "KP-GRA-NIHANSHITE-001",
  "KP-GRA-NIMUKETE-001", "KP-GRA-NISONAETE-001", "KP-GRA-OKAGEDE-001", "KP-GRA-SAE-001",
  "KP-GRA-SAEBA-001", "KP-GRA-SEIDE-001", "KP-GRA-TOSHITARA-001", "KP-GRA-TOSUREBA-001",
  "KP-GRA-TOWAIE-001", "KP-GRA-KUSENI-001", "KP-GRA-KOTONINARU-001", "KP-GRA-KOTONISURU-001",
  "KP-GRA-NAIWAKENIHAIKANAI-001", "KP-GRA-NIKURABETE-001", "KP-GRA-NISHITAGATTE-001", "KP-GRA-NITAISHITE-001",
  "KP-GRA-NITSURETE-001", "KP-GRA-SHIKANAI-001", "KP-GRA-TAMENI-001", "KP-GRA-YOUNI-001",
  "KP-GRA-KURAI-001"
];
const selectedIds = selected.map((point) => point.knowledgePointId);
if (JSON.stringify(selectedIds) !== JSON.stringify(expectedIds)) {
  throw new Error(`Sprint 14 selection changed: ${selectedIds.join(", ")}`);
}

const generatedAt = new Date();
const answerKeys = ["A", "B", "C", "D"];
const stages = [
  { name: "sentence", difficulty: 2, estimatedTime: 60, reviewWeight: 1 },
  { name: "dialogue", difficulty: 3, estimatedTime: 75, reviewWeight: 1.1 },
  { name: "distinction", difficulty: 4, estimatedTime: 90, reviewWeight: 1.2 },
  { name: "short_reading", difficulty: 5, estimatedTime: 120, reviewWeight: 1.3 }
];

function expressionLabel(point) {
  return point.title.replace(/^～/, "");
}

function blankExpression(point, example) {
  if (point.knowledgePointId === "KP-GRA-SAEBA-001") {
    const replaced = example.replace(/さえ[^、。]*?ば/, "（　　）");
    if (replaced !== example) return replaced;
  }
  const conjugatedPatterns = {
    "KP-GRA-YOUNINARU-001": /ようにな(?:る|った|っている|ります)/,
    "KP-GRA-KOTONINARU-001": /ことにな(?:る|った|っている|ります)/,
    "KP-GRA-KOTONISURU-001": /ことにし(?:た|ている|ます)/
  };
  if (conjugatedPatterns[point.knowledgePointId]) {
    const replaced = example.replace(conjugatedPatterns[point.knowledgePointId], "（　　）");
    if (replaced !== example) return replaced;
  }
  const candidates = [expressionLabel(point).split(/[／（]/)[0], point.reading].filter(Boolean);
  for (const candidate of candidates) {
    if (example.includes(candidate)) return example.replace(candidate, "（　　）");
  }
  throw new Error(`${point.knowledgePointId}: cannot blank expression in example: ${example}`);
}

function rotateChoices(items, correctIndex) {
  const correctKey = answerKeys[correctIndex % answerKeys.length];
  const ordered = [...items];
  const correct = ordered.shift();
  ordered.splice(answerKeys.indexOf(correctKey), 0, correct);
  return {
    choices: Object.fromEntries(answerKeys.map((key, index) => [key, ordered[index].text])),
    optionPoints: Object.fromEntries(answerKeys.map((key, index) => [key, ordered[index].point])),
    correctAnswer: correctKey
  };
}

function optionText(point, stageName) {
  return stageName === "sentence" ? expressionLabel(point)
    : stageName === "dialogue" ? point.meaning
      : point.usage;
}

function distractorsFor(point, stageName) {
  const targetText = optionText(point, stageName);
  const targetLength = [...targetText].length;
  const usedTexts = new Set([targetText.normalize("NFKC")]);
  const relatedIds = new Set([...(point.confusablePointIds || []), ...(point.relatedPointIds || [])]);
  const candidates = grammarPoints
    .filter((candidate) => candidate.knowledgePointId !== point.knowledgePointId)
    .sort((a, b) => Math.abs([...optionText(a, stageName)].length - targetLength) - Math.abs([...optionText(b, stageName)].length - targetLength)
      || Number(!relatedIds.has(a.knowledgePointId)) - Number(!relatedIds.has(b.knowledgePointId))
      || a.knowledgePointId.localeCompare(b.knowledgePointId));
  return candidates.filter((candidate) => {
    const normalized = optionText(candidate, stageName).normalize("NFKC");
    if (usedTexts.has(normalized)) return false;
    usedTexts.add(normalized);
    return true;
  }).slice(0, 3);
}

function buildExplanation(point, optionPoints, choices, correctAnswer, stage) {
  const correctReason = stage === "sentence"
    ? `句中的接续与语义都符合「${point.title}」：${point.usage}`
    : stage === "dialogue"
      ? `对话引用的例句表达「${point.meaning}」，符合「${point.title}」的用法。`
      : stage === "distinction"
        ? `该说明准确概括了「${point.title}」的使用场景：${point.usage}`
        : `短文中的两个例子都使用「${point.title}」表达「${point.meaning}」。`;
  const analyses = answerKeys.map((key) => {
    const optionPoint = optionPoints[key];
    if (key === correctAnswer) return `${key}「${choices[key]}」：正确。${correctReason}`;
    return `${key}「${choices[key]}」：错误。该选项对应「${optionPoint.title}」，含义是「${optionPoint.meaning}」，接续为「${optionPoint.structure}」，与本题要求的「${point.meaning}」不符。`;
  }).join(" ");
  return `知识点：${point.title}（${point.meaning}）。接续：${point.structure}。正确答案：${correctAnswer}。正确理由：${correctReason} 选项分析：${analyses} 涉及知识点：${point.title}。类似例句1：${point.examples[0]} 类似例句2：${point.examples[1]}`;
}

const generated = [];
selected.forEach((entry, pointIndex) => {
  const point = grammarById.get(entry.knowledgePointId);
  stages.forEach((stage, stageIndex) => {
    const distractors = distractorsFor(point, stage.name);
    const optionPoints = [point, ...distractors];
    const options = optionPoints.map((optionPoint) => ({
      point: optionPoint,
      text: optionText(optionPoint, stage.name)
    }));
    const rotated = rotateChoices(options, pointIndex + stageIndex);
    const prompt = stage.name === "sentence"
      ? `${blankExpression(point, point.examples[0])}`
      : stage.name === "dialogue"
        ? `A「『${point.examples[1]}』という文を見ました。」\nB「ここで使われた『${expressionLabel(point)}』は、どんな意味ですか。」`
        : stage.name === "distinction"
          ? `「${point.title}」の用法として最も適切な説明はどれか。\n例：${point.examples[0]}`
          : `次の短い説明を読んで、二つの文に共通する「${point.title}」の働きを選びなさい。\n「${point.examples[0]}」また、「${point.examples[1]}」という言い方もある。`;
    const questionNumber = pointIndex * stages.length + stageIndex + 1;
    generated.push({
      questionId: `Q-N2-FAC-S14-${String(questionNumber).padStart(4, "0")}`,
      level: "N2",
      section: stage.name === "short_reading" ? "reading" : "grammar",
      type: stage.name === "short_reading" ? "short_reading" : stage.name === "sentence" ? "grammar_choice" : "grammar_meaning",
      subType: `question_factory_${stage.name}`,
      prompt,
      choices: rotated.choices,
      correctAnswer: rotated.correctAnswer,
      explanation: buildExplanation(point, rotated.optionPoints, rotated.choices, rotated.correctAnswer, stage.name),
      knowledgePointIds: [point.knowledgePointId],
      knowledgePointTitles: [point.title],
      ...createQuestionMetadata({ knowledgePointId: point.knowledgePointId, generationType: "question_factory", difficulty: stage.difficulty, now: generatedAt }),
      reviewWeight: stage.reviewWeight,
      sourceName: "JLPT N2 AI Learning System Question Factory",
      tags: ["question_factory", "sprint14", stage.name, "grammar", ...(point.tags || []).slice(0, 1)],
      estimatedTime: stage.estimatedTime
    });
  });
});

if (generated.length !== 116) throw new Error(`Expected 116 questions, received ${generated.length}`);
const generatedIds = new Set(generated.map((question) => question.questionId));
const retained = questions.filter((question) => !generatedIds.has(question.questionId));
await Promise.all([
  writeFile(questionsUrl, `${JSON.stringify([...retained, ...generated], null, 2)}\n`),
  writeFile(versionUrl, `${JSON.stringify({ ...version, version: "v1.14.0", sprint: "Sprint 14", lastUpdated: generatedAt.toISOString() }, null, 2)}\n`)
]);
console.log(`Sprint 14 Question Factory: ${generated.length} questions generated across ${selected.length} knowledge points; bank total ${retained.length + generated.length}.`);
