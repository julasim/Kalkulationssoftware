-- Phase 2b: Vereinheitlichte Kalkulationszeile löst die 5 typisierten Zeilentabellen ab.
-- Reset (nur Testdaten): alte Zeilen verwerfen, Ergebnisfelder der Kalkulation zurücksetzen.
-- Enum "BetriebsmittelArt" existiert bereits (Phase 2a) und wird NICHT neu angelegt.

-- DropTable (alte Zeilentabellen)
DROP TABLE "KalkulationLohn";
DROP TABLE "KalkulationMaterial";
DROP TABLE "KalkulationGeraet";
DROP TABLE "KalkulationNU";
DROP TABLE "KalkulationSonstige";

-- Ergebnisse zurücksetzen (Zeilen sind weg → neu kalkulieren)
UPDATE "Kalkulation" SET "einheitspreis" = NULL, "gesamtpreis" = NULL;

-- CreateTable
CREATE TABLE "Kalkulationszeile" (
    "id" TEXT NOT NULL,
    "art" "BetriebsmittelArt" NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "einheit" TEXT NOT NULL DEFAULT '',
    "menge" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "einzelpreis" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "aufschlag" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "reihenfolge" INTEGER NOT NULL DEFAULT 0,
    "betriebsmittelId" TEXT,
    "kalkulationId" TEXT NOT NULL,
    CONSTRAINT "Kalkulationszeile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Kalkulationszeile_kalkulationId_idx" ON "Kalkulationszeile"("kalkulationId");
CREATE INDEX "Kalkulationszeile_betriebsmittelId_idx" ON "Kalkulationszeile"("betriebsmittelId");

-- AddForeignKey
ALTER TABLE "Kalkulationszeile" ADD CONSTRAINT "Kalkulationszeile_betriebsmittelId_fkey"
    FOREIGN KEY ("betriebsmittelId") REFERENCES "Betriebsmittel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Kalkulationszeile" ADD CONSTRAINT "Kalkulationszeile_kalkulationId_fkey"
    FOREIGN KEY ("kalkulationId") REFERENCES "Kalkulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
