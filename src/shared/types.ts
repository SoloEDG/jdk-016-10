export type Vec3 = [number, number, number];
export interface Face {
  id: string;
  points: Vec3[];
  parent?: string;
  hinge?: [Vec3, Vec3];
  crease?: string;
}
export interface Crease {
  id: string;
  name: string;
  description: string;
  /** 该折痕所带动的纸面。 */
  face: string;
  /** 设计角度，同时作为手动折叠的建议角度。 */
  target: number;
}
export interface Paper {
  id: string;
  name: string;
  subtitle: string;
  size: number;
  width: number;
  height: number;
  faces: Face[];
  creases: Crease[];
}
/** 折痕落点所在纸边：右边缘自右下角起，上边缘自右上角起。 */
export type PaperEdge = "right" | "top";
/** 纸型的静态定义：每次调整参数时由它重新生成纸面、折轴与步骤。 */
export interface CreaseSpec {
  id: string;
  name: string;
  description: string;
  edge: PaperEdge;
  /** 折痕落点在该纸边上、距起始角的比例。 */
  ratio: number;
  /** 设计角度，决定折法的山/谷与相对幅度。 */
  angle: number;
}
export interface PaperTemplate {
  id: string;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  creases: CreaseSpec[];
}
/** 驱动整套折法重新求解的尺寸参数。长度单位为毫米，角度单位为度。 */
export interface SchemeParams {
  width: number;
  height: number;
  /** 折痕 id → 距其所在纸边起始角的比例，取 (0, 1)。 */
  ratios: Record<string, number>;
  /** 成品外侧纸面相对平展纸面的目标开口角。 */
  opening: number;
}
export type StepStatus = "migrated" | "meaningless";
export interface Step {
  id: string;
  title: string;
  note: string;
  angles: Record<string, number>;
  duration: number;
  /** 该步骤负责的折痕；空字符串表示平展或收尾步骤。 */
  crease: string;
  /** 相对最终角度的比例，用于纸张重解后保持原来的折叠进度。 */
  fractions?: Record<string, number>;
  /** 用户手动保存过的步骤（保留整份角度快照）。 */
  captured?: boolean;
  /** 仅用于预览，提交时清除。 */
  status?: StepStatus;
  statusNote?: string;
}
export interface RetiredStep {
  id: string;
  title: string;
  reason: string;
  /** 被收回的步骤本身，参数回退时原样启用。 */
  step: Step;
}
export interface StepReport {
  id: string;
  title: string;
  crease: string;
  /** 旧顺序中的位置；-1 表示该折痕原先不在折法中。 */
  from: number;
  edge: PaperEdge;
  ratio: number;
  /** 新顺序中的位置（从 0 开始）；-1 表示该步骤被收回。 */
  to: number;
  status: StepStatus;
  note: string;
}
export interface MarkReport {
  id: string;
  label: string;
  crease: string;
  status: "kept" | "shifted" | "removed";
  note: string;
}
export interface SchemeReport {
  steps: StepReport[];
  retired: RetiredStep[];
  marks: MarkReport[];
  reachable: [number, number];
  orderBefore: string[];
  orderAfter: string[];
  orderChanged: boolean;
  summary: string;
}
/** 纸上的材料点，用纸张归一化坐标保存，重解后仍落在同一片纸料上。 */
export interface Mark {
  id: string;
  label: string;
  u: number;
  v: number;
  /** 该标记用来盯住哪道折痕所带动的纸面区域。 */
  crease: string;
}
export interface MarkPlacement {
  id: string;
  label: string;
  crease: string;
  position: Vec3;
  face: string;
  status: "kept" | "shifted" | "removed";
  note: string;
}
/** 一次参数求解的完整结果；只有 ok 为真时才会整体提交。 */
export interface Resolution {
  ok: boolean;
  errors: string[];
  params: SchemeParams;
  paper?: Paper;
  weights: Record<string, number>;
  fold: number;
  finalAngles: Record<string, number>;
  steps: Step[];
  marks: Mark[];
  placements: MarkPlacement[];
  report: SchemeReport;
  reachable: [number, number];
  opening: number;
  order: string[];
}
export interface View {
  yaw: number;
  pitch: number;
  zoom: number;
  grid: boolean;
  wire: boolean;
}
export interface Document {
  paper: Paper;
  front: string;
  back: string;
  texture: string;
  selected: string;
  angles: Record<string, number>;
  directions: Record<string, number>;
  steps: Step[];
  step: number;
  playing: boolean;
  speed: number;
  view: View;
  /** 当前已提交的参数化方案。 */
  scheme: SchemeParams;
  /** 各折痕相对最终角度的权重（含山/谷方向）。 */
  weights: Record<string, number>;
  /** 当前方案求得的整体折叠系数。 */
  fold: number;
  /** 当前方案下每道折痕的最终角度。 */
  finalAngles: Record<string, number>;
  /** 纸上的材料标记点，位置不随参数变化而移动。 */
  marks: Mark[];
  /** 最近一次提交时的迁移报告。 */
  report: SchemeReport;
  /** 已提交折法的折痕执行顺序。 */
  order: string[];
  /** 因参数越界而暂时收回的步骤，参数回退时会重新启用。 */
  retired: RetiredStep[];
}
export interface PoseFace {
  id: string;
  points: Vec3[];
  normal: Vec3;
}
