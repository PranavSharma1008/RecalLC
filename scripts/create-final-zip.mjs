import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const manifestPath = path.join(distDir, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
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

// Read and validate manifest from dist
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || 'unknown';

// Create clean zip where manifest.json is guaranteed to be strictly at the root and the very first entry
const finalZipPath = path.join(rootDir, 'final.zip');
const recallcZipPath = path.join(rootDir, 'RecalLC.zip');

const pythonPackagingScript = `
import zipfile, os, json, sys

dist_dir = ${JSON.stringify(distDir)}
primary_zip = ${JSON.stringify(finalZipPath)}
manifest_file = ${JSON.stringify(manifestPath)}

if not os.path.isfile(manifest_file):
    sys.exit('dist/manifest.json missing')

# Gather all files to include
files_to_pack = []
for root, _, files in os.walk(dist_dir):
    for f in files:
        # Ignore macOS metadata, temp files, and unused oversized raw logos
        if f in ('.DS_Store', 'Thumbs.db', 'logo.png') or f.endswith('.tmp') or f.endswith('.map'):
            continue
        full_path = os.path.join(root, f)
        rel_path = os.path.relpath(full_path, dist_dir).replace(os.sep, '/')
        if rel_path in ('manifest.json', 'icons/logo.png'):
            continue
        files_to_pack.append((full_path, rel_path))

# Sort alphabetically for determinism
files_to_pack.sort(key=lambda x: x[1])

# Put manifest.json as the VERY FIRST entry at the root
files_to_pack.insert(0, (manifest_file, 'manifest.json'))

# Write the zip archive using standard DEFLATE compression
with zipfile.ZipFile(primary_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for full_path, rel_path in files_to_pack:
        # Normalize file attributes and timestamps for clean cross-platform compatibility
        zinfo = zipfile.ZipInfo(rel_path, date_time=(2026, 11, 1, 0, 0, 0))
        zinfo.external_attr = 0o644 << 16  # standard file permissions
        zinfo.compress_type = zipfile.ZIP_DEFLATED
        with open(full_path, 'rb') as fp:
            z.writestr(zinfo, fp.read())

# Validate the generated archive
with zipfile.ZipFile(primary_zip, 'r') as z:
    names = z.namelist()
    test_result = z.testzip()
    if test_result is not None:
        sys.exit(f'ZIP integrity check failed for file: {test_result}')
    if 'manifest.json' not in names:
        sys.exit('ERROR: manifest.json is NOT in the zip!')
    if names[0] != 'manifest.json':
        sys.exit(f'ERROR: manifest.json is not the first entry! First is: {names[0]}')
`;

try {
  execSync(`python3 -c "${pythonPackagingScript.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('[create-final-zip] Packaging failed:', err);
  process.exit(1);
}

// Copy to RecalLC.zip
fs.copyFileSync(finalZipPath, recallcZipPath);

const sizeKb = Math.round(fs.statSync(finalZipPath).size / 1024);
console.log(`[create-final-zip] Successfully packaged Chrome Web Store extensions:`);
console.log(`  ✓ final.zip   (${sizeKb} KB, v${version}) - manifest.json at root (Entry #1)`);
console.log(`  ✓ RecalLC.zip (${sizeKb} KB, v${version}) - manifest.json at root (Entry #1)`);
