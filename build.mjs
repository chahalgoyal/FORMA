import { build, context } from 'esbuild';
import fs from 'fs';
import path from 'path';

// Clean dist folder
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
fs.mkdirSync('dist');

const isWatch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  target: 'chrome120',
  platform: 'browser',
  sourcemap: false,
  minify: false,
  logLevel: 'info',
};

const entryPoints = [
  { entryPoints: ['src/background/service-worker.ts'], outfile: 'dist/service-worker.js' },
  { entryPoints: ['src/content/index.ts'], outfile: 'dist/content.js' },
  { entryPoints: ['src/popup/popup.ts'], outfile: 'dist/popup.js' },
  { entryPoints: ['src/options/options.ts'], outfile: 'dist/options.js' },
];

if (isWatch) {
  console.log('👀 Watching for changes...');
  const contexts = await Promise.all(
    entryPoints.map((ep) => context({ ...shared, ...ep }))
  );
  await Promise.all(contexts.map((ctx) => ctx.watch()));
} else {
  await Promise.all(
    entryPoints.map((ep) => build({ ...shared, ...ep }))
  );
  console.log('✅ Build complete.');
}
