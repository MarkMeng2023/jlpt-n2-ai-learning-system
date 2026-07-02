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
const isSprint17 = process.argv.includes("--sprint17");
const sprintNumber = isSprint17 ? 17 : 16;
const questionPrefix = `Q-N2-FAC-S${sprintNumber}-`;
const before = questions.filter((question) => !question.questionId.startsWith(questionPrefix)
  && (isSprint17 || !question.questionId.startsWith("Q-N2-FAC-S17-")));
const coverage = buildExamCoverage({ knowledgeCards: cards, questions: before, grammarPoints });
const cardById = new Map(cards.map((point) => [point.knowledgePointId, point]));
const grammarById = new Map(grammarPoints.map((point) => [point.knowledgePointId, point]));
const diversityRisk = (point) => Number(point.risks.missingReading) + Number(point.risks.missingLongText) + Number(point.risks.missingHardQuestion);
const sprint16Ids = [
  "KP-VOC-OU-001", "KP-VOC-YOSERU-001", "KP-SYN-DATO-001", "KP-SYN-HABUKU-001",
  "KP-SYN-METTANI-001", "KP-SYN-OOYOSO-001", "KP-SYN-TADACHINI-001", "KP-READ-GUIDE-001",
  "KP-READ-REASON-001", "KP-GRA-NICHIGAINAI-001", "KP-READ-MEMO-001", "KP-READ-NOTICE-001",
  "KP-READ-MAINIDEA-001", "KP-GRA-BEKU-001", "KP-GRA-NISHITEWA-001", "KP-GRA-SAICHUUNI-001",
  "KP-GRA-WARINI-001", "KP-GRA-YOUMONONARA-001", "KP-GRA-BEKIDA-001", "KP-GRA-HAZUDA-001",
  "KP-GRA-BEKIDEWANAI-001", "KP-GRA-AMARI-001", "KP-GRA-KOTOKARA-001", "KP-GRA-BAKARIKA-001",
  "KP-GRA-HODO-001", "KP-GRA-IPPOUDE-001", "KP-ADV-ISSO-001", "KP-ADV-SHIKIRINI-001",
  "KP-GRA-NIHOKANARANAI-001", "KP-GRA-KOTONINATTEIRU-001", "KP-GRA-NAIKAGIRI-001", "KP-GRA-TABINI-001"
];
const sprint17Ids = [
  "KP-READ-GUIDE-001", "KP-READ-MAINIDEA-001", "KP-READ-MEMO-001", "KP-READ-REASON-001",
  "KP-READ-NOTICE-001", "KP-SYN-HABUKU-001", "KP-SYN-OOYOSO-001", "KP-SYN-DATO-001",
  "KP-SYN-METTANI-001", "KP-SYN-TADACHINI-001", "KP-VOC-TASSURU-001", "KP-VOC-HATASU-001",
  "KP-VOC-YOSERU-001", "KP-VOC-KITASU-001", "KP-VOC-OU-001", "KP-GRA-UCHINI-001",
  "KP-GRA-WAKEGANAI-001", "KP-GRA-YOUNINARU-001", "KP-GRA-KOTOWANAI-001", "KP-GRA-NIHANSHITE-001",
  "KP-GRA-NIMUKETE-001", "KP-GRA-NISONAETE-001", "KP-GRA-OKAGEDE-001", "KP-GRA-SAE-001",
  "KP-GRA-SAEBA-001", "KP-GRA-SEIDE-001", "KP-GRA-TOSHITARA-001", "KP-GRA-TOSUREBA-001",
  "KP-GRA-TOWAIE-001", "KP-GRA-KUSENI-001", "KP-GRA-ZARUOENAI-001", "KP-GRA-KOTONINARU-001"
];
const categoryPriority = { reading_skill: 0, reading: 0, vocabulary: 1, fixed_expression: 2, grammar: 3, adverb: 4 };
const selected = coverage.points.filter((point) => isSprint17 || point.questionCount < point.questionTarget)
  .sort((a, b) => (isSprint17 ? (categoryPriority[a.category] ?? 5) - (categoryPriority[b.category] ?? 5) : 0)
    || a.coverageScore - b.coverageScore
    || a.questionCount - b.questionCount
    || (grammarById.get(b.knowledgePointId)?.examFrequency || 0) - (grammarById.get(a.knowledgePointId)?.examFrequency || 0)
    || diversityRisk(b) - diversityRisk(a)
    || a.knowledgePointId.localeCompare(b.knowledgePointId)).slice(0, 32);
const expectedIds = isSprint17 ? sprint17Ids : sprint16Ids;
if (JSON.stringify(selected.map((point) => point.knowledgePointId)) !== JSON.stringify(expectedIds)) {
  throw new Error(`Sprint ${sprintNumber} selection changed: ${selected.map((point) => point.knowledgePointId).join(", ")}`);
}

const formats = [
  { name: "sentence", difficulty: 2, time: 60, weight: 1 },
  { name: "dialogue", difficulty: 3, time: 75, weight: 1.1 },
  { name: "notice", difficulty: 3, time: 90, weight: 1.1 },
  { name: "email", difficulty: 4, time: 105, weight: 1.2 },
  { name: "explanation", difficulty: 4, time: 150, weight: 1.2 },
  { name: "reason", difficulty: 4, time: 120, weight: 1.2 },
  { name: "author_viewpoint", difficulty: 5, time: 180, weight: 1.3 },
  { name: "short_reading", difficulty: 5, time: 150, weight: 1.3 }
];
const generatedAt = new Date();
const answerKeys = ["A", "B", "C", "D"];
const isReadingSkill = (point) => point.category === "reading" || point.category === "reading_skill";
const expression = (point) => point.title.replace(/^～/, "");

function blankExpression(point, example) {
  const special = {
    "KP-SYN-METTANI-001": /めったに/,
    "KP-GRA-YOUMONONARA-001": /ようものなら/,
    "KP-GRA-KOTONINATTEIRU-001": /ことになってい(?:る|ます)/,
    "KP-VOC-TASSURU-001": /達する/,
    "KP-VOC-HATASU-001": /果たす/,
    "KP-VOC-YOSERU-001": /寄せる/,
    "KP-VOC-KITASU-001": /きたす/,
    "KP-VOC-OU-001": /負う/
  }[point.knowledgePointId];
  if (special) {
    const replaced = example.replace(special, "（　　）");
    if (replaced !== example) return replaced;
  }
  const candidates = [expression(point).split(/[＝／（～]/)[0], point.title.replace(/^～/, "")]
    .filter(Boolean).sort((a, b) => b.length - a.length);
  for (const candidate of candidates) if (example.includes(candidate)) return example.replace(candidate, "（　　）");
  throw new Error(`${point.knowledgePointId}: cannot blank expression in ${example}`);
}

function optionText(point, formatName) {
  if (isReadingSkill(point)) return point.usage;
  return formatName === "sentence" ? expression(point)
    : ["dialogue", "notice", "email"].includes(formatName) ? point.meaning : point.usage;
}

function distractors(point, formatName) {
  const categoryPool = cards.filter((candidate) => candidate.category === point.category && candidate.knowledgePointId !== point.knowledgePointId);
  const pool = categoryPool.length >= 3 ? categoryPool : cards.filter((candidate) => candidate.knowledgePointId !== point.knowledgePointId);
  const target = optionText(point, formatName);
  const used = new Set([target.normalize("NFKC")]);
  return pool.sort((a, b) => Math.abs([...optionText(a, formatName)].length - [...target].length) - Math.abs([...optionText(b, formatName)].length - [...target].length)
    || a.knowledgePointId.localeCompare(b.knowledgePointId)).filter((candidate) => {
    const text = optionText(candidate, formatName).normalize("NFKC");
    if (used.has(text)) return false;
    used.add(text);
    return true;
  }).slice(0, 3);
}

function rotate(items, index) {
  const answer = answerKeys[index % 4];
  const ordered = [...items];
  const correct = ordered.shift();
  ordered.splice(answerKeys.indexOf(answer), 0, correct);
  return {
    answer,
    choices: Object.fromEntries(answerKeys.map((key, i) => [key, ordered[i].text])),
    points: Object.fromEntries(answerKeys.map((key, i) => [key, ordered[i].point]))
  };
}

function prompt(point, formatName) {
  const label = expression(point);
  if (isReadingSkill(point)) {
    const wrappers = {
      sentence: `次の読解作業で最も重視すべきことはどれか。\n課題：${point.examples[0]}`,
      dialogue: `A「${point.examples[0]}」\nB「この場合、どの読み方が最も適切ですか。」`,
      notice: `【お知らせを読む】\n${point.examples[1]}\nこの課題に最も適切な読解方法はどれか。`,
      email: `件名：読解確認\n本文：${point.examples[1]} この文章を正確に読む方法はどれか。`,
      explanation: `次の説明文を読み、適切な読解方法を選びなさい。\n${point.examples[0]} ${point.examples[1]}`,
      reason: `文章中の理由を誤らず特定するために必要な読み方はどれか。\n${point.examples[1]}`,
      author_viewpoint: `筆者の主張を判断する課題である。${point.examples[1]} 最も適切な読み方はどれか。`,
      short_reading: `次の読解課題に最も適切な方法を選びなさい。\n${point.examples[0]} ${point.examples[1]}`
    };
    return wrappers[formatName];
  }
  if (formatName === "sentence") return blankExpression(point, point.examples[0]);
  if (formatName === "dialogue") return `A「『${point.examples[1]}』という文を見ました。」\nB「ここでの『${label}』は、どんな意味ですか。」`;
  if (formatName === "notice") return `【お知らせ】\n${point.examples[0]}\nここで使われた「${label}」の意味として最も適切なものはどれか。`;
  if (formatName === "email") return `件名：表現の確認\n本文：「${point.examples[1]}」の「${label}」は何を表していますか。`;
  if (formatName === "explanation") return `「${point.examples[0]}」「${point.examples[1]}」に共通する「${label}」の用法はどれか。`;
  if (formatName === "reason") return `「${point.examples[0]}」と述べた理由を理解するうえで、「${label}」の働きとして適切なものはどれか。`;
  if (formatName === "author_viewpoint") return `筆者は「${point.examples[0]}」と述べている。「${label}」が示す関係はどれか。`;
  return `次の短文に共通する「${label}」の用法はどれか。\n${point.examples[0]} また、${point.examples[1]}`;
}

function explanation(point, optionPoints, choices, answer, formatName) {
  const correctReason = isReadingSkill(point)
    ? `この課題は「${point.title}」を測るため、${point.usage}`
    : formatName === "sentence"
      ? `「${point.title}」は接续「${point.grammarPattern}」と语义「${point.meaning}」の両方に合う。`
      : `本文の「${point.title}」は「${point.meaning}」を表し、用法「${point.usage}」に一致する。`;
  const analyses = answerKeys.map((key) => key === answer
    ? `${key}「${choices[key]}」：正确。${correctReason}`
    : `${key}「${choices[key]}」：错误。该选项对应「${optionPoints[key].title}」，要求「${optionPoints[key].usage}」，与本题考查内容不符。`).join(" ");
  return `知识点：${point.title}（${point.meaning}）。接续：${point.grammarPattern}。正确答案：${answer}。正确理由：${correctReason} 选项分析：${analyses} 涉及知识点：${point.title}。类似例句1：${point.examples[0]} 类似例句2：${point.examples[1]}`;
}

const generated = [];
selected.forEach((coveragePoint, pointIndex) => {
  const point = cardById.get(coveragePoint.knowledgePointId);
  for (let localIndex = 0; localIndex < 4; localIndex += 1) {
    const format = formats[(pointIndex * 4 + localIndex) % formats.length];
    const options = [point, ...distractors(point, format.name)];
    const rotated = rotate(options.map((optionPoint) => ({ point: optionPoint, text: optionText(optionPoint, format.name) })), pointIndex + localIndex);
    const number = pointIndex * 4 + localIndex + 1;
    const readingFormat = isReadingSkill(point) || !["sentence", "dialogue"].includes(format.name);
    generated.push({
      questionId: `${questionPrefix}${String(number).padStart(4, "0")}`,
      level: "N2",
      section: readingFormat ? "reading" : ["vocabulary", "adverb", "fixed_expression"].includes(point.category) ? "vocabulary" : "grammar",
      type: readingFormat ? "short_reading" : point.category === "fixed_expression" ? "vocabulary_collocation" : point.category === "adverb" ? "adverb" : point.category === "vocabulary" ? "synonym" : format.name === "sentence" ? "grammar_choice" : "grammar_meaning",
      subType: `question_factory_${format.name}`,
      prompt: prompt(point, format.name),
      choices: rotated.choices,
      correctAnswer: rotated.answer,
      explanation: explanation(point, rotated.points, rotated.choices, rotated.answer, format.name),
      knowledgePointIds: [point.knowledgePointId],
      knowledgePointTitles: [point.title],
      ...createQuestionMetadata({ knowledgePointId: point.knowledgePointId, generationType: "question_factory", difficulty: format.difficulty, now: generatedAt }),
      reviewWeight: format.weight,
      sourceName: "JLPT N2 AI Learning System Question Factory",
      tags: ["question_factory", `sprint${sprintNumber}`, format.name, ...(readingFormat && ["explanation", "author_viewpoint"].includes(format.name) ? ["long_text"] : []), point.category],
      estimatedTime: format.time
    });
  }
});
if (generated.length !== 128) throw new Error(`Expected 128 questions, received ${generated.length}`);
for (let index = 1; index < generated.length; index += 1) if (generated[index].subType === generated[index - 1].subType) throw new Error(`Repeated adjacent type at ${index}`);
const ids = new Set(generated.map((question) => question.questionId));
const retained = questions.filter((question) => !ids.has(question.questionId));
await Promise.all([
  writeFile(questionsUrl, `${JSON.stringify([...retained, ...generated], null, 2)}\n`),
  writeFile(versionUrl, `${JSON.stringify({ ...version, version: `v1.${sprintNumber}.0`, sprint: `Sprint ${sprintNumber}`, lastUpdated: generatedAt.toISOString() }, null, 2)}\n`)
]);
console.log(`Sprint ${sprintNumber} Question Factory: ${generated.length} questions across ${selected.length} knowledge points; bank total ${retained.length + generated.length}.`);
