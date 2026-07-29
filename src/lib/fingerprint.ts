/**
 * Content fingerprint for saved recipes.
 *
 * A SHA-256 over a decimated slice of the decoded audio plus its shape. It lets
 * a saved preset recognise "this is the same file you had last time" without
 * the server ever holding anything derived from the sound itself beyond a
 * one-way hash.
 *
 * Decimation keeps this fast on long files. It is a convenience matcher, not a
 * forensic identifier, and it is never used for access control.
 */

const MAX_SAMPLES = 1 << 18;

export async function fingerprintAudio(
  channels: Float32Array[],
  sampleRate: number,
): Promise<string> {
  if (channels.length === 0 || channels[0].length === 0) return '';

  const length = channels[0].length;
  const stride = Math.max(1, Math.floor((length * channels.length) / MAX_SAMPLES));
  const count = Math.floor(length / stride);

  const sampled = new Float32Array(count + 3);
  sampled[0] = sampleRate;
  sampled[1] = channels.length;
  sampled[2] = length;

  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let c = 0; c < channels.length; c++) sum += channels[c][i * stride];
    sampled[i + 3] = sum;
  }

  const digest = await crypto.subtle.digest('SHA-256', sampled.buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
