import type { JSX } from "react";

type DarkVeilProps = {
  hueShift?: number;
  noiseIntensity?: number;
  scanlineIntensity?: number;
  speed?: number;
  scanlineFrequency?: number;
  warpAmount?: number;
  resolutionScale?: number;
};

declare const DarkVeil: (props: DarkVeilProps) => JSX.Element;

export default DarkVeil;
