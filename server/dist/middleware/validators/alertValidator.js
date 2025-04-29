"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserAlertStatsValidationRules = exports.getAlertsByWebsiteValidationRules = exports.dismissAlertValidationRules = exports.getUserAlertsValidationRules = void 0;
// src/middleware/validators/alertValidator.ts
const types_1 = require("../../types"); // Import the constant
const commonValidators_1 = require("./commonValidators");
// Validation rules for GET /api/alerts/user
const getUserAlertsValidationRules = () => [
    (0, commonValidators_1.validateOptionalIntQueryParam)('limit'),
    // --- CORRECTED: Pass the imported constant ---
    (0, commonValidators_1.validateOptionalEnumQueryParam)('type', types_1.VALID_ALERT_TYPES),
    (0, commonValidators_1.validateOptionalDateQueryParam)('from'),
    (0, commonValidators_1.validateOptionalDateQueryParam)('to'),
    (0, commonValidators_1.validateOptionalIntQueryParam)('websiteId'),
];
exports.getUserAlertsValidationRules = getUserAlertsValidationRules;
// Validation rules for DELETE /api/alerts/:alertId
const dismissAlertValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('alertId'),
];
exports.dismissAlertValidationRules = dismissAlertValidationRules;
// Validation rules for GET /api/alerts/website/:websiteId
const getAlertsByWebsiteValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('websiteId'),
    (0, commonValidators_1.validateOptionalIntQueryParam)('limit'),
    // --- CORRECTED: Pass the imported constant ---
    (0, commonValidators_1.validateOptionalEnumQueryParam)('type', types_1.VALID_ALERT_TYPES),
    (0, commonValidators_1.validateOptionalDateQueryParam)('from'),
    (0, commonValidators_1.validateOptionalDateQueryParam)('to'),
];
exports.getAlertsByWebsiteValidationRules = getAlertsByWebsiteValidationRules;
// Validation rules for GET /api/alerts/user/stats
const getUserAlertStatsValidationRules = () => [
    (0, commonValidators_1.validateOptionalIntQueryParam)('days').default(7),
];
exports.getUserAlertStatsValidationRules = getUserAlertStatsValidationRules;
