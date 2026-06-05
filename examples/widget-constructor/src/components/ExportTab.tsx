import { parseHttpUrl } from "@toncast/widget/url";
import { WIDGET_CDN_JS_URL } from "@toncast/widget-loader";
import { useEffect, useRef, useState } from "react";
import type { ConstructorConfig } from "../types";
import { PLACEHOLDER_DOMAIN } from "../utils/buildWidgetConfig";
import { copyTextToClipboard } from "../utils/copyTextToClipboard";
import { downloadZip } from "../utils/generateZip";
import { buildManifestJson, safeHttpUrl } from "../utils/manifest";
import { buildJsSnippet, buildReactSnippet } from "../utils/snippets";

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const statusMsg =
    state === "copied" ? "Copied to clipboard" : state === "error" ? "Copy failed" : "";

  return (
    <div className="flex items-center gap-2">
      <span className="sr-only" aria-live="polite">
        {statusMsg}
      </span>
      <button
        type="button"
        onClick={async () => {
          if (timerRef.current !== null) clearTimeout(timerRef.current);
          try {
            await copyTextToClipboard(text);
            setState("copied");
          } catch {
            setState("error");
          }
          timerRef.current = setTimeout(() => setState("idle"), 2000);
        }}
        className="text-xs px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors font-medium"
      >
        {state === "copied" ? "✓ Copied" : state === "error" ? "✗ Failed" : "Copy"}
      </button>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-lg border border-slate-700 overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-slate-400 font-semibold uppercase tracking-wide text-[10px]">
          {title}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="p-3 overflow-x-auto bg-slate-900 text-slate-300 leading-relaxed font-mono text-[11px]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ExportTab({ config }: { config: ConstructorConfig }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const domainError: string | null = !config.domain
    ? "Set app domain in Config tab to enable ZIP download."
    : !parseHttpUrl(config.domain)
      ? "App domain must be a valid https:// URL (e.g. https://my-app.com)."
      : null;

  const iconUrlMissing = !config.iconUrl || !parseHttpUrl(config.iconUrl);

  const handleDownload = async () => {
    if (domainError) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadZip(config);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-sky-900/20 border border-sky-800/40 px-3 py-2.5 text-xs text-sky-400 leading-snug">
        <strong>Deploy vs preview:</strong> ZIP and CDN embeds use a full-viewport shell (no card
        shadow, <code className="text-sky-300/90">--tc-shell-radius: 0</code>). Theme is applied via{" "}
        <code className="text-sky-300/90">widget.cssVars</code> in the generated config.
      </div>

      {domainError && (
        <div className="rounded-lg bg-amber-900/20 border border-amber-700/40 px-3 py-2 text-xs text-amber-400">
          {domainError}
        </div>
      )}

      {downloadError && (
        <div className="rounded-lg bg-red-900/20 border border-red-700/40 px-3 py-2 text-xs text-red-400">
          ZIP error: {downloadError}
        </div>
      )}

      {/* Download ZIP */}
      <div className="rounded-lg border-2 border-dashed border-slate-700 p-4 text-center">
        <div className="text-2xl mb-2">📦</div>
        <p className="text-xs font-semibold text-slate-200 mb-1">Download ZIP</p>
        <p className="text-xs text-slate-500 mb-3">
          Deploy to Cloudflare Pages or any static host —{" "}
          <code className="text-slate-400">index.html</code> +{" "}
          <code className="text-slate-400">index.iife.css</code> +{" "}
          <code className="text-slate-400">tonconnect-manifest.json</code> (theme in embedded{" "}
          <code className="text-slate-400">widget.cssVars</code>)
        </p>
        {iconUrlMissing && !domainError && (
          <p className="mb-3 rounded-md bg-amber-900/20 border border-amber-700/40 px-3 py-2 text-[11px] text-amber-400/90 leading-snug text-left">
            <strong>Wallet icon:</strong> No App icon URL set — manifest will reference{" "}
            <code className="text-amber-300/80">
              {safeHttpUrl(config.domain) ?? PLACEHOLDER_DOMAIN}/icon-192.png
            </code>
            . Upload a square
            PNG (&ge;180&times;180 px) to that path after deploy, or set the{" "}
            <strong>App icon URL</strong> in the Config tab.
          </p>
        )}
        <button
          type="button"
          disabled={!!domainError || downloading}
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 text-white font-semibold text-xs hover:bg-sky-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {downloading ? "⏳ Generating…" : "⬇️ Download ZIP"}
        </button>
      </div>

      {/* JS snippet */}
      <div>
        <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
          Option A — CDN snippet
        </p>
        <div className="mb-2 rounded-md bg-amber-900/20 border border-amber-700/40 px-3 py-2 text-[11px] text-amber-400/90 leading-snug">
          <strong>CDN URL:</strong>{" "}
          <code className="text-amber-300/80 break-all">{WIDGET_CDN_JS_URL}</code>
          {" — "}
          major-version channel (<code>/v0/</code>). For production, pin to a specific release and
          add an SRI hash.{" "}
        </div>
        {domainError && (
          <div className="mb-2 rounded-md bg-rose-900/20 border border-rose-700/40 px-3 py-2 text-[11px] text-rose-400/90 leading-snug">
            ⚠ Snippet contains a placeholder domain (
            <code className="text-rose-300/80">{PLACEHOLDER_DOMAIN}</code>
            ). Set a valid app domain in the Config tab before using this snippet.
          </div>
        )}
        <CodeBlock title="HTML" code={buildJsSnippet(config)} />
      </div>

      {/* Manifest */}
      <div>
        <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">
          tonconnect-manifest.json
        </p>
        <p className="text-xs text-slate-600 mb-2">
          Host at{" "}
          <code className="text-slate-500">
            {config.domain
              ? `${config.domain}/tonconnect-manifest.json`
              : `${PLACEHOLDER_DOMAIN}/…`}
          </code>
        </p>
        <CodeBlock title="tonconnect-manifest.json" code={buildManifestJson(config)} />
      </div>

      {/* Option B */}
      <div>
        <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
          Option B — React (integrated)
        </p>
        <CodeBlock title="React component" code={buildReactSnippet(config)} />
      </div>
    </div>
  );
}
