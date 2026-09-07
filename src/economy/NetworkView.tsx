import { useMemo, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { forceCollide, forceSimulation, forceX, forceY } from "d3-force";
import type { EconomyResults } from "./types";
import { Caveat, DownloadButton, Evidence, Section, Stat } from "./shared";
import { colors, downloadJson, number } from "./formatters";
import { ModelDetails, Readiness } from "./ModelDetails";

export default function NetworkView({ data }: { data: EconomyResults }) {
  const network = data.network.result;
  const [mode, setMode] = useState("industry");
  const [selectedId, setSelectedId] = useState("");
  const [threshold, setThreshold] = useState(0);
  const [zoom, setZoom] = useState(1);
  const graph = useMemo(() => {
    if (!network) return { nodes: [], edges: [] };
    const result =
      mode === "industry"
        ? {
            nodes: network.nodes.map((n) => ({
              ...n,
              detail: `${number(n.establishments)} establishments · RCA ${number(n.rca, 2)}`,
              size: 7 + Math.sqrt(n.share) * 35,
            })),
            edges: network.edges.filter((e) => e.weight >= threshold),
          }
        : {
            nodes: network.directoryNetwork.nodes.map((n) => ({
              ...n,
              detail: n.industry,
              size: 5 + Math.sqrt(n.degree) * 1.5,
            })),
            edges: network.directoryNetwork.edges.map((e) => ({
              ...e,
              weight: 0.3,
            })),
          };
    const nodes = result.nodes.map((n) => ({
      ...n,
      x: n.x * 310,
      y: n.y * 175,
    }));
    const simulation = forceSimulation(nodes)
      .force(
        "collision",
        forceCollide<(typeof nodes)[number]>()
          .radius((n) => n.size + 8)
          .iterations(4),
      )
      .force("x", forceX<(typeof nodes)[number]>((n) => n.x).strength(0.01))
      .force("y", forceY<(typeof nodes)[number]>((n) => n.y).strength(0.01))
      .stop();
    simulation.tick(180);
    const scale = Math.max(
      1,
      ...nodes.map((n) =>
        Math.max(
          (Math.abs(n.x) + n.size + 10) / 365,
          (Math.abs(n.y) + n.size + 10) / 220,
        ),
      ),
    );
    return {
      edges: result.edges,
      nodes: nodes.map((n) => ({
        ...n,
        x: n.x / scale,
        y: n.y / scale,
        size: n.size / scale,
      })),
    };
  }, [network, mode, threshold]);
  if (!network) return <Readiness model={data.network} />;
  const selected = graph.nodes.find((n) => n.id === selectedId);
  const neighbors = new Set(
    graph.edges
      .filter((e) => e.source === selectedId || e.target === selectedId)
      .flatMap((e) => [e.source, e.target]),
  );
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const px = (x: number) => 400 + x * zoom,
    py = (y: number) => 245 + y * zoom;
  const ranked = graph.nodes
    .slice()
    .sort((a, b) => b.betweenness - a.betweenness)
    .slice(0, 10);
  return (
    <>
      <div className="eco-toolbar">
        <div className="eco-segmented">
          <button
            aria-pressed={mode === "industry"}
            onClick={() => {
              setMode("industry");
              setSelectedId("");
            }}
          >
            Industry similarity
          </button>
          <button
            aria-pressed={mode === "directory"}
            onClick={() => {
              setMode("directory");
              setSelectedId("");
            }}
          >
            Directory relationships
          </button>
        </div>
        {mode === "industry" && (
          <label className="eco-range-inline">
            Minimum similarity{" "}
            <input
              aria-label="Minimum edge similarity"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <b>{threshold.toFixed(2)}</b>
          </label>
        )}
        <DownloadButton
          onClick={() =>
            downloadJson("economic-network.json", {
              evidence:
                mode === "industry"
                  ? network.edgeMeaning
                  : network.directoryNetwork.coverageNote,
              ...graph,
            })
          }
        />
      </div>
      <Caveat>
        {mode === "industry"
          ? network.edgeMeaning
          : network.directoryNetwork.coverageNote}{" "}
        Network centrality is a graph property; it does not prove economic
        importance or an actual supply relationship.
      </Caveat>
      <div className="eco-stats three">
        <Stat
          label="Nodes"
          value={graph.nodes.length}
          detail={
            mode === "industry"
              ? "Broad industry sectors"
              : "Observed directory listings"
          }
        />
        <Stat
          label="Displayed relationships"
          value={graph.edges.length}
          detail={
            mode === "industry"
              ? "Edges above similarity threshold"
              : network.directoryNetwork.relationTypes.join(" · ")
          }
        />
        <Stat
          label="Reference areas"
          value={network.nGeographies}
          detail="Geographies used for sector comparison"
        />
      </div>
      <div className="eco-split-main">
        <Section
          title={
            mode === "industry"
              ? "Industry relatedness"
              : "Directory relationship graph"
          }
          note="Node color: graph community · inspect a node for details"
          action={
            <div className="eco-inline">
              <button
                className="eco-icon-button"
                title="Zoom out"
                aria-label="Zoom out network"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
              >
                <Minus size={16} />
              </button>
              <button
                className="eco-icon-button"
                title="Reset view"
                aria-label="Reset network view"
                onClick={() => setZoom(1)}
              >
                <Maximize2 size={16} />
              </button>
              <button
                className="eco-icon-button"
                title="Zoom in"
                aria-label="Zoom in network"
                onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
              >
                <Plus size={16} />
              </button>
            </div>
          }
        >
          <div className="eco-network">
            <svg
              viewBox="0 0 800 490"
              aria-label="Interactive economic relationship network"
              role="group"
            >
              {graph.edges.map((e, i) => {
                const a = nodeById.get(e.source),
                  b = nodeById.get(e.target);
                return a && b ? (
                  <line
                    key={i}
                    x1={px(a.x)}
                    y1={py(a.y)}
                    x2={px(b.x)}
                    y2={py(b.y)}
                    stroke={
                      selectedId &&
                      (e.source === selectedId || e.target === selectedId)
                        ? "#15816e"
                        : "#afbeb5"
                    }
                    strokeOpacity={
                      selectedId &&
                      e.source !== selectedId &&
                      e.target !== selectedId
                        ? 0.15
                        : 0.4
                    }
                    strokeWidth={Math.max(0.7, e.weight * 2)}
                  />
                ) : null;
              })}
              {graph.nodes.map((n) => (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect ${n.label}`}
                  onClick={() => setSelectedId(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(n.id);
                    }
                  }}
                  className="eco-network-node"
                >
                  <title>
                    {n.label} · {n.detail}
                  </title>
                  <circle
                    cx={px(n.x)}
                    cy={py(n.y)}
                    r={n.size}
                    fill={colors[n.community % colors.length]}
                    opacity={
                      selectedId && n.id !== selectedId && !neighbors.has(n.id)
                        ? 0.2
                        : 0.95
                    }
                    stroke={n.id === selectedId ? "#13291e" : "#ffffff"}
                    strokeWidth={n.id === selectedId ? 3 : 2}
                  />
                  {mode === "industry" && (
                    <text
                      x={px(n.x)}
                      y={py(n.y) + 4}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#fff"
                      fontWeight={700}
                      pointerEvents="none"
                    >
                      {n.id}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </Section>
        <Section
          title={selected?.label ?? "Network structure"}
          note={
            selected?.detail ?? "Centrality computed on the full source graph"
          }
        >
          {selected ? (
            <>
              <div className="eco-detail-metrics">
                <Stat
                  label="Full-graph degree"
                  value={selected.degree}
                  detail="Number of graph neighbors"
                />
                <Stat
                  label="Betweenness"
                  value={number(selected.betweenness, 4)}
                  detail="Share of shortest paths; not a measured spillover"
                />
              </div>
              <p className="eco-footnote">
                {neighbors.size - (neighbors.has(selected.id) ? 1 : 0)}{" "}
                neighbors in the displayed graph.
              </p>
              <button
                className="eco-link-button"
                onClick={() => setSelectedId("")}
              >
                Clear selection
              </button>
            </>
          ) : (
            <p className="eco-footnote">
              The relationship definitions determine the graph. Changing the
              threshold changes visible connectivity, while the table retains
              centralities from the full model graph.
            </p>
          )}
          <div className="eco-compact-list">
            {ranked.map((n) => (
              <button key={n.id} onClick={() => setSelectedId(n.id)}>
                <span>{n.label}</span>
                <b>{number(n.betweenness, 3)}</b>
              </button>
            ))}
          </div>
          <Evidence tone="model">Descriptive network</Evidence>
        </Section>
      </div>
      <ModelDetails model={data.network} />
    </>
  );
}
