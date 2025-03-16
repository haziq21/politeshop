import { arrEq } from "../helpers";
import type { SirenAction, SirenEntity, SirenLink } from "./schema";

export function getLinkWithRel(rel: string | string[], entity: SirenEntity): SirenLink | undefined {
  if (typeof rel === "string") return entity.links?.find(({ rel: r }) => r.includes(rel));
  return entity.links?.find(({ rel: r }) => arrEq(r, rel));
}

export function getLinkWithClass(cls: string | string[], entity: SirenEntity): SirenLink | undefined {
  if (typeof cls === "string") return entity.links?.find(({ class: c }) => c?.includes(cls));
  return entity.links?.find(({ class: c }) => c && arrEq(c, cls));
}

export function getSubEntWithRel(rel: string | string[], entity: SirenEntity): SirenEntity | undefined {
  if (typeof rel === "string") return entity.entities?.find(({ rel: r }) => r?.includes(rel));
  return entity.entities?.find(({ rel: r }) => r && arrEq(r, rel));
}

export function getSubEntWithClass(cls: string | string[], entity: SirenEntity): SirenEntity | undefined {
  if (typeof cls === "string") return entity.entities?.find(({ class: c }) => c.includes(cls));
  return entity.entities?.find(({ class: c }) => arrEq(c, cls));
}

export function getActionWithName(name: string, entity: SirenEntity): SirenAction | undefined {
  return entity.actions?.find((a) => a.name === name);
}

export function lastPathComponent(url: string | URL): string {
  if (typeof url === "string") url = new URL(url);
  return url.pathname.split("/").at(-1)!;
}
