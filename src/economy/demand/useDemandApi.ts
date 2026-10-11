import { useCallback, useEffect, useState } from "react";
import { fetchDemandApi, publishedToDemandBatch } from "./api";
import type { DemandApiEnvelope } from "./api-types";
import type { DemandBatch } from "./types";

export type DemandApiState = {
  status: "loading" | "available" | "empty" | "unavailable";
  active: DemandBatch | null;
  envelope: DemandApiEnvelope | null;
  refresh: () => void;
};

export function useDemandApi(): DemandApiState {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<Omit<DemandApiState, "refresh">>({
    status: "loading",
    active: null,
    envelope: null,
  });
  useEffect(() => {
    let current = true;
    void fetchDemandApi({
      endpoint: revision ? `/api/demand?refresh=${revision}` : "/api/demand",
    }).then((result) => {
      if (!current) return;
      if (result.status === "unavailable") {
        setState((existing) =>
          existing.active
            ? existing
            : { status: "unavailable", active: null, envelope: null },
        );
        return;
      }
      const published = result.data.datasets.find(
        (dataset) => dataset.id === result.data.activeDatasetId,
      );
      if (!published) {
        setState({ status: "empty", active: null, envelope: result.data });
        return;
      }
      try {
        setState({
          status: "available",
          active: publishedToDemandBatch(published),
          envelope: result.data,
        });
      } catch {
        setState({ status: "unavailable", active: null, envelope: null });
      }
    });
    return () => {
      current = false;
    };
  }, [revision]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return { ...state, refresh };
}
