import type { Paper, PoseFace, Vec3 } from "../../../shared/types";
import { rotate, sub, cross, unit } from "../../../shared/vector";
type Transform = (p: Vec3) => Vec3;
export function solvePose(
  paper: Paper,
  angles: Record<string, number>,
): PoseFace[] {
  const transforms = new Map<string, Transform>(),
    pending = [...paper.faces],
    result: PoseFace[] = [];
  while (pending.length) {
    const i = pending.findIndex((f) => !f.parent || transforms.has(f.parent));
    if (i < 0) throw new Error("纸面连接关系不能成环");
    const f = pending.splice(i, 1)[0]!;
    const parent: Transform = f.parent ? transforms.get(f.parent)! : (p) => p;
    let transform = parent;
    if (f.hinge && f.crease) {
      const a = parent(f.hinge[0]),
        b = parent(f.hinge[1]),
        angle = angles[f.crease] ?? 0;
      transform = (p) => rotate(parent(p), a, b, angle);
    }
    transforms.set(f.id, transform);
    const points = f.points.map(transform);
    result.push({
      id: f.id,
      points,
      normal: unit(
        cross(sub(points[1]!, points[0]!), sub(points[2]!, points[0]!)),
      ),
    });
  }
  return result;
}
export function hingePositions(paper: Paper, pose: PoseFace[]) {
  return paper.creases.flatMap((c) => {
    const base = paper.faces.find((f) => f.id === c.face);
    const face = pose.find((f) => f.id === c.face);
    if (!base?.hinge || !face) return [];
    const indices = base.hinge.map((h) =>
      base.points.findIndex((p) => p.every((n, i) => n === h[i])),
    );
    return [
      {
        id: c.id,
        a: face.points[indices[0]!]!,
        b: face.points[indices[1]!]!,
      },
    ];
  });
}
/**
 * 把一个纸面局部坐标中的点带到当前姿态。纸面是三角形，
 * 因此用两个边向量求解重心坐标后，用同样的系数在姿态后的角点上重建。
 */
export function posePoint(
  paper: Paper,
  pose: PoseFace[],
  faceId: string,
  local: Vec3,
): Vec3 {
  const face = paper.faces.find((f) => f.id === faceId);
  const posed = pose.find((f) => f.id === faceId);
  if (!face || !posed) return local;
  const [p0, p1, p2] = face.points;
  if (!p0 || !p1 || !p2) return local;
  const e1 = sub(p1, p0);
  const e2 = sub(p2, p0);
  const d = sub(local, p0);
  const det = e1[0] * e2[2] - e2[0] * e1[2];
  const s = (d[0] * e2[2] - e2[0] * d[2]) / (det || 1);
  const t = (e1[0] * d[2] - d[0] * e1[2]) / (det || 1);
  const [q0, q1, q2] = posed.points;
  if (!q0 || !q1 || !q2) return local;
  return [
    q0[0] + s * (q1[0] - q0[0]) + t * (q2[0] - q0[0]),
    q0[1] + s * (q1[1] - q0[1]) + t * (q2[1] - q0[1]),
    q0[2] + s * (q1[2] - q0[2]) + t * (q2[2] - q0[2]),
  ];
}
