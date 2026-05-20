-- Phase 3: Positions-Kennzeichen. Rein additiv.
ALTER TABLE "Position" ADD COLUMN "entfaellt" BOOLEAN NOT NULL DEFAULT false;
