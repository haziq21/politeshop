import { z } from "zod";

export const brightspaceJWTBody = z.object({ tenantid: z.string(), sub: z.string() });

// API responses

export const whoamiRes = z.object({
  Identifier: z.string(),
  FirstName: z.string(),
  LastName: z.string(),
  /** Email address of the user. */
  UniqueName: z.string(),
  ProfileIdentifier: z.string(),
});

// Siren

export type SirenEntity = {
  class: string[];
  actions?: {
    href: string;
    method: string;
    name: string;
    fields: { name: string; type: string; value?: any; title?: string }[];
    class?: string[];
    title?: string;
    type?: string;
  }[];
  entities?: SirenEntity[];
  links?: SirenLink[];
  properties?: Record<string, any>;
  href?: string;
};

export type SirenLink = { rel: string[]; href: string };

export const sirenEntity: z.ZodType<SirenEntity> = z.lazy(() =>
  z.object({
    actions: z
      .object({
        href: z.string(),
        method: z.string(),
        name: z.string(),
        fields: z.object({ name: z.string(), type: z.string(), value: z.any(), title: z.string().optional() }).array(),
        class: z.string().array().optional(),
        title: z.string().optional(),
        type: z.string().optional(),
      })
      .array()
      .optional(),
    entities: sirenEntity.array().optional(),
    links: z.object({ rel: z.string().array(), href: z.string() }).array().optional(),
    properties: z.record(z.string(), z.any()).optional(),
    class: z.string().array(),
    href: z.string().optional(),
  })
);
