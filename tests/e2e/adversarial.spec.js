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
      admin_email: { value: "javascript:alert(1)", verified_on: null },
      contact_form_url: { value: "javascript:alert(1)", verified_on: null },
      has_legal_help_program: true,
      legal_help_evidence: "javascript:alert(1)",
      services: [{ name: "legal-help desk", evidence_url: "javascript:alert(1)", verified_on: null }],
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
  await page.goto(`${BASE}#/directory`, { waitUntil: "networkidle" });
  await page.getByTestId("search").fill("XSS OUTLET");
  await expect(page.getByTestId("directory-row").first()).toBeVisible();
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await page.goto(`${BASE}#/outlet/XSS001-001`, { waitUntil: "networkidle" });
  const contact = page.getByTestId("outlet-contact");
  await expect(contact).toBeVisible();
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.getByTestId("outlet-name")).toContainText("Xss Outlet");
});

test("finder Milford is Hunterdon, not New Milford", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("finder-location").fill("Milford");
  await page.getByTestId("finder-submit").click();
  await expect(page.getByTestId("finder-status")).toContainText(/Milford/i);
  await expect(page.getByTestId("finder-status")).not.toContainText(/New Milford/i);
  await expect(page.getByTestId("finder-row").first()).toBeVisible();
  const first = await page.getByTestId("finder-row").first().locator("td:nth-child(2)").textContent();
  expect(first || "").not.toMatch(/New Milford/i);
});

test("outlet page shows contact above the fold and rejects a review proposal", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("finder-location").fill("08401");
  await page.getByTestId("finder-submit").click();
  await page.getByTestId("outlet-link").first().click();
  await expect(page.getByTestId("outlet-contact")).toBeVisible();
  await expect(page.getByTestId("admin-phone")).toBeVisible();
  await page.getByTestId("proposal-kind").selectOption("resource");
  await page.getByTestId("proposal-value").fill("5 star review of this library");
  await page.getByTestId("proposal-submit").click();
  await expect(page.getByTestId("proposal-error")).toContainText(/Ratings and reviews/i);
});

test("finder never shows weekly IMLS totals as hours and Hoboken has a weekday schedule", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("finder-location").fill("Hoboken");
  await page.getByTestId("finder-submit").click();
  await expect(page.getByTestId("finder-row").first()).toBeVisible();
  const hours = await page.getByTestId("finder-hours").allTextContents();
  expect(hours.length).toBeGreaterThan(0);
  expect(hours.every((t) => !/h\/wk/i.test(t))).toBeTruthy();
  await page.goto(`${BASE}#/outlet/NJ0148-002`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("hours-week")).toBeVisible();
  await expect(page.getByTestId("hours-week")).toContainText(/Monday/);
  await expect(page.getByTestId("hours-week")).toContainText(/10:00 AM/);
  await expect(page.getByTestId("outlet-contact")).toBeVisible();
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
