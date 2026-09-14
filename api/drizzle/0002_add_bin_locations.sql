ALTER TABLE "bins" ADD COLUMN "latitude" real;
--> statement-breakpoint
ALTER TABLE "bins" ADD COLUMN "longitude" real;
--> statement-breakpoint
UPDATE "bins" SET "latitude" = CASE "bin_id"
  WHEN 'BIN-01' THEN -15.408
  WHEN 'BIN-02' THEN -15.412
  WHEN 'BIN-03' THEN -15.419
  WHEN 'BIN-04' THEN -15.424
  ELSE "latitude"
END,
"longitude" = CASE "bin_id"
  WHEN 'BIN-01' THEN 28.283
  WHEN 'BIN-02' THEN 28.290
  WHEN 'BIN-03' THEN 28.278
  WHEN 'BIN-04' THEN 28.287
  ELSE "longitude"
END;
