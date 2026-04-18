// Severity → color semantics. Each tier gets a distinct FAST token:
//   critical = danger red, high = warning amber, medium = neutral steel,
//   low = success green. Hue-based (not lightness-only) so the chart stays
//   legible for colorblind users and at small slice widths.
//
// Plain module (no 'use client') so both the client chart and server-side
// inspection routes can import the same values.
export const RISK_COLORS: Record<string, string> = {
  critical: '#B45555', // danger
  high: '#A1620E',     // warning
  medium: '#5F6672',   // steel (neutral)
  low: '#3A6B4F',      // success
}
