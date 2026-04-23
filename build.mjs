import { build, context } from 'esbuild';
import fs from 'fs';
import path from 'path';

// ─── Clean dist folder ──────────────────────
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
fs.mkdirSync('dist');
fs.mkdirSync('dist/assets', { recursive: true });

const isWatch = process.argv.includes('--watch');

// ─── esbuild config ─────────────────────────
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

// ─── Copy & fix static files ────────────────

// Helper: read file, apply replacements, write to dist
function copyAndFix(src, dest, replacements = []) {
  let content = fs.readFileSync(src, 'utf-8');
  for (const [find, replace] of replacements) {
    content = content.replaceAll(find, replace);
  }
  fs.writeFileSync(dest, content, 'utf-8');
}

// 1. Manifest — rewrite paths to be relative to dist root
copyAndFix('manifest.json', 'dist/manifest.json', [
  ['src/popup/popup.html', 'popup.html'],
  ['src/options/options.html', 'options.html'],
  ['dist/service-worker.js', 'service-worker.js'],
  ['dist/content.js', 'content.js'],
]);

// 2. Popup HTML — fix logo and script paths
copyAndFix('src/popup/popup.html', 'dist/popup.html', [
  ['../../assets/logo-light.png', 'assets/logo-light.png'],
  ['../../assets/logo-dark.png', 'assets/logo-dark.png'],
  ['../../dist/popup.js', 'popup.js'],
]);

// 3. Options HTML — fix logo and script paths
copyAndFix('src/options/options.html', 'dist/options.html', [
  ['../../assets/logo-light.png', 'assets/logo-light.png'],
  ['../../assets/logo-dark.png', 'assets/logo-dark.png'],
  ['../../dist/options.js', 'options.js'],
]);

// 4. CSS files — straight copy (no path fixes needed)
fs.copyFileSync('src/popup/popup.css', 'dist/popup.css');
fs.copyFileSync('src/options/options.css', 'dist/options.css');

// 5. Logo assets — copy all logos used by the extension
const logoFiles = ['logo-light.png', 'logo-dark.png', 'icon128.png'];
for (const file of logoFiles) {
  const src = path.join('assets', file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join('dist', 'assets', file));
  }
}

console.log('📦 Static files copied to dist/');

// ─── Build JS ────────────────────────────────
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
  console.log('✅ Build complete. dist/ is ready to load as an unpacked extension.');
}
