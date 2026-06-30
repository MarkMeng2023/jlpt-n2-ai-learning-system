import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GRAMMAR_REQUIRED_FIELDS, RELATION_TYPES, validateGrammarMap } from "../scripts/validate-grammar-map.js";

const points = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8"));
const relations = JSON.parse(await readFile(new URL("../knowledge/grammar/grammar-relations.json", import.meta.url), "utf8"));
const questions = JSON.parse(await readFile(new URL("../data/questions.json", import.meta.url), "utf8"));

test("Grammar Master Map 包含 80 个结构完整的 N2 文法点", () => {
  assert.equal(points.length, 80);
  assert.equal(new Set(points.map((point) => point.knowledgePointId)).size, 80);
  points.forEach((point) => {
    GRAMMAR_REQUIRED_FIELDS.forEach((field) => assert.ok(Object.hasOwn(point, field), `${point.knowledgePointId}.${field}`));
    assert.equal(point.level, "N2");
    assert.equal(point.category, "grammar");
    assert.ok(point.examples.length >= 2);
    assert.ok(Array.isArray(point.tags));
    assert.ok(point.examFrequency >= 1 && point.examFrequency <= 5);
    assert.ok(["draft", "verified"].includes(point.status));
  });
});

test("文法关系引用有效且只使用允许的 relationType", () => {
  assert.equal(relations.length, 55);
  assert.deepEqual(validateGrammarMap(points, relations), { valid: true, errors: [] });
  const ids = new Set(points.map((point) => point.knowledgePointId));
  relations.forEach((relation) => {
    assert.ok(ids.has(relation.from));
    assert.ok(ids.has(relation.to));
    assert.ok(RELATION_TYPES.includes(relation.relationType));
  });
});

test("十个功能分类均有文法点且总数与报告一致", () => {
  const categories = ["逆接/让步", "原因/结果", "推量/判断", "限定/强调", "条件", "目的", "变化/结果", "禁止/义务", "比较/程度", "时间关系"];
  categories.forEach((category) => assert.ok(points.some((point) => point.tags[0] === category), category));
  assert.equal(points.reduce((sum, point) => sum + Number(categories.includes(point.tags[0])), 0), 80);
});

test("现有题库覆盖的 10 个 grammar knowledgePoint 均映射到主数据库", () => {
  const pointIds = new Set(points.map((point) => point.knowledgePointId));
  const sprint7Questions = questions.filter((question) => !question.questionId.startsWith("Q-N2-FAC-GRA-"));
  const covered = new Set(sprint7Questions.flatMap((question) => question.knowledgePointIds).filter((id) => pointIds.has(id)));
  assert.equal(covered.size, 10);
  covered.forEach((id) => assert.ok(pointIds.has(id)));
  assert.ok(questions.length >= 80, "Sprint 7.1 baseline questions must remain available");
});

test("人类可读地图和覆盖报告包含全部要求章节", async () => {
  const [masterMap, coverage] = await Promise.all([
    readFile(new URL("../knowledge/grammar/grammar-master-map.md", import.meta.url), "utf8"),
    readFile(new URL("../knowledge/reports/grammar-coverage-report.md", import.meta.url), "utf8")
  ]);
  ["N2 文法总览", "逆接/让步", "原因/结果", "推量/判断", "限定/强调", "条件", "目的", "变化/结果", "禁止/义务", "比较/程度", "时间关系", "易混组"]
    .forEach((heading) => assert.match(masterMap, new RegExp(heading)));
  assert.match(coverage, /文法点总数：\*\*80\*\*/);
  assert.match(coverage, /已有题目覆盖：\*\*10\*\*/);
  assert.match(coverage, /暂无题目覆盖：\*\*70\*\*/);
  assert.match(coverage, /易混关系数量：\*\*24\*\*/);
});
