const proc = Bun.spawn([
  "bun",
  "build",
  "./src/main.ts",
  "--compile",
  "--target=bun-windows-x64",
  "--outfile=moodle-reviewer.exe",
]);

await proc.exited;

export {};
