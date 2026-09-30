import vm from 'node:vm';
import fs from 'node:fs';
export const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
// Compile the real function rather than a test-side reimplementation.
export function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  for (let end = source.indexOf('}', start); end >= 0; end = source.indexOf('}', end + 1)) {
    const candidate = source.slice(start, end + 1);
    try { new vm.Script(`(${candidate})`); return candidate; } catch {}
  }
  throw new Error(`Cannot extract ${name}`);
}
export function declaration(source, name) {
  const line = source.split('\n').find(line => line.trimStart().startsWith(`const ${name} =`));
  if (!line) throw new Error(`Missing declaration ${name}`);
  return line;
}
