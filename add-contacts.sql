-- Migratie: contacttabel toevoegen
-- Veilig om meerdere keren te draaien.
-- Uitvoeren met: turso db shell lifepilot < add-contacts.sql

CREATE TABLE IF NOT EXISTS "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "birthDay" INTEGER,
    "birthMonth" INTEGER,
    "birthYear" INTEGER,
    "notes" TEXT,
    "keepInTouchWeeks" INTEGER,
    "lastContactAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Contact_birthMonth_birthDay_idx"
    ON "Contact"("birthMonth", "birthDay");
