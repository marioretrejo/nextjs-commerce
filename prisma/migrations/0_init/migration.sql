-- CreateTable
CREATE TABLE "ftds" (
    "id" SERIAL NOT NULL,
    "providerSource" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'FTD',
    "businessName" TEXT NOT NULL,
    "registrationDate" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "rawCampaignName" TEXT NOT NULL,
    "campaignBase" TEXT NOT NULL,
    "campaignVariant" TEXT,
    "country" TEXT NOT NULL,
    "finalReferenceName" TEXT,
    "isSameDay" BOOLEAN NOT NULL DEFAULT false,
    "isDelayedFtd" BOOLEAN NOT NULL DEFAULT false,
    "rawMessage" TEXT NOT NULL,
    "dedupeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ftds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_leads" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "campaignBase" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "leads" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_metrics" (
    "id" SERIAL NOT NULL,
    "campaignBase" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "totalFtds" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reached2Percent" BOOLEAN NOT NULL DEFAULT false,
    "topRank" INTEGER,
    "qualifiedForTop" BOOLEAN NOT NULL DEFAULT false,
    "triggerStatus" TEXT NOT NULL DEFAULT 'do_not_fire',
    "triggerReason" TEXT,
    "crmRecommendation" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rank_snapshots" (
    "id" SERIAL NOT NULL,
    "campaignBase" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "rank" INTEGER NOT NULL,
    "conversionRate" DOUBLE PRECISION NOT NULL,
    "totalFtds" INTEGER NOT NULL,
    "totalLeads" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rank_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" SERIAL NOT NULL,
    "campaignBase" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "conversionRate" DOUBLE PRECISION NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "details" TEXT,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_actions" (
    "id" SERIAL NOT NULL,
    "campaignBase" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "reason" TEXT,
    "sourceMetricId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" SERIAL NOT NULL,
    "weeklyThresholdPercent" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "monthlyThresholdPercent" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "weeklyMinLeadsForTop" INTEGER NOT NULL DEFAULT 20,
    "monthlyMinLeadsForTop" INTEGER NOT NULL DEFAULT 40,
    "weeklyMinLeadsForTrigger" INTEGER NOT NULL DEFAULT 20,
    "monthlyMinLeadsForTrigger" INTEGER NOT NULL DEFAULT 40,
    "weekStartDay" INTEGER NOT NULL DEFAULT 1,
    "weekEndDay" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ftds_dedupeHash_key" ON "ftds"("dedupeHash");
CREATE INDEX "ftds_campaignBase_country_idx" ON "ftds"("campaignBase", "country");
CREATE INDEX "ftds_registrationDate_idx" ON "ftds"("registrationDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_leads_date_campaignBase_country_key" ON "daily_leads"("date", "campaignBase", "country");
CREATE INDEX "daily_leads_campaignBase_country_idx" ON "daily_leads"("campaignBase", "country");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_metrics_campaignBase_country_periodType_periodStart_key" ON "campaign_metrics"("campaignBase", "country", "periodType", "periodStart");
CREATE INDEX "campaign_metrics_campaignBase_country_idx" ON "campaign_metrics"("campaignBase", "country");

-- CreateIndex
CREATE UNIQUE INDEX "rank_snapshots_campaignBase_country_periodType_periodStart_key" ON "rank_snapshots"("campaignBase", "country", "periodType", "periodStart");
CREATE INDEX "rank_snapshots_campaignBase_country_idx" ON "rank_snapshots"("campaignBase", "country");
CREATE INDEX "rank_snapshots_periodType_periodStart_idx" ON "rank_snapshots"("periodType", "periodStart");

-- CreateIndex
CREATE INDEX "alerts_campaignBase_country_idx" ON "alerts"("campaignBase", "country");
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "crm_actions_campaignBase_country_idx" ON "crm_actions"("campaignBase", "country");
CREATE INDEX "crm_actions_status_idx" ON "crm_actions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
