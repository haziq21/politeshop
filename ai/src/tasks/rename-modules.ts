import dedent from "dedent";
import { z } from "zod";

import type { Provider } from "../providers/types.ts";

import { chunk } from "../utils.ts";

export type RenameModulesInput = { name: string; code: string }[];
export type RenameModulesOutput = { niceName: string; niceCode: string | null }[];

const responseSchema = z
  .object({
    items: z.array(
      z
        .object({
          niceName: z.string(),
          niceCode: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

const systemPrompt = dedent`
  You will receive an array of module \`name\`s and \`code\`s from Polytechnics in Singapore.
  Clean the text and output a corresponding array of \`niceName\`s and \`niceCode\`s.
  The modules in your output should follow the same order as the input.

  <step name="Transforming \`name\` into \`niceName\`">
    1. Convert \`name\` to Title Case, unless it is more appropriate to case specific phrases otherwise (camelCase for "DevOps", "IoT", etc., all-caps for acronyms like "IT", "NP", "SP", etc.).
    2. Remove module codes already in \`code\`, archival indicators and non-human-readable IDs. Preserve other human-readable information, if present.

    For Title Casing, leave articles, conjunctions and prepositions in lowercase, unless:
    - They are the first or last word of the \`niceName\`.
    - They come directly after a ":" or "(".
  </step>

  <step name="Transforming \`code\` into \`niceCode\`">
    A \`code\` part (substring of \`code\`) is meaningful only if it abbreviates or describes the human-readable content of \`name\`.
    This necessitates that the \`code\` part itself is human-readable.
    Numeric/alphanumeric IDs (not human-readable) and uncommon, unexplained acronyms are not meaningful.

    If there are absolutely no meaningful \`code\` parts, set \`niceCode\` to null. Otherwise,
    1. Remove all non-meaningful \`code\` parts that do not meaningfully map to \`name\`, e.g. metadata, unexplained numbers or letters, etc.
    2. Remove all year/semester information ("24S1-", "EVER", etc).

    Contextually common acronyms include but are not limited to: ICT, IT, SDO (Student Development Office), SOC (School of Computing), SP (Singapore Polytechnic), NP (Ngee Ann Polytechnic).

    \`niceCode\` must not include text derived from \`name\`, only \`code\`.
  </step>

  <example>
    <input>{"name": "Service-Learning Toolkit", "code": "SD MESL101 EVER"}</input>
    <output>{"niceName": "Service-Learning Toolkit", "niceCode": "SL101"}</output>
    <explanation>
      "SL" in "MESL101" from \`code\` stands for "Service-Learning" from \`name\`.
      "ME" is an unexplained prefix of "MESL101", so it is not meaningful.
      "101" is a common suffix for introductory modules, so it is meaningful.
    </explanation>
  </example>

  <example>
    <input>{"name": "Digital Life @ Polys: Digital & Media Literacy, Cyber Wellness, Anti-Plagiarism, Copyright, Campus Wellness (ICT Apr)", "code": "24S1 LIB 23DIGITALLIFE ICT"}</input>
    <output>{"niceName": "Digital Life @ Polys: Digital & Media Literacy, Cyber Wellness, Anti-Plagiarism, Copyright, Campus Wellness (ICT Apr)", "niceCode": "DIGITALLIFE ICT"}</output>
    <explanation>
      "DIGITALLIFE" in \`code\` abbreviates "Digital Life" from \`name\`.
      The "23" prefix of "DIGITALLIFE"  in \`code\` is an unexplained number, so it is not meaningful.
      "ICT" in \`code\` is also reflected in \`name\`, and it is a well-known acronym, so it is considered meaningful.
      Because "ICT" in \`name\` is a well-known acronym and not a repeated module code, it is also preserved in \`niceName\`.
    </explanation>
  </example>

  <example>
    <input>{"name": "z_[Archived - 24S1] Interactive Development / Front End Development(1_ID_009807 / 3_FED_013851)", "code": "24S2 1 ID 009807"}</input>
    <output>{"niceName": "Interactive Development / Front End Development", "niceCode": "ID"}</output>
    <explanation>
      "ID" in \`code\` stands for "Interactive Development" from \`name\`.
      "FED" also appears as an acronym in \`name\`, but it is not present in \`code\`, so it is not included in \`niceCode\`.
      "z_[Archived - 24S1]" in \`name\` is an archival indicator, so it is removed.
    </explanation>
  </example>

  <example>
    <input>{"name": "SECURE CODING (Project)", "code": "ST0527 2510"}</input>
    <output>{"niceName": "Secure Coding (Project)", "niceCode": null}</output>
    <explanation>Neither "ST0527" nor "2510" from \`code\` are reflected in \`name\`, so \`niceCode\` is set to null.</explanation>
  </example>

  <example>
    <input>{"name": "CCC_EWW : EFFECTIVE WRITING FOR THE WORKPLACE", "code": "CCC EWW 2510"}</input>
    <output>{"niceName": "Effective Writing for the Workplace", "niceCode": "EWW"}</output>
    <explanation>
      "EWW" in \`code\` stands for "EFFECTIVE WRITING FOR THE WORKPLACE" from \`name\`.
      "CCC" in \`code\` also appears in \`name\`, but there is no meaningful expansion for it, so "CCC" is not included in \`niceCode\`.
      "CCC_EWW" is removed from \`name\` since it is a repeat of the module code.
      "for the" in \`name\` is lowercased as they are both prepositions.
    </explanation>
  </example>
`;

export const renameModules = async (provider: Provider, modules: RenameModulesInput): Promise<RenameModulesOutput> => {
  const batches = chunk(modules, 20);

  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const { items } = await provider.send({
        systemPrompt,
        userMessage: JSON.stringify(batch.map((m) => ({ name: m.name, code: m.code.replaceAll(/[-_]/g, " ") }))),
        schema: responseSchema,
      });

      return items;
    }),
  );

  return batchResults.flat();
};
