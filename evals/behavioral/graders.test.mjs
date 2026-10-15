import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parseToolUses, runGraders } from "./graders.mjs"

const line = (o) => JSON.stringify(o)
const STREAM = [
  line({ type: "system", subtype: "init" }),
  line({ type: "assistant", message: { content: [
    { type: "text", text: "Reading docs" },
    { type: "tool_use", name: "Read", input: { file_path: "/w/node_modules/@auth0/nextjs-auth0/docs/README.md" } },
  ] } }),
  "not json — ignored",
  line({ type: "assistant", message: { content: [
    { type: "tool_use", name: "WebFetch", input: { url: "https://auth0.com/docs/quickstart/webapp/nextjs.md" } },
  ] } }),
  line({ type: "result", result: "done" }),
].join("\n")

test("parseToolUses extracts tool_use blocks in order and skips junk lines", () => {
  assert.deepEqual(parseToolUses(STREAM), [
    { name: "Read", input: { file_path: "/w/node_modules/@auth0/nextjs-auth0/docs/README.md" } },
    { name: "WebFetch", input: { url: "https://auth0.com/docs/quickstart/webapp/nextjs.md" } },
  ])
})

test("parseToolUses returns [] for empty output", () => {
  assert.deepEqual(parseToolUses(""), [])
})

const emptyDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "grader-test-"))

test("transcript_matches passes when a tool use matches", async () => {
  const [r] = await runGraders(
    [{ type: "transcript_matches", pattern: "nextjs-auth0/docs/|auth0\\.com/docs/.+\\.md", description: "read SDK docs" }],
    emptyDir(), null, parseToolUses(STREAM))
  assert.equal(r.pass, true)
  assert.match(r.detail, /Read/)
})

test("transcript_matches fails when no tool use matches", async () => {
  const [r] = await runGraders(
    [{ type: "transcript_matches", pattern: "auth0-react/docs/", description: "read SDK docs" }],
    emptyDir(), null, parseToolUses(STREAM))
  assert.equal(r.pass, false)
  assert.match(r.detail, /2 tool uses/)
})

test("transcript_matches reports an invalid regex", async () => {
  const [r] = await runGraders(
    [{ type: "transcript_matches", pattern: "(", description: "bad" }], emptyDir(), null, [])
  assert.equal(r.pass, false)
  assert.match(r.detail, /Invalid regex/)
})
