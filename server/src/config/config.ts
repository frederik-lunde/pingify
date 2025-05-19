import dotenv from "dotenv";

dotenv.config();



const requiredEnvVars = [
  "NODE_ENV", 
  "PORT",
  "JWT_SECRET",
  "DATABASE_URL",
  "CORS_ORIGIN", 
  "MAIL_HOST",
  "MAIL_PORT",
  "MAIL_SECURE",
  "MAIL_USER",
  "MAIL_PASS",
  "MAIL_FROM",
];

const nodeEnv = process.env.NODE_ENV || "development"; 

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(
    `FATAL ERROR: Missing required environment variables: ${missingVars.join(", ")} (NODE_ENV=${nodeEnv})`,
  );
  process.exit(1); 
}


export const appConfig = {
  nodeEnv: nodeEnv,
  port: parseInt(process.env.PORT!, 10),
  logLevel: process.env.LOG_LEVEL || "info",
  isProduction: nodeEnv === "production",
  isDevelopment: nodeEnv === "development",
};

export const dbConfig = {
  databaseUrl: process.env.DATABASE_URL!, 
  shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || "",
};

export const securityConfig = {
  jwtSecret: process.env.JWT_SECRET!, 
};

export const corsConfig = {
  allowedOrigins: process.env.CORS_ORIGIN!,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, 
};

const mailPort = parseInt(process.env.MAIL_PORT!, 10); 

export const mailConfig = {
  host: process.env.MAIL_HOST!,
  port: mailPort, 
  secure: process.env.MAIL_SECURE === "true", 
  tls: process.env.MAIL_TLS === "true" ? { ciphers: "SSLv3" } : undefined, 
  auth: {
    user: process.env.MAIL_USER!, 
    pass: process.env.MAIL_PASS!, 
  },
  from: process.env.MAIL_FROM!, 
};

export const monitoringConfig = {
  concurrency: parseInt(process.env.MONITOR_CONCURRENCY || "5", 10),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT || "10000", 10),
  defaultIntervalSeconds: parseInt(
    process.env.DEFAULT_MONITOR_INTERVAL_SECONDS || "300",
    10,
  ),
  minimumIntervalSeconds: parseInt(
    process.env.MINIMUM_MONITOR_INTERVAL_SECONDS || "30",
    10,
  ),
  resultsToKeep: parseInt(process.env.MONITORING_RESULTS_TO_KEEP || "2000", 10),
  resolvedAlertLinkCleanupDays: parseInt(
    process.env.RESOLVED_ALERT_LINK_CLEANUP_DAYS || "30",
    10,
  ),
  recheckDelaySeconds: parseInt(process.env.RECHECK_DELAY_SECONDS || "60", 10),
  monitorUserAgent:
    process.env.MONITOR_USER_AGENT ||
    "PingifyMonitor/1.0 (+https://pingify.com/monitor)",
};

export const schedulerConfig = {
  monitorCronPattern: process.env.MONITOR_CRON_PATTERN || "*/30 * * * * *",
  cleanupCronPattern: process.env.CLEANUP_CRON_PATTERN || "0 * * * *",
  purgeCronPattern: process.env.PURGE_CRON_PATTERN || "0 2 * * *",
};

export const config = {
  app: appConfig,
  db: dbConfig,
  security: securityConfig,
  cors: corsConfig,
  mail: mailConfig,
  monitoring: monitoringConfig,
  scheduler: schedulerConfig,
};


const numberValidation = [
  { name: "PORT", value: appConfig.port },
  { name: "MAIL_PORT", value: mailConfig.port },
  { name: "MONITOR_CONCURRENCY", value: monitoringConfig.concurrency },
  { name: "REQUEST_TIMEOUT", value: monitoringConfig.requestTimeoutMs },
  {
    name: "DEFAULT_MONITOR_INTERVAL_SECONDS",
    value: monitoringConfig.defaultIntervalSeconds,
  },
  {
    name: "MINIMUM_MONITOR_INTERVAL_SECONDS",
    value: monitoringConfig.minimumIntervalSeconds,
  },
  { name: "MONITORING_RESULTS_TO_KEEP", value: monitoringConfig.resultsToKeep },
  {
    name: "RESOLVED_ALERT_LINK_CLEANUP_DAYS",
    value: monitoringConfig.resolvedAlertLinkCleanupDays,
  },
  {
    name: "RECHECK_DELAY_SECONDS",
    value: monitoringConfig.recheckDelaySeconds,
  },
];

const invalidNumbers = numberValidation.filter((v) => isNaN(v.value));

if (invalidNumbers.length > 0) {
  const invalidNames = invalidNumbers.map((v) => v.name).join(", ");
  console.error(
    `FATAL ERROR: The following environment variables must be valid numbers: ${invalidNames}`,
  );
  process.exit(1);
}

console.log(
  `[Config] Configuration loaded successfully for NODE_ENV=${appConfig.nodeEnv}.`,
);
if (dbConfig.databaseUrl) {
  try {
    const url = new URL(dbConfig.databaseUrl);
    console.log(`[Config] Database Host: ${url.hostname}`);
  } catch (e) {
    console.log("[Config] Database URL: Set (format unrecognized or invalid)");
  }
} else {
  console.log("[Config] Database URL: Not Set"); 
}
console.log(`[Config] CORS Origin configured: ${corsConfig.allowedOrigins}`);
