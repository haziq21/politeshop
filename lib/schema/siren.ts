import { z } from "zod";
import { arrEq } from "../utils/array";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SirenLink = { class?: string[]; rel: string[]; href: string };

export type SirenAction = {
  href: string;
  method: string;
  name: string;
  fields?: { name: string; type: string; value?: any; title?: string }[];
  class?: string[];
  title?: string;
  type?: string;
};

// ── SirenEntity class ─────────────────────────────────────────────────────────

export class SirenEntity {
  class: (string | null | undefined)[];
  rel?: string[];
  actions?: SirenAction[];
  entities?: SirenEntity[];
  links?: SirenLink[];
  properties?: Record<string, any>;
  href?: string;

  constructor(data: {
    class: (string | null | undefined)[];
    rel?: string[];
    actions?: SirenAction[];
    entities?: SirenEntity[];
    links?: SirenLink[];
    properties?: Record<string, any>;
    href?: string;
  }) {
    this.class = data.class;
    this.rel = data.rel;
    this.actions = data.actions;
    this.entities = data.entities;
    this.links = data.links;
    this.properties = data.properties;
    this.href = data.href;
  }

  // ── Sub-entity lookup ───────────────────────────────────────────────────────

  findChild(
    query: { class: string | string[] } | { rel: string | string[] },
  ): SirenEntity | undefined {
    if ("class" in query) {
      const cls = query.class;
      if (typeof cls === "string")
        return this.entities?.find(({ class: c }) => c.includes(cls));
      return this.entities?.find(({ class: c }) =>
        arrEq(c as string[], cls as string[]),
      );
    }
    if ("rel" in query) {
      const rel = query.rel;
      if (typeof rel === "string")
        return this.entities?.find(({ rel: r }) => r?.includes(rel));
      return this.entities?.find(
        ({ rel: r }) => r != null && arrEq(r, rel as string[]),
      );
    }
  }

  getChild(
    query: { class: string | string[] } | { rel: string | string[] },
  ): SirenEntity {
    const result = this.findChild(query);
    if (!result)
      throw new Error(
        `No child entity found matching query: ${JSON.stringify(query)}`,
      );
    return result;
  }

  // ── Link lookup ─────────────────────────────────────────────────────────────

  findLink(
    query: { class: string | string[] } | { rel: string | string[] },
  ): SirenLink | undefined {
    if ("class" in query) {
      const cls = query.class;
      if (typeof cls === "string")
        return this.links?.find(({ class: c }) => c?.includes(cls));
      return this.links?.find(
        ({ class: c }) => c != null && arrEq(c, cls as string[]),
      );
    }
    if ("rel" in query) {
      const rel = query.rel;
      if (typeof rel === "string")
        return this.links?.find(({ rel: r }) => r.includes(rel));
      return this.links?.find(({ rel: r }) => arrEq(r, rel as string[]));
    }
  }

  getLink(
    query: { class: string | string[] } | { rel: string | string[] },
  ): SirenLink {
    const result = this.findLink(query);
    if (!result)
      throw new Error(`No link found matching query: ${JSON.stringify(query)}`);
    return result;
  }

  // ── Action lookup ───────────────────────────────────────────────────────────

  findAction(query: { name: string }): SirenAction | undefined {
    return this.actions?.find((a) => a.name === query.name);
  }

  getAction(query: { name: string }): SirenAction {
    const result = this.findAction(query);
    if (!result) throw new Error(`No action found with name: "${query.name}"`);
    return result;
  }
}

// ── Zod schema ────────────────────────────────────────────────────────────────

export const sirenEntity: z.ZodType<SirenEntity, z.ZodTypeDef, unknown> =
  z.lazy(() =>
    z
      .object({
        actions: z
          .object({
            href: z.string(),
            method: z.string(),
            name: z.string(),
            fields: z
              .object({
                name: z.string(),
                type: z.string(),
                value: z.any(),
                title: z.string().optional(),
              })
              .array()
              .optional(),
            class: z.string().array().optional(),
            title: z.string().optional(),
            type: z.string().optional(),
          })
          .array()
          .optional(),
        entities: sirenEntity.array().optional(),
        links: z
          .object({
            class: z.string().array().optional(),
            rel: z.string().array(),
            href: z.string(),
          })
          .array()
          .optional(),
        rel: z.string().array().optional(),
        properties: z.record(z.string(), z.any()).optional(),
        class: z.string().nullable().array(),
        href: z.string().optional(),
      })
      .transform((data) => new SirenEntity(data)),
  );
