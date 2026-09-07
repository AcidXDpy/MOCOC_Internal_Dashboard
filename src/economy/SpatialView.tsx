import { useEffect, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { FeatureCollection } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { members } from "../data/members";
import type { EconomyResults, Tract } from "./types";
import {
  Caveat,
  DownloadButton,
  Evidence,
  Section,
  Source,
  Stat,
} from "./shared";
import { chartTooltip, downloadJson, number } from "./formatters";
import { ModelDetails, Readiness } from "./ModelDetails";

const clusterColors: Record<string, string> = {
  "high-high": "#bb4c42",
  "low-low": "#397b9d",
  "high-low": "#d8a86c",
  "low-high": "#84c6c7",
  "not-significant": "#b6c2b8",
};
function Recenter({ directory }: { directory: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.setView(
      directory ? [40.868, -74.732] : [40.875, -74.535],
      directory ? 11 : 10,
    );
  }, [map, directory]);
  return null;
}

export default function SpatialView({ data }: { data: EconomyResults }) {
  const [layer, setLayer] = useState("income");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Tract | null>(null);
  const [boundaries, setBoundaries] = useState<FeatureCollection | null>(null);
  const [boundaryError, setBoundaryError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/economy/tracts.geojson", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Tract boundary file unavailable");
        return r.json();
      })
      .then((j: FeatureCollection) => {
        if (j.type !== "FeatureCollection") throw new Error("Invalid geometry");
        setBoundaries(j);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setBoundaryError(true);
      });
    return () => controller.abort();
  }, []);
  const s = data.spatial.result;
  if (!s) return <Readiness model={data.spatial} />;
  const directory = layer === "directory";
  const tractById = new Map(s.tracts.map((t) => [t.geoid, t]));
  const tract = (properties: Record<string, unknown> | null) =>
    tractById.get(
      String(
        properties?.geoid ?? properties?.GEOID ?? properties?.GEOID20 ?? "",
      ),
    );
  const fill = (t?: Tract) =>
    !t
      ? "#dce3dd"
      : layer === "clusters"
        ? (clusterColors[t.cluster] ?? "#b6c2b8")
        : t.standardizedValue > 1
          ? "#136854"
          : t.standardizedValue > 0
            ? "#499579"
            : t.standardizedValue > -1
              ? "#aacdb4"
              : "#e3ecd9";
  const mapped = members.filter(
    (m) =>
      m.data_source === "public_directory" &&
      m.latitude != null &&
      m.longitude != null &&
      `${m.business_name} ${m.city} ${m.industry}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="eco-toolbar">
        <div className="eco-segmented">
          <button
            aria-pressed={layer === "income"}
            onClick={() => setLayer("income")}
          >
            Income context
          </button>
          <button
            aria-pressed={layer === "clusters"}
            onClick={() => setLayer("clusters")}
          >
            Local clusters
          </button>
          <button
            aria-pressed={directory}
            onClick={() => setLayer("directory")}
          >
            Business locations
          </button>
        </div>
        {directory && (
          <input
            className="eco-search"
            placeholder="Find a business, town or industry"
            aria-label="Map business search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        <DownloadButton
          onClick={() => downloadJson("spatial-statistics.json", data.spatial)}
        />
      </div>
      <div className="eco-stats">
        <Stat
          label="Global Moran's I"
          value={number(s.global.statistic, 3)}
          detail={`Null expectation ${number(s.global.expected, 3)}`}
        />
        <Stat
          label="Permutation p-value"
          value={number(s.global.pValue, 4)}
          detail={`${number(s.permutations)} permutations · global association`}
        />
        <Stat
          label="Geographic sample"
          value={`${s.n} tracts`}
          detail={
            boundaries
              ? `${s.n} eligible of ${boundaries.features.length} county boundary tracts`
              : "Eligible complete-case county tracts"
          }
        />
        <Stat
          label="Cluster inference"
          value="FDR adjusted"
          detail="Local significance uses adjusted q-values"
        />
      </div>
      <div className="eco-map-layout">
        <Section
          title={
            directory
              ? "Observed business locations"
              : layer === "clusters"
                ? "Spatial clustering of household income"
                : "Household income by census tract"
          }
          note={
            directory
              ? `${mapped.length} mapped public listings · directory snapshot July 16, 2026`
              : `${s.period} · ${s.variable}`
          }
          action={
            <Evidence tone={directory ? "observed" : "model"}>
              {directory ? "Selected sample" : "Tract estimates"}
            </Evidence>
          }
        >
          <div className="eco-map">
            <MapContainer
              center={[40.875, -74.535]}
              zoom={10}
              className="h-full w-full"
              scrollWheelZoom={false}
            >
              <Recenter directory={directory} />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {!directory && boundaries && (
                <GeoJSON
                  key={layer}
                  data={boundaries}
                  style={(feature) =>
                    ({
                      color: "#536b60",
                      weight: 0.7,
                      fillColor: fill(tract(feature?.properties)),
                      fillOpacity: 0.7,
                    }) as PathOptions
                  }
                  onEachFeature={(feature, featureLayer: Layer) => {
                    const t = tract(feature.properties);
                    if (t) featureLayer.on("click", () => setSelected(t));
                    else
                      featureLayer.bindPopup(
                        "Excluded from the complete-case tract sample. No model result is published for this tract.",
                      );
                  }}
                />
              )}
              {!directory &&
                !boundaries &&
                s.tracts
                  .filter(
                    (t) =>
                      Number.isFinite(t.latitude) &&
                      Number.isFinite(t.longitude),
                  )
                  .map((t) => (
                    <CircleMarker
                      key={t.geoid}
                      center={[t.latitude, t.longitude]}
                      radius={6}
                      pathOptions={{
                        fillColor: fill(t),
                        color: "#536b60",
                        weight: 1,
                        fillOpacity: 0.8,
                      }}
                      eventHandlers={{ click: () => setSelected(t) }}
                    />
                  ))}
              {directory &&
                mapped.map((m) => (
                  <CircleMarker
                    key={m.member_id}
                    center={[m.latitude!, m.longitude!]}
                    radius={6}
                    pathOptions={{
                      color: "#fff",
                      weight: 1.5,
                      fillColor: "#146955",
                      fillOpacity: 0.85,
                    }}
                  >
                    <Popup>
                      <strong>{m.business_name}</strong>
                      <p>
                        {m.industry}
                        <br />
                        {m.address}, {m.city}
                      </p>
                      {m.source_url && (
                        <Source href={m.source_url}>Directory record</Source>
                      )}
                    </Popup>
                  </CircleMarker>
                ))}
            </MapContainer>
          </div>
          <div className="eco-chart-legend">
            {!directory && (
              <span>
                <i style={{ background: "#dce3dd" }} />
                Excluded / no model result
              </span>
            )}
            {layer === "clusters" ? (
              Object.entries(clusterColors).map(([label, color]) => (
                <span key={label}>
                  <i style={{ background: color }} />
                  {label}
                </span>
              ))
            ) : directory ? (
              <span>
                Public directory coordinates · not a census of businesses
              </span>
            ) : (
              <>
                <span>
                  <i style={{ background: "#e3ecd9" }} />
                  Lower income
                </span>
                <span>
                  <i style={{ background: "#136854" }} />
                  Higher income
                </span>
              </>
            )}
          </div>
          {boundaryError && !directory && (
            <p className="eco-footnote">
              Tract boundaries unavailable. Showing tract representative points
              instead.
            </p>
          )}
        </Section>
        <Section
          title={selected?.name ?? "Spatial inference"}
          note={selected?.geoid ?? "Morris County, New Jersey"}
        >
          {selected ? (
            <>
              <div className="eco-detail-metrics">
                <Stat
                  label="Median household income"
                  value={`$${number(selected.value)}`}
                  detail={`90% MOE +/- $${number(selected.marginOfError)}`}
                />
                <Stat
                  label="Local cluster"
                  value={selected.cluster}
                  detail={`Permutation p ${number(selected.pValue, 4)} · adjusted q ${number(selected.qValue, 4)}`}
                />
              </div>
              <p className="eco-footnote">
                Local Moran's I: {number(selected.localI, 3)}. This is an
                association in household income, not a business-growth hotspot.
              </p>
            </>
          ) : (
            <>
              <p className="eco-footnote">
                The map studies spatial dependence in survey estimates.
                Geographic neighbors can share household conditions without one
                area causing changes in the other.
              </p>
              <p className="eco-footnote">{s.weightDefinition}</p>
            </>
          )}
          <Caveat>
            ACS tracts are statistical areas. They are not commercial corridors.
            The Chamber's wider directory footprint does not define Mount
            Olive's boundaries.
          </Caveat>
        </Section>
      </div>
      <div className="eco-two-col">
        <Section
          title="Moran scatterplot"
          note="Standardized tract value vs. spatially lagged neighbors"
        >
          <div className="eco-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
              >
                <CartesianGrid stroke="#e3e8e5" />
                <XAxis
                  type="number"
                  dataKey="standardizedValue"
                  name="Standardized income"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="spatialLag"
                  name="Spatial lag"
                  tick={{ fontSize: 11 }}
                />
                <ReferenceLine x={0} stroke="#929f96" />
                <ReferenceLine y={0} stroke="#929f96" />
                <Tooltip
                  {...chartTooltip}
                  cursor={{ strokeDasharray: "3 3" }}
                />
                <Scatter data={s.tracts} fill="#15816e" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section
          title="Weight-matrix sensitivity"
          note="A spatial result should not depend entirely on one neighbor definition"
        >
          <table className="eco-table">
            <thead>
              <tr>
                <th>Neighbors k</th>
                <th>Moran's I</th>
                <th>Permutation p</th>
              </tr>
            </thead>
            <tbody>
              {s.sensitivity.map((r) => (
                <tr key={r.k}>
                  <td>{r.k}</td>
                  <td>{number(r.statistic, 3)}</td>
                  <td>{number(r.pValue, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
      <ModelDetails model={data.spatial} />
    </>
  );
}
