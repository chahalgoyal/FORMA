import { build, context } from 'esbuild';
import fs from 'fs';
import path from 'path';

// Helper to copy directory recursively
const copyDir = (src, dest) => {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(srcPath, destPath) : fs.copyFileSync(srcPath, destPath);
  }
};

// Clean dist folder
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
fs.mkdirSync('dist');

// Copy static assets
copyDir('assets', 'dist/assets');
fs.copyFileSync('manifest.json', 'dist/manifest.json');
fs.copyFileSync('src/popup/popup.html', 'dist/popup.html');
fs.copyFileSync('src/popup/popup.css', 'dist/popup.css');
fs.copyFileSync('src/options/options.html', 'dist/options.html');
fs.copyFileSync('src/options/options.css', 'dist/options.css');

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
