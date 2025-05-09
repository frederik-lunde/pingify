// src/middleware/validators/commonValidators.ts
import { param, query } from "express-validator";
import {
  VALID_ALERT_TYPES,
  VALID_INCIDENT_TYPES,
  VALID_TIMEFRAMES,
  VALID_SORT_BY,
  VALID_SORT_DIR,
} from "../../types"; // Assuming these enums/constants exist in types

export const validateOptionalIntQueryParam = (paramName: string) =>
  query(paramName)
    .optional()
    .isInt({ gt: 0 })
    .withMessage(`${paramName} must be a positive integer.`)
    .toInt();

export const validateRequiredIntParam = (paramName: string) =>
  param(paramName)
    .isInt({ gt: 0 })
    .withMessage(`${paramName} must be a positive integer.`)
    .toInt();

export const validateOptionalDateQueryParam = (paramName: string) =>
  query(paramName)
    .optional()
    .isISO8601()
    .withMessage(`${paramName} must be a valid ISO 8601 date.`)
    .toDate();

export const validateOptionalEnumQueryParam = (
  paramName: string,
  validValues: readonly string[],
) =>
  query(paramName)
    .optional()
    .isIn(validValues)
    .withMessage(`${paramName} must be one of: ${validValues.join(", ")}`);
