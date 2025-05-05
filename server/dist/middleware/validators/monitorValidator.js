"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebsiteDetailsValidationRules = exports.getWebsiteStatsValidationRules = exports.getStatsValidationRules = exports.triggerWebsiteCheckValidationRules = exports.getResultsByWebsiteValidationRules = exports.getResultsValidationRules = void 0;
// src/middleware/validators/monitoringValidator.ts
const types_1 = require("../../types");
const commonValidators_1 = require("./commonValidators");
// Validation rules for GET /api/monitoring/admin/results and GET /api/monitoring/user/results
const getResultsValidationRules = () => [
    (0, commonValidators_1.validateOptionalIntQueryParam)('limit'),
    (0, commonValidators_1.validateOptionalDateQueryParam)('from'),
    (0, commonValidators_1.validateOptionalDateQueryParam)('to'),
];
exports.getResultsValidationRules = getResultsValidationRules;
// Validation rules for GET /api/monitoring/website/:websiteId/results
const getResultsByWebsiteValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('websiteId'),
    (0, commonValidators_1.validateOptionalIntQueryParam)('limit'),
    (0, commonValidators_1.validateOptionalDateQueryParam)('from'),
    (0, commonValidators_1.validateOptionalDateQueryParam)('to'),
];
exports.getResultsByWebsiteValidationRules = getResultsByWebsiteValidationRules;
// Validation rules for POST /api/monitoring/check/:websiteId
const triggerWebsiteCheckValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('websiteId'),
];
exports.triggerWebsiteCheckValidationRules = triggerWebsiteCheckValidationRules;
// Validation rules for GET /api/monitoring/admin/stats and GET /api/monitoring/user/stats
const getStatsValidationRules = () => [
    // --- CORRECTED: Use common validator with constant ---
    (0, commonValidators_1.validateOptionalEnumQueryParam)('period', types_1.VALID_TIMEFRAMES).default('week'),
];
exports.getStatsValidationRules = getStatsValidationRules;
// Validation rules for GET /api/monitoring/website/:websiteId/stats
const getWebsiteStatsValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('websiteId'),
    // --- CORRECTED: Use common validator with constant ---
    (0, commonValidators_1.validateOptionalEnumQueryParam)('period', types_1.VALID_TIMEFRAMES).default('week'),
];
exports.getWebsiteStatsValidationRules = getWebsiteStatsValidationRules;
// Validation rules for GET /api/monitoring/website/:websiteId
const getWebsiteDetailsValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('websiteId'),
    // --- CORRECTED: Pass the imported constants ---
    (0, commonValidators_1.validateOptionalEnumQueryParam)('timeframe', types_1.VALID_TIMEFRAMES).default('day'),
    (0, commonValidators_1.validateOptionalIntQueryParam)('limit').default(25),
    (0, commonValidators_1.validateOptionalIntQueryParam)('incidentLimit').default(10),
    (0, commonValidators_1.validateOptionalEnumQueryParam)('sortBy', types_1.VALID_SORT_BY).default('checkedAt'),
    (0, commonValidators_1.validateOptionalEnumQueryParam)('sortDir', types_1.VALID_SORT_DIR).default('desc'),
];
exports.getWebsiteDetailsValidationRules = getWebsiteDetailsValidationRules;
