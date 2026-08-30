# CSPRNG refill benchmark

This benchmark compares the previous one-word `crypto.getRandomValues` call with reusable
buffers of 1, 16, 64, 256 and 1,024 uint32 words. Every candidate uses the same platform
CSPRNG. The benchmark measures speed, not randomness quality.

Five workloads keep the raw result in context:

- creating a source and reading its first word;
- producing raw random words;
- rolling a d20;
- rolling `2d6+3`;
- rolling `1000d6`.

Each row records seven samples after two warmups. Compare medians within one result file.
Results from different machines are not directly comparable.

## Node

Build the package, then pass the output path to the runner:

```bash
npm run build
BENCHMARK_CPU="Apple M4 Max" node benchmarks/rng/run-node.mjs benchmarks/rng/results/node-24.json
```

Run the same command under every supported Node release.

## Browsers

Start the local result collector:

```bash
npm run build
node benchmarks/rng/serve-browser.mjs
```

Open the printed URL in each browser and give each one a distinct `name` query parameter,
such as `chrome`, `firefox` or `safari`. The page saves its result under `results/` and shows
the same JSON in the browser.

## workerd

Use Wrangler from the Rollful checkout to run `worker.mjs`, then save its response:

```bash
npm run build
../rollful.dev/node_modules/.bin/wrangler dev benchmarks/rng/worker.mjs --port 4174
curl http://127.0.0.1:4174 > benchmarks/rng/results/workerd.json
```

Record the Wrangler and workerd versions beside published results.
