import { getPOLITEShopJWT } from "./auth";
import { setDefaultSemesterFilter } from "./defaults";
import { syncData } from "./sync";

export const server = {
  getPOLITEShopJWT,
  setDefaultSemesterFilter,
  syncData,
};
