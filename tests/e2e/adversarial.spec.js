import { expect, test } from "@playwright/test";

const BASE = process.env.NOSTOS_BASE_URL || "http://127.0.0.1:8080/src/";

const XSS_PAYLOADS = [
  '<script>window.__xss=1</script>',
  '"><img src=x onerror="window.__xss=1">',
  "javascript:alert(1)",
];

test.beforeEach(async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
});

test("finder resolves ZIP 07030 without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.getByTestId("finder-location").fill("07030");
  await page.getByTestId("finder-submit").click();
  await expect(page.getByTestId("finder-row").first()).toBeVisible({ timeout: 10000 });
  const rows = await page.getByTestId("finder-row").count();
  expect(rows).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("geolocation denied still allows ZIP search", async ({ page, context }) => {
  await context.setGeolocation({ latitude: 40.05, longitude: -74.05 });
  await context.clearPermissions();
  await page.getByTestId("finder-geo").click();
  await page.getByTestId("finder-location").fill("08401");
  await page.getByTestId("finder-submit").click();
  await expect(page.getByTestId("finder-row").first()).toBeVisible();
});

test("directory search rejects XSS in DOM", async ({ page }) => {
  await page.getByTestId("tab-directory").click();
  for (const payload of XSS_PAYLOADS) {
    await page.getByTestId("search").fill(payload);
    await page.waitForTimeout(100);
    const xss = await page.evaluate(() => window.__xss);
    expect(xss).toBeUndefined();
    const html = await page.getByTestId("table").innerHTML();
    expect(html).not.toContain("<script");
  }
});

test("adversarial finder filters do not crash UI", async ({ page }) => {
  await page.getByTestId("finder-location").fill("Hoboken");
  await page.getByTestId("finder-submit").click();
  await expect(page.getByTestId("finder-row").first()).toBeVisible();
  await page.getByTestId("finder-county").selectOption({ index: 1 });
  await page.getByTestId("finder-type").selectOption({ index: 1 });
  await expect(page.getByTestId("finder-table")).toBeVisible();
});
