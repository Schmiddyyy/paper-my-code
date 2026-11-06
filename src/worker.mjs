// Runs papergen.js (vendored unchanged from Paper my Shell) in a worker
// thread: a texture takes a few seconds and a few hundred MB, which must not
// stall the extension host.
import {parentPort, workerData} from 'node:worker_threads';
import {generate} from '../vendor/papergen.mjs';

const {texture, resolution} = workerData;
const tiles = generate(texture, {seed: 1, size: 1024 * resolution, scale: resolution});
parentPort.postMessage(tiles, Object.values(tiles).map(t => t.pixels.buffer));
