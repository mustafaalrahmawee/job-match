-- pgvector für die Vektorsuche im Stellen-Pool (Stufe 7). Schon im Fundament, damit jede
-- Umgebung (lokal, CI, Hosting) früh zeigt, ob die Erweiterung verfügbar ist.
CREATE EXTENSION IF NOT EXISTS vector;
