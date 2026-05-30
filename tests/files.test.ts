import { expect, test } from "bun:test";
import { isEnvPath, isEditablePath, isMarkdownPath } from "../src/lib/files";

test("isEnvPath matches .env and its variants", () => {
  expect(isEnvPath(".env")).toBe(true);
  expect(isEnvPath("/project/.env")).toBe(true);
  expect(isEnvPath("C:\\project\\.env.local")).toBe(true);
  expect(isEnvPath(".env.production")).toBe(true);
  expect(isEnvPath("config.env")).toBe(true);
});

test("isEnvPath rejects non-env files", () => {
  expect(isEnvPath("notes.md")).toBe(false);
  expect(isEnvPath(".gitignore")).toBe(false);
  expect(isEnvPath("environment.txt")).toBe(false);
});

test("isEditablePath covers markdown family and env files", () => {
  expect(isEditablePath("readme.md")).toBe(true);
  expect(isEditablePath("notes.txt")).toBe(true);
  expect(isEditablePath(".env")).toBe(true);
  expect(isEditablePath("image.png")).toBe(false);
});

test("isMarkdownPath stays markdown-only", () => {
  expect(isMarkdownPath(".env")).toBe(false);
  expect(isMarkdownPath("doc.mdx")).toBe(true);
});
