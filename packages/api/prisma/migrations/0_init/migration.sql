-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "ProjektStatus" AS ENUM ('offen', 'in_arbeit', 'abgeschlossen', 'archiviert');

-- CreateEnum
CREATE TYPE "PositionTyp" AS ENUM ('normal', 'alternativ', 'eventualposition', 'pauschale');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'editor',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Projekt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "status" "ProjektStatus" NOT NULL DEFAULT 'offen',
    "ort" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Projekt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LV" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "bezeichnung" TEXT NOT NULL,
    "notiz" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projektId" TEXT NOT NULL,

    CONSTRAINT "LV_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LVTitel" (
    "id" TEXT NOT NULL,
    "nummer" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "lvId" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "LVTitel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "nummer" TEXT NOT NULL,
    "kurztext" TEXT NOT NULL,
    "langtext" TEXT,
    "menge" DECIMAL(12,3) NOT NULL,
    "einheit" TEXT NOT NULL,
    "typ" "PositionTyp" NOT NULL DEFAULT 'normal',
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "katalogPosId" TEXT,
    "titelId" TEXT NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kalkulation" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agkProzent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "guProzent" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "gewinnProzent" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "einheitspreis" DECIMAL(12,4),
    "gesamtpreis" DECIMAL(14,2),
    "positionId" TEXT NOT NULL,

    CONSTRAINT "Kalkulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KalkulationLohn" (
    "id" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "aufwandswert" DECIMAL(8,3) NOT NULL,
    "stundensatz" DECIMAL(8,2) NOT NULL,
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "kalkulationId" TEXT NOT NULL,

    CONSTRAINT "KalkulationLohn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KalkulationMaterial" (
    "id" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "menge" DECIMAL(10,3) NOT NULL,
    "einheit" TEXT NOT NULL,
    "preis" DECIMAL(10,4) NOT NULL,
    "aufschlag" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "kalkulationId" TEXT NOT NULL,

    CONSTRAINT "KalkulationMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KalkulationGeraet" (
    "id" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "menge" DECIMAL(10,3) NOT NULL,
    "einheit" TEXT NOT NULL,
    "preis" DECIMAL(10,4) NOT NULL,
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "kalkulationId" TEXT NOT NULL,

    CONSTRAINT "KalkulationGeraet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KalkulationNU" (
    "id" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "betrag" DECIMAL(12,2) NOT NULL,
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "kalkulationId" TEXT NOT NULL,

    CONSTRAINT "KalkulationNU_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KalkulationSonstige" (
    "id" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "betrag" DECIMAL(12,2) NOT NULL,
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "kalkulationId" TEXT NOT NULL,

    CONSTRAINT "KalkulationSonstige_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KatalogPosition" (
    "id" TEXT NOT NULL,
    "lbNummer" TEXT NOT NULL,
    "posNummer" TEXT NOT NULL,
    "kurztext" TEXT NOT NULL,
    "langtext" TEXT,
    "grundtextLang" TEXT,
    "einheit" TEXT NOT NULL,
    "quelle" TEXT NOT NULL,
    "tags" TEXT[],
    "lgNr" TEXT,
    "ulgNr" TEXT,
    "gtNr" TEXT,
    "ftNr" TEXT,
    "lgBezeichnung" TEXT,
    "ulgBezeichnung" TEXT,

    CONSTRAINT "KatalogPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Angebot" (
    "id" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotJson" JSONB NOT NULL,
    "summeNetto" DECIMAL(14,2) NOT NULL,
    "summeBrutto" DECIMAL(14,2),
    "mwstProzent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "lvId" TEXT NOT NULL,

    CONSTRAINT "Angebot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Kalkulation_positionId_key" ON "Kalkulation"("positionId");

-- CreateIndex
CREATE INDEX "KatalogPosition_lgNr_ulgNr_idx" ON "KatalogPosition"("lgNr", "ulgNr");

-- CreateIndex
CREATE UNIQUE INDEX "KatalogPosition_quelle_posNummer_key" ON "KatalogPosition"("quelle", "posNummer");

-- AddForeignKey
ALTER TABLE "Projekt" ADD CONSTRAINT "Projekt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LV" ADD CONSTRAINT "LV_projektId_fkey" FOREIGN KEY ("projektId") REFERENCES "Projekt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LVTitel" ADD CONSTRAINT "LVTitel_lvId_fkey" FOREIGN KEY ("lvId") REFERENCES "LV"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LVTitel" ADD CONSTRAINT "LVTitel_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LVTitel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_katalogPosId_fkey" FOREIGN KEY ("katalogPosId") REFERENCES "KatalogPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_titelId_fkey" FOREIGN KEY ("titelId") REFERENCES "LVTitel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kalkulation" ADD CONSTRAINT "Kalkulation_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KalkulationLohn" ADD CONSTRAINT "KalkulationLohn_kalkulationId_fkey" FOREIGN KEY ("kalkulationId") REFERENCES "Kalkulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KalkulationMaterial" ADD CONSTRAINT "KalkulationMaterial_kalkulationId_fkey" FOREIGN KEY ("kalkulationId") REFERENCES "Kalkulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KalkulationGeraet" ADD CONSTRAINT "KalkulationGeraet_kalkulationId_fkey" FOREIGN KEY ("kalkulationId") REFERENCES "Kalkulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KalkulationNU" ADD CONSTRAINT "KalkulationNU_kalkulationId_fkey" FOREIGN KEY ("kalkulationId") REFERENCES "Kalkulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KalkulationSonstige" ADD CONSTRAINT "KalkulationSonstige_kalkulationId_fkey" FOREIGN KEY ("kalkulationId") REFERENCES "Kalkulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Angebot" ADD CONSTRAINT "Angebot_lvId_fkey" FOREIGN KEY ("lvId") REFERENCES "LV"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

