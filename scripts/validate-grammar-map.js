#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const GRAMMAR_REQUIRED_FIELDS = Object.freeze([
  "knowledgePointId", "level", "category", "title", "reading", "meaning",
  "structure", "usage", "formality", "examples", "confusablePointIds",
  "relatedPointIds", "tags", "examFrequency", "sourceNotes", "status"
]);

export const RELATION_TYPES = Object.freeze([
  "similar", "contrast", "confusable", "stronger_than", "weaker_than",
  "formal_variant", "casual_variant"
]);

const FUNCTION_CATEGORIES = [
  "逆接/让步", "原因/结果", "推量/判断", "限定/强调", "条件",
  "目的", "变化/结果", "禁止/义务", "比较/程度", "时间关系"
];

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateStringArray(value, path, errors, minimum = 0) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: must be an array`);
    return;
  }
  if (value.length < minimum) errors.push(`${path}: must contain at least ${minimum} item(s)`);
  value.forEach((item, index) => {
    if (!nonEmptyString(item)) errors.push(`${path}[${index}]: must be a non-empty string`);
  });
}

export function validateGrammarMap(points, relations) {
  const errors = [];
  if (!Array.isArray(points)) return { valid: false, errors: ["grammar-points.json: root must be an array"] };
  if (!Array.isArray(relations)) return { valid: false, errors: ["grammar-relations.json: root must be an array"] };

  const ids = new Set();
  points.forEach((point, index) => {
    const path = `grammar-points[${index}]`;
    if (!point || typeof point !== "object" || Array.isArray(point)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    GRAMMAR_REQUIRED_FIELDS.forEach((field) => {
      if (!Object.hasOwn(point, field) || point[field] === null || point[field] === undefined) {
        errors.push(`${path}.${field}: required field is missing`);
      }
    });
    if (!nonEmptyString(point.knowledgePointId)) {
      errors.push(`${path}.knowledgePointId: must be a non-empty string`);
    } else if (ids.has(point.knowledgePointId)) {
      errors.push(`${path}.knowledgePointId: duplicate ID "${point.knowledgePointId}"`);
    } else {
      ids.add(point.knowledgePointId);
    }
    ["title", "reading", "meaning", "structure", "usage", "sourceNotes"].forEach((field) => {
      if (!nonEmptyString(point[field])) errors.push(`${path}.${field}: must be a non-empty string`);
    });
    if (point.level !== "N2") errors.push(`${path}.level: must be N2`);
    if (point.category !== "grammar") errors.push(`${path}.category: must be grammar`);
    if (!["spoken", "written", "both"].includes(point.formality)) {
      errors.push(`${path}.formality: must be spoken, written, or both`);
    }
    validateStringArray(point.examples, `${path}.examples`, errors, 2);
    validateStringArray(point.confusablePointIds, `${path}.confusablePointIds`, errors);
    validateStringArray(point.relatedPointIds, `${path}.relatedPointIds`, errors);
    validateStringArray(point.tags, `${path}.tags`, errors, 1);
    if (!FUNCTION_CATEGORIES.includes(point.tags?.[0])) {
      errors.push(`${path}.tags[0]: must be a supported functional category`);
    }
    if (!Number.isInteger(point.examFrequency) || point.examFrequency < 1 || point.examFrequency > 5) {
      errors.push(`${path}.examFrequency: must be an integer from 1 to 5`);
    }
    if (!["draft", "verified"].includes(point.status)) {
      errors.push(`${path}.status: must be draft or verified`);
    }
  });

  points.forEach((point, index) => {
    ["confusablePointIds", "relatedPointIds"].forEach((field) => {
      (point?.[field] || []).forEach((id, relationIndex) => {
        if (!ids.has(id)) errors.push(`grammar-points[${index}].${field}[${relationIndex}]: unknown ID "${id}"`);
      });
    });
  });

  const relationKeys = new Set();
  relations.forEach((relation, index) => {
    const path = `grammar-relations[${index}]`;
    if (!relation || typeof relation !== "object" || Array.isArray(relation)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    ["from", "to", "relationType", "note"].forEach((field) => {
      if (!nonEmptyString(relation[field])) errors.push(`${path}.${field}: must be a non-empty string`);
    });
    if (!ids.has(relation.from)) errors.push(`${path}.from: unknown ID "${relation.from}"`);
    if (!ids.has(relation.to)) errors.push(`${path}.to: unknown ID "${relation.to}"`);
    if (relation.from === relation.to) errors.push(`${path}: self-relations are not allowed`);
    if (!RELATION_TYPES.includes(relation.relationType)) {
      errors.push(`${path}.relationType: unsupported value "${relation.relationType}"`);
    }
    const key = `${relation.from}|${relation.to}|${relation.relationType}`;
    if (relationKeys.has(key)) errors.push(`${path}: duplicate relation`);
    relationKeys.add(key);
  });

  return { valid: errors.length === 0, errors };
}

async function runCli() {
  const [points, relations] = await Promise.all([
    readFile(new URL("../knowledge/grammar/grammar-points.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../knowledge/grammar/grammar-relations.json", import.meta.url), "utf8").then(JSON.parse)
  ]);
  const result = validateGrammarMap(points, relations);
  if (!result.valid) {
    console.error(`Grammar map validation failed with ${result.errors.length} error(s):`);
    result.errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`Grammar map valid: ${points.length} points, ${relations.length} relations.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  runCli().catch((error) => {
    console.error(`Grammar map validation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
