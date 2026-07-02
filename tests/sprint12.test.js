import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeQuestionBankQuality } from "../src/question-bank-quality.js";
import { buildQuestionFactoryPlan } from "../src/question-factory.js";
import { buildProjectStatus, loadProjectStatusData } from "../src/project-status.js";
import { validateQuestionBank } from "../src/question-bank.js";
import { validateKnowledgeCards } from "../src/knowledge-card.js";

const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"));
const basePoints = JSON.parse(await readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8"));
const grammarPoints = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const cards = JSON.parse(await readFile(new URL("../data/knowledge-cards.json", import.meta.url), "utf8"));
const sources = JSON.parse(await readFile(new URL("../data/knowledge-point-sources.json", import.meta.url), "utf8"));
const version = JSON.parse(await readFile(new URL("../data/version.json", import.meta.url), "utf8"));
const sprint12Version = { ...version, version: "v1.12.0", sprint: "Sprint 12" };

const sprint12Ids = [
  "KP-GRA-AMARI-001",
  "KP-GRA-BAKARIKA-001",
  "KP-GRA-BEKIDA-001",
  "KP-GRA-BEKIDEWANAI-001",
  "KP-GRA-BEKU-001",
  "KP-GRA-DOKORODEWANAI-001",
  "KP-GRA-HANMEN-001",
  "KP-GRA-HAZUDA-001",
  "KP-GRA-HODO-001",
  "KP-GRA-IPPOUDE-001"
];
const sprint12Questions = questions.filter((question) => question.questionId.startsWith("Q-N2-FAC-S12-"));

test("Sprint 12 将题库扩展到205题并保留版本快照", () => {
  assert.equal(sprint12Version.version, "v1.12.0");
  assert.equal(sprint12Version.sprint, "Sprint 12");
  assert.equal(questions.length, 205);
  assert.equal(sprint12Questions.length, 40);
  assert.deepEqual(validateQuestionBank(questions, basePoints, grammarPoints), { valid: true, errors: [] });
  assert.deepEqual(validateKnowledgeCards(cards, questions), { valid: true, errors: [] });
});

test("Sprint 12 仅补充当前缺口最大的Top 10知识点并达到50%阶段目标", () => {
  assert.deepEqual(new Set(sprint12Questions.map((question) => question.knowledgePointId)), new Set(sprint12Ids));
  sprint12Ids.forEach((id) => {
    assert.equal(questions.filter((question) => question.knowledgePointIds.includes(id)).length, 4, id);
    const stages = sprint12Questions.filter((question) => question.knowledgePointId === id).map((question) => question.subType).sort();
    assert.deepEqual(stages, ["question_factory_basic","question_factory_context","question_factory_distinction","question_factory_integrated"]);
  });
});

test("Sprint 12 新增题包含完整元数据、干扰项分析和两个例句", () => {
  sprint12Questions.forEach((question) => {
    assert.equal(question.generationType, "question_factory");
    assert.equal(question.sourceType, "ai_generated");
    assert.equal(question.knowledgePointId, question.knowledgePointIds[0]);
    assert.equal(question.knowledgePointTitles.length, 1);
    ["difficulty","reviewWeight","version","createdAt","updatedAt"].forEach((field) => assert.ok(question[field]));
    ["A","B","C","D"].forEach((key) => assert.ok(question.explanation.includes(`${key}「${question.choices[key]}」`)));
    assert.match(question.explanation, /类似例句1：/);
    assert.match(question.explanation, /类似例句2：/);
  });
});

test("Sprint 12 Coverage 从19.53%提升到24.26%", () => {
  const sprint11Questions = questions.filter((question) => !question.questionId.startsWith("Q-N2-FAC-S12-"));
  const before = buildQuestionFactoryPlan({ knowledgeCards: cards, questions: sprint11Questions });
  const after = buildQuestionFactoryPlan({ knowledgeCards: cards, questions });
  assert.equal(before.summary.targetCoverageRate, 19.53);
  assert.equal(after.summary.targetCoverageRate, 24.26);
  assert.equal(after.summary.currentAssociations, 205);
  assert.equal(after.summary.coveredKnowledgePoints, 50);
});

test("首页 Project Status 用户可见文字已中文化", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  ["项目状态", "构建概览", "版本", "题库总量", "知识点", "知识卡", "知识卡覆盖率", "覆盖率", "目标题量", "最后更新时间", "今日复习队列", "知识掌握情况"]
    .forEach((text) => assert.match(html, new RegExp(text)));
  ["Project Status", "Question Bank", "Knowledge Points", "Knowledge Cards", "Question Target", "Last Updated", "Today's Review Queue", "Knowledge Status"]
    .forEach((text) => assert.doesNotMatch(html, new RegExp(text)));
});

test("Project Status 自动统计 Sprint 12 当前数据", () => {
  const status = buildProjectStatus({ questions, basePoints, grammarPoints, knowledgeCards: cards, version: sprint12Version });
  assert.equal(status.version, "v1.12.0");
  assert.equal(status.sprint, "Sprint 12");
  assert.equal(status.questionCount, 205);
  assert.equal(status.knowledgePointCount, 100);
  assert.equal(status.knowledgeCardCount, 100);
  assert.equal(status.knowledgeCardCoverage, 100);
  assert.equal(status.coverage, 24.26);
  assert.equal(status.questionTarget, 845);
});

test("Project Status 版本数据禁用缓存以避免跨 Sprint 混合状态", async () => {
  const requests = [];
  const fetchMock = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => version };
  };
  const status = await loadProjectStatusData(questions, basePoints, fetchMock, grammarPoints, cards);
  assert.equal(status.version, version.version);
  assert.equal(status.sprint, version.sprint);
  assert.deepEqual(requests, [{ url: "data/version.json", options: { cache: "no-store" } }]);
});

test("Sprint 12 报告标题已中文化且质量启发式不退化", async () => {
  const [coverage, plan, qualityMarkdown, cardCoverage] = await Promise.all([
    readFile(new URL("../knowledge/reports/question-coverage-report.md", import.meta.url), "utf8"),
    readFile(new URL("../reports/question-generation-plan.md", import.meta.url), "utf8"),
    readFile(new URL("../reports/question-bank-quality.md", import.meta.url), "utf8"),
    readFile(new URL("../knowledge/reports/knowledge-card-coverage-report.md", import.meta.url), "utf8")
  ]);
  assert.match(coverage, /^# 题库覆盖率报告/);
  assert.match(plan, /^# 出题计划/);
  assert.match(qualityMarkdown, /^# 题库质量报告/);
  assert.match(cardCoverage, /^# 知识卡覆盖率报告/);
  const quality = analyzeQuestionBankQuality(questions, basePoints, sources, { additionalKnowledgePoints: grammarPoints });
  assert.equal(quality.summary.shortExplanationCount, 0);
  assert.equal(quality.summary.missingDistractorAnalysisCount, 0);
  assert.equal(quality.summary.obviousOptionCandidateCount, 0);
  assert.equal(quality.summary.multipleAnswerCandidateCount, 0);
});
