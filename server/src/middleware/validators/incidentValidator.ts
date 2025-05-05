// src/middleware/validators/incidentValidator.ts
import { query, param } from 'express-validator';
// --- CORRECTED: Import the constants ---
import { VALID_INCIDENT_TYPES, VALID_INCIDENT_STATUSES } from '../../types';
import {
    validateOptionalIntQueryParam,
    validateRequiredIntParam,
    validateOptionalDateQueryParam,
    validateOptionalEnumQueryParam
} from './commonValidators';

// Validation rules for GET /api/incidents/user
export const getUserIncidentsValidationRules = () => [
    validateOptionalIntQueryParam('limit'),
    validateOptionalEnumQueryParam('type', VALID_INCIDENT_TYPES),
    validateOptionalDateQueryParam('from'),
    validateOptionalDateQueryParam('to'),
    validateOptionalIntQueryParam('websiteId'),
    validateOptionalEnumQueryParam('status', VALID_INCIDENT_STATUSES),
];

// Validation rules for GET /api/incidents/website/:websiteId
export const getWebsiteIncidentsValidationRules = () => [
    validateRequiredIntParam('websiteId'),
    validateOptionalIntQueryParam('limit'),
    // --- CORRECTED: Pass the imported constants ---
    validateOptionalEnumQueryParam('type', VALID_INCIDENT_TYPES),
    validateOptionalDateQueryParam('from'),
    validateOptionalDateQueryParam('to'),
    validateOptionalEnumQueryParam('status', VALID_INCIDENT_STATUSES),
];

// No specific validation needed for getUserIncidentCountLast24h beyond authentication