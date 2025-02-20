import type { SirenEntity, SirenLink } from "./schema";

export function getLinkWithRel(rel: string | string[], entity: SirenEntity): SirenLink | undefined {
  if (typeof rel === "string") return entity.links?.find(({ rel: r }) => r.includes(rel));
  return entity.links?.find(({ rel: r }) => r.length === rel.length && r.every((v, i) => v === rel[i]));
}

export function lastPathComponent(url: string): string {
  return new URL(url).pathname.split("/").at(-1)!;
}
