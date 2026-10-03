import { expect, test, type Page } from "@playwright/test";

const verifiedEnvelope = () => ({
  schemaVersion: "1.0",
  generatedAt: "2026-10-03T16:00:00.000Z",
  activeDatasetId: "verified-one",
  warnings: [],
  datasets: [
    {
      id: "verified-one",
      schemaVersion: "1.0",
      status: "verified",
      name: "Official New Jersey demand",
      sourceType: "google-trends-csv",
      valueUnit: "normalized-index-0-100",
      frequency: "Month",
      geography: { label: "New Jersey", level: "state", code: "US-NJ" },
      comparison: { sharedScale: true, method: "single-export" },
      provenance: {
        sourceOrganization: "Google",
        sourceProduct: "Google Trends",
        sourceUrl: "https://trends.google.com/trends/explore?geo=US-NJ",
        retrievedAt: "2026-10-03T14:00:00.000Z",
        publishedAt: "2026-10-03T15:00:00.000Z",
        originalFilename: "multiTimeline.csv",
        contentSha256: "a".repeat(64),
        acquisitionMethod: "official-csv-export",
        notes: ["Official export"],
      },
      series: ["restaurants", "coffee", "fitness"].map((category, c) => ({
        category,
        query: category,
        points: Array.from({ length: 12 }, (_, i) => ({
          date: `2025-${String(i + 1).padStart(2, "0")}-01`,
          interest: 25 + c * 15 + i,
        })),
      })),
    },
  ],
});

async function routeVerified(page: Page) {
  await page.route("**/api/demand*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(verifiedEnvelope()) }),
  );
}

test("verified API data becomes the default and exposes complete provenance", async ({ page }) => {
  await routeVerified(page);
  await page.goto("/#demand");
  await expect(page.getByLabel("Demand data source")).toHaveValue("api");
  await expect(page.locator(".demand-evidence")).toContainText("Verified API Data");
  await page.getByText("Verified source & provenance", { exact: true }).click();
  const provenance = page.locator(".demand-provenance");
  await expect(provenance).toContainText("New Jersey");
  await expect(provenance).toContainText("state");
  await expect(provenance).toContainText("US-NJ");
  await expect(provenance).toContainText("official-csv-export");
  await expect(provenance).toContainText("restaurants");
  await expect(provenance).toContainText("aaaaaaaaaaaa");
  await expect(provenance.getByRole("link", { name: "Google Trends source" })).toHaveAttribute("href", /trends\.google\.com/);
});

test("empty, malformed, slow and failed API responses retain labeled demo data", async ({ page }) => {
  const responses: Array<"empty" | "malformed" | "slow" | "failed"> = ["empty", "malformed", "slow", "failed"];
  for (const kind of responses) {
    await page.unrouteAll({ behavior: "wait" });
    await page.route("**/api/demand*", async (route) => {
      if (kind === "slow") await new Promise((resolve) => setTimeout(resolve, 1200));
      if (kind === "failed") return route.fulfill({ status: 503, body: "{}" });
      const body = kind === "malformed" ? { datasets: [{}] } : { ...verifiedEnvelope(), activeDatasetId: null, datasets: [] };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto("/#demand");
    await expect(page.getByLabel("Demand data source")).toHaveValue("demo");
    await expect(page.locator(".demand-evidence")).toContainText("Demo Data");
  }
});

test("browser imports remain selectable beside verified API data", async ({ page }) => {
  await routeVerified(page);
  await page.goto("/#demand");
  await page.getByRole("button", { name: "Import Trends Data", exact: true }).click();
  await upload(page, csv());
  await save(page);
  await expect(page.getByLabel("Demand data source").locator("option")).toHaveText(["Demo Data", "Verified API Data", "This Browser"]);
  await expect(page.getByLabel("Demand data source")).toHaveValue("import");
  await expect(page.locator(".demand-evidence")).toContainText("Google Trends Import");
});

test("homepage pulse identifies verified source or explicit demo fallback", async ({ page }) => {
  await routeVerified(page);
  await page.goto("/");
  await expect(page.locator(".demand-home .demand-context")).toContainText("Verified API Data");
  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/api/demand*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...verifiedEnvelope(), activeDatasetId: null, datasets: [] }) }));
  await page.reload();
  await expect(page.locator(".demand-home .demand-context")).toContainText("Demo Data");
});

test("two browser tabs preserve imports and print keeps source context", async ({
  page,
  context,
}) => {
  await page.goto("/#demand");
  const second = await context.newPage();
  await second.goto("/#demand");
  await second
    .getByRole("button", { name: "Import Trends Data", exact: true })
    .click();
  await upload(second, csv("New York DMA"), "second.csv");
  await page
    .getByRole("button", { name: "Import Trends Data", exact: true })
    .click();
  await upload(page, csv(), "first.csv");
  await save(page);
  await save(second);
  await expect(
    page.getByLabel("Demand geography").locator("option"),
  ).toHaveCount(2);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("mococ.local-demand.v1")!).length,
    ),
  ).toBe(2);
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printRequested = "true";
    };
  });
  await page.getByRole("button", { name: "Print / Save PDF" }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-print-requested",
    "true",
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".demand-toolbar")).toBeHidden();
  await expect(page.locator(".demand-print-method")).toBeVisible();
  await expect(page.locator(".demand-evidence")).toContainText(
    "Google Trends Import",
  );
  await page.screenshot({
    path: "test-results/demand-print.png",
    fullPage: true,
  });
  await second.close();
});

const csv = (geography = "New Jersey", base = 20) =>
  `Month,restaurants: (${geography}),coffee: (${geography}),fitness: (${geography})\n` +
  Array.from(
    { length: 12 },
    (_, i) =>
      `2025-${String(i + 1).padStart(2, "0")},${base + i},${80 - i},${40 + i}`,
  ).join("\n");
async function upload(page: Page, text: string, name = "comparison.csv") {
  await page
    .getByLabel("Google Trends CSV file")
    .setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(text) });
  await expect(page.getByLabel("Mapped industry 1")).toBeVisible();
}
async function save(page: Page) {
  await page.getByRole("checkbox", { name: /These columns came/ }).check();
  await page.getByRole("button", { name: "Import Data", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("homepage preview, filters, charts, sorting, details, export and map", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Local Demand Pulse" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Explore Local Demand/ }).click();
  await expect(page.locator(".eco-page-heading h1")).toHaveText("Local Demand");
  await expect(page.locator(".demand-bubble")).toHaveCount(10);
  await expect(page.locator(".demand-line .recharts-line-curve")).toHaveCount(
    3,
  );
  await expect(page.locator(".demand-evidence")).toContainText("Demo Data");
  for (const months of ["3", "6", "24", "12"]) {
    await page.getByLabel("Demand time range").selectOption(months);
    await expect(page.locator(".demand-kpis")).toContainText(
      `${months} common observed months`,
    );
  }
  await page
    .getByRole("checkbox", { name: "Restaurants", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Coffee & Cafes", exact: true })
    .check();
  await expect(
    page.getByRole("checkbox", { name: "Auto Repair", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".demand-line .recharts-line-curve")).toHaveCount(
    5,
  );
  await page
    .getByRole("button", { name: "Open Restaurants details", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Restaurants", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".demand-businesses li")).toHaveCount(3);
  await expect(
    page.getByRole("link", { name: "Public directory source" }).first(),
  ).toHaveAttribute("href", /membee/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Filter demand categories").fill("childcare");
  await expect(page.locator(".demand-opportunity tbody tr")).toHaveCount(1);
  await page.getByLabel("Filter demand categories").fill("no-match-xyz");
  await expect(
    page.getByText("No categories match this filter."),
  ).toBeVisible();
  await page.getByLabel("Filter demand categories").fill("");
  for (const name of [
    "Search Interest",
    "3M Change",
    "Businesses",
    "Demand Gap",
  ]) {
    await page
      .locator(".demand-opportunity thead")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(
      page.locator(".demand-opportunity th[aria-sort=descending]"),
    ).toHaveCount(1);
  }
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Analysis" }).click();
  expect((await download).suggestedFilename()).toBe(
    "local-demand-analysis.csv",
  );
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await page.getByLabel("Map industry").selectOption("restaurants");
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveCount(3);
  await page
    .locator(".leaflet-overlay-pane path")
    .first()
    .click({ force: true });
  await expect(page.locator(".leaflet-popup-content")).toBeVisible();
  await page.getByRole("tab", { name: "Demand", exact: true }).click();
  await page
    .getByText("Calculation, sources & limitations", { exact: true })
    .click();
  await expect(
    page.getByText("Gap(c) = z(mean search interest(c)) - z(supply share(c))", {
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("CSV previews, mappings, import, persistence, geography, replacement and deletion", async ({
  page,
}) => {
  await page.goto("/#demand");
  await page
    .getByRole("button", { name: "Import Trends Data", exact: true })
    .click();
  await page.getByLabel("Google Trends CSV file").setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Region,coffee\nNew Jersey,100"),
  });
  await expect(page.getByRole("alert")).toContainText("No time-series header");
  await upload(page, csv());
  await expect(page.getByLabel("Actual search geography")).toHaveValue(
    "New Jersey",
  );
  await expect(page.getByLabel("Mapped industry 1")).toHaveValue("restaurants");
  await save(page);
  await expect(page.locator(".demand-evidence")).toContainText(
    "Google Trends Import",
  );
  await expect(page.locator(".demand-kpis > div strong")).toHaveText("3");
  await expect(page.locator(".demand-bubble")).toHaveCount(3);
  await expect(page.locator(".demand-kpis")).toContainText("Coffee & Cafes");
  await page.reload();
  await page.getByLabel("Demand data source").selectOption("import");
  await expect(page.locator(".demand-evidence")).toContainText("New Jersey");
  await page.getByRole("button", { name: "Replace this import" }).click();
  await upload(page, csv("New Jersey", 70), "replacement.csv");
  await save(page);
  await expect(
    page.getByLabel("Comparison export").locator("option"),
  ).toHaveCount(1);
  await expect(page.locator(".demand-kpis")).toContainText("Restaurants");
  await page
    .getByRole("button", { name: "Import Trends Data", exact: true })
    .click();
  await upload(page, csv("New York DMA"), "dma.csv");
  await save(page);
  await page.getByLabel("Demand geography").selectOption("New Jersey");
  await expect(page.locator(".demand-evidence")).toContainText("New Jersey");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete this import" }).click();
  await expect(page.locator(".demand-evidence")).toContainText("New York DMA");
  await page.getByRole("button", { name: "Delete this import" }).click();
  await expect(
    page.getByRole("heading", { name: "Your imported comparisons" }),
  ).toBeVisible();
  await expect(page.locator(".demand-bubble")).toHaveCount(0);
});

test("synthetic sample stays labeled and independent scales cannot produce gaps", async ({
  page,
}) => {
  await page.goto("/#demand");
  await page
    .getByRole("button", { name: "Import Trends Data", exact: true })
    .click();
  const sample = await page.request.get(
    "/sample-data/google-trends/demonstration.csv",
  );
  await upload(page, await sample.text(), "demonstration.csv");
  await page.getByRole("button", { name: "Import Data", exact: true }).click();
  await expect(page.locator(".demand-evidence")).toContainText("Demo Data");
  await expect(
    page.getByText("Comparison not available", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".demand-line .recharts-line-curve")).toHaveCount(
    3,
  );
});

test("desktop, tablet and mobile layouts and dialogs fit with rendered charts", async ({
  page,
}) => {
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/#demand");
    await expect(page.locator(".demand-bubble")).toHaveCount(10);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/demand-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Import Trends Data", exact: true })
      .click();
    await upload(page, csv());
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/demand-import-${width}.png` });
    await page.keyboard.press("Escape");
  }
});
