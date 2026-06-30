/**
 * JLPT N2 AI Learning System — Sprint 2 Apps Script backend.
 *
 * 部署前：
 * 1. 将此脚本绑定到目标 Google Spreadsheet。
 * 2. 在编辑器中手动运行 setupSheets() 并授权。
 * 3. 部署为 Web App，执行身份选择“我”，访问权限按个人使用场景选择。
 */

const ANSWER_SHEET = "answer_records";
const WEAK_POINT_SHEET = "weak_points";

const ANSWER_HEADERS = [
  "recordId",
  "questionId",
  "level",
  "section",
  "questionType",
  "prompt",
  "choiceA",
  "choiceB",
  "choiceC",
  "choiceD",
  "userAnswer",
  "correctAnswer",
  "isCorrect",
  "confidence",
  "timeSpent",
  "answeredAt",
  "knowledgePointIds",
  "knowledgePointTitles",
  "explanation",
  "receivedAt"
];

const WEAK_POINT_HEADERS = [
  "weakPointId",
  "sourceRecordId",
  "questionId",
  "prompt",
  "userAnswer",
  "correctAnswer",
  "questionType",
  "knowledgePointIds",
  "reasons",
  "createdAt",
  "reviewStatus",
  "receivedAt"
];

function doGet() {
  return jsonResponse_({
    success: true,
    service: "jlpt-n2-sprint-2",
    message: "ready",
    serverTime: new Date().toISOString()
  });
}

function doPost(event) {
  let payload = {};
  try {
    payload = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    if (payload.action === "submitAnswer") return jsonResponse_(submitAnswer_(payload));
    if (payload.action === "getProgress") return jsonResponse_(getProgress_());
    throw new Error("Unsupported action");
  } catch (error) {
    if (payload.action === "getProgress") {
      return jsonResponse_({
        success: false,
        answeredQuestionIds: [],
        totalAnswered: 0,
        serverTime: new Date().toISOString(),
        error: { code: "PROGRESS_FAILED", message: error.message }
      });
    }
    return jsonResponse_({
      success: false,
      operationId: payload.operationId || null,
      recordId: payload.answerRecord && payload.answerRecord.recordId || null,
      serverTime: new Date().toISOString(),
      results: {
        answerRecord: null,
        weakPoint: null
      },
      error: {
        code: "SUBMIT_FAILED",
        message: error.message
      }
    });
  }
}

function getProgress_() {
  const spreadsheet = getSpreadsheet_();
  const answerSheet = getOrCreateSheet_(spreadsheet, ANSWER_SHEET, ANSWER_HEADERS);
  const lastRow = answerSheet.getLastRow();
  const questionIds = lastRow < 2
    ? []
    : answerSheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues()
      .map(function (row) { return row[0]; })
      .filter(function (questionId) { return questionId !== ""; });
  const answeredQuestionIds = Array.from(new Set(questionIds));

  return {
    success: true,
    answeredQuestionIds: answeredQuestionIds,
    totalAnswered: answeredQuestionIds.length,
    serverTime: new Date().toISOString()
  };
}

function submitAnswer_(payload) {
  validatePayload_(payload);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const spreadsheet = getSpreadsheet_();

    const answerSheet = getOrCreateSheet_(spreadsheet, ANSWER_SHEET, ANSWER_HEADERS);
    const weakPointSheet = getOrCreateSheet_(spreadsheet, WEAK_POINT_SHEET, WEAK_POINT_HEADERS);
    const receivedAt = new Date().toISOString();

    const answerResult = upsertAnswerRecord_(answerSheet, payload.answerRecord, receivedAt);
    const weakPointResult = payload.weakPoint
      ? upsertWeakPoint_(weakPointSheet, payload.weakPoint, receivedAt)
      : { status: "skipped", rowNumber: null, weakPointId: null };

    return {
      success: true,
      operationId: payload.operationId,
      recordId: payload.answerRecord.recordId,
      serverTime: receivedAt,
      results: {
        answerRecord: answerResult,
        weakPoint: weakPointResult
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function upsertAnswerRecord_(sheet, record, receivedAt) {
  const existingRow = findExactRow_(sheet, 1, record.recordId);
  if (existingRow) {
    return { status: "duplicate", rowNumber: existingRow, recordId: record.recordId };
  }

  const row = [
    record.recordId,
    record.questionId,
    record.level,
    record.section,
    record.questionType,
    record.prompt,
    record.choices.A,
    record.choices.B,
    record.choices.C,
    record.choices.D,
    record.userAnswer,
    record.correctAnswer,
    record.isCorrect,
    record.confidence,
    record.timeSpent,
    record.answeredAt,
    JSON.stringify(record.knowledgePointIds),
    JSON.stringify(record.knowledgePointTitles),
    record.explanation,
    receivedAt
  ].map(safeCell_);

  sheet.appendRow(row);
  return { status: "inserted", rowNumber: sheet.getLastRow(), recordId: record.recordId };
}

function upsertWeakPoint_(sheet, weakPoint, receivedAt) {
  const existingRow = findExactRow_(sheet, 1, weakPoint.weakPointId);
  if (existingRow) {
    return { status: "duplicate", rowNumber: existingRow, weakPointId: weakPoint.weakPointId };
  }

  const row = [
    weakPoint.weakPointId,
    weakPoint.sourceRecordId,
    weakPoint.questionId,
    weakPoint.prompt,
    weakPoint.userAnswer,
    weakPoint.correctAnswer,
    weakPoint.questionType,
    JSON.stringify(weakPoint.knowledgePointIds),
    JSON.stringify(weakPoint.reasons),
    weakPoint.createdAt,
    weakPoint.reviewStatus,
    receivedAt
  ].map(safeCell_);

  sheet.appendRow(row);
  return { status: "inserted", rowNumber: sheet.getLastRow(), weakPointId: weakPoint.weakPointId };
}

function validatePayload_(payload) {
  assertString_(payload.operationId, "operationId", 100);
  if (!payload.answerRecord || typeof payload.answerRecord !== "object") {
    throw new Error("answerRecord is required");
  }

  const record = payload.answerRecord;
  assertString_(record.recordId, "answerRecord.recordId", 100);
  assertString_(record.questionId, "answerRecord.questionId", 100);
  assertString_(record.level, "answerRecord.level", 10);
  assertString_(record.section, "answerRecord.section", 100);
  assertString_(record.questionType, "answerRecord.questionType", 100);
  assertString_(record.prompt, "answerRecord.prompt", 5000);
  assertChoices_(record.choices, "answerRecord.choices");
  assertChoice_(record.userAnswer, "answerRecord.userAnswer");
  assertChoice_(record.correctAnswer, "answerRecord.correctAnswer");
  if (typeof record.isCorrect !== "boolean") throw new Error("answerRecord.isCorrect must be boolean");
  if (record.isCorrect !== (record.userAnswer === record.correctAnswer)) {
    throw new Error("answerRecord.isCorrect does not match the submitted answers");
  }
  if (["sure", "uncertain", "guessed"].indexOf(record.confidence) === -1) {
    throw new Error("answerRecord.confidence is invalid");
  }
  if (!Number.isFinite(record.timeSpent) || record.timeSpent < 0 || record.timeSpent > 86400) {
    throw new Error("answerRecord.timeSpent is invalid");
  }
  assertIsoDate_(record.answeredAt, "answerRecord.answeredAt");
  assertStringArray_(record.knowledgePointIds, "answerRecord.knowledgePointIds", 50);
  assertStringArray_(record.knowledgePointTitles, "answerRecord.knowledgePointTitles", 50);
  if (record.knowledgePointIds.length !== record.knowledgePointTitles.length) {
    throw new Error("answerRecord knowledge point IDs and titles must have the same length");
  }
  assertString_(record.explanation, "answerRecord.explanation", 5000);

  const expectedReasons = [];
  if (!record.isCorrect) expectedReasons.push("wrong_answer");
  if (record.confidence === "uncertain") expectedReasons.push("uncertain");
  if (record.confidence === "guessed") expectedReasons.push("guessed");

  if (expectedReasons.length > 0 && !payload.weakPoint) {
    throw new Error("weakPoint is required for this answer");
  }
  if (expectedReasons.length === 0 && payload.weakPoint) {
    throw new Error("weakPoint must be omitted for a sure, correct answer");
  }

  if (payload.weakPoint !== null && payload.weakPoint !== undefined) {
    const weakPoint = payload.weakPoint;
    assertString_(weakPoint.weakPointId, "weakPoint.weakPointId", 100);
    if (weakPoint.sourceRecordId !== record.recordId) {
      throw new Error("weakPoint.sourceRecordId must match answerRecord.recordId");
    }
    if (weakPoint.questionId !== record.questionId) {
      throw new Error("weakPoint.questionId must match answerRecord.questionId");
    }
    assertString_(weakPoint.prompt, "weakPoint.prompt", 5000);
    assertChoice_(weakPoint.userAnswer, "weakPoint.userAnswer");
    assertChoice_(weakPoint.correctAnswer, "weakPoint.correctAnswer");
    assertString_(weakPoint.questionType, "weakPoint.questionType", 100);
    if (weakPoint.userAnswer !== record.userAnswer || weakPoint.correctAnswer !== record.correctAnswer) {
      throw new Error("weakPoint answer snapshot does not match answerRecord");
    }
    if (weakPoint.questionType !== record.questionType) {
      throw new Error("weakPoint.questionType must match answerRecord.questionType");
    }
    assertStringArray_(weakPoint.knowledgePointIds, "weakPoint.knowledgePointIds", 50);
    assertReasons_(weakPoint.reasons);
    if (JSON.stringify(weakPoint.reasons) !== JSON.stringify(expectedReasons)) {
      throw new Error("weakPoint.reasons does not match answerRecord");
    }
    assertIsoDate_(weakPoint.createdAt, "weakPoint.createdAt");
    if (weakPoint.reviewStatus !== "new") throw new Error("weakPoint.reviewStatus is invalid");
  }
}

function assertString_(value, name, maxLength) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new Error(name + " is invalid");
  }
}

function assertChoice_(value, name) {
  if (["A", "B", "C", "D"].indexOf(value) === -1) throw new Error(name + " is invalid");
}

function assertChoices_(choices, name) {
  if (!choices || typeof choices !== "object" || Array.isArray(choices)) {
    throw new Error(name + " is invalid");
  }
  ["A", "B", "C", "D"].forEach(function (key) {
    assertString_(choices[key], name + "." + key, 1000);
  });
}

function assertIsoDate_(value, name) {
  assertString_(value, name, 50);
  if (isNaN(Date.parse(value))) throw new Error(name + " is invalid");
}

function assertStringArray_(value, name, maxItems) {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(name + " is invalid");
  value.forEach(function (item) { assertString_(item, name + " item", 150); });
}

function assertReasons_(reasons) {
  const allowed = ["wrong_answer", "uncertain", "guessed"];
  if (!Array.isArray(reasons) || reasons.length === 0 || reasons.length > allowed.length) {
    throw new Error("weakPoint.reasons is invalid");
  }
  reasons.forEach(function (reason) {
    if (allowed.indexOf(reason) === -1) throw new Error("weakPoint.reasons contains an invalid value");
  });
}

function findExactRow_(sheet, column, value) {
  if (sheet.getLastRow() < 2) return null;
  const match = sheet
    .getRange(2, column, sheet.getLastRow() - 1, 1)
    .createTextFinder(value)
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : null;
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  ensureHeaders_(sheet, headers);
  return sheet;
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!spreadsheetId) {
    throw new Error("Spreadsheet is not configured. Run setupSheets() before deploying.");
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  const actual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (JSON.stringify(actual) !== JSON.stringify(headers)) {
    const actualHeaders = readActualHeaders_(sheet);
    const mismatchIndex = findHeaderMismatchIndex_(headers, actualHeaders);
    const details = {
      spreadsheetId: sheet.getParent().getId(),
      sheetName: sheet.getName(),
      expectedHeaders: headers,
      actualHeaders: actualHeaders,
      expectedLength: headers.length,
      actualLength: actualHeaders.length,
      mismatchIndex: mismatchIndex,
      expectedAtMismatch: mismatchIndex === -1 ? null : headers[mismatchIndex] ?? null,
      actualAtMismatch: mismatchIndex === -1 ? null : actualHeaders[mismatchIndex] ?? null
    };
    throw new Error("Header mismatch diagnostics:\n" + JSON.stringify(details, null, 2));
  }
}

function readActualHeaders_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const actualHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  while (actualHeaders.length > 0 && actualHeaders[actualHeaders.length - 1] === "") {
    actualHeaders.pop();
  }
  return actualHeaders;
}

function findHeaderMismatchIndex_(expectedHeaders, actualHeaders) {
  const maxLength = Math.max(expectedHeaders.length, actualHeaders.length);
  for (let index = 0; index < maxLength; index += 1) {
    if (expectedHeaders[index] !== actualHeaders[index]) return index;
  }
  return -1;
}

function safeCell_(value) {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the Apps Script editor before deploying. */
function setupSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Bind this script to a Google Spreadsheet first.");
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", spreadsheet.getId());
  getOrCreateSheet_(spreadsheet, ANSWER_SHEET, ANSWER_HEADERS);
  getOrCreateSheet_(spreadsheet, WEAK_POINT_SHEET, WEAK_POINT_HEADERS);
}
