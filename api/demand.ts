import { createHash, timingSafeEqual } from "node:crypto";
import type {
  DemandApiErrorCode,
  DemandPublishRequest,
  PublishedDemandDataset,
} from "../src/economy/demand/api-types";
import {
  canonicalDataset,
  validatePublishRequest,
} from "./_lib/demand-contract";
import {
  VercelBlobDemandRepository,
  deriveDemandState,
  type DemandRepository,
} from "./_lib/demand-store";

const MAX_BODY_BYTES = 2_000_000;
const AUTH_FAILURE_LIMIT = 5;
const AUTH_FAILURE_WINDOW_MS = 60_000;

type RequestLike = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  status?(code: number): ResponseLike;
  json?(value: unknown): unknown;
  end(value?: unknown): unknown;
};

type HandlerDependencies = {
  getRepository: () => DemandRepository;
  adminToken: string;
  allowedOrigin?: string;
  now?: () => string;
  id?: (prefix: string) => string;
};

function header(request: RequestLike, name: string): string | undefined {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function send(response: ResponseLike, status: number, body?: unknown) {
  response.statusCode = status;
  if (response.status) response.status(status);
  if (body === undefined) return response.end();
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (response.json) return response.json(body);
  return response.end(JSON.stringify(body));
}

function errorBody(
  code: DemandApiErrorCode,
  message: string,
  requestId: string,
) {
  return { error: { code, message, requestId } };
}

function tokenMatches(authorization: string | undefined, expected: string) {
  const supplied = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  const actualDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return Boolean(supplied) && timingSafeEqual(actualDigest, expectedDigest);
}

function parseBody(body: unknown): unknown {
  let serialized: string;
  if (typeof body === "string") serialized = body;
  else {
    try {
      serialized = JSON.stringify(body ?? {});
    } catch {
      throw new Error("Request body must be valid JSON");
    }
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_BODY_BYTES) {
    const error = new Error("Request body exceeds the 2 MB limit");
    error.name = "PayloadTooLargeError";
    throw error;
  }
  try {
    return typeof body === "string" ? JSON.parse(body) : (body ?? {});
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

function datasetFromRequest(
  request: DemandPublishRequest,
  now: string,
): PublishedDemandDataset {
  const provisional = canonicalDataset(request, {
    id: "pending",
    publishedAt: now,
  });
  return canonicalDataset(request, {
    id: `demand-${provisional.provenance.contentSha256.slice(0, 16)}`,
    publishedAt: now,
  });
}

export function createDemandHandler(dependencies: HandlerDependencies) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const id =
    dependencies.id ?? ((prefix: string) => `${prefix}-${crypto.randomUUID()}`);
  let failedAuthorization: number[] = [];

  return async (request: RequestLike, response: ResponseLike) => {
    const requestId = id("request");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const method = (request.method ?? "GET").toUpperCase();
    const mutation = method === "POST" || method === "PATCH";
    if (mutation) response.setHeader("Cache-Control", "no-store");

    if (mutation) {
      const origin = header(request, "origin");
      if (
        origin &&
        dependencies.allowedOrigin &&
        origin !== dependencies.allowedOrigin
      ) {
        return send(
          response,
          403,
          errorBody(
            "UNAUTHORIZED",
            "Administrative authorization failed",
            requestId,
          ),
        );
      }
      if (!dependencies.adminToken) {
        return send(
          response,
          503,
          errorBody(
            "NOT_CONFIGURED",
            "Demand administration is not configured",
            requestId,
          ),
        );
      }
      const currentTime = new Date(now()).getTime();
      failedAuthorization = failedAuthorization.filter(
        (time) => currentTime - time < AUTH_FAILURE_WINDOW_MS,
      );
      if (failedAuthorization.length >= AUTH_FAILURE_LIMIT) {
        return send(
          response,
          429,
          errorBody(
            "RATE_LIMITED",
            "Too many failed authorization attempts",
            requestId,
          ),
        );
      }
      if (
        !tokenMatches(header(request, "authorization"), dependencies.adminToken)
      ) {
        failedAuthorization.push(currentTime);
        return send(
          response,
          401,
          errorBody(
            "UNAUTHORIZED",
            "Administrative authorization failed",
            requestId,
          ),
        );
      }
    }

    let repository: DemandRepository;
    try {
      repository = dependencies.getRepository();
    } catch {
      return send(
        response,
        503,
        errorBody(
          "NOT_CONFIGURED",
          "Demand storage is not configured",
          requestId,
        ),
      );
    }

    if (method === "GET") {
      try {
        const url = new URL(
          request.url ?? "/api/demand",
          "https://local.invalid",
        );
        const state = deriveDemandState(
          await repository.listDatasets(),
          await repository.listEvents(),
          {
            includeHistory: url.searchParams.get("include") === "history",
            now: now(),
          },
        );
        const body = JSON.stringify(state);
        const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
        response.setHeader(
          "Cache-Control",
          "public, s-maxage=60, stale-while-revalidate=300",
        );
        response.setHeader("ETag", etag);
        if (header(request, "if-none-match") === etag)
          return send(response, 304);
        return send(response, 200, state);
      } catch {
        return send(
          response,
          503,
          errorBody(
            "STORAGE_FAILURE",
            "Demand data is temporarily unavailable",
            requestId,
          ),
        );
      }
    }

    if (method === "POST") {
      let body: unknown;
      try {
        body = parseBody(request.body);
      } catch (error) {
        const oversized =
          error instanceof Error && error.name === "PayloadTooLargeError";
        return send(
          response,
          oversized ? 413 : 400,
          errorBody(
            "INVALID_DATASET",
            oversized
              ? "Request body exceeds the 2 MB limit"
              : "Request body must be valid JSON",
            requestId,
          ),
        );
      }
      const idempotencyKey = header(request, "idempotency-key")?.trim();
      if (!idempotencyKey || idempotencyKey.length > 200) {
        return send(
          response,
          400,
          errorBody(
            "INVALID_DATASET",
            "A valid Idempotency-Key header is required",
            requestId,
          ),
        );
      }
      try {
        const dataset = datasetFromRequest(validatePublishRequest(body), now());
        const outcome = await repository.putDataset(dataset, idempotencyKey);
        let published = dataset;
        if (outcome === "exists") {
          const stored = (await repository.listDatasets()).find(
            (item) => item.value?.id === dataset.id,
          );
          if (stored?.value) published = stored.value;
        }
        return send(response, outcome === "created" ? 201 : 200, {
          dataset: published,
          outcome,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.startsWith("Idempotency key")) {
          return send(
            response,
            409,
            errorBody(
              "CONFLICT",
              "Idempotency key conflicts with another dataset",
              requestId,
            ),
          );
        }
        if (!message.startsWith("Demand storage")) {
          return send(
            response,
            400,
            errorBody(
              "INVALID_DATASET",
              message || "Dataset is invalid",
              requestId,
            ),
          );
        }
        return send(
          response,
          503,
          errorBody(
            "STORAGE_FAILURE",
            "Demand data could not be stored",
            requestId,
          ),
        );
      }
    }

    if (method === "PATCH") {
      let body: Record<string, unknown>;
      try {
        const parsed = parseBody(request.body);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("invalid");
        body = parsed as Record<string, unknown>;
      } catch (error) {
        const oversized =
          error instanceof Error && error.name === "PayloadTooLargeError";
        return send(
          response,
          oversized ? 413 : 400,
          errorBody(
            "INVALID_DATASET",
            "Administrative event is invalid",
            requestId,
          ),
        );
      }
      const url = new URL(
        request.url ?? "/api/demand",
        "https://local.invalid",
      );
      const datasetId = url.searchParams.get("id")?.trim();
      const action = body.action;
      const expected = body.expectedActiveDatasetId;
      if (
        !datasetId ||
        !new Set(["activate", "supersede", "archive"]).has(String(action)) ||
        (expected !== null && typeof expected !== "string")
      ) {
        return send(
          response,
          400,
          errorBody(
            "INVALID_DATASET",
            "Administrative event is invalid",
            requestId,
          ),
        );
      }
      try {
        const datasets = await repository.listDatasets();
        const events = await repository.listEvents();
        const current = deriveDemandState(datasets, events, {
          includeHistory: true,
          now: now(),
        });
        if (current.activeDatasetId !== expected) {
          return send(
            response,
            409,
            errorBody(
              "CONFLICT",
              "Active dataset changed; refresh and retry",
              requestId,
            ),
          );
        }
        const target = datasets.find(
          (item) => !item.error && item.value?.id === datasetId,
        );
        if (!target?.value) {
          return send(
            response,
            400,
            errorBody("INVALID_DATASET", "Dataset is not available", requestId),
          );
        }
        await repository.appendEvent({
          id: id("event"),
          type: action as "activate" | "supersede" | "archive",
          datasetId,
          occurredAt: now(),
          expectedActiveDatasetId: expected as string | null,
        });
        const updated = deriveDemandState(
          await repository.listDatasets(),
          await repository.listEvents(),
          { includeHistory: true, now: now() },
        );
        const expectedResult = action === "activate" ? datasetId : null;
        if (updated.activeDatasetId !== expectedResult) {
          return send(
            response,
            409,
            errorBody(
              "CONFLICT",
              "Active dataset changed; refresh and retry",
              requestId,
            ),
          );
        }
        return send(response, 200, updated);
      } catch {
        return send(
          response,
          503,
          errorBody(
            "STORAGE_FAILURE",
            "Demand state could not be updated",
            requestId,
          ),
        );
      }
    }

    response.setHeader("Allow", "GET, POST, PATCH");
    return send(
      response,
      405,
      errorBody("INVALID_DATASET", "Method is not supported", requestId),
    );
  };
}

let repository: DemandRepository | undefined;

const defaultHandler = createDemandHandler({
  getRepository: () => {
    if (!repository)
      repository = new VercelBlobDemandRepository({
        token: process.env.BLOB_READ_WRITE_TOKEN ?? "",
      });
    return repository;
  },
  adminToken: process.env.DEMAND_ADMIN_TOKEN ?? "",
  allowedOrigin: process.env.DEMAND_ALLOWED_ORIGIN,
});

export default defaultHandler;
