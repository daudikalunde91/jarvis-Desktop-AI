/**
 * Structural description of an audio chunk's shape — never the codec
 * implementation itself, which belongs to a future provider milestone.
 */
export interface AudioFormat {
  sampleRateHz: number;
  channels: number;
  bitDepth: number;
}
