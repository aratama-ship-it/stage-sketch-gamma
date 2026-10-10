/* Lossless storage for recovery copies only. Live show JSON stays compatible. */
(function (root) {
  'use strict';
  const MAX_TEXT_BYTES = 64 * 1024 * 1024;
  const rawBytes = record => typeof record?.value === 'string'
    ? new Blob([record.value]).size : Number(record?.textBytes) || 0;
  async function unpack(record) {
    if (!record || !record.storageEncoding) return record;
    if (record.storageEncoding !== 'gzip-v1' || typeof root.DecompressionStream !== 'function'
        || !Number.isSafeInteger(record.textBytes) || record.textBytes < 0 || record.textBytes > MAX_TEXT_BYTES) {
      throw new Error('ARCHIVE_CODEC_UNAVAILABLE');
    }
    const reader = new Blob([record.valueGzip]).stream().pipeThrough(new root.DecompressionStream('gzip')).getReader();
    const parts = []; let total = 0;
    try {
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > record.textBytes) throw new Error('ARCHIVE_LENGTH_MISMATCH');
        parts.push(value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    if (total !== record.textBytes) throw new Error('ARCHIVE_LENGTH_MISMATCH');
    const value = await new Blob(parts).text();
    if (value.length !== record.valueChars) throw new Error('ARCHIVE_LENGTH_MISMATCH');
    const {storageEncoding, valueGzip, textBytes, valueChars, ...metadata} = record;
    return {...metadata, value};
  }
  const available = () => typeof root.CompressionStream === 'function' && typeof root.DecompressionStream === 'function';
  async function pack(record) {
    if (typeof record?.value !== 'string' || !available()) return record;
    const checked = {...record, compressionChecked:1};
    if (record.value.length < 2048) return checked;
    const blob = new Blob([record.value]);
    if (blob.size > MAX_TEXT_BYTES) return checked;
    try {
      const compressed = await new Response(blob.stream().pipeThrough(new root.CompressionStream('gzip'))).arrayBuffer();
      if (compressed.byteLength + 256 >= blob.size * .9) return checked;
      const {value, ...metadata} = record;
      const packed = {...metadata, storageEncoding:'gzip-v1', valueGzip:compressed,
        textBytes:blob.size, valueChars:value.length};
      if ((await unpack(packed)).value !== value) throw new Error('ARCHIVE_CODEC_MISMATCH');
      return packed;
    } catch (_) { return checked; } // Failed compression keeps the exact original copy.
  }
  const summary = record => ({id:record.id, key:record.key, projectId:record.projectId,
    title:record.title, archivedAt:record.archivedAt,
    chars:typeof record.value === 'string' ? record.value.length : record.valueChars,
    rawBytes:rawBytes(record), storedBytes:record.valueGzip?.byteLength ?? rawBytes(record),
    compressed:record.storageEncoding === 'gzip-v1'});
  root.STAGE_STORAGE_CODEC = Object.freeze({pack, unpack, summary, available});
})(typeof window === 'undefined' ? globalThis : window);
