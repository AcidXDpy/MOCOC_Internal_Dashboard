import type { ReactNode } from "react";
import { Download, ExternalLink, Info } from "lucide-react";

export function Evidence({
  children,
  tone = "observed",
}: {
  children: ReactNode;
  tone?: "observed" | "model" | "scenario" | "missing";
}) {
  return <span className={`eco-evidence ${tone}`}>{children}</span>;
}
export function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  tone?: string;
}) {
  return (
    <div
      className="eco-stat"
      style={tone ? { borderTopColor: tone } : undefined}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function Section({
  title,
  note,
  action,
  children,
  className = "",
}: {
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`eco-section ${className}`}>
      <div className="eco-section-heading">
        <div>
          <h3>{title}</h3>
          {note && <p>{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Caveat({ children }: { children: ReactNode }) {
  return (
    <div className="eco-caveat">
      <Info size={16} />
      <div>{children}</div>
    </div>
  );
}
export function Method({
  title = "Method & limitations",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <details className="eco-method">
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}
export function Source({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a className="eco-source" href={href} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={12} />
    </a>
  );
}
export function DownloadButton({
  onClick,
  label = "Export data",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="eco-button" onClick={onClick}>
      <Download size={15} />
      {label}
    </button>
  );
}
