import type { Mark, MarkPlacement, Paper, SchemeParams, Vec3 } from "../../../shared/types";
import {
  cornerOrigin,
  faceCentroid,
  faceSpans,
  regionAt,
  uvFromWorld,
  worldFromUV,
} from "../../../shared/geometry";

/**
 * 标记点必须与折痕边界保持的最小角度余量，避免重解后被折裂。
 * 只以折痕为界：纸张外轮廓不是折痕，靠近外边不算失效。
 */
const MARGIN = (0.5 * Math.PI) / 180;

/** 点到最近折痕射线的角度距离（弧度）。 */
function creaseMargin(paper: Paper, p: Vec3): number {
  const origin = cornerOrigin(paper.width, paper.height);
  const a = Math.atan2(p[2] - origin[2], p[0] - origin[0]);
  let best = Infinity;
  for (const c of paper.creases) {
    const f = paper.faces.find((f) => f.id === c.face);
    if (!f?.hinge) continue;
    const end = f.hinge[1];
    const angle = Math.atan2(end[2] - origin[2], end[0] - origin[0]);
    best = Math.min(best, Math.abs(a - angle));
  }
  return best;
}

export interface PlacementContext {
  paper: Paper;
  params: SchemeParams;
  /** 折痕 id → 该折痕带动纸面的 id。 */
  faceOf: Record<string, string>;
}

/**
 * 把材料坐标上的标记点放回纸面。标记本身从不动，
 * 变化的是它所在分区的归属；越过分区的标记要显式提示，而不是被悄悄搬走。
 */
export function placeMarks(
  marks: Mark[],
  ctx: PlacementContext,
): MarkPlacement[] {
  return marks.map((m) => {
    const p = worldFromUV(m.u, m.v, ctx.params.width, ctx.params.height);
    const region = regionAt(ctx.paper, p);
    const face = ctx.paper.faces[region];
    const driverFace = ctx.faceOf[m.crease];
    const driverIndex = driverFace ? ctx.paper.faces.findIndex((f) => f.id === driverFace) : -1;
    const base = {
      id: m.id,
      label: m.label,
      crease: m.crease,
      face: face?.id ?? "",
      position: p,
    };
    if (region < 0) {
      const signed = signedSide(ctx.paper, p);
      return {
        ...base,
        face: signed >= 0 ? lastFace(ctx.paper) : ctx.paper.faces[0]!.id,
        status: "removed" as const,
        note: "标记点落到了纸外，本次方案无法保留该观察位置",
      };
    }
    if (region === 0) {
      // 固定纸面本身随参数改变且不再由任何折痕带动；标记点仍在纸上，但步骤失去了对应区域。
      return {
        ...base,
        status: "shifted" as const,
        note: "标记点滑入了不参与折叠的固定纸面，原来的折叠区域已不在这里",
      };
    }
    if (creaseMargin(ctx.paper, p) < MARGIN) {
      return {
        ...base,
        status: "removed" as const,
        note: "标记点压在折痕边界上，重解后将被折裂",
      };
    }
    if (driverIndex >= 0 && region !== driverIndex) {
      const owner = ctx.paper.creases.find((c) => c.face === face?.id);
      return {
        ...base,
        status: "shifted" as const,
        note: owner
          ? `标记点滑入「${owner.name}」带动的纸面，不再对应原来的区域`
          : "标记点滑入固定纸面，不再对应原来的区域",
      };
    }
    return {
      ...base,
      status: "kept" as const,
      note: `仍位于「${creaseName(ctx.paper, m.crease)}」所带动的同片纸面上`,
    };
  });
}

function signedSide(paper: Paper, p: Vec3) {
  const origin = cornerOrigin(paper.width, paper.height);
  const spans = faceSpans(paper);
  const a = Math.atan2(p[2] - origin[2], p[0] - origin[0]);
  const [lo] = spans[0]!;
  return a - lo;
}
const lastFace = (paper: Paper) => paper.faces[paper.faces.length - 1]!.id;
const creaseName = (paper: Paper, id: string) =>
  paper.creases.find((c) => c.id === id)?.name ?? id;

/** 为每道折痕生成一个标记点，位于该折痕所带动纸面的内部。 */
export function seedMarks(paper: Paper): Mark[] {
  return paper.creases.map((c, i) => {
    const p = faceCentroid(paper, c.face);
    const [u, v] = uvFromWorld(p, paper.width, paper.height);
    return { id: "mark-" + c.id, label: `M${i + 1}`, u, v, crease: c.id };
  });
}
