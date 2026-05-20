-- Phase 2a: Zentrale Betriebsmittel-Stammdaten + Zuschlagsschema. Rein additiv (kein Backfill).

-- CreateEnum
CREATE TYPE "BetriebsmittelArt" AS ENUM ('lohn', 'material', 'geraet', 'sonstiges', 'nu');

-- CreateTable
CREATE TABLE "Betriebsmittel" (
    "id" TEXT NOT NULL,
    "art" "BetriebsmittelArt" NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "kennung" TEXT,
    "einheit" TEXT NOT NULL,
    "kostenProEinheit" DECIMAL(12,4) NOT NULL,
    "aufschlag" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gruppe" TEXT,
    "notiz" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Betriebsmittel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Betriebsmittel_art_idx" ON "Betriebsmittel"("art");

-- CreateTable
CREATE TABLE "Zuschlagsschema" (
    "id" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "agkProzent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "guProzent" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "gewinnProzent" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "istStandard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Zuschlagsschema_pkey" PRIMARY KEY ("id")
);
