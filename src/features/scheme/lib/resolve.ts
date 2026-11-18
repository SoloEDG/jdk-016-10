import type {
  Mark,
  MarkPlacement,
  Paper,
  PaperTemplate,
  Resolution,
  RetiredStep,
  SchemeParams,
  SchemeReport,
  Step,
  StepReport,
  StepStatus,
} from "../../../shared/types";
import { buildGeometry, faceSpans, type Geometry } from "../../../shared/geometry";
import { solvePose } from "../../fold/lib/kinematics";
import { dot } from "../../../shared/vector";
import { placeMarks } from "./marks";

export interface ResolveState {
  template: PaperTemplate;
  params: SchemeParams;
  /** 折痕相对最终姿态的角度权重（含山/谷符号）。 */
  weights: Record<string, number>;
  /** 已经提交、仍然有效的步骤。 */
  steps: Step[];
  /** 之前因参数越界而收回的步骤，参数回退时会被重新启用。 */
  retired: RetiredStep[];
  marks: Mark[];
  /** 上一版折法的折痕顺序，用于报告顺序变化。 */
  previousOrder: string[];
}

export const MAX_ANGLE = 175;
/** 纸面被压得比这更窄（度）时，该步骤已没有可折的纸面。 */
const MIN_FACE_SPAN = 1.5;
const STEP_DURATION = 1600;

const clampAngle = (v: number) => Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, v));

/** 依据每道折痕的权重与折叠系数求各折痕的最终角度。 */
export function anglesFor(
  weights: Record<string, number>,
  fold: number,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(weights).map(([id, w]) => [id, clampAngle(w * fold)]),
  );
}

/** 成品最外侧纸面相对平展纸面的开口角。 */
export function openingOf(paper: Paper, angles: Record<string, number>): number {
  const flat = solvePose(paper, {});
  const pose = solvePose(paper, angles);
  const outer = pose[pose.length - 1];
  const flatOuter = flat[flat.length - 1];
  if (!outer || !flatOuter) return 0;
  const c = Math.max(-1, Math.min(1, dot(outer.normal, flatOuter.normal)));
  return (Math.acos(c) * 180) / Math.PI;
}

export interface FoldSolution {
  fold: number;
  reachable: [number, number];
  opening: number;
  finalAngles: Record<string, number>;
}
export interface FoldFailure {
  reachable: [number, number];
  error: string;
}

/**
 * 求解使成品开口角等于目标值的整体折叠系数。
 * 只在「从平展开始单调打开」的第一段上取解；达不到目标就直接报告可达范围，
 * 绝不通过裁剪折角来凑出一个看似成立的姿态。
 */
export function solveFold(
  paper: Paper,
  weights: Record<string, number>,
  target: number,
): FoldSolution | FoldFailure {
  const maxWeight = Math.max(...Object.values(weights).map(Math.abs), 1e-6);
  const kMax = MAX_ANGLE / maxWeight;
  const at = (k: number) => openingOf(paper, anglesFor(weights, k));

  const SAMPLES = 480;
  let bestK = 0;
  let best = 0;
  let prev = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const k = (kMax * i) / SAMPLES;
    const o = at(k);
    if (i > 0 && o < prev - 1e-4) break; // 离开第一段单调区间不再取值
    if (o > best) {
      best = o;
      bestK = k;
    }
    prev = o;
  }
  const reachable: [number, number] = [0, Math.round(best * 10) / 10];
  if (target > best + 0.05)
    return {
      reachable,
      error: `目标开口角 ${target.toFixed(0)}° 超出当前布局可达的上限 ${best.toFixed(1)}°。请调整纸张尺寸、折痕比例或目标角；不会通过裁剪折角来掩盖这个参数。`,
    };
  if (target <= 0.05)
    return { fold: 0, reachable, opening: 0, finalAngles: anglesFor(weights, 0) };
  let lo = 0;
  let hi = bestK;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) < target) lo = mid;
    else hi = mid;
  }
  const fold = (lo + hi) / 2;
  return { fold, reachable, opening: at(fold), finalAngles: anglesFor(weights, fold) };
}

export function stepAngles(
  step: Step,
  finalAngles: Record<string, number>,
): Record<string, number> {
  const angles: Record<string, number> = {};
  for (const [id, f] of Object.entries(step.fractions ?? {})) {
    if (!f) continue;
    angles[id] = (finalAngles[id] ?? 0) * f;
  }
  return angles;
}

/** 折痕带动的那片纸面的角宽度（度）。 */
function faceSpan(paper: Paper, orderOf: Record<string, number>, id: string): number {
  const spans = faceSpans(paper);
  const span = spans[(orderOf[id] ?? 0) + 1];
  if (!span) return 0;
  return ((span[1] - span[0]) * 180) / Math.PI;
}

/**
 * 折痕权重决定折法意图：既定的比例与山/谷方向来自模板，
 * 用户翻转方向后由 state.weights 覆盖。整体幅度由目标开口角反解。
 */
const defaultWeights = (
  template: PaperTemplate,
  weights?: Record<string, number>,
): Record<string, number> => ({
  ...Object.fromEntries(template.creases.map((c) => [c.id, c.angle])),
  ...weights,
});

export function defaultParams(template: PaperTemplate): SchemeParams {
  return {
    width: template.width,
    height: template.height,
    ratios: Object.fromEntries(template.creases.map((c) => [c.id, c.ratio])),
    opening: 0,
  };
}

/** 由模板生成最初的折法与参数；目标开口角取自设计姿态的实测值。 */
export function bootstrap(
  template: PaperTemplate,
  presetWeights?: Record<string, number>,
) {
  const weights = defaultWeights(template, presetWeights);
  const params = defaultParams(template);
  const geo = buildGeometry(template, params);
  const opening = geo.paper ? openingOf(geo.paper, weights) : 0;
  params.opening = Math.round(opening * 10) / 10;
  return { weights, params, opening: params.opening };
}

/**
 * 用旧步骤的角度占比把整套折法映射到新的几何上。
 * 未手动保存过的步骤随新的折痕顺序重新累积；保存过的步骤保留作者定下的比例。
 * 失去意义的步骤被收入 retired，而不是被悄悄删掉——参数回退时它会回来。
 */
function buildSteps(
  state: ResolveState,
  order: string[],
  finalAngles: Record<string, number>,
  statuses: Record<string, { status: StepStatus; note: string }>,
): { steps: Step[]; retired: RetiredStep[] } {
  const known = new Map<string, Step>();
  for (const s of [...state.retired.map((r) => r.step), ...state.steps]) {
    if (s.crease) known.set(s.crease, s);
  }
  const prepareSource = state.steps.find((s) => !s.crease);
  const prepare: Step = {
    id: prepareSource?.id ?? "flat",
    title: prepareSource?.title ?? "准备纸张",
    note: prepareSource?.note ?? "将纸张正面朝上，观察预设折痕。",
    angles: {},
    duration: prepareSource?.duration ?? 1000,
    crease: "",
  };

  const cumulative: Record<string, number> = {};
  const creaseSteps: Step[] = order.map((id) => {
    cumulative[id] = 1;
    const source = known.get(id);
    const spec = state.template.creases.find((c) => c.id === id);
    const fractions =
      source?.captured && source.fractions
        ? { ...source.fractions, [id]: source.fractions[id] ?? 1 }
        : { ...cumulative };
    const status = statuses[id] ?? { status: "migrated" as StepStatus, note: "" };
    return {
      id: source?.id ?? "step-" + id,
      title: source?.title ?? spec?.name ?? id,
      note: source?.captured ? source.note : (spec?.description ?? ""),
      angles: {},
      duration: source?.duration ?? STEP_DURATION,
      crease: id,
      fractions,
      captured: source?.captured,
      status: status.status,
      statusNote: status.note,
    };
  });

  // 失去意义的步骤不再进入折叠序列，但完整保存在 retired 里，参数回退时可原样恢复。
  const steps = [prepare, ...creaseSteps.filter((s) => s.status !== "meaningless")].map((s) => ({
    ...s,
    angles: stepAngles(s, finalAngles),
  }));
  const retired: RetiredStep[] = creaseSteps
    .filter((s) => s.status === "meaningless")
    .map((s) => ({
      id: s.id,
      title: s.title,
      reason: s.statusNote ?? "该步骤在当前参数下已无对应纸面",
      step: { ...s, status: undefined, statusNote: undefined },
    }));
  return { steps, retired };
}

/**
 * 一次完整的参数重解：纸面、折轴、最终角度、步骤与标记全部重新求。
 * 任何一步失败都不会产出半成品 —— ok 为假时调用方必须整体放弃。
 */
export function resolveScheme(state: ResolveState): Resolution {
  const { template, params, marks } = state;
  const weights = defaultWeights(template, state.weights);
  const base: Resolution = {
    ok: false,
    errors: [],
    params,
    paper: undefined,
    weights,
    fold: 0,
    finalAngles: {},
    steps: [],
    marks,
    placements: [],
    report: emptyReport(state),
    reachable: [0, 0],
    opening: 0,
    order: [],
  };

  const geo: Geometry = buildGeometry(template, params);
  if (!geo.ok || !geo.paper) {
    return { ...base, errors: geo.errors };
  }
  const paper = geo.paper;
  const solved = solveFold(paper, weights, params.opening);
  if ("error" in solved) {
    return { ...base, errors: [solved.error], reachable: solved.reachable };
  }
  const { fold, reachable, finalAngles, opening } = solved;
  const order = geo.order;

  const faceOf: Record<string, string> = {};
  for (const c of paper.creases) faceOf[c.id] = c.face;
  const placements: MarkPlacement[] = placeMarks(marks, { paper, params, faceOf });

  const statuses: Record<string, { status: StepStatus; note: string }> = {};
  const stepReports: StepReport[] = [];
  for (const id of order) {
    const index = geo.orderOf[id]!;
    const from = state.previousOrder.indexOf(id);
    const span = faceSpan(paper, geo.orderOf, id);
    const mark = placements.find((p) => p.crease === id);
    // 步骤能否迁移取决于它塑形的纸面区域；标记点只是该区域的观测锚。
    // 冷启动还没有标记点时不做锚点判断，否则整套折法会被误判为无效。
    const anchored = marks.some((m) => m.crease === id);
    let status: StepStatus = "migrated";
    let note = "";
    if (Math.abs(finalAngles[id] ?? 0) < 0.5) {
      status = "meaningless";
      note = "该折痕在当前方案下折角为 0°，这一步已不再改变纸面";
    } else if (span < MIN_FACE_SPAN) {
      status = "meaningless";
      note = `折痕把它带动的纸面挤成 ${span.toFixed(1)}° 的窄条，已没有可折的纸`;
    } else if (anchored && (!mark || mark.status === "removed")) {
      status = "meaningless";
      note = mark
        ? `原本标记在这片纸面上的 ${mark.label} 已不存在：${mark.note}`
        : `原本标记在这片纸面上的标记点已不存在，${titleOf(template, id)} 失去对应区域`;
    } else if (anchored && mark?.status === "shifted") {
      status = "meaningless";
      note = `标记 ${mark.label} 已不在「${titleOf(template, id)}」带动的纸面上，这一步塑造的区域已不是同一片纸`;
    } else if (from >= 0 && from !== index) {
      note = `折痕顺序由第 ${from + 1} 位变为第 ${index + 1} 位，步骤已随新分区迁移`;
    } else if (from < 0) {
      note = "该折痕在当前方案中重新出现，步骤按新的纸面分区恢复";
    }
    statuses[id] = { status, note };
  }

  const reportFor = (id: string, to: number): StepReport => {
    const spec = template.creases.find((c) => c.id === id);
    return {
      id,
      title: spec?.name ?? id,
      crease: id,
      from: state.previousOrder.indexOf(id),
      to,
      edge: spec?.edge ?? "right",
      ratio: params.ratios[id] ?? spec?.ratio ?? 0,
      status: statuses[id]!.status,
      note: statuses[id]!.note,
    };
  };
  // 可迁移的步骤按新顺序排在前面，失去意义的步骤集中在报告尾部。
  for (const id of order)
    if (statuses[id]!.status === "migrated")
      stepReports.push(reportFor(id, geo.orderOf[id]!));
  for (const id of order)
    if (statuses[id]!.status !== "migrated") stepReports.push(reportFor(id, -1));

  const { steps, retired } = buildSteps(state, order, finalAngles, statuses);

  const report: SchemeReport = {
    steps: stepReports,
    retired,
    marks: placements.map((p) => ({
      id: p.id,
      label: p.label,
      crease: p.crease,
      status: p.status,
      note: p.note,
    })),
    reachable,
    orderBefore: state.previousOrder,
    orderAfter: order,
    orderChanged:
      state.previousOrder.length > 0 &&
      state.previousOrder.join("|") !== order.join("|"),
    summary: summarize(stepReports, placements),
  };

  return {
    ok: true,
    errors: [],
    params,
    paper,
    weights,
    fold,
    finalAngles,
    steps,
    marks,
    placements,
    report,
    reachable,
    opening,
    order,
  };
}

const titleOf = (template: PaperTemplate, id: string) =>
  template.creases.find((c) => c.id === id)?.name ?? id;

function summarize(steps: StepReport[], placements: MarkPlacement[]): string {
  const bad = steps.filter((s) => s.status === "meaningless").length;
  const shifted = placements.filter((p) => p.status !== "kept").length;
  if (!bad && !shifted) return "所有步骤与标记点都能迁移到新纸面。";
  const parts: string[] = [];
  if (bad) parts.push(`${bad} 个步骤失去意义`);
  if (shifted) parts.push(`${shifted} 个标记点不再对应原区域`);
  return parts.join("，") + "。";
}

function emptyReport(state: ResolveState): SchemeReport {
  return {
    steps: [],
    retired: [],
    marks: [],
    reachable: [0, 0],
    orderBefore: state.previousOrder,
    orderAfter: [],
    orderChanged: false,
    summary: "",
  };
}
