import { expect, test } from "vite-plus/test";

import { sirenEntity } from "./siren";

const entity = sirenEntity.parse({
  class: ["activity"],
  entities: [
    { class: ["file-activity", "file"], properties: { name: "slides.pptx" } },
    { class: ["thumbnail"], rel: ["item", "icon"], properties: { src: "https://example.com/t.png" } },
  ],
  links: [
    { class: ["pdf", "d2l-converted-doc"], rel: ["alternate"], href: "https://example.com/preview.pdf" },
    { rel: ["self"], href: "https://example.com/self" },
  ],
  actions: [{ name: "submit", href: "https://example.com/submit", method: "POST" }],
});

test("a string class query matches any entity containing that class", () => {
  expect(entity.findChild({ class: "file" })?.properties?.name).toBe("slides.pptx");
});

test("an array class query must match the whole class list in order", () => {
  expect(entity.findChild({ class: ["file-activity", "file"] })).toBeDefined();
  expect(entity.findChild({ class: ["file-activity"] })).toBeUndefined();
  expect(entity.findChild({ class: ["file", "file-activity"] })).toBeUndefined();
});

test("rel queries work for children and links", () => {
  expect(entity.findChild({ rel: "icon" })?.properties?.src).toBe("https://example.com/t.png");
  expect(entity.findChild({ rel: ["item", "icon"] })).toBeDefined();
  expect(entity.findLink({ rel: "self" })?.href).toBe("https://example.com/self");
});

test("findLink matches on class", () => {
  expect(entity.findLink({ class: "pdf" })?.href).toBe("https://example.com/preview.pdf");
  expect(entity.findLink({ class: ["pdf", "d2l-converted-doc"] })).toBeDefined();
  expect(entity.findLink({ class: ["pdf"] })).toBeUndefined();
});

test("the get* variants throw when nothing matches", () => {
  expect(() => entity.getChild({ class: "missing" })).toThrow("No child entity found");
  expect(() => entity.getLink({ rel: "missing" })).toThrow("No link found");
  expect(() => entity.getAction({ name: "missing" })).toThrow('No action found with name: "missing"');
  expect(entity.getAction({ name: "submit" }).method).toBe("POST");
});
