import { describe, expect, it } from "vitest";
import type {
  DemandPublishRequest,
  PublishedDemandDataset,
} from "../src/economy/demand/api-types";
import { canonicalDataset } from "./_lib/demand-contract";
import {
  MemoryDemandRepository,
  type DemandRepository,
} from "./_lib/demand-store";
import { createDemandHandler } from "./demand";

const ADMIN_TOKEN = "test-admin-token-with-enough-entropy";

function publication(name = "Official demand"): DemandPublishRequest {
  return {
    name,
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
      originalFilename: "multiTimeline.csv",
      acquisitionMethod: "official-csv-export",
      notes: ["Official export"],
    },
    series: [
      {
        category: "restaurants",
        query: "restaurants",
        points: [{ date: "2026-01-01", interest: 50 }],
      },
    ],
  };
}

type TestRequest = {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
};

function request(
  method: string,
  options: {
    url?: string;
    body?: unknown;
    token?: string;
    origin?: string;
    idempotencyKey?: string;
  } = {},
): TestRequest {
  return {
    method,
    url: options.url ?? "/api/demand",
    body: options.body,
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.idempotencyKey
        ? { "idempotency-key": options.idempotencyKey }
        : {}),
      "content-type": "application/json",
    },
  };
}

function response() {
  const headers = new Map<string, string>();
  return {
    statusCode: 200,
    headers,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      this.body = value;
      return this;
    },
    end(value?: unknown) {
      this.body = value;
      return this;
    },
  };
}

function handler(repository: DemandRepository, options = {}) {
  let sequence = 0;
  return createDemandHandler({
    getRepository: () => repository,
    adminToken: ADMIN_TOKEN,
    allowedOrigin: "https://allowed.example",
    now: () => "2026-10-03T16:00:00.000Z",
    id: (prefix: string) => `${prefix}-${++sequence}`,
    ...options,
  });
}

async function invoke(
  run: ReturnType<typeof createDemandHandler>,
  input: TestRequest,
) {
  const output = response();
  await run(input, output);
  return output;
}

async function seed(
  repository: MemoryDemandRepository,
  id: string,
  minute: number,
) {
  const dataset = canonicalDataset(publication(`Dataset ${id}`), {
    id,
    publishedAt: `2026-10-03T15:${String(minute).padStart(2, "0")}:00.000Z`,
  });
  await repository.putDataset(dataset, `key-${id}`);
  return dataset;
}

describe("demand API handler", () => {
  it("GET is public, sanitized, cacheable and supports explicit history", async () => {
    const repository = new MemoryDemandRepository();
    await seed(repository, "one", 1);
    await seed(repository, "two", 2);
    await repository.appendEvent({
      id: "e1",
      type: "activate",
      datasetId: "one",
      occurredAt: "2026-10-03T15:03:00.000Z",
    });
    await repository.appendEvent({
      id: "e2",
      type: "supersede",
      datasetId: "one",
      occurredAt: "2026-10-03T15:04:00.000Z",
    });
    await repository.appendEvent({
      id: "e3",
      type: "activate",
      datasetId: "two",
      occurredAt: "2026-10-03T15:05:00.000Z",
    });
    const run = handler(repository);
    const current = await invoke(run, request("GET"));
    expect(current.statusCode).toBe(200);
    expect(
      (current.body as { datasets: PublishedDemandDataset[] }).datasets,
    ).toHaveLength(1);
    expect(current.headers.get("cache-control")).toContain("s-maxage=60");
    expect(current.headers.get("etag")).toMatch(/^"[a-f0-9]{64}"$/);
    expect(current.headers.get("x-content-type-options")).toBe("nosniff");
    expect(JSON.stringify(current.body)).not.toContain("pathname");
    const history = await invoke(
      run,
      request("GET", { url: "/api/demand?include=history" }),
    );
    expect(
      (history.body as { datasets: PublishedDemandDataset[] }).datasets,
    ).toHaveLength(2);
    const notModified = await invoke(run, {
      ...request("GET"),
      headers: { "if-none-match": current.headers.get("etag") },
    });
    expect(notModified.statusCode).toBe(304);
  });

  it("POST returns identical 401 responses for missing and invalid credentials", async () => {
    const run = handler(new MemoryDemandRepository());
    const missing = await invoke(run, request("POST", { body: publication() }));
    const invalid = await invoke(
      run,
      request("POST", { body: publication(), token: "wrong" }),
    );
    expect(missing.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(401);
    expect({
      ...(missing.body as Record<string, unknown>),
      error: {
        ...(missing.body as { error: object }).error,
        requestId: "same",
      },
    }).toEqual({
      ...(invalid.body as Record<string, unknown>),
      error: {
        ...(invalid.body as { error: object }).error,
        requestId: "same",
      },
    });
  });

  it("POST publishes canonical verified data and honors idempotency", async () => {
    const repository = new MemoryDemandRepository();
    const run = handler(repository);
    const input = request("POST", {
      body: { ...publication(), id: "client-id", status: "verified" },
      token: ADMIN_TOKEN,
      origin: "https://allowed.example",
      idempotencyKey: "official-export-2026-10",
    });
    const created = await invoke(run, input);
    const repeated = await invoke(run, input);
    expect(created.statusCode).toBe(201);
    expect(repeated.statusCode).toBe(200);
    const dataset = (created.body as { dataset: PublishedDemandDataset })
      .dataset;
    expect(dataset.id).not.toBe("client-id");
    expect(dataset.status).toBe("verified");
    expect(dataset.provenance.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await repository.listDatasets()).toHaveLength(1);
  });

  it("POST rejects oversized bodies before repository access", async () => {
    let accessed = false;
    const repository: DemandRepository = {
      listDatasets: async () => {
        accessed = true;
        return [];
      },
      listEvents: async () => {
        accessed = true;
        return [];
      },
      putDataset: async () => {
        accessed = true;
        return "created";
      },
      appendEvent: async () => {
        accessed = true;
      },
    };
    const result = await invoke(
      handler(repository),
      request("POST", {
        body: `{"payload":"${"x".repeat(2_000_001)}"}`,
        token: ADMIN_TOKEN,
        origin: "https://allowed.example",
        idempotencyKey: "oversized-body",
      }),
    );
    expect(result.statusCode).toBe(413);
    expect(accessed).toBe(false);
  });

  it("PATCH activates and archives by append-only events", async () => {
    const repository = new MemoryDemandRepository();
    await seed(repository, "one", 1);
    const run = handler(repository);
    const activate = await invoke(
      run,
      request("PATCH", {
        url: "/api/demand?id=one",
        body: { action: "activate", expectedActiveDatasetId: null },
        token: ADMIN_TOKEN,
        origin: "https://allowed.example",
      }),
    );
    expect(activate.statusCode).toBe(200);
    expect((activate.body as { activeDatasetId: string }).activeDatasetId).toBe(
      "one",
    );
    const archive = await invoke(
      run,
      request("PATCH", {
        url: "/api/demand?id=one",
        body: { action: "archive", expectedActiveDatasetId: "one" },
        token: ADMIN_TOKEN,
        origin: "https://allowed.example",
      }),
    );
    expect(archive.statusCode).toBe(200);
    expect(
      (archive.body as { activeDatasetId: null }).activeDatasetId,
    ).toBeNull();
    expect(await repository.listEvents()).toHaveLength(2);
  });

  it("PATCH rejects a stale expected active id with 409 and does not mutate state", async () => {
    const repository = new MemoryDemandRepository();
    await seed(repository, "one", 1);
    await seed(repository, "two", 2);
    await repository.appendEvent({
      id: "existing",
      type: "activate",
      datasetId: "one",
      occurredAt: "2026-10-03T15:03:00.000Z",
    });
    const before = await repository.listEvents();
    const result = await invoke(
      handler(repository),
      request("PATCH", {
        url: "/api/demand?id=two",
        body: { action: "activate", expectedActiveDatasetId: null },
        token: ADMIN_TOKEN,
        origin: "https://allowed.example",
      }),
    );
    expect(result.statusCode).toBe(409);
    expect((result.body as { error: { code: string } }).error.code).toBe(
      "CONFLICT",
    );
    expect(await repository.listEvents()).toEqual(before);
  });

  it("malformed stored data yields warnings while valid data remains readable", async () => {
    const valid = canonicalDataset(publication(), {
      id: "valid",
      publishedAt: "2026-10-03T15:00:00.000Z",
    });
    const repository: DemandRepository = {
      listDatasets: async () => [
        { pathname: "valid", value: valid },
        { pathname: "private://bad", error: "secret storage failure" },
      ],
      listEvents: async () => [
        {
          pathname: "activate",
          value: {
            id: "event",
            type: "activate",
            datasetId: "valid",
            occurredAt: "2026-10-03T15:01:00.000Z",
          },
        },
      ],
      putDataset: async () => "created",
      appendEvent: async () => undefined,
    };
    const result = await invoke(handler(repository), request("GET"));
    expect(result.statusCode).toBe(200);
    expect((result.body as { datasets: unknown[] }).datasets).toHaveLength(1);
    expect((result.body as { warnings: string[] }).warnings).toHaveLength(1);
    expect(JSON.stringify(result.body)).not.toContain("private://");
    expect(JSON.stringify(result.body)).not.toContain("secret storage");
  });

  it("unconfigured storage or token returns structured 503 without secrets", async () => {
    const run = createDemandHandler({
      getRepository: () => {
        throw new Error("BLOB token secret-private-url");
      },
      adminToken: "",
      allowedOrigin: "https://allowed.example",
      now: () => "2026-10-03T16:00:00.000Z",
      id: () => "request-id",
    });
    const getResult = await invoke(run, request("GET"));
    const postResult = await invoke(
      run,
      request("POST", {
        body: publication(),
        token: "anything",
        origin: "https://allowed.example",
      }),
    );
    expect(getResult.statusCode).toBe(503);
    expect(postResult.statusCode).toBe(503);
    expect((getResult.body as { error: { code: string } }).error.code).toBe(
      "NOT_CONFIGURED",
    );
    expect(JSON.stringify([getResult.body, postResult.body])).not.toContain(
      "secret-private-url",
    );
  });

  it("disallowed origins and repeated failed authorization are rejected", async () => {
    const run = handler(new MemoryDemandRepository());
    const crossOrigin = await invoke(
      run,
      request("POST", {
        body: publication(),
        token: ADMIN_TOKEN,
        origin: "https://evil.example",
      }),
    );
    expect(crossOrigin.statusCode).toBe(403);
    expect((crossOrigin.body as { error: { code: string } }).error.code).toBe(
      "UNAUTHORIZED",
    );
    let limited = crossOrigin;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      limited = await invoke(
        run,
        request("POST", {
          body: publication(),
          token: "wrong-token",
          origin: "https://allowed.example",
        }),
      );
    }
    expect(limited.statusCode).toBe(429);
    expect((limited.body as { error: { code: string } }).error.code).toBe(
      "RATE_LIMITED",
    );
  });
});
