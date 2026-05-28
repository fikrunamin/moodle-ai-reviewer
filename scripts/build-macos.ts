const targets = [
  {
    target: "bun-darwin-arm64",
    outfile: "moodle-reviewer-macos-arm64",
  },
  {
    target: "bun-darwin-x64",
    outfile: "moodle-reviewer-macos-x64",
  },
];

for (const item of targets) {
  const proc = Bun.spawn([
    "bun",
    "build",
    "./src/main.ts",
    "--compile",
    `--target=${item.target}`,
    `--outfile=${item.outfile}`,
  ], {
    stdout: "inherit",
    stderr: "inherit",
  });

  const code = await proc.exited;
  if (code !== 0) {
    process.exit(code);
  }
}

export {};
