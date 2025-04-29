-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Website" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastChecked" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "globalInterval" INTEGER NOT NULL DEFAULT 300,

    CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_users" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "websiteId" INTEGER NOT NULL,
    "name" TEXT,
    "interval" INTEGER,
    "alertThreshold" INTEGER,
    "alertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notifyEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "website_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_results" (
    "id" SERIAL NOT NULL,
    "websiteId" INTEGER NOT NULL,
    "responseTime" INTEGER,
    "isAvailable" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitoring_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "websiteId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "incidentId" INTEGER,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" SERIAL NOT NULL,
    "websiteId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "initialResultId" INTEGER,
    "confirmingResultId" INTEGER,
    "resolvingResultId" INTEGER,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Website_url_key" ON "Website"("url");

-- CreateIndex
CREATE INDEX "Website_isActive_idx" ON "Website"("isActive");

-- CreateIndex
CREATE INDEX "website_users_userId_idx" ON "website_users"("userId");

-- CreateIndex
CREATE INDEX "website_users_websiteId_idx" ON "website_users"("websiteId");

-- CreateIndex
CREATE UNIQUE INDEX "website_users_userId_websiteId_key" ON "website_users"("userId", "websiteId");

-- CreateIndex
CREATE INDEX "monitoring_results_websiteId_idx" ON "monitoring_results"("websiteId");

-- CreateIndex
CREATE INDEX "monitoring_results_checkedAt_idx" ON "monitoring_results"("checkedAt");

-- CreateIndex
CREATE INDEX "monitoring_results_isAvailable_idx" ON "monitoring_results"("isAvailable");

-- CreateIndex
CREATE INDEX "Alert_websiteId_idx" ON "Alert"("websiteId");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_type_idx" ON "Alert"("type");

-- CreateIndex
CREATE INDEX "Alert_incidentId_idx" ON "Alert"("incidentId");

-- CreateIndex
CREATE INDEX "Incident_websiteId_idx" ON "Incident"("websiteId");

-- CreateIndex
CREATE INDEX "Incident_startTime_idx" ON "Incident"("startTime");

-- CreateIndex
CREATE INDEX "Incident_endTime_idx" ON "Incident"("endTime");

-- CreateIndex
CREATE INDEX "Incident_type_idx" ON "Incident"("type");

-- CreateIndex
CREATE INDEX "Incident_initialResultId_idx" ON "Incident"("initialResultId");

-- CreateIndex
CREATE INDEX "Incident_confirmingResultId_idx" ON "Incident"("confirmingResultId");

-- CreateIndex
CREATE INDEX "Incident_resolvingResultId_idx" ON "Incident"("resolvingResultId");

-- AddForeignKey
ALTER TABLE "website_users" ADD CONSTRAINT "website_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_users" ADD CONSTRAINT "website_users_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitoring_results" ADD CONSTRAINT "monitoring_results_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_initialResultId_fkey" FOREIGN KEY ("initialResultId") REFERENCES "monitoring_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_confirmingResultId_fkey" FOREIGN KEY ("confirmingResultId") REFERENCES "monitoring_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_resolvingResultId_fkey" FOREIGN KEY ("resolvingResultId") REFERENCES "monitoring_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;
