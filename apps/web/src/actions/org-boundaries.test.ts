import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

// Separate processes keep auth/AWS/database mocks out of the rest of the suite.
async function runIsolated(source: string) {
  const setup = `
    import { mock } from "bun:test";
    import { strict as assert } from "node:assert";
    const schema = await import("../database/src/schema");
    const orm = await import(Bun.resolveSync("drizzle-orm", new URL("../database/", import.meta.url).pathname));
    mock.module("@the-forum/database", () => ({
      ...schema,
      ...orm,
      loadOrganizationPage: async () => { throw new Error("Unexpected pagination query"); },
      db: { select() { throw new Error("Invalid IDs must not reach the database"); } },
    }));
    mock.module("~/auth", () => ({ auth: async () => ({ user: { id: "fixture" } }) }));
  `;
  const child = Bun.spawn([process.execPath, "--eval", setup + source], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect({ exitCode, stdout, stderr }).toEqual({ exitCode: 0, stdout: "", stderr: "" });
}

test("signed-in invalid organization IDs return not found without querying the database", async () => {
  await runIsolated(`
    const { getOrg } = await import("~/actions/orgs");
    for (const id of ["create", "not-a-uuid", ""]) assert.equal(await getOrg(id), null);
  `);
});

test("upload action rejects organization logos and still signs avatar and flyer uploads", async () => {
  await runIsolated(`
    mock.module("~/env", () => ({ env: { AWS_S3_BUCKET: "fixture-bucket", AWS_REGION: "us-east-1" } }));
    const commands = [];
    mock.module("@aws-sdk/s3-request-presigner", () => ({
      getSignedUrl: async (_client, command) => {
        commands.push(command.input);
        return "https://example.test/upload";
      },
    }));
    const { getPresignedUploadUrl } = await import("~/actions/upload");
    const input = { contentType: "image/png", size: 123, filename: "fixture.png" };
    await assert.rejects(getPresignedUploadUrl({ ...input, folder: "org-logos" }), /Invalid input/);
    assert.equal(commands.length, 0);
    for (const folder of ["avatars", "event-flyers"]) {
      const result = await getPresignedUploadUrl({ ...input, folder });
      assert.ok(result.key.startsWith(folder + "/fixture/"));
      assert.equal(result.uploadUrl, "https://example.test/upload");
      assert.ok(result.publicUrl.startsWith("https://fixture-bucket.s3.amazonaws.com/" + folder + "/"));
    }
    assert.equal(commands.length, 2);
    assert.ok(commands.every(command => command.Bucket === "fixture-bucket"));
  `);
});

test("organization page discards oversized cursor strings instead of failing action validation", async () => {
  await runIsolated(`
    const calls = [];
    mock.module("~/actions/orgs", () => ({
      getOrgs: async (params) => {
        if (typeof params.cursor?.value === "string" && params.cursor.value.length > 255) {
          throw new Error("Oversized cursor reached the action");
        }
        calls.push(params);
        return { items: [], total: 0, rangeStart: 0, rangeEnd: 0, previousCursor: null, nextCursor: null, hasCursor: false };
      },
      getBlockedOrgs: async () => [],
      getRecommendedOrgs: async () => [],
    }));
    mock.module("~/components/layout/page-shell", () => ({ PageShell: () => null, PageHeading: () => null }));
    mock.module("./src/app/(app)/orgs/orgs-client", () => ({ OrgsClient: () => null }));
    const { default: Page } = await import("./src/app/(app)/orgs/page");
    const id = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    for (const [sort, key] of [["name", "after_name"], ["newest", "after_created_at"]]) {
      for (const length of [255, 256, 1000]) {
        const value = "a".repeat(length);
        await Page({ searchParams: Promise.resolve({ sort, after_id: id, direction: "next", [key]: value }) });
        assert.deepEqual(calls.at(-1).cursor, length <= 255 ? { id, direction: "next", value } : undefined);
      }
    }
    await Page({ searchParams: Promise.resolve({ sort: "members", after_id: id, direction: "next", after_member_count: "42" }) });
    assert.deepEqual(calls.at(-1).cursor, { id, direction: "next", value: 42 });
  `);
});
