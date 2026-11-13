"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, X } from "lucide-react";
import { DEV_MODE_ENABLED } from "@/lib/dev-mode";

const BAR_HEIGHT = "28px";
const REFRESH_MS = 60_000;
const HIDDEN_KEY = "dev-usage-bar-hidden";

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
};

const percent = (used, limit) => (limit ? (used / limit) * 100 : 0);

// green < 70%, amber < 90%, red >= 90%
const levelClass = (pct) =>
  pct >= 90 ? "text-red-400" : pct >= 70 ? "text-amber-300" : "text-emerald-400";

const barClass = (pct) =>
  pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-400" : "bg-emerald-500";

function Meter({ label, used, limit, format = (v) => v, hint }) {
  const pct = percent(used, limit);
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-slate-300">{label}</span>
        <span className={levelClass(pct)}>
          {format(used)} / {format(limit)} ({Math.round(pct)}%)
        </span>
      </div>
      <div className="h-1.5 w-full rounded bg-slate-700 overflow-hidden">
        <div
          className={`h-full ${barClass(pct)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function SectionError({ error }) {
  return <p className="text-xs text-red-400">Couldn&apos;t load: {error}</p>;
}

const timeAgo = (ts) => {
  if (!ts) return "never";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

export default function DevUsageBar() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(localStorage.getItem(HIDDEN_KEY) === "1");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dev/usage", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setFetchError(null);
    } catch (e) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!DEV_MODE_ENABLED) return;
    load();
    const id = setInterval(load, REFRESH_MS);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  if (!DEV_MODE_ENABLED) return null;

  const setHiddenPersisted = (value) => {
    setHidden(value);
    localStorage.setItem(HIDDEN_KEY, value ? "1" : "0");
    if (value) setExpanded(false);
  };

  // Pushes page content and fixed headers down so the bar never covers them
  const layoutStyle = (
    <style>{`
      :root { --dev-bar-h: ${hidden ? "0px" : BAR_HEIGHT}; }
      body { padding-top: var(--dev-bar-h); }
    `}</style>
  );

  if (hidden) {
    return (
      <>
        {layoutStyle}
        <button
          type="button"
          onClick={() => setHiddenPersisted(false)}
          className="fixed top-0 right-3 z-[100] rounded-b-md bg-purple-700 px-2 py-0.5 text-[11px] font-semibold text-white shadow"
          aria-label="Show developer usage bar"
        >
          DEV
        </button>
      </>
    );
  }

  const ik = data?.imagekit;
  const gemini = data?.gemini;
  const clerk = data?.clerk;
  const convex = data?.convex;

  const extPct = ik && !ik.error ? percent(ik.extensionUnits.used, ik.extensionUnits.limit) : 0;
  const bwPct = ik && !ik.error ? percent(ik.bandwidth.used, ik.bandwidth.limit) : 0;
  const flashUsed = gemini?.models?.["gemini-3.8-flash"]?.success || 0;
  const flashLimit = gemini?.limits?.["gemini-3.8-flash"] || 20;
  const geminiTotal = gemini?.models
    ? Object.values(gemini.models).reduce((s, m) => s + m.success, 0)
    : 0;

  return (
    <>
      {layoutStyle}
      <div className="fixed top-0 left-0 right-0 z-[100] text-white">
        {/* Slim summary bar */}
        <div
          className="flex items-center gap-3 px-3 bg-slate-950/95 border-b border-purple-700/60 backdrop-blur text-[11px] overflow-x-auto whitespace-nowrap"
          style={{ height: BAR_HEIGHT }}
        >
          <span className="rounded bg-purple-700 px-1.5 py-0.5 font-bold tracking-wide">
            DEV
          </span>

          {fetchError && <span className="text-red-400">Usage API: {fetchError}</span>}
          {!data && !fetchError && <span className="text-slate-400">Loading usage…</span>}

          {data && (
            <>
              {ik?.error ? (
                <span className="text-red-400">ImageKit: error</span>
              ) : ik ? (
                <>
                  <span>
                    ImageKit AI{" "}
                    <b className={levelClass(extPct)}>
                      {ik.extensionUnits.used}/{ik.extensionUnits.limit}
                    </b>
                  </span>
                  <span>
                    Bandwidth{" "}
                    <b className={levelClass(bwPct)}>{formatBytes(ik.bandwidth.used)}</b>
                    <span className="text-slate-500">/20 GB</span>
                  </span>
                </>
              ) : null}

              <span className="text-slate-600">|</span>
              <span>
                Gemini 3.8-flash today{" "}
                <b className={levelClass(percent(flashUsed, flashLimit))}>
                  {flashUsed}/{flashLimit}
                </b>
                <span className="text-slate-500"> · all models {geminiTotal}</span>
              </span>

              <span className="text-slate-600">|</span>
              {clerk?.error ? (
                <span className="text-red-400">Clerk: error</span>
              ) : (
                <span>
                  Clerk users <b className="text-emerald-400">{clerk?.totalUsers ?? "–"}</b>
                  <span className="text-slate-500">/50k</span>
                </span>
              )}

              <span className="text-slate-600">|</span>
              <a
                href={convex?.dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
              >
                Convex usage <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}

          <div className="ml-auto flex items-center gap-1 pl-2">
            {data && (
              <span className="text-slate-500 hidden sm:inline">
                updated {timeAgo(data.fetchedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={load}
              className="p-1 rounded hover:bg-slate-800"
              aria-label="Refresh usage"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="p-1 rounded hover:bg-slate-800"
              aria-label={expanded ? "Collapse usage details" : "Expand usage details"}
              aria-expanded={expanded}
              title="Details"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setHiddenPersisted(true)}
              className="p-1 rounded hover:bg-slate-800"
              aria-label="Hide developer usage bar"
              title="Hide"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Detail panel */}
        {expanded && data && (
          <div className="bg-slate-950/98 border-b border-purple-700/60 shadow-2xl max-h-[70vh] overflow-y-auto">
            <div className="max-w-7xl mx-auto grid gap-6 p-4 md:grid-cols-2 lg:grid-cols-4">
              {/* ImageKit */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">ImageKit · images</h3>
                {ik?.error ? (
                  <SectionError error={ik.error} />
                ) : (
                  <>
                    <Meter
                      label="AI extension units"
                      used={ik.extensionUnits.used}
                      limit={ik.extensionUnits.limit}
                      hint="Background removal 10 · Drop shadow 1 · resize/crop/text free"
                    />
                    <Meter label="Bandwidth" used={ik.bandwidth.used} limit={ik.bandwidth.limit} format={formatBytes} />
                    <Meter label="Storage" used={ik.storage.used} limit={ik.storage.limit} format={formatBytes} />
                    <p className="text-[11px] text-slate-500">
                      {ik.period} · resets {ik.resets}
                    </p>
                  </>
                )}
              </section>

              {/* Gemini */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Gemini · AI writing (today)</h3>
                {gemini?.error ? (
                  <SectionError error={gemini.error} />
                ) : Object.keys(gemini.models).length === 0 ? (
                  <p className="text-xs text-slate-400">No requests yet today.</p>
                ) : (
                  Object.entries(gemini.models).map(([model, m]) =>
                    gemini.limits[model] ? (
                      <Meter
                        key={model}
                        label={model}
                        used={m.success}
                        limit={gemini.limits[model]}
                        hint={`busy ${m.overloaded} · rate-limited ${m.rateLimited} · failed ${m.failed}`}
                      />
                    ) : (
                      <div key={model} className="text-xs flex justify-between gap-3">
                        <span className="text-slate-300">{model}</span>
                        <span className="text-slate-400">
                          {m.success} ok · busy {m.overloaded} · limited {m.rateLimited}
                        </span>
                      </div>
                    )
                  )
                )}
                {gemini?.lastError && (
                  <p className="text-[11px] text-amber-300 break-words">
                    Last error ({gemini.lastError.model}, {timeAgo(gemini.lastError.at)}):{" "}
                    {gemini.lastError.message}
                  </p>
                )}
                <p className="text-[11px] text-slate-500">
                  Counted by this app · resets {gemini?.resets} · exact limits in AI Studio
                </p>
              </section>

              {/* Clerk */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Clerk · authentication</h3>
                {clerk?.error ? (
                  <SectionError error={clerk.error} />
                ) : (
                  <Meter
                    label="Users (free plan: 50k monthly retained)"
                    used={clerk.totalUsers}
                    limit={clerk.limit}
                    format={(v) => v.toLocaleString()}
                    hint="Shows total signed-up users, the upper bound of monthly retained users"
                  />
                )}
              </section>

              {/* Convex */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Convex · database</h3>
                <p className="text-xs text-slate-400">
                  Convex only shows usage in its dashboard. Free plan limits:
                </p>
                <ul className="text-xs text-slate-300 space-y-0.5">
                  <li>Function calls: {convex.limits.functionCalls}</li>
                  <li>Database storage: {convex.limits.databaseStorage}</li>
                  <li>Database I/O: {convex.limits.databaseIO}</li>
                  <li>File storage: {convex.limits.fileStorage}</li>
                  <li>Egress: {convex.limits.egress}</li>
                  <li>Action compute: {convex.limits.actionCompute}</li>
                </ul>
                <a
                  href={convex.dashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200"
                >
                  Open {convex.deployment || "Convex"} dashboard <ExternalLink className="h-3 w-3" />
                </a>
              </section>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
