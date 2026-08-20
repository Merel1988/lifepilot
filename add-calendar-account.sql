-- Migratie: tabel voor agenda-accounts die we zelf uitlezen (iCloud via CalDAV)
-- Veilig om meerdere keren te draaien.
-- Uitvoeren met: turso db shell lifepilot < add-calendar-account.sql

CREATE TABLE IF NOT EXISTS "CalendarAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'ICLOUD',
    "username" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'PRIVE',
    "color" TEXT NOT NULL DEFAULT '#6d28d9',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "selected" TEXT,
    "lastSyncAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
