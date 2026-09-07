import { CheckCircle2, Circle } from "lucide-react";
import type { Model } from "./types";
import { Evidence, Method, Section } from "./shared";

export function ModelDetails({ model }: { model: Model<unknown> }) {
  return (
    <Method title={`${model.method.name} · methodology`}>
      <p>{model.method.description}</p>
      <pre>{model.method.formula}</pre>
      <p>{model.method.library}</p>
      <ul>
        {model.limitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Method>
  );
}
export function Readiness({ model }: { model: Model<unknown> }) {
  return (
    <Section
      title={model.title}
      action={<Evidence tone="missing">Awaiting evidence</Evidence>}
    >
      <div className="eco-requirements">
        {model.requirements.map((item) => (
          <div key={item.name}>
            {item.met ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            <div>
              <strong>{item.name}</strong>
              <p>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <ModelDetails model={model} />
    </Section>
  );
}
