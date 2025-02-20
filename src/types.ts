export type Result<T> =
  | { data: T; error: null }
  | {
      data: null;
      error: { msg: string; data?: Object };
    };

export type POLITEData = {
  school?: typeof import("./db").school.$inferInsert;
  user?: typeof import("./db").user.$inferInsert;
  semesters?: typeof import("./db").semester.$inferInsert[];
  modules?: typeof import("./db").module.$inferInsert[];
};
