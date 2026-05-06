import type { ConstructorConfig } from "../types";

export function Preview({ config }: { config: ConstructorConfig }) {
  const isDark = config.theme.colorScheme === "dark";
  const accent = config.theme.accent;
  const bg = config.theme.bg || (isDark ? "#0f172a" : "#ffffff");
  const bgCard = isDark ? "#1e293b" : "#f8fafc";
  const fg = isDark ? "#f1f5f9" : "#1e293b";
  const fgMuted = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#334155" : "#e2e8f0";
  const radius = config.theme.radius;

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: radius,
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        color: fg,
        width: "100%",
        maxWidth: 360,
      }}
    >
      {/* Mock content */}
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: fg }}>Markets</div>

        {/* Mock category bar */}
        <div style={{ display: "flex", gap: 6 }}>
          {["All", "Sport", "Crypto"].map((c, i) => (
            <div
              key={c}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                background: i === 0 ? accent : bgCard,
                color: i === 0 ? "#fff" : fgMuted,
                fontSize: 11,
                fontWeight: 500,
                border: `1px solid ${i === 0 ? accent : border}`,
              }}
            >
              {c}
            </div>
          ))}
        </div>

        {/* Mock pari cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { name: "Will BTC reach $120k in 2025?", yes: "×1.85", no: "×2.10" },
            { name: "Champions League winner: Real Madrid?", yes: "×1.42", no: "×3.20" },
          ].map((p) => (
            <div
              key={p.name}
              style={{
                background: bgCard,
                border: `1px solid ${border}`,
                borderRadius: radius - 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: 70,
                  background: isDark ? "#2d3748" : "#e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                }}
              >
                🎯
              </div>
              <div style={{ padding: 8 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: fg,
                    lineHeight: 1.4,
                    marginBottom: 6,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {p.name}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  <div
                    style={{
                      background: "rgba(22,163,74,0.12)",
                      color: "#16a34a",
                      border: "1px solid rgba(22,163,74,0.25)",
                      borderRadius: radius - 4,
                      padding: "4px 0",
                      fontSize: 11,
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    YES {p.yes}
                  </div>
                  <div
                    style={{
                      background: "rgba(220,38,38,0.10)",
                      color: "#dc2626",
                      border: "1px solid rgba(220,38,38,0.2)",
                      borderRadius: radius - 4,
                      padding: "4px 0",
                      fontSize: 11,
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    NO {p.no}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mock nav */}
      <div
        style={{
          display: "flex",
          borderTop: `1px solid ${border}`,
          background: bgCard,
        }}
      >
        {[
          { label: "Markets", active: true },
          { label: "My Bets", active: false },
        ].map(({ label, active }) => (
          <div
            key={label}
            style={{
              flex: 1,
              padding: "8px 4px 6px",
              textAlign: "center",
              fontSize: 10,
              fontWeight: 600,
              color: active ? accent : fgMuted,
              borderTop: active ? `2px solid ${accent}` : "2px solid transparent",
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
