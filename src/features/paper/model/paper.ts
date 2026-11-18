import type { Document } from "../../../shared/types";
export function setMaterial(doc: Document, front: string, back: string) {
  doc.front = front;
  doc.back = back;
}
