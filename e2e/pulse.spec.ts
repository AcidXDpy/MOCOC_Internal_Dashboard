import { expect, test } from "@playwright/test";

test("pulse windows, indicators, normalization, geographies, and export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#pulse");
  await expect(page.locator(".pulse-headlines")).toContainText("29,149");
  await page.getByLabel("ACS observation window").selectOption("2019");
  await expect(page.locator(".pulse-headlines")).toContainText("2015-2019");
  await expect(page.locator(".pulse-industry")).toContainText("2015-2019");
  await expect(page.locator(".pulse-headlines")).not.toContainText("29,149");
  await page.getByLabel("ACS observation window").selectOption("2014");
  await expect(page.locator(".pulse-headlines")).toContainText("2010-2014");
  await page.getByLabel("ACS observation window").selectOption("2024");
  for (const id of [
    "population",
    "household-income",
    "per-capita-income",
    "resident-employment",
    "earnings",
    "unemployment",
    "employment-rate",
  ]) {
    await page.getByLabel("Resident trend indicator").selectOption(id);
    await expect(
      page.locator(".pulse-chart").first().locator(".recharts-line-curve"),
    ).toHaveCount(3);
  }
  const residentUnits = page.getByRole("group", {
    name: "Resident trend units",
  });
  await expect(residentUnits.getByLabel("Index = 100")).toBeDisabled();
  await page.getByLabel("Resident trend indicator").selectOption("population");
  await residentUnits.getByLabel("Index = 100").check();
  await page.getByLabel("Resident history").selectOption("2019");
  const residentDetails = page.locator(".pulse-table-detail").first();
  await residentDetails.locator("summary").click();
  await expect(residentDetails).toContainText("2019 = 100");
  await expect(residentDetails.locator("tbody tr")).toHaveCount(2);
  await residentUnits.getByLabel("Published units").check();
  await page.getByLabel("Resident history").selectOption("2014");
  const businessUnits = page.getByRole("group", {
    name: "Business trend units",
  });
  for (const id of [
    "workplace-employment",
    "annual-payroll",
    "establishments",
  ]) {
    await page.getByLabel("Business trend indicator").selectOption(id);
    await expect(page.locator(".pulse-latest")).toContainText(
      "Not published for township",
    );
    await expect(
      page.locator(".pulse-chart").nth(1).locator(".recharts-line-curve"),
    ).toHaveCount(2);
  }
  await page.getByLabel("Business history").selectOption("2020");
  await businessUnits.getByLabel("Published units").check();
  await businessUnits.getByLabel("Index = 100").check();
  await page
    .getByRole("checkbox", { name: "New Jersey", exact: true })
    .uncheck();
  await page
    .getByRole("checkbox", { name: "Morris County", exact: true })
    .uncheck();
  await expect(
    page.getByRole("checkbox", { name: "Mount Olive Township", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".pulse-headlines thead th")).toHaveCount(2);
  await expect(
    page.locator(".pulse-chart").nth(1).locator(".recharts-line-curve"),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Morris County", exact: true })
    .check();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export evidence" }).click();
  const downloaded = await download;
  expect(downloaded.suggestedFilename()).toBe("local-economic-pulse.json");
  const stream = await downloaded.createReadStream();
  let text = "";
  for await (const chunk of stream!) text += chunk;
  const exported = JSON.parse(text);
  expect(exported.selection.geographies).toEqual(["mount-olive", "morris"]);
  expect(exported.sources.length).toBeGreaterThan(0);
  expect(
    exported.datasets.every((d: { observations: { geographyId: string }[] }) =>
      d.observations.every((o) => o.geographyId !== "new-jersey"),
    ),
  ).toBe(true);
  await page.getByText(/Source register \(/).click();
  await expect(page.locator(".pulse-sources")).toContainText(
    "release not recorded",
  );
  expect(errors).toEqual([]);
});

test("pulse mobile layout, navigation, sources and methods", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Local Economic Pulse", exact: true })
    .click();
  await expect(page.locator(".pulse-headlines")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const table = page.locator(".pulse-headlines");
  await table.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect(table).toContainText("New Jersey");
  await page.getByLabel("ACS observation window").selectOption("2019");
  await page
    .locator(".pulse-module summary")
    .filter({ hasText: "Method & limitations" })
    .first()
    .click();
  await expect(
    page.getByText(/ACS earnings include all work schedules/),
  ).toBeVisible();
  await page
    .getByText("Industry definitions & uncertainty", { exact: true })
    .click();
  await expect(page.getByText(/Each industry count sums/)).toBeVisible();
  const source = page.locator(".pulse-headlines a").first();
  await expect(source).toHaveAttribute("href", /www2.census.gov.*2019.*zip/);
  const popupEvent = page.waitForEvent("popup");
  await page.route("https://www2.census.gov/**", (route) =>
    route.fulfill({
      contentType: "text/plain",
      body: "Source link target verified",
    }),
  );
  await source.click();
  await (await popupEvent).close();
  await page.goBack();
  await expect(page.locator(".eco-page-heading h1")).toHaveText(
    "Local economy",
  );
  await page.goForward();
  await expect(page.locator(".eco-page-heading h1")).toHaveText(
    "Local Economic Pulse",
  );
});

test("pulse failures retry and missing observations remain unavailable independently of model bundle", async ({
  page,
}) => {
  let failing = true;
  await page.route("**/economy/model-results.json", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.route("**/economy/local-pulse.json", async (route) => {
    if (failing) return route.fulfill({ status: 503, body: "unavailable" });
    const response = await route.fetch();
    const bundle = await response.json();
    const population = bundle.datasets.find(
      (d: { id: string }) => d.id === "population",
    );
    for (const row of population.observations)
      if (row.geographyId === "mount-olive") {
        row.value = null;
        row.moe = null;
        row.status = "missing";
      }
    await route.fulfill({ response, json: bundle });
  });
  await page.goto("/#pulse");
  await expect(page.getByRole("alert")).toContainText("503");
  failing = false;
  await page.getByRole("button", { name: "Retry comparison data" }).click();
  await expect(page.locator(".pulse-headlines tbody tr").first()).toContainText(
    "Missing observation",
  );
  await page.getByLabel("Resident trend indicator").selectOption("population");
  await expect(
    page.locator(".pulse-chart").first().locator(".recharts-line-curve"),
  ).toHaveCount(2);
});

test("pulse malformed bundle is rejected without crashing the shell", async ({
  page,
}) => {
  await page.route("**/economy/local-pulse.json", (route) =>
    route.fulfill({ json: { schemaVersion: "bad" } }),
  );
  await page.goto("/#pulse");
  await expect(page.getByRole("alert")).toContainText("invalid format");
  await page
    .getByRole("button", { name: "Local economy", exact: true })
    .click();
  await expect(page.locator(".eco-page-heading h1")).toHaveText(
    "Local economy",
  );
});
