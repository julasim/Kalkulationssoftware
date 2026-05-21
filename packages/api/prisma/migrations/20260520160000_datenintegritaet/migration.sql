-- Phase 3.1: Daten-Integrität — Angebot-Kaskade + fehlende FK-Indizes. Rein additiv.

-- Angebot → LV: Löschen kaskadiert. Ein Angebot ist ein eigenständiger Snapshot
-- (snapshotJson); RESTRICT blockierte sonst die Projekt-/LV-Löschung und führte
-- zu einer irreführenden 404-Antwort.
ALTER TABLE "Angebot" DROP CONSTRAINT "Angebot_lvId_fkey";
ALTER TABLE "Angebot" ADD CONSTRAINT "Angebot_lvId_fkey"
  FOREIGN KEY ("lvId") REFERENCES "LV"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fehlende Fremdschlüssel-Indizes (PostgreSQL legt diese nicht automatisch an).
CREATE INDEX "Projekt_userId_idx" ON "Projekt"("userId");
CREATE INDEX "LV_projektId_idx" ON "LV"("projektId");
CREATE INDEX "LVTitel_lvId_idx" ON "LVTitel"("lvId");
CREATE INDEX "LVTitel_parentId_idx" ON "LVTitel"("parentId");
CREATE INDEX "Position_titelId_idx" ON "Position"("titelId");
CREATE INDEX "Position_katalogPosId_idx" ON "Position"("katalogPosId");
CREATE INDEX "Angebot_lvId_idx" ON "Angebot"("lvId");
CREATE INDEX "ImportJob_leistungsbuchId_idx" ON "ImportJob"("leistungsbuchId");
