-- CreateTable
CREATE TABLE "ftds" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "providerSource" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'FTD',
    "businessName" TEXT NOT NULL,
    "registrationDate" DATETIME NOT NULL,
    "customerName" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "rawCampaignName" TEXT NOT NULL,
    "campaignBase" TEXT NOT NULL,
    "campaignVariant" TEXT,
    "country" TEXT NOT NULL,
    "finalReferenceName" TEXT,
    "isSameDay" BOOLEAN NOT NULL DEFAULT false,
    "isDelayedFtd" BOOLEAN NOT NULL DEFAULT false,
    "rawMessage" TEXT NOT NULL,
    "dedupeHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "daily_leads" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "campaignBase" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "leads" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "campaign_metrics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignBase" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "totalFtds" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" REAL NOT NULL DEFAULT 0,
    "reached2Percent" BOOLEAN NOT NULL DEFAULT false,
    "topRank" INTEGER,
    "qualifiedForTop" BOOLEAN NOT NULL DEFAULT false,
    "triggerStatus" TEXT NOT NULL DEFAULT 'do_not_fire',
    "triggerReason" TEXT,
    "crmRecommendation" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignBase" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "conversionRate" REAL NOT NULL,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "details" TEXT
);

-- CreateTable
CREATE TABLE "crm_actions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignBase" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "reason" TEXT,
    "sourceMetricId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weeklyThresholdPercent" REAL NOT NULL DEFAULT 2.0,
    "monthlyThresholdPercent" REAL NOT NULL DEFAULT 2.0,
    "weeklyMinLeadsForTop" INTEGER NOT NULL DEFAULT 20,
    "monthlyMinLeadsForTop" INTEGER NOT NULL DEFAULT 40,
    "weeklyMinLeadsForTrigger" INTEGER NOT NULL DEFAULT 20,
    "monthlyMinLeadsForTrigger" INTEGER NOT NULL DEFAULT 40,
    "weekStartDay" INTEGER NOT NULL DEFAULT 1,
    "weekEndDay" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ftds_dedupeHash_key" ON "ftds"("dedupeHash");

-- CreateIndex
CREATE INDEX "ftds_campaignBase_country_idx" ON "ftds"("campaignBase", "country");

-- CreateIndex
CREATE INDEX "ftds_registrationDate_idx" ON "ftds"("registrationDate");

-- CreateIndex
CREATE INDEX "daily_leads_campaignBase_country_idx" ON "daily_leads"("campaignBase", "country");

-- CreateIndex
CREATE UNIQUE INDEX "daily_leads_date_campaignBase_country_key" ON "daily_leads"("date", "campaignBase", "country");

-- CreateIndex
CREATE INDEX "campaign_metrics_campaignBase_country_idx" ON "campaign_metrics"("campaignBase", "country");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_metrics_campaignBase_country_periodType_periodStart_key" ON "campaign_metrics"("campaignBase", "country", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "alerts_campaignBase_country_idx" ON "alerts"("campaignBase", "country");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "crm_actions_campaignBase_country_idx" ON "crm_actions"("campaignBase", "country");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
