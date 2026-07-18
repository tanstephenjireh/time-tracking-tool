-- CreateTable
CREATE TABLE "SyncSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "lastSyncedAt" DATETIME,
    "eventsProcessed" INTEGER NOT NULL DEFAULT 0,
    "eventsTotal" INTEGER NOT NULL DEFAULT 0
);
