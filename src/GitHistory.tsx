import { useEffect, useState } from "react";
import { GitCommitHorizontal, RefreshCw, ArrowUp, Clock } from "lucide-react";
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
export function GitHistory({
  id,
  revision,
}: {
  id: string;
  revision?: number;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    setLoading(true);
    window.ajo
      .call("gitHistory", { id, offset: 0 })
      .then((result) => {
        if (!cancelled) setData(result);
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
  }, [id, revision, refresh]);
  async function more() {
    setLoading(true);
    try {
      const result = await window.ajo.call("gitHistory", {
        id,
        offset: data.commits.length,
      });
      setData((old: any) => ({
        ...result,
        commits: [...old.commits, ...result.commits],
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="git-history">
      <div className="panel-title">
        <h3>
          <GitCommitHorizontal size={16} />
          Commit history
        </h3>
        <button
          title="Refresh Git history"
          disabled={loading}
          onClick={() => setRefresh((v) => v + 1)}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      {error && <p className="amber">{error}</p>}
      {!data && loading && <p className="muted">Reading local Git history…</p>}
      {data && (
        <div
          className="detail-scroll history-scroll"
          role="region"
          aria-label="Commit history content"
          tabIndex={0}
        >
          <div className="git-activity">
            <div>
              <div className="eyebrow">
                <ArrowUp size={12} />
                LAST RECORDED PUSH
              </div>
              {data.lastPush ? (
                <>
                  <p>{date(data.lastPush.at)}</p>
                  <p className="wrap">
                    {data.lastPush.commit?.subject ||
                      data.lastPush.hash.slice(0, 8)}
                  </p>
                  <code>{data.lastPush.hash.slice(0, 8)}</code>
                </>
              ) : (
                <p className="muted">No push event recorded locally.</p>
              )}
              <p className="muted">
                Current upstream’s local reflog; may be incomplete.
              </p>
            </div>
            <div>
              <div className="eyebrow">UPSTREAM</div>
              <p className="wrap">
                {data.upstream || "No tracking branch configured"}
              </p>
              {data.upstreamCommit && (
                <>
                  <p className="wrap">{data.upstreamCommit.subject}</p>
                  <p className="muted">
                    {data.upstreamCommit.shortHash} · committed{" "}
                    {date(data.upstreamCommit.committedAt)}
                  </p>
                  <p className="muted">
                    Locally cached remote state, not a push timestamp.
                  </p>
                </>
              )}
            </div>
          </div>
          <p className="muted">
            Current branch history · newest first. Messages are the commit
            comments. Expand for full details.
          </p>
          {data.commits.length ? (
            data.commits.map((c: any, index: number) => (
              <details className="commit" key={c.hash}>
                <summary>
                  <GitCommitHorizontal size={15} />
                  <span>
                    <strong>{c.subject || "(No commit message)"}</strong>
                    <small>
                      {c.author} · {date(c.committedAt)}
                    </small>
                  </span>
                  {index === 0 && <em>Latest</em>}
                </summary>
                <div className="commit-details">
                  <code className="wrap">{c.hash}</code>
                  {c.refs && <p className="muted wrap">{c.refs}</p>}
                  <p className="muted">
                    {c.author} &lt;{c.email}&gt;
                    <br />
                    Authored {date(c.authoredAt)}
                    <br />
                    Committed {date(c.committedAt)}
                  </p>
                  {typeof c.localOnly === "boolean" && (
                    <p className={c.localOnly ? "amber" : "green"}>
                      {c.localOnly
                        ? "Not in cached upstream history"
                        : "Present in cached upstream history"}
                    </p>
                  )}
                  <pre>
                    {c.subject}
                    {c.body ? "\n\n" + c.body : ""}
                  </pre>
                </div>
              </details>
            ))
          ) : (
            <p className="muted">No commits yet.</p>
          )}
          {data.hasMore && (
            <button disabled={loading} onClick={more}>
              {loading ? "Loading…" : "Load older commits"}
            </button>
          )}
          <p className="muted">
            <Clock size={11} /> Local Git data only. No fetch or push is
            performed.
          </p>
        </div>
      )}
    </div>
  );
}
