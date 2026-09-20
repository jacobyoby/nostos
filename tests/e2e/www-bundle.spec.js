import { expect, test } from "@playwright/test";

/** Capacitor serves the same bundle from www/ at site root. */
const BASE = process.env.NOSTOS_WWW_URL || "http://127.0.0.1:8081/";

test("www bundle finder works (mobile shell parity)", async ({ page }) => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByTestId("finder-location").fill("08401");
  await page.getByTestId("finder-submit").click();
  await expect(page.getByTestId("finder-row").first()).toBeVisible();
  const dist = await page.getByTestId("finder-row").first().locator("td").first().textContent();
  expect(dist).toMatch(/mi$/);
});
