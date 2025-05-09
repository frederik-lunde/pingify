

import { VALID_INCIDENT_TYPES, VALID_INCIDENT_STATUSES } from "../../types";
import {
  validateOptionalIntQueryParam,
  validateRequiredIntParam,
  validateOptionalDateQueryParam,
  validateOptionalEnumQueryParam,
} from "./commonValidators";


export const getUserIncidentsValidationRules = () => [
  validateOptionalIntQueryParam("limit"),
  validateOptionalEnumQueryParam("type", VALID_INCIDENT_TYPES),
  validateOptionalDateQueryParam("from"),
  validateOptionalDateQueryParam("to"),
  validateOptionalIntQueryParam("websiteId"),
  validateOptionalEnumQueryParam("status", VALID_INCIDENT_STATUSES),
];


export const getWebsiteIncidentsValidationRules = () => [
  validateRequiredIntParam("websiteId"),
  validateOptionalIntQueryParam("limit"),
  
  validateOptionalEnumQueryParam("type", VALID_INCIDENT_TYPES),
  validateOptionalDateQueryParam("from"),
  validateOptionalDateQueryParam("to"),
  validateOptionalEnumQueryParam("status", VALID_INCIDENT_STATUSES),
];


