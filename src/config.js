export const APP_CONFIG = Object.freeze({
  // 部署 Apps Script Web App 后，把 /exec URL 粘贴到这里。
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbxAG5i_Vxl9L27TQnMak1cqMb-83esZ8QYJW7SZOq_J--LbTaOHf0VJ5qAvU3Djp03PJw/exec",
  requestTimeoutMs: 15000,
  queueStorageKey: "jlpt-n2.pending-sync.v1",
  progressStorageKey: "jlpt-n2.answered-question-ids.v1"
});
