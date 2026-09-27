import { expect, test } from "@playwright/test";

/**
 * Smoke tests against a running, seeded instance (`npm run db:seed && npm run build`).
 * Credentials come from the same environment variables the seed uses.
 */
const demoEmail = process.env.SEED_DEMO_EMAIL ?? "rafi.demo@banktechjobs.local";
const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "";

test("home page shows search, stats and category cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Technology jobs");
  await expect(page.getByRole("searchbox").or(page.getByLabel("Search jobs"))).toBeVisible();
  await expect(page.getByText("Open jobs")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse by category" })).toBeVisible();
});

test("job search filters and job details with official apply link", async ({ page }) => {
  await page.goto("/jobs?q=Engineer");
  await expect(page.getByText(/jobs? found/)).toBeVisible();
  const first = page.locator("article h3 a").first();
  await first.click();
  await expect(page.getByRole("link", { name: /Apply on Official Site/ })).toHaveAttribute("rel", /noopener/);
  await expect(page.getByRole("heading", { name: "Requirements" })).toBeVisible();
});

test("public pages render", async ({ page }) => {
  for (const path of ["/closing-soon", "/public-bank-jobs", "/software-jobs", "/organizations", "/calendar", "/about", "/privacy", "/terms"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});

test("protected pages redirect to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("demo candidate can sign in and see eligibility", async ({ page }) => {
  test.skip(!demoPassword, "SEED_DEMO_PASSWORD not set");
  await page.goto("/login");
  await page.getByLabel("Email").fill(demoEmail);
  await page.getByLabel("Password").fill(demoPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Top matches" })).toBeVisible();
  await page.locator("a[href^='/jobs/']").first().click();
  await expect(page.getByRole("heading", { name: "Your eligibility" })).toBeVisible();
});
