import type { POLITELib } from "@politeshop/lib";

import { Mockwright } from "mockwright";

type MockDeps = {
  pl: POLITELib;
};

export const mockwright = new Mockwright<MockDeps>();
