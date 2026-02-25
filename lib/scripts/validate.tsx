import pLimit from "p-limit";
import { useState, useEffect } from "react";
import { render, Box, Text } from "ink";
import { POLITELib } from "../clients/politelib";
import type {
  AnyActivity,
  ActivityFolder,
  User,
  Institution,
  Module,
  Semester,
  SubmissionDropbox,
  Submission,
} from "../types";
import "dotenv/config";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recursively collect all activities from a list of content tree nodes. */
function collectActivities(items: ActivityFolder["contents"]): AnyActivity[] {
  return items.flatMap((item) =>
    item.type === "folder" ? collectActivities(item.contents) : [item],
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function List({ items, max = 5 }: { items: string[]; max?: number }) {
  return (
    <Box flexDirection="column">
      {items.slice(0, max).map((item, i) => (
        <Text key={i}>- {item}</Text>
      ))}
      {items.length > max && <Text> … and {items.length - max} more</Text>}
    </Box>
  );
}

// ── POLITELib client ─────────────────────────────────────────────────────────

const pl = new POLITELib({
  d2lSessionVal: process.env.D2L_SESSION_VAL!,
  d2lSecureSessionVal: process.env.D2L_SECURE_SESSION_VAL!,
  domain: process.env.DOMAIN!,
});

// ── Concurrency ───────────────────────────────────────────────────────────────

/** Shared limiter – at most 8 requests in-flight at once across the whole script. */
const limit = pLimit(8);

// ── Counting helpers ──────────────────────────────────────────────────────────

/**
 * Fetches content for each module ID in parallel.
 * Calls onUpdate with each module's activities as they resolve, enabling live updates.
 */
async function getAllActivitiesBatched({
  moduleIds,
  onUpdate,
}: {
  moduleIds: string[];
  onUpdate: (result: { activities: AnyActivity[] }) => void;
}): Promise<void> {
  await Promise.all(
    moduleIds.map((moduleId) =>
      limit(async () => {
        const content = await pl.getModuleContent({ moduleId });
        onUpdate({
          activities: content.flatMap((folder) =>
            collectActivities(folder.contents),
          ),
        });
      }),
    ),
  );
}

/** Merges a batch of activities into an existing byType count map. */
function mergeActivities(
  byType: Map<AnyActivity["type"], number>,
  activities: AnyActivity[],
): Map<AnyActivity["type"], number> {
  const next = new Map(byType);
  for (const a of activities) next.set(a.type, (next.get(a.type) ?? 0) + 1);
  return next;
}

/**
 * Fetches dropboxes for each module ID in parallel.
 * Calls onUpdate with each module's ID and dropboxes as they resolve.
 */
async function getAllDropboxesBatched({
  moduleIds,
  onUpdate,
}: {
  moduleIds: string[];
  onUpdate: (result: {
    moduleId: string;
    dropboxes: SubmissionDropbox[];
  }) => void;
}): Promise<void> {
  await Promise.all(
    moduleIds.map((moduleId) =>
      limit(async () => {
        const dropboxes = await pl.getSubmissionDropboxes({ moduleId });
        onUpdate({ moduleId, dropboxes });
      }),
    ),
  );
}

/**
 * Fetches submissions for each dropbox in a single module in parallel.
 * Calls onUpdate with each dropbox's submissions as they resolve.
 */
async function getModuleSubmissionsBatched({
  moduleId,
  dropboxIds,
  organizationId,
  onUpdate,
}: {
  moduleId: string;
  dropboxIds: string[];
  organizationId?: string;
  onUpdate: (result: { submissions: Submission[] }) => void;
}): Promise<void> {
  await Promise.all(
    dropboxIds.map((dropboxId) =>
      limit(async () => {
        const submissions = await pl.getSubmissions({
          moduleId,
          dropboxId,
          organizationId,
        });
        onUpdate({ submissions });
      }),
    ),
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [user, setUser] = useState<User>();
  const [institution, setInstitution] = useState<Institution>();
  const [modules, setModules] = useState<Module[]>();
  const [semesters, setSemesters] = useState<Semester[]>();
  const [byType, setByType] = useState<Map<AnyActivity["type"], number>>();
  const [totalDropboxes, setTotalDropboxes] = useState<number>();
  const [totalSubmissions, setTotalSubmissions] = useState<number>();

  useEffect(() => {
    async function run() {
      pl.getUser().then(setUser);
      const fetchedInstitution = pl.getInstitution().then((inst) => {
        setInstitution(inst);
        return inst;
      });

      const { modules: mods, semesters: sems } =
        await pl.getModulesAndSemesters();
      setModules(mods);
      setSemesters(sems);

      await getAllActivitiesBatched({
        moduleIds: mods.map((m) => m.id),
        onUpdate: ({ activities }) =>
          setByType((prev) => mergeActivities(prev ?? new Map(), activities)),
      });

      const orgId = (await fetchedInstitution).id;
      const submissionFetches: Promise<void>[] = [];

      await getAllDropboxesBatched({
        moduleIds: mods.map((m) => m.id),
        onUpdate: ({ moduleId, dropboxes }) => {
          setTotalDropboxes((prev) => (prev ?? 0) + dropboxes.length);
          submissionFetches.push(
            getModuleSubmissionsBatched({
              moduleId,
              dropboxIds: dropboxes.map((d) => d.id),
              organizationId: orgId,
              onUpdate: ({ submissions }) =>
                setTotalSubmissions((prev) => (prev ?? 0) + submissions.length),
            }),
          );
        },
      });

      await Promise.all(submissionFetches);
    }

    run();
  }, []);

  const totalActivities =
    byType && Array.from(byType.values()).reduce((a, b) => a + b, 0);

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        {user && <Text>Found user: {user.name}</Text>}
        {institution && <Text>Found institution: {institution.name}</Text>}
      </Box>

      {semesters && (
        <Box flexDirection="column">
          <Text>Found {semesters.length} semesters:</Text>
          <List items={semesters.map((s) => s.name)} />
        </Box>
      )}

      {modules && (
        <Box flexDirection="column">
          <Text>Found {modules.length} modules:</Text>
          <List items={modules.map((m) => m.name)} />
        </Box>
      )}

      {byType && (
        <Box flexDirection="column">
          <Text>Found {totalActivities} activities:</Text>
          {Array.from(byType.entries()).map(([type, count]) => (
            <Text key={type}>
              - {count} {type}
            </Text>
          ))}
        </Box>
      )}

      {totalDropboxes !== undefined && totalSubmissions !== undefined && (
        <Text>
          Found {totalDropboxes} submission dropbox
          {totalDropboxes !== 1 ? "es" : ""} with {totalSubmissions} total
          submission{totalSubmissions !== 1 ? "s" : ""}
        </Text>
      )}
    </Box>
  );
}

render(<App />);
