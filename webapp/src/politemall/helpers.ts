import { arrEq } from "../helpers";
import type { SirenEntity, SirenLink } from "./schema";

export function getLinkWithRel(rel: string | string[], entity: SirenEntity): SirenLink | undefined {
  if (typeof rel === "string") return entity.links?.find(({ rel: r }) => r.includes(rel));
  return entity.links?.find(({ rel: r }) => arrEq(r, rel));
}

export function lastPathComponent(url: string | URL): string {
  if (typeof url === "string") url = new URL(url);
  return url.pathname.split("/").at(-1)!;
}
