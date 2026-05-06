// biome-ignore-all lint/suspicious/noExplicitAny: smoke script, raw message inspection
// Listen to wss://toncast.me/ws/pari-list for ~60s and dump raw messages.
// Goal: verify endpoint, message shapes, and how `pari_created` carries language.
// Run: npx tsx scripts/smoke-ws-pari-list.ts [seconds]

const URL = "wss://toncast.me/ws/pari-list";

async function main() {
  const seconds = Number(process.argv[2] ?? "60");
  console.log(`▸ Connecting to ${URL} for ${seconds}s…\n`);

  const ws = new WebSocket(URL);
  const stats = new Map<string, number>();
  let lastSeq: number | null = null;
  let firstPariCreated: unknown = null;

  ws.addEventListener("open", () => {
    console.log("▸ open — sending checkSync");
    ws.send(JSON.stringify({ type: "checkSync", lastSeen: 0 }));

    // Ping every 5s like the frontend does
    setInterval(() => {
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        /* socket closed */
      }
    }, 5000);
  });

  ws.addEventListener("message", (ev) => {
    let msg: any;
    try {
      msg = JSON.parse(String(ev.data));
    } catch (err) {
      console.log("  ! parse error", err);
      return;
    }
    const t = msg?.type ?? "<no-type>";
    stats.set(t, (stats.get(t) ?? 0) + 1);

    if (typeof msg?.sequenceId === "number") {
      const prev = lastSeq;
      lastSeq = msg.sequenceId;
      if (prev !== null && msg.sequenceId !== prev + 1) {
        console.log(`  [seq jump ${prev} → ${msg.sequenceId}]`);
      }
    }

    if (t === "pari_created" && !firstPariCreated) {
      firstPariCreated = msg;
      console.log("\n▸ first pari_created (full payload):");
      console.log(JSON.stringify(msg, null, 2));
      console.log();
    } else if (
      t === "syncStatus" ||
      (t !== "pong" && t !== "coefficient_update" && t !== "volume_update")
    ) {
      console.log(`  ${t}:`, JSON.stringify(msg).slice(0, 160));
    }
  });

  ws.addEventListener("close", (ev) => {
    console.log(`\n▸ close code=${ev.code} reason="${ev.reason}"`);
  });

  ws.addEventListener("error", (err) => {
    console.log("▸ error", err);
  });

  await new Promise((r) => setTimeout(r, seconds * 1000));

  console.log("\n=== Summary ===");
  for (const [t, n] of [...stats.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(24)}  ${n}`);
  }
  console.log(`  lastSequenceId: ${lastSeq}`);

  ws.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
