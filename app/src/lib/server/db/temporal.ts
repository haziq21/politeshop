import { customType } from "drizzle-orm/pg-core";

export const timestamptz = customType<{ data: Temporal.Instant; driverData: string }>({
  dataType: () => "timestamp with time zone",
  toDriver: (value) => value.toString(),
  fromDriver: (value) => Temporal.Instant.from(value),
});

export const date = customType<{ data: Temporal.PlainDate; driverData: string }>({
  dataType: () => "date",
  toDriver: (value) => value.toString(),
  fromDriver: (value) => Temporal.PlainDate.from(value),
});
