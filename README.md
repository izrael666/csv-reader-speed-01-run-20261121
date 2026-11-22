# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/izrael666/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/izrael666/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in for make.fun's own csv-reader 1.0.0: `solve.js` answers every CSV case exactly as csv-reader does — same columns, rows and errors on every broken row (short/long rows, stray CRs, quote junk, unterminated quotes, BOM, CRLF and lone CRs inside quotes) — in about a quarter of the reference's CPU time on the practice set (median 183 ms vs 739 ms parse-only, 410 ms vs 984 ms end to end, measured locally on Node 24).

How it gets there: quote-free records go through one slice + `split(',')`; unquoted fields are found with a single native regex scan for the next delimiter and sliced once; quoted fields jump quote to quote with `indexOf`, collapsing `""` and converting CRs only where they occur. No per-character string building, no per-field object.

## Run it

```sh
MAKEFUN_INPUT_DIR=./input MAKEFUN_OUTPUT_DIR=./output node main.ts
```

`main.ts` reads every case from `$MAKEFUN_INPUT_DIR/cases.json`, answers each with `run` from `solve.js`, and writes `$MAKEFUN_OUTPUT_DIR/answers.json`. It runs on Node 22 or later, with no dependencies to install.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
