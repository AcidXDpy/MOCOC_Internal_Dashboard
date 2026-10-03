import { ArrowRight } from "lucide-react";
import { demoBatch } from "./demo";
import { signed, sortSummaries, summarize } from "./engine";
import { InterestChart } from "./DemandCharts";
import { Section } from "../shared";
import "./demand.css";
export default function DemandPulse({ onExplore }: { onExplore: () => void }) {
  const data = summarize(demoBatch, 12);
  const gap = sortSummaries(data.rows, "demandGap", "desc")[0];
  const rising = sortSummaries(data.rows, "change3m", "desc")[0];
  const top = sortSummaries(data.rows, "averageInterest", "desc")[0];
  return (
    <div className="demand-home">
      <Section
        title="Local Demand Pulse"
        note="Consumer search interest meets the represented business landscape."
        action={
          <button className="eco-button demand-primary" onClick={onExplore}>
            Explore Local Demand <ArrowRight size={16} />
          </button>
        }
      >
        <div className="demand-home-body">
          <div className="demand-home-metrics">
            <button onClick={onExplore}>
              <span>Largest demand gap</span>
              <strong>{gap.name}</strong>
              <b>{signed(gap.demandGap, 2)}</b>
            </button>
            <button onClick={onExplore}>
              <span>Fastest rising category</span>
              <strong>{rising.name}</strong>
              <b>{signed(rising.change3m)}%</b>
            </button>
            <button onClick={onExplore}>
              <span>Top interest category</span>
              <strong>{top.name}</strong>
              <b>{top.averageInterest?.toFixed(1)} / 100</b>
            </button>
          </div>
          <div>
            <InterestChart rows={[top, rising]} start={data.start} small />
            <p className="eco-footnote">
              {data.start} to {data.end}
            </p>
          </div>
        </div>
        <p className="demand-context">
          <strong className="demand-demo">Demo Data</strong> Search signals are
          synthetic. Supply uses real public listings. Full page supports your
          imports.
        </p>
      </Section>
    </div>
  );
}
