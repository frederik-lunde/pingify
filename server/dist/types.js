"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_INCIDENT_STATUSES =
  exports.VALID_SORT_DIR =
  exports.VALID_SORT_BY =
  exports.VALID_TIMEFRAMES =
  exports.VALID_INCIDENT_TYPES =
  exports.VALID_ALERT_TYPES =
    void 0;
exports.VALID_ALERT_TYPES = ["down", "slow"];
exports.VALID_INCIDENT_TYPES = ["down", "slow"];
exports.VALID_TIMEFRAMES = ["hour", "day", "week", "month", "year"];
exports.VALID_SORT_BY = [
  "checkedAt",
  "isAvailable",
  "responseTime",
  "statusCode",
  "id",
];
exports.VALID_SORT_DIR = ["asc", "desc"];
exports.VALID_INCIDENT_STATUSES = ["open", "closed"];
