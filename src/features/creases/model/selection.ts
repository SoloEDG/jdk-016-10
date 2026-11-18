import type { Document } from "../../../shared/types";
export function selectCrease(doc: Document, id: string) {
  if (doc.paper.creases.some((c) => c.id === id)) {
    doc.selected = id;
    doc.playing = false;
  }
}
