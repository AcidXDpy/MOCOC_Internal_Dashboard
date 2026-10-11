import { expect, test } from "@playwright/test";

const routes = [
  "demand",
  "pulse",
  "overview",
  "health",
  "labor",
  "industry",
  "spatial",
  "network",
  "dynamics",
  "resilience",
  "policy",
  "evidence",
  "research",
];

test("MOCA is the product name across the economic platform", async ({
  page,
}) => {
  await page.goto("/#overview");
  await expect(page).toHaveTitle("MOCA");
  await expect(page.locator(".eco-brand strong")).toHaveText("MOCA");
  await expect(page.locator(".eco-page-heading > div > p")).toHaveText(
    "Mount Olive / MOCA",
  );
  await expect(page.locator(".eco-footer")).toContainText("MOCA");
});

test("all analysis views load without runtime errors and expose real content", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of routes) {
    await page.goto(`/#${route}`);
    await expect(page.locator(".eco-loading")).toHaveCount(0);
    await expect(page.locator(".eco-content h1").first()).toBeVisible();
    await expect(page.locator(".eco-content")).not.toContainText(
      "This analysis could not render",
    );
    await expect(
      page.locator(".eco-section,.eco-document").first(),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, `${route} has page-level overflow`).toBe(false);
  }
  expect(errors).toEqual([]);
});

test("policy solver changes allocation and reports impossible constraints", async ({
  page,
}) => {
  await page.goto("/#policy");
  await expect(page.getByText("Optimal for these assumptions")).toBeVisible();
  const before = await page.locator(".eco-stats").innerText();
  await page.getByRole("slider", { name: "Policy budget" }).fill("10");
  await expect(
    page.getByText("No feasible allocation.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("checkbox").uncheck();
  await expect(page.getByText("0 projects")).toBeVisible();
  await page.getByRole("button", { name: "Reset assumptions" }).click();
  await expect(page.locator(".eco-stats")).toHaveText(before, {
    useInnerText: true,
  });
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export allocation & assumptions" })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "mount-olive-policy-scenario.json",
  );
});

test("scenario controls recompute exposure; graph selection reveals a node", async ({
  page,
}) => {
  await page.goto("/#resilience");
  await expect(
    page.getByRole("slider", { name: "Propagation strength" }),
  ).toHaveValue("0");
  const bundle = await (
    await page.request.get("/economy/model-results.json")
  ).json();
  const connected = bundle.network.result.nodes.find(
    (node: { degree: number }) => node.degree > 0,
  );
  await page
    .getByRole("combobox", { name: "Shocked sector" })
    .selectOption(connected.id);
  const before = await page.locator(".eco-stats").innerText();
  await page.getByRole("slider", { name: "Propagation strength" }).fill("0.4");
  await expect(page.locator(".eco-stats")).not.toHaveText(before, {
    useInnerText: true,
  });
  await page.goto("/#network");
  await expect(page.locator(".eco-network-node").first()).toBeVisible();
  await page.locator(".eco-network-node").first().click();
  await expect(page.getByText("Full-graph degree")).toBeVisible();
  await page
    .getByRole("button", { name: "Directory relationships", exact: true })
    .click();
  await expect(page.locator(".eco-network-node")).not.toHaveCount(0);
});

test("spatial geometry, research equations, filters and browser history work", async ({
  page,
}) => {
  await page.goto("/#spatial");
  await expect(
    page.locator(".leaflet-overlay-pane path").first(),
  ).toBeVisible();
  await page
    .locator(".leaflet-overlay-pane path")
    .first()
    .click({ force: true });
  await expect(page.getByText("90% MOE", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Business locations", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Map business search" })
    .fill("nonexistent-business-xyz");
  await expect(
    page.getByText("0 mapped public listings", { exact: false }),
  ).toBeVisible();
  await page.goto("/#research");
  await expect(page.locator(".eco-document .katex").first()).toBeVisible();
  await page
    .getByRole("link", { name: "source acquisition matrix", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("combobox", { name: "Research document" }),
  ).toHaveValue(/source-acquisition-matrix/);
  await page
    .getByRole("button", { name: "Data observatory", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search data sources" })
    .fill("not-a-dataset");
  await expect(page.getByText("No datasets match this search.")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".eco-page-heading h1")).toHaveText(
    "Research library",
  );
});

test("legacy Chamber workspace remains reachable with return navigation", async ({
  page,
}) => {
  await page.goto("/chamber");
  await expect(page.locator(".app-main-shell")).toBeVisible();
  await page.getByRole("link", { name: "MOCA", exact: true }).first().click();
  await expect(page.locator(".eco-page-heading h1")).toHaveText(
    "Local economy",
  );
});

test("mobile navigation and layouts fit a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of routes) {
    await page.goto(`/#${route}`);
    await expect(page.locator(".eco-loading")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      route,
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Local economy", exact: true })
    .click();
  await expect(page.locator(".eco-page-heading h1")).toHaveText(
    "Local economy",
  );
  await expect(page.locator(".eco-sidebar")).not.toHaveClass(/open/);
});
