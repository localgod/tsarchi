// Upgrades vite-plus and the `vite` alias to @voidzero-dev/vite-plus-core together.
// They must stay on the same version, or `vp pack` refuses to run. Dependabot can't
// update npm aliases, so it ignores vite-plus and this script does the upgrade.
//
// Usage: npm run upgrade:vite-plus [-- <version>]   (default: latest)
import { execSync } from 'child_process';

const version = process.argv[2] ?? execSync('npm view vite-plus version', { encoding: 'utf8' }).trim();
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Not a version: ${version}`);
  process.exit(1);
}

console.log(`Upgrading vite-plus and vite (@voidzero-dev/vite-plus-core) to ${version}`);
execSync(`npm install --save-dev --save-exact vite-plus@${version} vite@npm:@voidzero-dev/vite-plus-core@${version}`, {
  stdio: 'inherit',
});
