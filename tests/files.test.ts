import { expect, test } from "bun:test";
import {
  isEditablePath,
  isEnvPath,
  isMarkdownPath,
  isNewNoteFileName,
  newNoteFileName,
  resolveNewNoteFolder,
} from "../src/lib/files";

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

test("new notes are numbered .txt files", () => {
  expect(newNoteFileName(1)).toBe("Yeni not.txt");
  expect(newNoteFileName(2)).toBe("Yeni not 2.txt");
  expect(isNewNoteFileName("Yeni not.txt")).toBe(true);
  expect(isNewNoteFileName("Yeni not 12.txt")).toBe(true);
  expect(isNewNoteFileName("Yeni not.md")).toBe(false);
  expect(isNewNoteFileName("Toplanti.txt")).toBe(false);
});

test("new note folder follows where the user is working", () => {
  const activePath = "/notes/proje/a.txt";
  expect(resolveNewNoteFolder({ explicit: "/x", selectedFolder: "/y", activePath })).toBe("/x");
  expect(resolveNewNoteFolder({ selectedFolder: "/y", activePath, rootPath: "/notes" })).toBe("/y");
  expect(resolveNewNoteFolder({ activePath, rootPath: "/notes" })).toBe("/notes/proje");
  expect(resolveNewNoteFolder({ activePath: null, rootPath: "/notes" })).toBe("/notes");
  expect(resolveNewNoteFolder({})).toBeNull();
});
