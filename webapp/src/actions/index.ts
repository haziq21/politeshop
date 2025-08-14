import { registerSourceCredentials } from "./auth";
import { setDefaultSemesterFilter } from "./defaults";
import { syncData } from "./sync";

export const server = {
  getPOLITEShopJWT: registerSourceCredentials,
  setDefaultSemesterFilter,
  syncData,
};
