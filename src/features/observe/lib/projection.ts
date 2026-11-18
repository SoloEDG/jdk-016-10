import type { Vec3, View } from "../../../shared/types";
export function cameraPoint(p: Vec3, view: View): Vec3 {
  const a = (view.yaw * Math.PI) / 180,
    b = (view.pitch * Math.PI) / 180,
    x = p[0] * Math.cos(a) - p[2] * Math.sin(a),
    z = p[0] * Math.sin(a) + p[2] * Math.cos(a);
  return [
    x,
    p[1] * Math.cos(b) - z * Math.sin(b),
    p[1] * Math.sin(b) + z * Math.cos(b),
  ];
}
/** 纸张以毫米建模，投影到画布时归一化取景，缩放参数才是纯粹的观察缩放。 */
export const sceneScale = (width: number, height: number) =>
  290 / Math.max(width, height, 1);
export function project(p: Vec3, view: View, scale = 1) {
  const c = cameraPoint(p, view);
  return {
    x: 400 + c[0] * scale * view.zoom,
    y: 280 - c[1] * scale * view.zoom,
    z: c[2],
  };
}
export function polygon(points: Vec3[], view: View, scale = 1) {
  return points
    .map((p) => {
      const v = project(p, view, scale);
      return `${v.x.toFixed(2)},${v.y.toFixed(2)}`;
    })
    .join(" ");
}
