export const APP_CONFIG = Object.freeze({
  // 部署 Apps Script Web App 后，把 /exec URL 粘贴到这里。
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbxWHaNjm_qZiFi7hdB4u4Nw_Nwri1osybdgzMwqkLasqBRuzOAIjDHEFcvhakorxNQbKw/exec",
  requestTimeoutMs: 15000,
  queueStorageKey: "jlpt-n2.pending-sync.v1",
  progressStorageKey: "jlpt-n2.answered-question-ids.v1"
});
