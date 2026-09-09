import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, RefreshCw } from "lucide-react";
export function ReadmePanel({ id }: { id: string }) {
  const [data, setData] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    setLoading(true);
    window.ajo
      .call("readme", { id })
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, revision]);
  return (
    <div className="panel readme-panel">
      <div className="panel-title">
        <h3>
          <BookOpen size={16} />
          README
        </h3>
        <button
          title="Refresh README"
          disabled={loading}
          onClick={() => setRevision((v) => v + 1)}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      {loading ? (
        <p className="muted">Reading README…</p>
      ) : error ? (
        <p role="alert" className="amber">
          {error}
        </p>
      ) : data ? (
        <>
          <p className="muted readme-location" title={data.path}>
            {data.repositoryFallback ? "Repository README" : "App README"} ·{" "}
            {data.name}
          </p>
          <div
            className="detail-scroll markdown-body"
            role="region"
            aria-label="README content"
            tabIndex={0}
          >
            <Markdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              components={{
                a: ({ children, href }) => (
                  <span className="readme-link" title={href}>
                    {children}
                  </span>
                ),
                img: ({ alt }) => (
                  <span className="muted">[Image: {alt || "image"}]</span>
                ),
              }}
            >
              {data.content || "*This README is empty.*"}
            </Markdown>
          </div>
          {data.truncated && (
            <p className="amber">
              Showing the first 256 KiB. Open the project in your editor to read
              the full file.
            </p>
          )}
        </>
      ) : (
        <p className="muted">
          No README.md found in this app or its repository root.
        </p>
      )}
    </div>
  );
}
