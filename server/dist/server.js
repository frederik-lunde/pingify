"use strict";
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
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config/config");
const prismaClient_1 = __importDefault(require("./prisma/prismaClient"));
const PORT = config_1.appConfig.port;
function startServer() {
  return __awaiter(this, void 0, void 0, function* () {
    console.log(`Starting server in ${config_1.appConfig.nodeEnv} mode...`);
    try {
      console.log("Connecting to database...");
      yield prismaClient_1.default.$connect();
      console.log("Database connected successfully!");
      app_1.default.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
      process.on("SIGINT", gracefulShutdown);
      process.on("SIGTERM", gracefulShutdown);
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  });
}
function gracefulShutdown() {
  return __awaiter(this, void 0, void 0, function* () {
    console.log("Received shutdown signal. Closing database connection...");
    try {
      yield prismaClient_1.default.$disconnect();
      console.log("Database connection closed.");
      process.exit(0);
    } catch (error) {
      console.error("Error during database disconnection:", error);
      process.exit(1);
    }
  });
}
startServer();
