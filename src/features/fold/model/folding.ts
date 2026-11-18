import type { Document } from "../../../shared/types";
import { normalizeAngle } from "../lib/angle";

/** 手动微调某道折痕的角度：只改变当前姿态，不回写折法意图。 */
export function changeAngle(doc: Document, value: number) {
  doc.playing = false;
  doc.angles[doc.selected] = normalizeAngle(value);
}
export function flatten(doc: Document) {
  doc.playing = false;
  doc.angles = {};
  doc.step = 0;
}
export function applyTarget(doc: Document) {
  const c = doc.paper.creases.find((c) => c.id === doc.selected);
  if (c) changeAngle(doc, doc.finalAngles[c.id] ?? c.target);
}
/** 当前折痕的最终角度，来自参数化方案的求解结果。 */
export function finalAngle(doc: Document, id: string) {
  return doc.finalAngles[id] ?? 0;
}
