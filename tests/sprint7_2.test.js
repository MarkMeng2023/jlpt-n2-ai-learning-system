import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateKnowledgePointSources } from "../src/question-bank-quality.js";

const grammarPoints = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const basePoints = JSON.parse(await readFile(new URL("../data/knowledge-points.json", import.meta.url), "utf8"));
const registry = JSON.parse(await readFile(new URL("../data/knowledge-point-sources.json", import.meta.url), "utf8"));
const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"))
  .filter((question) => !question.questionId.startsWith("Q-N2-FAC-S14-") && !question.questionId.startsWith("Q-N2-FAC-S15-"));

test("Sprint 7.2 验证 30 个文法点并保留 50 个 draft", () => {
  assert.equal(grammarPoints.filter((point) => point.status === "verified").length, 30);
  assert.equal(grammarPoints.filter((point) => point.status === "draft").length, 50);
  assert.ok(grammarPoints.filter((point) => point.status === "verified").every((point) => point.sourceNotes.includes("trusted_learning_site")));
});

test("每个 verified 文法点都有扁平来源登记和两条独立证据", () => {
  const byId = new Map(registry.map((entry) => [entry.knowledgePointId, entry]));
  grammarPoints.filter((point) => point.status === "verified").forEach((point) => {
    const entry = byId.get(point.knowledgePointId);
    assert.equal(entry.title, point.title);
    assert.equal(entry.sourceType, "trusted_learning_site");
    assert.equal(entry.verificationStatus, "verified");
    assert.equal(entry.validationStatus, "verified");
    assert.ok(entry.sourceName.includes("JLPT Sensei"));
    assert.ok(entry.sourceName.includes("JapaneseTest4You"));
    assert.ok(entry.evidenceNote.length > 20);
    assert.ok(!Number.isNaN(Date.parse(entry.verifiedAt)));
    assert.equal(entry.evidence.length, 2);
    assert.ok(entry.evidence.every((evidence) => evidence.usagePermission === "reference_only"));
  });
  assert.deepEqual(validateKnowledgePointSources([...basePoints, ...grammarPoints], registry), []);
});

test("draft 文法点不会被 AI 来源伪标 verified", () => {
  const byId = new Map(registry.map((entry) => [entry.knowledgePointId, entry]));
  grammarPoints.filter((point) => point.status === "draft").forEach((point) => {
    const entry = byId.get(point.knowledgePointId);
    assert.equal(entry.sourceType, "ai_structured");
    assert.equal(entry.verificationStatus, "unverified");
    assert.equal(entry.evidence.length, 0);
  });
});

test("Sprint 7.2 不新增题目且不改变覆盖关系", () => {
  assert.ok(questions.length >= 80);
  const grammarIds = new Set(grammarPoints.map((point) => point.knowledgePointId));
  const sprint7Questions = questions.filter((question) => !question.questionId.startsWith("Q-N2-FAC-GRA-") && !question.questionId.startsWith("Q-N2-FAC-S12-"));
  const covered = new Set(sprint7Questions.flatMap((question) => question.knowledgePointIds).filter((id) => grammarIds.has(id)));
  assert.equal(covered.size, 10);
});

test("验证报告包含数量、来源、高频完成率和未验证清单", async () => {
  const report = await readFile(new URL("../knowledge/reports/grammar-verification-report.md", import.meta.url), "utf8");
  assert.match(report, /verified：\*\*30\*\*/);
  assert.match(report, /draft：\*\*50\*\*/);
  assert.match(report, /trusted_learning_site/);
  assert.match(report, /高频文法.*验证完成率/);
  assert.match(report, /未验证文法点/);
  assert.match(report, /暂不可解除/);
});
