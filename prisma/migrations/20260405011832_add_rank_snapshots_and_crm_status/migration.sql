-- CreateTable
CREATE TABLE "rank_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignBase" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "rank" INTEGER NOT NULL,
    "conversionRate" REAL NOT NULL,
    "totalFtds" INTEGER NOT NULL,
    "totalLeads" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_crm_actions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignBase" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "reason" TEXT,
    "sourceMetricId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "executedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_crm_actions" ("actionType", "campaignBase", "country", "createdAt", "id", "reason", "sourceMetricId") SELECT "actionType", "campaignBase", "country", "createdAt", "id", "reason", "sourceMetricId" FROM "crm_actions";
DROP TABLE "crm_actions";
ALTER TABLE "new_crm_actions" RENAME TO "crm_actions";
CREATE INDEX "crm_actions_campaignBase_country_idx" ON "crm_actions"("campaignBase", "country");
CREATE INDEX "crm_actions_status_idx" ON "crm_actions"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "rank_snapshots_campaignBase_country_idx" ON "rank_snapshots"("campaignBase", "country");

-- CreateIndex
CREATE INDEX "rank_snapshots_periodType_periodStart_idx" ON "rank_snapshots"("periodType", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "rank_snapshots_campaignBase_country_periodType_periodStart_key" ON "rank_snapshots"("campaignBase", "country", "periodType", "periodStart");
