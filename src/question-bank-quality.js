const ALLOWED_VALIDATION_STATUSES = ["unverified", "verified", "rejected"];
const ALLOWED_EVIDENCE_TYPES = [
  "official_public", "high_trust_material", "user_provided", "linguistic_reference"
];
const ALLOWED_USAGE_PERMISSIONS = ["reference_only", "user_authorized", "publicly_reproducible"];
const ALLOWED_REGISTRY_SOURCE_TYPES = [
  "official", "textbook", "trusted_learning_site", "grammar_reference",
  "user_material", "ai_structured"
];

function textLength(value) {
  return String(value || "").replace(/\s/g, "").length;
}

function normalized(value) {
  return String(value || "").normalize("NFKC").replace(/[\s。、，,.!?！？「」『』]/g, "").toLowerCase();
}

function explanationCoversDistractors(question) {
  const explanation = String(question.explanation || "");
  if (/(其他|其余|干扰项|不合适|不正确|誤り|適切ではない)/.test(explanation)) return true;
  const wrongChoiceValues = Object.entries(question.choices || {})
    .filter(([key]) => key !== question.correctAnswer)
    .map(([, value]) => String(value))
    .filter((value) => value.length >= 2);
  return wrongChoiceValues.filter((value) => explanation.includes(value)).length >= 2;
}

function findObviousOptionReasons(question) {
  const entries = Object.entries(question.choices || {});
  if (entries.length !== 4) return ["选项数量不是四个"];
  const lengths = entries.map(([, value]) => Math.max(textLength(value), 1));
  const correctIndex = entries.findIndex(([key]) => key === question.correctAnswer);
  if (correctIndex === -1) return [];
  const correctLength = lengths[correctIndex];
  const otherLengths = lengths.filter((_, index) => index !== correctIndex).sort((a, b) => a - b);
  const medianOther = otherLengths[1] || 1;
  const reasons = [];
  if (correctLength >= medianOther * 2.5 || correctLength * 2.5 <= medianOther) {
    reasons.push("正确项长度与干扰项差异过大");
  }
  const uniqueLengths = new Set(lengths);
  if (Math.max(...lengths) >= Math.min(...lengths) * 4 && uniqueLengths.size >= 3) {
    reasons.push("选项长度分布差异明显");
  }
  return reasons;
}

function findMultipleAnswerReasons(question) {
  const entries = Object.entries(question.choices || {});
  const reasons = [];
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const leftValue = normalized(entries[left][1]);
      const rightValue = normalized(entries[right][1]);
      if (leftValue && leftValue === rightValue) {
        reasons.push(`${entries[left][0]} 与 ${entries[right][0]} 归一化后相同`);
      }
    }
  }
  return reasons;
}

export function validateKnowledgePointSources(knowledgePoints, sourceRegistry) {
  const errors = [];
  if (!Array.isArray(sourceRegistry)) {
    return ["knowledge-point-sources.json: root value must be an array"];
  }
  const knownIds = new Set((knowledgePoints || []).map((point) => point.knowledgePointId));
  const registeredIds = new Set();
  sourceRegistry.forEach((entry, index) => {
    const path = `knowledge-point-sources[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    if (!knownIds.has(entry.knowledgePointId)) errors.push(`${path}.knowledgePointId: unknown knowledge point "${entry.knowledgePointId}"`);
    if (registeredIds.has(entry.knowledgePointId)) errors.push(`${path}.knowledgePointId: duplicate source registry entry`);
    registeredIds.add(entry.knowledgePointId);
    if (!ALLOWED_VALIDATION_STATUSES.includes(entry.validationStatus)) {
      errors.push(`${path}.validationStatus: must be ${ALLOWED_VALIDATION_STATUSES.join(", ")}`);
    }
    if (Object.hasOwn(entry, "verificationStatus")) {
      if (!ALLOWED_VALIDATION_STATUSES.includes(entry.verificationStatus)) {
        errors.push(`${path}.verificationStatus: must be ${ALLOWED_VALIDATION_STATUSES.join(", ")}`);
      }
      if (entry.verificationStatus !== entry.validationStatus) {
        errors.push(`${path}: verificationStatus must match validationStatus`);
      }
      if (typeof entry.title !== "string" || entry.title.trim() === "") errors.push(`${path}.title: must be a non-empty string`);
      if (!ALLOWED_REGISTRY_SOURCE_TYPES.includes(entry.sourceType)) {
        errors.push(`${path}.sourceType: must be ${ALLOWED_REGISTRY_SOURCE_TYPES.join(", ")}`);
      }
      if (typeof entry.sourceName !== "string" || entry.sourceName.trim() === "") errors.push(`${path}.sourceName: must be a non-empty string`);
      if (typeof entry.evidenceNote !== "string" || entry.evidenceNote.trim() === "") errors.push(`${path}.evidenceNote: must be a non-empty string`);
      if (entry.verificationStatus === "verified" && (typeof entry.verifiedAt !== "string" || Number.isNaN(Date.parse(entry.verifiedAt)))) {
        errors.push(`${path}.verifiedAt: verified entries require an ISO date string`);
      }
    }
    if (!Array.isArray(entry.evidence)) {
      errors.push(`${path}.evidence: must be an array`);
      return;
    }
    entry.evidence.forEach((evidence, evidenceIndex) => {
      const evidencePath = `${path}.evidence[${evidenceIndex}]`;
      if (!ALLOWED_EVIDENCE_TYPES.includes(evidence?.evidenceType)) {
        errors.push(`${evidencePath}.evidenceType: must be ${ALLOWED_EVIDENCE_TYPES.join(", ")}`);
      }
      ["sourceName", "citation", "verifiedBy", "verifiedAt"].forEach((field) => {
        if (typeof evidence?.[field] !== "string" || evidence[field].trim() === "") {
          errors.push(`${evidencePath}.${field}: must be a non-empty string`);
        }
      });
      if (!ALLOWED_USAGE_PERMISSIONS.includes(evidence?.usagePermission)) {
        errors.push(`${evidencePath}.usagePermission: must be ${ALLOWED_USAGE_PERMISSIONS.join(", ")}`);
      }
    });
    if (entry.validationStatus === "verified" && entry.evidence.length === 0) {
      errors.push(`${path}: verified knowledge point must include evidence`);
    }
  });
  knownIds.forEach((id) => {
    if (!registeredIds.has(id)) errors.push(`knowledge-point-sources.json: missing registry entry for "${id}"`);
  });
  return errors;
}

export function analyzeQuestionBankQuality(questions, knowledgePoints, sourceRegistry, options = {}) {
  const minimumExplanationLength = options.minimumExplanationLength ?? 30;
  const allKnownPoints = [...knowledgePoints, ...(options.additionalKnowledgePoints || [])];
  const sourceErrors = validateKnowledgePointSources(allKnownPoints, sourceRegistry);
  const registryById = new Map((sourceRegistry || []).map((entry) => [entry.knowledgePointId, entry]));
  const questionsByPoint = new Map((knowledgePoints || []).map((point) => [point.knowledgePointId, []]));
  (questions || []).forEach((question) => {
    (question.knowledgePointIds || []).forEach((id) => {
      if (!questionsByPoint.has(id)) questionsByPoint.set(id, []);
      questionsByPoint.get(id).push(question);
    });
  });

  const knowledgePointCoverage = (knowledgePoints || []).map((point) => {
    const relatedQuestions = questionsByPoint.get(point.knowledgePointId) || [];
    const registry = registryById.get(point.knowledgePointId);
    const sourceTypes = [...new Set(relatedQuestions.map((question) => question.sourceType))].sort();
    const evidence = registry?.evidence || [];
    const hasNonAiEvidence = evidence.length > 0;
    return {
      knowledgePointId: point.knowledgePointId,
      title: point.title,
      questionCount: relatedQuestions.length,
      validationStatus: registry?.validationStatus || "missing",
      evidence,
      sourceTypes,
      onlyAiSource: sourceTypes.length > 0 && sourceTypes.every((type) => type === "ai_generated") && !hasNonAiEvidence,
      missingValidationSource: registry?.validationStatus !== "verified" || evidence.length === 0
    };
  });

  const questionSources = (questions || []).map((question) => ({
    questionId: question.questionId,
    sourceType: question.sourceType,
    sourceName: question.sourceName
  }));
  const shortExplanations = (questions || [])
    .filter((question) => textLength(question.explanation) < minimumExplanationLength)
    .map((question) => ({ questionId: question.questionId, length: textLength(question.explanation) }));
  const missingDistractorAnalysis = (questions || [])
    .filter((question) => !explanationCoversDistractors(question))
    .map((question) => question.questionId);
  const obviousOptionCandidates = (questions || []).flatMap((question) => {
    const reasons = findObviousOptionReasons(question);
    return reasons.length ? [{ questionId: question.questionId, reasons }] : [];
  });
  const multipleAnswerCandidates = (questions || []).flatMap((question) => {
    const reasons = findMultipleAnswerReasons(question);
    return reasons.length ? [{ questionId: question.questionId, reasons }] : [];
  });
  const missingQuestionSources = (questions || []).filter((question) => !question.sourceType || !question.sourceName)
    .map((question) => question.questionId);
  const onlyAiKnowledgePoints = knowledgePointCoverage.filter((point) => point.onlyAiSource).map((point) => point.knowledgePointId);
  const missingValidationSources = knowledgePointCoverage.filter((point) => point.missingValidationSource)
    .map((point) => point.knowledgePointId);
  const publicationBlockerCount = sourceErrors.length + missingQuestionSources.length
    + missingValidationSources.length + missingDistractorAnalysis.length + multipleAnswerCandidates.length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      questionCount: (questions || []).length,
      knowledgePointCount: (knowledgePoints || []).length,
      verifiedKnowledgePointCount: knowledgePointCoverage.filter((point) => !point.missingValidationSource).length,
      onlyAiKnowledgePointCount: onlyAiKnowledgePoints.length,
      missingValidationSourceCount: missingValidationSources.length,
      shortExplanationCount: shortExplanations.length,
      missingDistractorAnalysisCount: missingDistractorAnalysis.length,
      obviousOptionCandidateCount: obviousOptionCandidates.length,
      multipleAnswerCandidateCount: multipleAnswerCandidates.length,
      publicationBlockerCount,
      expansionGate: publicationBlockerCount === 0 ? "PASS" : "HOLD"
    },
    sourceErrors,
    knowledgePointCoverage,
    questionSources,
    onlyAiKnowledgePoints,
    missingValidationSources,
    shortExplanations,
    missingDistractorAnalysis,
    obviousOptionCandidates,
    multipleAnswerCandidates,
    missingQuestionSources
  };
}

function markdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function listOrNone(items, formatter = (item) => item) {
  if (items.length === 0) return "- None";
  return items.map((item) => `- ${formatter(item)}`).join("\n");
}

export function renderQualityReportMarkdown(report) {
  const s = report.summary;
  const lines = [
    "# Question Bank Quality Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Expansion gate: **${s.expansionGate}**`,
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Questions | ${s.questionCount} |`,
    `| Knowledge points | ${s.knowledgePointCount} |`,
    `| Verified knowledge points | ${s.verifiedKnowledgePointCount} |`,
    `| Knowledge points with only AI sources | ${s.onlyAiKnowledgePointCount} |`,
    `| Knowledge points missing validation sources | ${s.missingValidationSourceCount} |`,
    `| Explanations below length threshold | ${s.shortExplanationCount} |`,
    `| Explanations missing distractor analysis | ${s.missingDistractorAnalysisCount} |`,
    `| Obvious-option review candidates | ${s.obviousOptionCandidateCount} |`,
    `| Multiple-answer review candidates | ${s.multipleAnswerCandidateCount} |`,
    `| Publication blockers | ${s.publicationBlockerCount} |`,
    "",
    "The obvious-option and multiple-answer checks are heuristics. PASS still requires human Japanese-language review.",
    "",
    "## Knowledge Point Coverage and Evidence",
    "",
    "| Knowledge Point | Title | Questions | Status | Evidence | Question Sources | AI Only |",
    "| --- | --- | ---: | --- | --- | --- | --- |"
  ];
  report.knowledgePointCoverage.forEach((point) => {
    const evidence = point.evidence.length
      ? point.evidence.map((item) => `${item.evidenceType}: ${item.sourceName}`).join("; ")
      : "未登记";
    lines.push(`| ${markdownCell(point.knowledgePointId)} | ${markdownCell(point.title)} | ${point.questionCount} | ${point.validationStatus} | ${markdownCell(evidence)} | ${markdownCell(point.sourceTypes.join(", "))} | ${point.onlyAiSource ? "YES" : "NO"} |`);
  });
  lines.push("", "## Question Sources", "", "| Question | sourceType | sourceName |", "| --- | --- | --- |");
  report.questionSources.forEach((question) => {
    lines.push(`| ${markdownCell(question.questionId)} | ${markdownCell(question.sourceType)} | ${markdownCell(question.sourceName)} |`);
  });
  lines.push(
    "", "## Knowledge Points With Only AI Sources", "",
    listOrNone(report.onlyAiKnowledgePoints),
    "", "## Knowledge Points Missing Validation Sources", "",
    listOrNone(report.missingValidationSources),
    "", "## Short Explanations", "",
    listOrNone(report.shortExplanations, (item) => `${item.questionId} (${item.length} chars)`),
    "", "## Explanations Missing Distractor Analysis", "",
    listOrNone(report.missingDistractorAnalysis),
    "", "## Obvious-Option Review Candidates", "",
    listOrNone(report.obviousOptionCandidates, (item) => `${item.questionId}: ${item.reasons.join("; ")}`),
    "", "## Possible Multiple-Answer Candidates", "",
    listOrNone(report.multipleAnswerCandidates, (item) => `${item.questionId}: ${item.reasons.join("; ")}`),
    "", "## Source Registry Errors", "",
    listOrNone(report.sourceErrors),
    ""
  );
  return lines.join("\n");
}
