import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.NOSTOS_BASE_URL || "http://127.0.0.1:8080/src/";
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const libraries = JSON.parse(readFileSync(join(root, "data/nj-libraries.json"), "utf8"));

test("finder resolves ZIP 07030 without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("finder-location").fill("07030");
  await page.getByTestId("finder-submit").click();
  await expect(page.getByTestId("finder-row").first()).toBeVisible({ timeout: 10000 });
  const rows = await page.getByTestId("finder-row").count();
  expect(rows).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("geolocation denied shows status then ZIP still works", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, err) => {
      err({ code: 1, message: "denied" });
    };
  });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("finder-geo").click();
  await expect(page.getByTestId("finder-status")).toContainText(/Location denied/i);
  await page.getByTestId("finder-location").fill("08401");
  await page.getByTestId("finder-submit").click();
  await expect(page.getByTestId("finder-row").first()).toBeVisible();
});

test("directory does not emit javascript: href from poisoned website", async ({ page }) => {
  const poisoned = [
    {
      fscskey: "XSS001",
      fscs_seq: "001",
      system_name: "XSS SYSTEM",
      outlet_name: "XSS OUTLET",
      outlet_type: "central",
      address: "1 EVIL ST",
      city: "TRENTON",
      zip: "08608",
      county: "MERCER",
      phone: "6090000000",
      lat: 40.22,
      lon: -74.76,
      hours_open_weekly: 10,
      website: "javascript:alert(document.domain)",
      has_legal_help_program: true,
      legal_help_evidence: "javascript:alert(1)",
      outreach: { status: "todo", notes: null },
    },
    ...libraries,
  ];
  await page.route("**/nj-libraries.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(poisoned),
    });
  });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("tab-directory").click();
  await page.getByTestId("search").fill("XSS OUTLET");
  const row = page.locator('[data-fscs="XSS001-001"]');
  await expect(row).toBeVisible();
  await expect(row.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(row.locator("td").first()).toContainText("Xss Outlet");
});

test("finder county filter changes result set", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("finder-location").fill("Hoboken");
  await page.getByTestId("finder-submit").click();
  await expect(page.getByTestId("finder-row").first()).toBeVisible();
  const before = await page.getByTestId("finder-row").count();
  await page.getByTestId("finder-county").selectOption("ATLANTIC");
  const after = await page.getByTestId("finder-row").count();
  expect(after).toBeLessThan(before);
  const counties = await page.getByTestId("finder-row").locator("td:nth-child(3)").allTextContents();
  expect(counties.every((c) => c.toLowerCase() === "atlantic")).toBeTruthy();
});

test("directory legal=no filters to confirmed-negative programs", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("tab-directory").click();
  await page.getByTestId("legal").selectOption("no");
  const cells = await page.locator('[data-testid="directory-row"] td:nth-child(5)').allTextContents();
  expect(cells.length).toBeGreaterThan(0);
  expect(cells.every((t) => t.trim() === "no")).toBeTruthy();
});
