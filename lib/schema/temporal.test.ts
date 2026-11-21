import { expect, test } from "vite-plus/test";

import { instant } from "./temporal";

test("instant rejects a string that isn't a timestamp, naming it in the error", () => {
  const result = instant.safeParse("next week");

  expect(result.error?.issues[0]?.message).toBe("Invalid timestamp: next week");
});
