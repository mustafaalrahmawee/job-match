import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export type OfferType = 'job' | 'apprenticeship' | 'internship' | 'self_employed';

export const jobs = pgTable(
  'jobs',
  {
    id: uuid().primaryKey().defaultRandom(),
    source: text().$type<'ba'>().notNull(),
    externalId: text().notNull(),
    offerType: text().$type<OfferType>(),
    title: text().notNull(),
    company: text().notNull(),
    occupation: text(),
    description: text().notNull(),
    city: text(),
    region: text(),
    postalCode: text(),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    fullTime: boolean(),
    partTime: boolean(),
    remote: boolean(),
    permanent: boolean(),
    salaryMinYear: integer(),
    salaryMaxYear: integer(),
    agency: boolean(),
    url: text().notNull(),
    publishedAt: date().notNull(),
    raw: jsonb().notNull(),
    importedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('jobs_source_external_id_unique').on(table.source, table.externalId),
    uniqueIndex('jobs_company_description_unique').on(
      table.company,
      sql`md5(${table.description})`,
    ),
  ],
);
