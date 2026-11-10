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
