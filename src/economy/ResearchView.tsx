import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Download } from "lucide-react";
const documents = import.meta.glob("/docs/economic-intelligence/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
export default function ResearchView() {
  const paths = Object.keys(documents).sort();
  const [path, setPath] = useState(
    paths.find((p) => p.endsWith("technical-design.md")) ?? paths[0],
  );
  const content = documents[path] ?? "Research document unavailable.";
  const label = (p: string) =>
    p.split("/").at(-1)!.replace(".md", "").replaceAll("-", " ");
  return (
    <>
      <div className="eco-toolbar">
        <label>
          Research document
          <select
            aria-label="Research document"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          >
            {paths.map((p) => (
              <option key={p} value={p}>
                {label(p)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="eco-button"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([content], { type: "text/markdown" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = path.split("/").at(-1)!;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download size={15} />
          Download research
        </button>
      </div>
      <article className="eco-document">
        <Markdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            a: ({ href, children }) => {
              const linked = paths.find((p) => p.split("/").at(-1) === href);
              return linked ? (
                <a
                  href="#research"
                  onClick={(event) => {
                    event.preventDefault();
                    setPath(linked);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  {children}
                </a>
              ) : (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              );
            },
          }}
        >
          {content}
        </Markdown>
      </article>
    </>
  );
}
