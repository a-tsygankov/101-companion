import { test, expect } from "@playwright/test";

test("app renders and shows component versions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "101 Companion" })).toBeVisible();
  await expect(page.getByTestId("versions")).toContainText("schema");
});
