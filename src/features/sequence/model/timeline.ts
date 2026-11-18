import type { Document } from "../../../shared/types";
import { clamp } from "../../../shared/document";
export function seek(doc: Document, index: number) {
  doc.playing = false;
  doc.step = clamp(index, 0, doc.steps.length - 1);
  doc.angles = { ...doc.steps[doc.step]!.angles };
  const c = doc.paper.creases.find((c) => c.id === doc.steps[doc.step]!.crease);
  if (c) doc.selected = c.id;
}
/** 保存当前姿态：记录相对最终角度的比例，这样重解参数时仍能保持这一折的进度。 */
export function captureStep(doc: Document) {
  const step = doc.steps[doc.step];
  if (!step) return;
  step.angles = { ...doc.angles };
  step.fractions = Object.fromEntries(
    Object.entries(doc.angles).map(([id, value]) => [
      id,
      doc.finalAngles[id] ? value / doc.finalAngles[id]! : 0,
    ]),
  );
  step.captured = true;
  step.note = "已保存当前折叠形态，重解参数时会保留这一折的进度。";
}
