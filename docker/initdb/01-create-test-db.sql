-- Eigene Datenbank für Repository-Tests, damit Tests nie Entwicklungsdaten anfassen.
-- Postgres führt Skripte in /docker-entrypoint-initdb.d nur beim ersten Start mit leerem Volume aus;
-- bei einem bestehenden Volume: `docker compose exec db createdb -U jobmatch jobmatch_test`.
CREATE DATABASE jobmatch_test;
