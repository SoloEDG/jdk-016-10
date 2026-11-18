import type { Document, Mark, Paper, PaperTemplate, SchemeParams, SchemeReport, Step } from "./types";
export interface DocumentSeed {
  template: PaperTemplate;
  paper: Paper;
  params: SchemeParams;
  weights: Record<string, number>;
  fold: number;
  finalAngles: Record<string, number>;
  steps: Step[];
  marks: Mark[];
  order: string[];
  report: SchemeReport;
  retired: Document["retired"];
}
export function createDocument(seed: DocumentSeed): Document {
  return {
    paper: seed.paper,
    front: "#e88459",
    back: "#f8dec2",
    texture: "fiber",
    selected: seed.paper.creases[0]?.id ?? "",
    angles: { ...(seed.steps[seed.steps.length - 1]?.angles ?? {}) },
    directions: Object.fromEntries(seed.paper.creases.map((c) => [c.id, 1])),
    steps: seed.steps,
    step: seed.steps.length - 1,
    playing: false,
    speed: 1,
    view: { yaw: -35, pitch: 50, zoom: 1, grid: true, wire: true },
    scheme: seed.params,
    weights: seed.weights,
    fold: seed.fold,
    finalAngles: seed.finalAngles,
    marks: seed.marks,
    report: seed.report,
    order: seed.order,
    retired: seed.retired,
  };
}
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
