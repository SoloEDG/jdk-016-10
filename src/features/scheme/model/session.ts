import { reactive } from "vue";
import type { Document, Mark, Resolution, SchemeParams } from "../../../shared/types";
import { createDocument } from "../../../shared/document";
import { presetById } from "../../paper/lib/presets";
import { bootstrap, resolveScheme, type ResolveState } from "../lib/resolve";
import { seedMarks } from "../lib/marks";

/** 打开一个新纸型的完整文档。 */
export function openTemplate(templateId: string): Document {
  const preset = presetById(templateId);
  const { weights, params } = bootstrap(preset.template);
  const first = resolveScheme({
    template: preset.template,
    params,
    weights,
    steps: [],
    retired: [],
    marks: [],
    previousOrder: [],
  });
  if (!first.ok || !first.paper) throw new Error("初始纸型无法求解");
  const marks = seedMarks(first.paper);
  const second = resolveScheme({
    template: preset.template,
    params,
    weights,
    steps: first.steps,
    retired: [],
    marks,
    previousOrder: first.order,
  });
  if (!second.ok || !second.paper) throw new Error("初始纸型无法求解");
  return createDocument({
    template: preset.template,
    paper: second.paper,
    params,
    weights,
    fold: second.fold,
    finalAngles: second.finalAngles,
    steps: second.steps,
    marks,
    order: second.order,
    report: { ...second.report, orderBefore: second.order, orderChanged: false },
    retired: [],
  });
}

export interface DraftBase {
  params: SchemeParams;
  weights: Record<string, number>;
  steps: Document["steps"];
  retired: Document["retired"];
  marks: Mark[];
  order: string[];
}

const cloneParams = (p: SchemeParams): SchemeParams => ({
  width: p.width,
  height: p.height,
  ratios: { ...p.ratios },
  opening: p.opening,
});

const snapshot = (doc: Document): DraftBase => ({
  params: cloneParams(doc.scheme),
  weights: { ...doc.weights },
  steps: doc.steps.map((s) => ({
    ...s,
    angles: { ...s.angles },
    fractions: s.fractions ? { ...s.fractions } : undefined,
  })),
  retired: doc.retired.map((r) => ({
    ...r,
    step: {
      ...r.step,
      fractions: r.step.fractions ? { ...r.step.fractions } : undefined,
    },
  })),
  marks: doc.marks.map((m) => ({ ...m })),
  order: [...doc.order],
});

const sameParams = (a: SchemeParams, b: SchemeParams) =>
  a.width === b.width &&
  a.height === b.height &&
  a.opening === b.opening &&
  Object.keys(a.ratios).every((k) => a.ratios[k] === b.ratios[k]);

const sameWeights = (a: Record<string, number>, b: Record<string, number>) =>
  Object.keys({ ...a, ...b }).every((k) => (a[k] ?? 0) === (b[k] ?? 0));

/**
 * 参数编辑会话：拖动只改动草稿并实时预览，确认时一次性提交全部关联变化，
 * 取消则丢弃草稿。提交前文档始终保持完整一致的旧状态，失败也不会写入一半。
 */
export function useScheme(doc: Document) {
  let base = snapshot(doc);
  const draft = reactive({
    params: cloneParams(doc.scheme),
    weights: { ...doc.weights },
    dirty: false,
  });
  const templateOf = () => presetById(doc.paper.id).template;
  // 界面多处会同时读取预览；按参数签名缓存，避免同一份草稿被反复求解。
  let cacheKey = "";
  let cacheValue: Resolution | null = null;
  const resolve = (): Resolution => {
    const key = JSON.stringify([
      doc.paper.id,
      base.order,
      draft.params,
      draft.weights,
      base.steps.map((s) => [s.id, s.captured, s.fractions]),
      base.marks.map((m) => [m.id, m.u, m.v, m.crease]),
    ]);
    if (cacheValue && cacheKey === key) return cacheValue;
    cacheKey = key;
    cacheValue = resolveScheme({
      template: templateOf(),
      params: draft.params,
      weights: draft.weights,
      steps: base.steps,
      retired: base.retired,
      marks: base.marks,
      previousOrder: base.order,
    } satisfies ResolveState);
    return cacheValue;
  };

  function touch() {
    draft.dirty =
      !sameParams(draft.params, base.params) ||
      !sameWeights(draft.weights, base.weights);
  }
  function setParam(key: "width" | "height" | "opening", value: number) {
    if (!Number.isFinite(value)) return;
    draft.params[key] = value;
    touch();
  }
  function setRatio(crease: string, value: number) {
    if (!Number.isFinite(value)) return;
    draft.params.ratios[crease] = value;
    touch();
  }
  /** 翻转某道折痕的山/谷：折法意图的一部分，同样在确认时提交。 */
  function toggleDirection(crease: string) {
    draft.weights[crease] = -(draft.weights[crease] ?? 0);
    touch();
  }
  function reset() {
    draft.params = cloneParams(base.params);
    draft.weights = { ...base.weights };
    draft.dirty = false;
  }
  function rebase() {
    base = snapshot(doc);
    reset();
    cacheValue = null;
  }

  /**
   * 确认：把纸面、折轴、最终角度、步骤、标记与报告作为一个整体写入文档。
   * 求解失败时不写任何字段，避免出现只更新了一半的作品。
   */
  function commit(): { ok: boolean; errors: string[] } {
    if (!draft.dirty) return { ok: true, errors: [] };
    const r = resolve();
    if (!r.ok || !r.paper) return { ok: false, errors: r.errors };
    const anchorCrease = doc.steps[doc.step]?.crease ?? doc.selected;

    doc.paper = r.paper;
    doc.scheme = cloneParams(r.params);
    doc.weights = { ...r.weights };
    doc.fold = r.fold;
    doc.finalAngles = { ...r.finalAngles };
    doc.steps = r.steps;
    doc.retired = r.report.retired;
    doc.marks = r.marks;
    doc.order = r.order;
    doc.report = r.report;
    doc.directions = Object.fromEntries(
      Object.entries(r.finalAngles).map(([id, a]) => [id, a < 0 ? -1 : 1]),
    );
    doc.playing = false;

    const stepIndex = r.steps.findIndex((s) => s.crease === anchorCrease && s.crease);
    doc.step = stepIndex > 0 ? stepIndex : 0;
    doc.angles = { ...r.steps[doc.step]!.angles };
    if (!r.paper.creases.some((c) => c.id === doc.selected))
      doc.selected = r.steps[doc.step]?.crease || r.paper.creases[0]?.id || "";
    rebase();
    return { ok: true, errors: [] };
  }

  return {
    draft,
    template: presetById(doc.paper.id).template,
    resolve,
    setParam,
    setRatio,
    toggleDirection,
    reset,
    commit,
    rebase,
  };
}
