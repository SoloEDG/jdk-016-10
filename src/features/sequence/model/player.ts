import { onUnmounted } from "vue";
import type { Document } from "../../../shared/types";
import { interpolate } from "../lib/steps";
export function usePlayer(doc: Document) {
  let frame = 0,
    last = 0,
    elapsed = 0,
    start: Record<string, number> = {},
    target = 0;
  function tick(now: number) {
    if (!doc.playing) {
      last = 0;
      return;
    }
    if (!last) {
      last = now;
      start = { ...doc.angles };
      target = Math.min(doc.step + 1, doc.steps.length - 1);
      elapsed = 0;
    }
    elapsed += (now - last) * doc.speed;
    last = now;
    const step = doc.steps[target]!;
    doc.angles = interpolate(
      start,
      step.angles,
      Math.min(1, elapsed / step.duration),
    );
    if (elapsed >= step.duration) {
      doc.step = target;
      const c = doc.paper.creases.find((c) => c.id === step.crease);
      if (c) doc.selected = c.id;
      if (target >= doc.steps.length - 1) {
        doc.playing = false;
        last = 0;
        return;
      }
      start = { ...doc.angles };
      target = Math.min(target + 1, doc.steps.length - 1);
      elapsed = 0;
    }
    frame = requestAnimationFrame(tick);
  }
  function toggle() {
    doc.playing = !doc.playing;
    cancelAnimationFrame(frame);
    last = 0;
    if (doc.playing) frame = requestAnimationFrame(tick);
  }
  onUnmounted(() => cancelAnimationFrame(frame));
  return { toggle };
}
