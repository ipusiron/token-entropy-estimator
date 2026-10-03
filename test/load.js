// 画面と同じ通常のスクリプト（js/*.js）を、テストの実行環境に読み込む。
// vm.runInThisContext で読むので、結果のオブジェクトはテスト側と同じ realm になる（deepStrictEqual で比べられる）
import fs from 'node:fs';
import vm from 'node:vm';

export const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const loaded = new Set();
export function load(file) {
  if (!loaded.has(file)) {
    vm.runInThisContext(read(file), { filename: file });
    loaded.add(file);
  }
  return globalThis;
}

export const core = () => load('js/entropy-core.js').TokenEntropy;
