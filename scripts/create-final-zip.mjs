import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const pythonScript = `
import zipfile, os, glob, json, shutil

os.chdir(${JSON.stringify(rootDir)})

dist_dir = 'dist'
if not os.path.isdir(dist_dir) or not os.path.exists(os.path.join(dist_dir, 'manifest.json')):
    raise SystemExit('[create-final-zip] Error: dist/manifest.json not found. Run "npm run build" first.')

# Clean up any existing zip files in the project root
for zf in glob.glob('*.zip'):
    try:
        os.remove(zf)
    except OSError:
        pass

# Read manifest from dist
with open(os.path.join(dist_dir, 'manifest.json'), 'r') as mf:
    manifest_data = json.load(mf)

version = manifest_data.get('version', 'unknown')

# Collect dist files relative to dist/ (so manifest.json is directly at the root of the zip archive)
entries = []
for root, dirs, files in os.walk(dist_dir):
    for file in files:
        if file in ('.DS_Store', 'Thumbs.db') or file.endswith('.tmp'):
            continue
        full_path = os.path.join(root, file)
        rel_path = os.path.relpath(full_path, dist_dir)
        entries.append((full_path, rel_path))

entries.sort(key=lambda x: x[1])

# Create final.zip
primary_zip = 'final.zip'
with zipfile.ZipFile(primary_zip, 'w', zipfile.ZIP_DEFLATED) as z:
    for full_path, rel_path in entries:
        z.write(full_path, rel_path)

# Validate that manifest.json is at the exact root of the zip
with zipfile.ZipFile(primary_zip, 'r') as z:
    names = z.namelist()
    if 'manifest.json' not in names:
        raise SystemExit('[create-final-zip] ERROR: manifest.json is NOT at the root directory of the zip!')

# Duplicate to RecalLC.zip for Chrome Web Store upload convenience
shutil.copyfile(primary_zip, 'RecalLC.zip')

size_kb = os.path.getsize(primary_zip) // 1024
print(f'[create-final-zip] Successfully packaged Chrome Web Store extensions:')
print(f'  ✓ final.zip   ({size_kb} KB, {len(entries)} files, v{version}) - manifest.json at root')
print(f'  ✓ RecalLC.zip ({size_kb} KB, {len(entries)} files, v{version}) - manifest.json at root')
`;

execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
