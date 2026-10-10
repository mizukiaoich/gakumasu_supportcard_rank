// 公開用に、JS・CSS の参照へ版番号（?v=...）を付ける。GitHub Pages のデプロイ時に実行する。
//   node scripts/stamp-version.mjs <サイトのルート> <版番号>
// HTML の <script src> / <link href>、JS 同士の import に ?v= を付ける。
// データ（JSON）は js/data-loader.js が自分の URL の ?v= を読み取って同じ版番号を付ける。
// これにより、ブラウザがキャッシュした HTML・JS・JSON の組み合わせが常に同じ版になる。
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function stampVersion(root, version) {
  if (!/^[\w.-]+$/.test(version)) throw new Error(`版番号に使えない文字が含まれています: ${version}`);
  const changed = [];
  const update = async (file, fn) => {
    const before = await readFile(file, 'utf8');
    const after = fn(before);
    if (after !== before) {
      await writeFile(file, after);
      changed.push(path.relative(root, file));
    }
  };

  for (const html of ['index.html', path.join('ranking', 'index.html')]) {
    await update(path.join(root, html), (s) => s
      .replace(/(<script[^>]*\bsrc="[^"?]+\.js)"/g, `$1?v=${version}"`)
      .replace(/(<link[^>]*\bhref="[^"?]+\.css)"/g, `$1?v=${version}"`));
  }

  const jsDir = path.join(root, 'js');
  for (const name of await readdir(jsDir)) {
    if (!name.endsWith('.js')) continue;
    await update(path.join(jsDir, name), (s) => s.replace(/(from '\.\/[^'?]+\.js)'/g, `$1?v=${version}'`));
  }
  return changed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [root, version] = process.argv.slice(2);
  if (!root || !version) {
    console.error('使い方: node scripts/stamp-version.mjs <サイトのルート> <版番号>');
    process.exit(1);
  }
  const changed = await stampVersion(path.resolve(root), version);
  console.log(`版番号 ${version} を付けました: ${changed.join(', ')}`);
}
