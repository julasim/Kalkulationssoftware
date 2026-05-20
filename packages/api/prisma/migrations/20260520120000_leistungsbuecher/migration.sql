-- Leistungsbücher: mehrere Quellen verwalten + Import-Jobs.
-- Verlustfreier Backfill bestehender KatalogPositionen (eine Quelle je distinct quelle/lbNummer).

-- CreateEnum
CREATE TYPE "LeistungsbuchTyp" AS ENUM ('oenorm', 'eigen');
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'running', 'done', 'error');

-- CreateTable Leistungsbuch
CREATE TABLE "Leistungsbuch" (
    "id" TEXT NOT NULL,
    "kennung" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "versionsnummer" TEXT NOT NULL,
    "versionsdatum" TIMESTAMP(3),
    "herausgeber" TEXT,
    "typ" "LeistungsbuchTyp" NOT NULL DEFAULT 'oenorm',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "dateiname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Leistungsbuch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Leistungsbuch_kennung_versionsnummer_key" ON "Leistungsbuch"("kennung", "versionsnummer");

-- CreateTable ImportJob
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "leistungsbuchId" TEXT,
    "dateiname" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'pending',
    "processed" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- Backfill: ein Leistungsbuch je distinct (quelle, lbNummer) der bestehenden Positionen.
-- kennung = quelle ohne "LB-"; versionsnummer = Teil nach dem Leerzeichen in lbNummer ("LB-HB 23" -> "23").
INSERT INTO "Leistungsbuch" ("id", "kennung", "bezeichnung", "versionsnummer", "typ", "aktiv", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text || k."quelle" || k."lbNummer"),
    regexp_replace(k."quelle", '^LB-', ''),
    k."quelle",
    split_part(k."lbNummer", ' ', 2),
    'oenorm',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "quelle", "lbNummer" FROM "KatalogPosition") k;

-- KatalogPosition: leistungsbuchId zuerst nullable, dann backfillen.
ALTER TABLE "KatalogPosition" ADD COLUMN "leistungsbuchId" TEXT;

UPDATE "KatalogPosition" kp
SET "leistungsbuchId" = lb."id"
FROM "Leistungsbuch" lb
WHERE lb."kennung" = regexp_replace(kp."quelle", '^LB-', '')
  AND lb."versionsnummer" = split_part(kp."lbNummer", ' ', 2);

-- Erst nach erfolgtem Backfill: NOT NULL erzwingen.
ALTER TABLE "KatalogPosition" ALTER COLUMN "leistungsbuchId" SET NOT NULL;

-- Unique von (quelle,posNummer) auf (leistungsbuchId,posNummer) umstellen.
DROP INDEX "KatalogPosition_quelle_posNummer_key";
CREATE UNIQUE INDEX "KatalogPosition_leistungsbuchId_posNummer_key" ON "KatalogPosition"("leistungsbuchId", "posNummer");

-- Foreign Keys
ALTER TABLE "KatalogPosition" ADD CONSTRAINT "KatalogPosition_leistungsbuchId_fkey"
    FOREIGN KEY ("leistungsbuchId") REFERENCES "Leistungsbuch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_leistungsbuchId_fkey"
    FOREIGN KEY ("leistungsbuchId") REFERENCES "Leistungsbuch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
