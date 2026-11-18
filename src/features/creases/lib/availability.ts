import type { Document } from "../../../shared/types";
export function selectedCrease(doc: Document) {
  return (
    doc.paper.creases.find((c) => c.id === doc.selected) ?? doc.paper.creases[0]
  );
}
export function creaseProgress(doc: Document, id: string) {
  const final = Math.abs(doc.finalAngles[id] ?? 0);
  return Math.round(
    Math.min(100, (Math.abs(doc.angles[id] ?? 0) / (final || 180)) * 100),
  );
}
