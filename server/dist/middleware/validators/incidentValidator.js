"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebsiteIncidentsValidationRules =
  exports.getUserIncidentsValidationRules = void 0;
// --- CORRECTED: Import the constants ---
const types_1 = require("../../types");
const commonValidators_1 = require("./commonValidators");
// Validation rules for GET /api/incidents/user
const getUserIncidentsValidationRules = () => [
  (0, commonValidators_1.validateOptionalIntQueryParam)("limit"),
  (0, commonValidators_1.validateOptionalEnumQueryParam)(
    "type",
    types_1.VALID_INCIDENT_TYPES,
  ),
  (0, commonValidators_1.validateOptionalDateQueryParam)("from"),
  (0, commonValidators_1.validateOptionalDateQueryParam)("to"),
  (0, commonValidators_1.validateOptionalIntQueryParam)("websiteId"),
  (0, commonValidators_1.validateOptionalEnumQueryParam)(
    "status",
    types_1.VALID_INCIDENT_STATUSES,
  ),
];
exports.getUserIncidentsValidationRules = getUserIncidentsValidationRules;
// Validation rules for GET /api/incidents/website/:websiteId
const getWebsiteIncidentsValidationRules = () => [
  (0, commonValidators_1.validateRequiredIntParam)("websiteId"),
  (0, commonValidators_1.validateOptionalIntQueryParam)("limit"),
  // --- CORRECTED: Pass the imported constants ---
  (0, commonValidators_1.validateOptionalEnumQueryParam)(
    "type",
    types_1.VALID_INCIDENT_TYPES,
  ),
  (0, commonValidators_1.validateOptionalDateQueryParam)("from"),
  (0, commonValidators_1.validateOptionalDateQueryParam)("to"),
  (0, commonValidators_1.validateOptionalEnumQueryParam)(
    "status",
    types_1.VALID_INCIDENT_STATUSES,
  ),
];
exports.getWebsiteIncidentsValidationRules = getWebsiteIncidentsValidationRules;
// No specific validation needed for getUserIncidentCountLast24h beyond authentication
