UPDATE "jobs" SET "offer_type" = CASE "raw"->>'stellenangebotsart'
  WHEN 'ARBEIT' THEN 'job'
  WHEN 'AUSBILDUNG' THEN 'apprenticeship'
  WHEN 'PRAKTIKUM_TRAINEE' THEN 'internship'
  WHEN 'SELBSTAENDIGKEIT' THEN 'self_employed'
END
WHERE "source" = 'ba';
