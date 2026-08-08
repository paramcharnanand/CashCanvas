import { test, expect } from "./fixtures/index.mjs";

test.describe("command palette", () => {
  test("the trigger button reads \"Go to…\", not \"Jump to…\"", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /Go to…/ })).toBeVisible();
    await expect(page.getByText("Jump to…")).not.toBeVisible();
  });

  test("does not list 'Import PDF statement' as a separate destination from 'Upload a statement'", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Go to…/ }).click();
    await expect(page.getByRole("listbox", { name: "Commands" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Upload a statement" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Import PDF statement" })).toHaveCount(0);
  });
});
