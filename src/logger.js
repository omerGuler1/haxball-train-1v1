const LEVELS = ["debug", "info", "warn", "error"];

export function createLogger(config) {
  const wanted = String(config?.debug?.logLevel || "info").toLowerCase();
  const min = Math.max(0, LEVELS.indexOf(wanted));
  function emit(level, args) {
    const idx = LEVELS.indexOf(level);
    if (idx < min) return;
    const ts = new Date().toISOString();
    const tag = level.toUpperCase().padEnd(5);
    const stream = idx >= 2 ? process.stderr : process.stdout;
    stream.write(`${ts} ${tag} ${args.join(" ")}\n`);
  }
  return {
    debug: (...a) => emit("debug", a),
    info: (...a) => emit("info", a),
    warn: (...a) => emit("warn", a),
    error: (...a) => emit("error", a),
  };
}
