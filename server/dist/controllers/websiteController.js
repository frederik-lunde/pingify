"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchWebsites =
  exports.removeWebsiteFromUser =
  exports.addWebsiteToUser =
  exports.toggleWebsiteStatus =
  exports.deleteWebsite =
  exports.setPinStatus =
  exports.updateUserWebsite =
  exports.updateWebsite =
  exports.createWebsite =
  exports.getUserWebsiteById =
  exports.getWebsiteById =
  exports.getUserWebsites =
  exports.getAllWebsites =
    void 0;
const websiteService = __importStar(require("../services/websiteService"));
/**
 * GET /api/websites/admin/all - Get all websites (admin function).
 * No input validation needed beyond auth/admin check.
 */
const getAllWebsites = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    try {
      // Optional: Add admin role check here if needed
      const websites = yield websiteService.getAllWebsites();
      res.json(websites);
    } catch (error) {
      next(error);
    }
  });
exports.getAllWebsites = getAllWebsites;
/**
 * GET /api/websites/user/dashboard - Get websites for the authenticated user.
 * No input validation needed beyond auth.
 */
const getUserWebsites = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
      if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
        res.status(401).json({ message: "Authentication required." });
        return;
      }
      const userId = req.user.id;
      const websiteUsers = yield websiteService.getWebsitesForUser(userId);
      res.json(websiteUsers);
    } catch (error) {
      next(error);
    }
  });
exports.getUserWebsites = getUserWebsites;
/**
 * GET /api/websites/:id - Get website by ID (publicly accessible info).
 * Validation handled by middleware.
 */
const getWebsiteById = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    try {
      // Access validated ID (already parsed to int)
      const websiteId = req.params.id;
      const website = yield websiteService.getWebsiteById(websiteId);
      if (!website) {
        res.status(404).json({ message: "Website not found" });
        return;
      }
      res.json(website);
    } catch (error) {
      next(error);
    }
  });
exports.getWebsiteById = getWebsiteById;
/**
 * GET /api/websites/user/dashboard/:id - Get user's specific website configuration by ID.
 * Validation handled by middleware.
 */
const getUserWebsiteById = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
      if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
        res.status(401).json({ message: "Authentication required." });
        return;
      }
      const userId = req.user.id;
      // Access validated ID (already parsed to int)
      const websiteId = req.params.id;
      const userWebsite = yield websiteService.getUserWebsiteById(
        userId,
        websiteId,
      );
      if (!userWebsite) {
        res
          .status(404)
          .json({ message: "Website not found in your dashboard" });
        return;
      }
      res.json(userWebsite);
    } catch (error) {
      next(error);
    }
  });
exports.getUserWebsiteById = getUserWebsiteById;
/**
 * POST /api/websites/admin/create - Create a new website (admin function).
 * Validation handled by middleware.
 */
const createWebsite = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    try {
      // Optional: Add admin role check here if needed
      // Access validated body data
      const { url, interval } = req.body;
      const createData = { url, interval }; // Pass validated data
      const website = yield websiteService.createWebsite(createData);
      res.status(201).json(website);
    } catch (error) {
      // Handle specific service errors
      if (
        error instanceof Error &&
        (error.message.includes("Invalid URL") ||
          error.message.includes("already exists"))
      ) {
        res.status(400).json({ message: error.message });
      } else {
        next(error);
      }
    }
  });
exports.createWebsite = createWebsite;
/**
 * PUT /api/websites/admin/:id - Update a website's core properties (admin function).
 * Validation handled by middleware.
 */
const updateWebsite = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    try {
      // Optional: Add admin role check here if needed
      // Access validated params and body
      const websiteId = req.params.id;
      const updateData = req.body; // Contains validated url or isActive
      const website = yield websiteService.updateWebsiteCore(
        websiteId,
        updateData,
      );
      if (!website) {
        res.status(404).json({ message: "Website not found" });
        return;
      }
      res.json(website);
    } catch (error) {
      // Handle specific service errors
      if (
        error instanceof Error &&
        (error.message.includes("Invalid URL") ||
          error.message.includes("already exists"))
      ) {
        res.status(400).json({ message: error.message });
      } else {
        next(error);
      }
    }
  });
exports.updateWebsite = updateWebsite;
/**
 * PUT /api/websites/user/dashboard/:id - Update a user's website configuration.
 * Validation handled by middleware.
 */
const updateUserWebsite = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
      if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
        res.status(401).json({ message: "Authentication required." });
        return;
      }
      const userId = req.user.id;
      // Access validated params and body
      const websiteId = req.params.id;
      const updateDto = req.body; // Contains validated fields
      const userWebsite = yield websiteService.updateUserWebsite(
        userId,
        websiteId,
        updateDto,
      );
      if (!userWebsite) {
        res
          .status(404)
          .json({ message: "Website not found in your dashboard for update" });
        return;
      }
      res.json(userWebsite);
    } catch (error) {
      next(error);
    }
  });
exports.updateUserWebsite = updateUserWebsite;
/**
 * PATCH /api/websites/user/dashboard/:id/pin - Set the pin status for a user's website.
 * Validation handled by middleware.
 */
const setPinStatus = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
      if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
        res.status(401).json({ message: "Authentication required." });
        return;
      }
      const userId = req.user.id;
      // Access validated params and body
      const websiteId = req.params.id;
      const { isPinned } = req.body; // Contains validated boolean
      const userWebsite = yield websiteService.setPinStatusForUser(
        userId,
        websiteId,
        isPinned,
      );
      if (!userWebsite) {
        res
          .status(404)
          .json({
            message:
              "Website not found in your dashboard to update pin status.",
          });
        return;
      }
      res.json(userWebsite);
    } catch (error) {
      next(error);
    }
  });
exports.setPinStatus = setPinStatus;
/**
 * DELETE /api/websites/admin/:id - Delete a website (admin function).
 * Validation handled by middleware.
 */
const deleteWebsite = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    try {
      // Optional: Add admin role check here if needed
      // Access validated ID (already parsed to int)
      const websiteId = req.params.id;
      const deletedWebsite = yield websiteService.deleteWebsite(websiteId);
      if (!deletedWebsite) {
        res.status(404).json({ message: "Website not found for deletion" });
        return;
      }
      res.status(204).send(); // Success, no content
    } catch (error) {
      next(error);
    }
  });
exports.deleteWebsite = deleteWebsite;
/**
 * PATCH /api/websites/admin/:id/toggle - Toggle a website's active status (admin function).
 * Validation handled by middleware.
 */
const toggleWebsiteStatus = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    try {
      // Optional: Add admin role check here if needed
      // Access validated ID (already parsed to int)
      const websiteId = req.params.id;
      const website = yield websiteService.toggleWebsiteStatus(websiteId);
      if (!website) {
        res.status(404).json({ message: "Website not found for toggle" });
        return;
      }
      res.json(website);
    } catch (error) {
      next(error);
    }
  });
exports.toggleWebsiteStatus = toggleWebsiteStatus;
/**
 * POST /api/websites/user/dashboard - Add a website to user's dashboard.
 * Validation handled by middleware.
 */
const addWebsiteToUser = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
      if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
        res.status(401).json({ message: "Authentication required." });
        return;
      }
      const userId = req.user.id;
      // Access validated body data
      const websiteData = req.body; // Contains validated fields
      const websiteUser = yield websiteService.addWebsiteToUser(
        userId,
        websiteData,
      );
      res.status(201).json(websiteUser);
    } catch (error) {
      // Handle specific service errors
      if (
        error instanceof Error &&
        (error.message.includes("Invalid URL") ||
          error.message.includes("Failed to add website"))
      ) {
        res.status(400).json({ message: error.message });
      } else {
        next(error);
      }
    }
  });
exports.addWebsiteToUser = addWebsiteToUser;
/**
 * DELETE /api/websites/user/dashboard/:id - Remove a website from user's dashboard.
 * Validation handled by middleware.
 */
const removeWebsiteFromUser = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
      if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
        res.status(401).json({ message: "Authentication required." });
        return;
      }
      const userId = req.user.id;
      // Access validated ID (already parsed to int)
      const websiteId = req.params.id;
      // Service handles "not found" internally, just call it
      yield websiteService.removeWebsiteFromUser(userId, websiteId);
      res.status(204).send(); // Success, no content
    } catch (error) {
      // Handle potential generic error from service if needed
      if (
        error instanceof Error &&
        error.message.includes("Failed to remove website")
      ) {
        res.status(500).json({ message: error.message });
      } else {
        next(error);
      }
    }
  });
exports.removeWebsiteFromUser = removeWebsiteFromUser;
/**
 * GET /api/websites/search - Search websites by URL.
 * Validation handled by middleware.
 */
const searchWebsites = (req, res, next) =>
  __awaiter(void 0, void 0, void 0, function* () {
    try {
      // Access validated & escaped query
      const query = req.query.query;
      const websites = yield websiteService.searchWebsites(query);
      res.json(websites);
    } catch (error) {
      next(error);
    }
  });
exports.searchWebsites = searchWebsites;
