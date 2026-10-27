import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const pythonScript = `
import zipfile, os

os.chdir(${JSON.stringify(rootDir)})
zip_path = 'final.zip'
if os.path.exists(zip_path):
    os.remove(zip_path)

files_to_pack = {}
exclude_dirs = {'node_modules', '.git'}

# 1. Collect all project root files
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for file in files:
        if file in ('final.zip', 'recalllc-v1.0.1.zip', 'recalllc-v1.0.2.zip') or file.endswith('.tmp'):
            continue
        full_path = os.path.join(root, file)
        rel_path = os.path.relpath(full_path, '.')
        files_to_pack[rel_path] = full_path

# 2. Preserve source html files under .source.html
for p in ('src/popup/index.html', 'src/dashboard/index.html'):
    if p in files_to_pack:
        files_to_pack[p.replace('.html', '.source.html')] = files_to_pack[p]

# 3. Overlay compiled dist files both at root (for immediate unpacked loading) and under dist/
if os.path.isdir('dist'):
    for root, dirs, files in os.walk('dist'):
        for file in files:
            full_path = os.path.join(root, file)
            rel_in_dist = os.path.relpath(full_path, 'dist')
            # Root-level entrypoint for Chrome Load unpacked
            files_to_pack[rel_in_dist] = full_path
            # Also keep dist/ version
            files_to_pack[os.path.join('dist', rel_in_dist)] = full_path

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for rel_path, full_path in sorted(files_to_pack.items()):
        z.write(full_path, rel_path)

print(f'[create-final-zip] Successfully packaged final.zip ({os.path.getsize(zip_path) // 1024} KB) with {len(files_to_pack)} entries')
`;

execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
