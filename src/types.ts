export type Result<T> =
  | { data: T; error: null }
  | {
      data: null;
      error: { msg: string; data?: Object };
    };
