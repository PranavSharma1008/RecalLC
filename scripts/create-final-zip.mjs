import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(path.join(distDir, 'manifest.json'))) {
  console.error('[create-final-zip] Error: dist/manifest.json not found. Run "npm run build" first.');
  process.exit(1);
}

// Clean up any existing zip files in the project root
for (const file of fs.readdirSync(rootDir)) {
  if (file.endsWith('.zip')) {
    try {
      fs.unlinkSync(path.join(rootDir, file));
    } catch {}
  }
}

// Read manifest from dist
const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8'));
const version = manifest.version || 'unknown';

// Create clean zip from inside dist/ so manifest.json is strictly at the root
const finalZipPath = path.join(rootDir, 'final.zip');
const recallcZipPath = path.join(rootDir, 'RecalLC.zip');

try {
  // Use system zip with -X (strip extra macOS attributes/__MACOSX) and -r (recursive)
  execSync(`cd "${distDir}" && /usr/bin/zip -r -X -FS "${finalZipPath}" . -x "*.DS_Store*" "*Thumbs.db*"`, {
    stdio: 'ignore',
  });
} catch {
  // Python fallback if system zip is unavailable
  const pythonScript = `
import zipfile, os, json
dist_dir = ${JSON.stringify(distDir)}
primary_zip = ${JSON.stringify(finalZipPath)}
with zipfile.ZipFile(primary_zip, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(dist_dir):
        for file in files:
            if file in ('.DS_Store', 'Thumbs.db') or file.endswith('.tmp'):
                continue
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, dist_dir)
            z.write(full_path, rel_path)
`;
  execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
}

// Verify manifest.json is at root
const zipListing = execSync(`unzip -l "${finalZipPath}"`, { encoding: 'utf8' });
if (!zipListing.match(/\s+manifest\.json\n/)) {
  console.error('[create-final-zip] ERROR: manifest.json is NOT at the root directory of the zip!');
  process.exit(1);
}

// Copy to RecalLC.zip
fs.copyFileSync(finalZipPath, recallcZipPath);

const sizeKb = Math.round(fs.statSync(finalZipPath).size / 1024);
console.log(`[create-final-zip] Successfully packaged Chrome Web Store extensions:`);
console.log(`  ✓ final.zip   (${sizeKb} KB, v${version}) - manifest.json at root`);
console.log(`  ✓ RecalLC.zip (${sizeKb} KB, v${version}) - manifest.json at root`);

