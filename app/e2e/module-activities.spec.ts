import type { AnyActivity } from "@politeshop/lib";
import type { Mw } from "mockwright";

import type { createMockData } from "./data";

import { mockwright } from "../src/lib/server/mockwright";
import { expect, test } from "./fixtures";

type Seeded = ReturnType<typeof createMockData>;

const id = () => crypto.randomUUID();

// Folders and topics share one sortOrder sequence: "Readings" sits between two topics
function createActivities({ dropboxes, quizzes }: Seeded) {
  const week1 = id();
  const readings = id();
  const week2 = id();

  return [
    { type: "folder", id: week1, name: "Week 1", description: "<p>Start here</p>", sortOrder: 0, parentId: null },
    { id: id(), type: "html", name: "Introduction", content: "<p>Hello</p>", sortOrder: 0, parentId: week1 },
    { type: "folder", id: readings, name: "Readings", description: "", sortOrder: 1, parentId: week1 },
    {
      id: id(),
      type: "web_embed",
      name: "Reference site",
      url: "https://example.com",
      sortOrder: 0,
      parentId: readings,
    },
    { id: id(), type: "quiz", name: quizzes[0]!.name, quizId: quizzes[0]!.id, sortOrder: 2, parentId: week1 },
    { type: "folder", id: week2, name: "Week 2", description: "", sortOrder: 1, parentId: null },
    { id: id(), type: "submission", name: "Report A", dropboxId: dropboxes[0]!.id, sortOrder: 0, parentId: week2 },
  ] satisfies AnyActivity[];
}

async function mockModule(mw: Mw<typeof mockwright>, data: Seeded) {
  await mw("pl.getModuleActivities").mockResolvedValue(createActivities(data));
  await mw("pl.getQuizzes").mockResolvedValue(data.quizzes.map((q) => ({ ...q, description: "" })));
  await mw("pl.getSubmissionDropboxes").mockResolvedValue(data.dropboxes.map((d) => ({ ...d, description: "" })));
  await mw("pl.getSubmissions").mockResolvedValue([]);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
});

test("syncing a module shows nested folders in the sidebar", async ({ mw, page, seededUser }) => {
  await mockModule(mw, seededUser);

  await page.goto(`/d2l/home/${seededUser.module.id}`);
  const app = page.frameLocator("iframe");

  await app.getByRole("button", { name: "Week 1" }).click();
  await expect(app.getByRole("link", { name: "🧑‍🏫 Introduction", exact: true })).toBeVisible();
  await app.getByRole("button", { name: "Readings" }).click();
  await expect(app.getByRole("link", { name: "Reference site" })).toBeVisible();
  await expect(app.getByRole("link", { name: "Quiz B" })).toBeVisible();
});

test("the stored activities render when a fresh sync fails", async ({ mw, page, seededUser }) => {
  await mockModule(mw, seededUser);
  await page.goto(`/d2l/home/${seededUser.module.id}`);
  const app = page.frameLocator("iframe");
  await expect(app.getByRole("button", { name: "Week 1" })).toBeVisible();
  await expect(app.getByRole("button", { name: "Week 2" })).toBeVisible();

  await mw("pl.getModuleActivities").mockRejectedValue(new Error("offline"));
  await page.reload();

  await expect(app.getByRole("button", { name: "Week 1" })).toBeVisible();
  await expect(app.getByRole("button", { name: "Week 2" })).toBeVisible();
});
