import type { Face, Paper, PaperTemplate, PaperEdge, SchemeParams, Vec3 } from "./types";

/**
 * 折痕落点沿外边界的参数化：右边缘从右下角（0）到右上角（1），
 * 上边缘从右上角（0）到左上角（1）。比例按各边自身长度取，
 * 因此「距边缘的比例」在纸张宽高变化后仍是同一条边上的同一个相对位置，
 * 但折痕在纸上的实际角度会改变，必须重新求解纸面。
 */
export function boundaryPoint(
  width: number,
  height: number,
  edge: PaperEdge,
  ratio: number,
): Vec3 {
  return edge === "right"
    ? [width / 2, 0, -height / 2 + ratio * height]
    : [width / 2 - ratio * width, 0, height / 2];
}
/** 折痕在纸边上的位置，用于排序：先右边缘，再上边缘。 */
export const edgeKey = (edge: PaperEdge, ratio: number) =>
  edge === "right" ? ratio : 1 + ratio;

export const cornerOrigin = (width: number, height: number): Vec3 => [
  -width / 2,
  0,
  -height / 2,
];
export const cornerFar = (width: number, height: number): Vec3 => [
  -width / 2,
  0,
  height / 2,
];
export const cornerNear = (width: number, height: number): Vec3 => [
  width / 2,
  0,
  -height / 2,
];
export const rayAngle = (p: Vec3, origin: Vec3) =>
  Math.atan2(p[2] - origin[2], p[0] - origin[0]);

export interface Ray {
  crease: string;
  edge: PaperEdge;
  ratio: number;
  end: Vec3;
  angle: number;
}
export interface Geometry {
  ok: boolean;
  errors: string[];
  paper?: Paper;
  rays: Ray[];
  order: string[];
  orderOf: Record<string, number>;
  origin: Vec3;
}

/**
 * 由尺寸参数重建整套纸面与折轴。折痕不是把成品整体拉伸，而是重新落在纸面射线上；
 * 分区与父子关系按射线的实际角度顺序重新生成，所以比例交叉时折痕顺序随之改变。
 */
export function buildGeometry(template: PaperTemplate, params: SchemeParams): Geometry {
  const errors: string[] = [];
  const { width, height, ratios } = params;
  const ids = template.creases.map((c) => c.id);
  const nameOf = (id: string) =>
    template.creases.find((c) => c.id === id)?.name ?? id;

  if (!Number.isFinite(width) || !Number.isFinite(height))
    errors.push("纸张宽高必须是有效数值");
  else if (width < 60 || height < 60)
    errors.push("纸张宽高不能小于 60 mm，否则折痕分区无法成立");
  else if (width > 600 || height > 600)
    errors.push("纸张宽高不能大于 600 mm");
  if (!Number.isFinite(params.opening) || params.opening < 0 || params.opening > 180)
    errors.push("目标开口角需在 0–180° 之间");
  if (!ids.length) errors.push("纸型至少需要一道折痕");

  for (const id of ids) {
    const spec = template.creases.find((c) => c.id === id)!;
    const r = ratios[id] ?? spec.ratio;
    if (!Number.isFinite(r)) errors.push(`「${nameOf(id)}」的折痕比例无效`);
    else if (r <= 0 || r >= 1)
      errors.push(
        `「${nameOf(id)}」的比例 ${(r * 100).toFixed(1)}% 已越出纸边，折痕无处落笔`,
      );
  }
  if (errors.length) return failed(errors);

  const keys: Record<string, number> = {};
  for (const id of ids) {
    const spec = template.creases.find((c) => c.id === id)!;
    keys[id] = edgeKey(spec.edge, ratios[id] ?? spec.ratio);
  }
  const order = [...ids].sort((a, b) => keys[a]! - keys[b]!);
  for (let i = 1; i < order.length; i++) {
    if (Math.abs(keys[order[i]!]! - keys[order[i - 1]!]!) < 1e-4)
      errors.push(
        `「${nameOf(order[i]!)}」与「${nameOf(order[i - 1]!)}」落在同一条射线上，纸面分区退化`,
      );
  }
  if (errors.length) return failed(errors);

  const origin = cornerOrigin(width, height);
  const near = cornerNear(width, height);
  const far = cornerFar(width, height);
  // 各折痕是以右下角为公共转轴的射线。分区自固定纸面起按角度递增依次叠放：
  // 每条射线只带动它「以外」（角度更大）的纸料，因此顺序必须与角度顺序一致，
  // 否则相邻纸面会互相重叠而不是形成连续的扇形。
  const rays: Ray[] = order
    .map((crease) => {
      const spec = template.creases.find((c) => c.id === crease)!;
      const ratio = ratios[crease] ?? spec.ratio;
      const end = boundaryPoint(width, height, spec.edge, ratio);
      return { crease, edge: spec.edge, ratio, end, angle: rayAngle(end, origin) };
    })
    .sort((a, b) => a.angle - b.angle);

  const faces: Face[] = [{ id: "r0", points: [origin, near, rays[0]!.end] }];
  rays.forEach((ray, i) => {
    faces.push({
      id: "r" + (i + 1),
      parent: "r" + i,
      crease: ray.crease,
      hinge: [origin, ray.end],
      points: [origin, ray.end, rays[i + 1]?.end ?? far],
    });
  });

  const orderOf: Record<string, number> = {};
  rays.forEach((r, i) => (orderOf[r.crease] = i));
  const paper: Paper = {
    id: template.id,
    name: template.name,
    subtitle: template.subtitle,
    size: Math.max(width, height),
    width,
    height,
    faces,
    creases: template.creases.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      face: "r" + (orderOf[c.id]! + 1),
      target: c.angle,
    })),
  };
  return { ok: true, errors: [], paper, rays, order, orderOf, origin };
}

function failed(errors: string[]): Geometry {
  return { ok: false, errors, rays: [], order: [], orderOf: {}, origin: [0, 0, 0] };
}

export function worldFromUV(u: number, v: number, width: number, height: number): Vec3 {
  return [u * width - width / 2, 0, v * height - height / 2];
}
export function uvFromWorld(p: Vec3, width: number, height: number): [number, number] {
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return [r(p[0] / width + 0.5), r(p[2] / height + 0.5)];
}

/** 平展状态下每一块纸面所覆盖的射线角度区间。 */
export function faceSpans(paper: Paper): [number, number][] {
  const origin = cornerOrigin(paper.width, paper.height);
  return paper.faces.map((f) => {
    const angles = f.points.slice(1).map((p) => rayAngle(p, origin));
    return [Math.min(...angles), Math.max(...angles)];
  });
}
export function regionAt(paper: Paper, p: Vec3): number {
  const origin = cornerOrigin(paper.width, paper.height);
  if (Math.hypot(p[0] - origin[0], p[2] - origin[2]) < 1e-9) return -1;
  const a = rayAngle(p, origin);
  const spans = faceSpans(paper);
  for (let i = 0; i < spans.length; i++) {
    const [lo, hi] = spans[i]!;
    if (a >= lo - 1e-7 && a <= hi + 1e-7) return i;
  }
  return -1;
}
export function faceCentroid(paper: Paper, faceId: string): Vec3 {
  const f = paper.faces.find((f) => f.id === faceId);
  if (!f) return cornerOrigin(paper.width, paper.height);
  const c: Vec3 = [0, 0, 0];
  for (const p of f.points) {
    c[0] += p[0] / f.points.length;
    c[1] += p[1] / f.points.length;
    c[2] += p[2] / f.points.length;
  }
  return c;
}
