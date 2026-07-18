-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "emailDomain" TEXT NOT NULL,
    "annualRevenue" INTEGER NOT NULL,
    "customerTier" INTEGER NOT NULL,
    "accountOwnerId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "creatorEmail" TEXT NOT NULL,
    "attendees" TEXT NOT NULL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "employeeEmail" TEXT NOT NULL,
    "employeeName" TEXT,
    "category" TEXT NOT NULL,
    "companyId" TEXT,
    "companyName" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "rawAiResponse" TEXT,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_emailDomain_key" ON "Company"("emailDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventId_employeeEmail_key" ON "ProcessedEvent"("eventId", "employeeEmail");
