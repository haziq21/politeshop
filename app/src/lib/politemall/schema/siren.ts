import { z } from "zod";

export type SirenEntity = {
  class: (string | null | undefined)[];
  rel?: string[];
  actions?: SirenAction[];
  entities?: SirenEntity[];
  links?: SirenLink[];
  properties?: Record<string, any>;
  href?: string;
};

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

export const sirenEntity: z.ZodType<SirenEntity> = z.lazy(() =>
  z.object({
    actions: z
      .object({
        href: z.string(),
        method: z.string(),
        name: z.string(),
        fields: z
          .object({ name: z.string(), type: z.string(), value: z.any(), title: z.string().optional() })
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
      .object({ class: z.string().array().optional(), rel: z.string().array(), href: z.string() })
      .array()
      .optional(),
    rel: z.string().array().optional(),
    properties: z.record(z.string(), z.any()).optional(),
    class: z.string().nullable().array(),
    href: z.string().optional(),
  })
);
