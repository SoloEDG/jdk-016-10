<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { Layers, RotateCcw, ArrowUpRight, HelpCircle, Leaf } from "lucide-vue-next";
import { openTemplate, useScheme, SchemePanel, placeMarks } from "../features/scheme";
import { PaperPanel, presets } from "../features/paper";
import { CreasePanel, selectCrease, selectedCrease } from "../features/creases";
import { FoldPanel, solvePose, hingePositions, changeAngle, flatten, applyTarget } from "../features/fold";
import { SequencePanel, seek, captureStep, usePlayer } from "../features/sequence";
import { Viewport, ObservePanel, setView } from "../features/observe";
import { sceneScale } from "../features/observe/lib/projection";
import { posePoint } from "../features/fold/lib/kinematics";
import type { Document, MarkPlacement, Resolution } from "../shared/types";

const doc = reactive(openTemplate(presets[0]!.template.id)) as Document;
const scheme = useScheme(doc);

const pose = computed(() => solvePose(doc.paper, doc.angles));
const hinges = computed(() => hingePositions(doc.paper, pose.value));

const preview = computed<Resolution>(() => scheme.resolve());
const dirty = computed(() => scheme.draft.dirty);
const previewing = computed(() => dirty.value);
/** 把材料标记带到当前姿态；标记点自己从不移动，只是随所在纸面运动。 */
function lift(paper: Document["paper"], placed: MarkPlacement[], angles: Record<string, number>): MarkPlacement[] {
  const posed = solvePose(paper, angles);
  return placed.map((m) => ({
    ...m,
    position: posePoint(paper, posed, m.face, m.position),
  }));
}
const ghost = computed(() => {
  if (!previewing.value || !preview.value.ok || !preview.value.paper) return null;
  const p = preview.value;
  // 预览保持与当前步骤同一阶段，方便与已提交的实线纸面直接对照。
  const current = doc.steps[doc.step]?.crease;
  const index =
    current !== undefined
      ? p.steps.findIndex((s) => s.crease === current)
      : Math.min(doc.step, p.steps.length - 1);
  const stageAngles =
    index >= 0 ? { ...p.steps[index]!.angles } : { ...p.finalAngles };
  const posed = solvePose(p.paper!, stageAngles);
  return {
    pose: posed,
    hinges: hingePositions(p.paper!, posed),
    paper: p.paper!,
    markers: lift(p.paper!, p.placements, stageAngles),
  };
});
/** 预览时两种纸张共用同一取景比例，形状变化才不会被缩放掩盖。 */
const scale = computed(() =>
  sceneScale(
    Math.max(doc.paper.width, ghost.value?.paper.width ?? 0),
    Math.max(doc.paper.height, ghost.value?.paper.height ?? 0),
  ),
);
const committedMarkers = computed(() =>
  lift(
    doc.paper,
    placeMarks(doc.marks, {
      paper: doc.paper,
      params: doc.scheme,
      faceOf: Object.fromEntries(doc.paper.creases.map((c) => [c.id, c.face])),
    }),
    doc.angles,
  ),
);
/**
 * 已提交的标记点始终画在实线纸面上；预览时再把草稿纸面上的标记画成半透明层，
 * 两者并排即可看出同一个材料点是否仍落在同一片纸面区域。
 */
const markers = computed(() => committedMarkers.value);
const dimensions = computed(() => {
  const p = previewing.value && preview.value.ok ? preview.value.paper! : doc.paper;
  return `${p.width.toFixed(0)} × ${p.height.toFixed(0)} mm`;
});

const player = usePlayer(doc);
/** 成品处再按播放时从头开始，而不是停在最后一帧。 */
function togglePlay() {
  if (!doc.playing && doc.step >= doc.steps.length - 1) seek(doc, 0);
  player.toggle();
}
const help = ref(false),
  toast = ref("");
function notify(s: string) {
  toast.value = s;
  setTimeout(() => (toast.value = ""), 2600);
}
function choosePaper(id: string) {
  if (scheme.draft.dirty && !window.confirm("当前有未确认的参数调整，切换纸型将丢弃它。继续吗？")) return;
  Object.assign(doc, openTemplate(id));
  scheme.rebase();
  setView(doc, "iso");
  notify("已载入「" + doc.paper.name + "」");
}
function reset() {
  flatten(doc);
  setView(doc, "iso");
  notify("已回到平展纸张");
}
function capture() {
  captureStep(doc);
  scheme.rebase();
  notify("当前形态已保存到步骤 " + (doc.step + 1));
}
</script>
<template>
  <div class="workspace">
    <header class="topbar">
      <a class="brand" href="#"
        ><span class="brand-mark">◩</span><strong>折间<span>ORI</span></strong
        ><i></i><small>三维折纸工作室</small></a
      >
      <nav>
        <span class="project-indicator"></span> 未命名的纸间探索
        <span class="local-badge">本次会话</span>
      </nav>
      <div class="header-actions">
        <button class="icon-button" aria-label="帮助" @click="help = !help">
          <HelpCircle :size="18" /></button
        ><button class="reset" @click="reset">
          <RotateCcw :size="14" />重新开始</button
        ><button class="primary" @click="seek(doc, doc.steps.length - 1)">
          观察成品 <ArrowUpRight :size="15" />
        </button>
      </div>
    </header>
    <main>
      <div class="page-title">
        <div>
          <div class="eyebrow">THE ART OF FOLDING</div>
          <h1>一张纸，无限可能<span>。</span></h1>
          <p>沿着折痕，让平面生长成空间。</p>
        </div>
        <div class="session-note">
          <Leaf :size="16" /><span>放慢一点，折出自己的节奏。</span>
        </div>
      </div>
      <div class="studio">
        <aside class="left-sidebar">
          <PaperPanel :doc="doc" @paper="choosePaper" /><CreasePanel
            :doc="doc"
            :display-angles="previewing && preview.ok ? preview.finalAngles : undefined"
            @select="selectCrease(doc, $event)"
          />
          <div class="sidebar-footer">
            <Layers :size="13" /> 单张纸 · {{ doc.paper.faces.length }} 块关联纸面
          </div>
        </aside>
        <div class="center">
          <div class="canvas-label">
            <span
              >{{ ghost?.paper.name ?? doc.paper.name }}
              <small>/
                {{ (ghost?.paper.id ?? doc.paper.id) === "shelter" ? "PAPER GARDEN" : "VALLEY WALK" }}</small
              ></span
            ><span class="difficulty">入门探索 <i></i><i></i><i class="empty"></i></span>
          </div>
          <Viewport
            :doc="doc"
            :pose="pose"
            :hinges="hinges"
            :scale="scale"
            :ghost-pose="ghost?.pose"
            :ghost-hinges="ghost?.hinges"
            :ghost-scale="scale"
            :markers="markers"
            :ghost-markers="ghost?.markers"
            :previewing="previewing"
            :dims="dimensions"
            @select="selectCrease(doc, $event)"
          />
          <div class="instruction">
            <span class="instruction-number">0{{ doc.step + 1 }}</span>
            <div>
              <b>{{ doc.steps[doc.step]?.title }}</b>
              <p>{{ doc.steps[doc.step]?.note }}</p>
            </div>
            <span class="step-count">{{ doc.step + 1 }} / {{ doc.steps.length }}</span>
          </div>
        </div>
        <aside class="right-sidebar">
          <div class="selected-heading">
            <span class="eyebrow">当前折痕</span>
            <h2>{{ selectedCrease(doc)?.name }}</h2>
            <p>{{ selectedCrease(doc)?.description }}</p>
          </div>
          <SchemePanel :doc="doc" :session="scheme" @notify="notify" />
          <FoldPanel
            :doc="doc"
            :preview-final="previewing && preview.ok ? preview.finalAngles : undefined"
            @angle="changeAngle(doc, $event)"
            @direction="scheme.toggleDirection(doc.selected)"
            @target="applyTarget(doc)"
          /><ObservePanel :doc="doc" />
        </aside>
      </div>
      <SequencePanel
        :doc="doc"
        @seek="seek(doc, $event)"
        @play="togglePlay"
        @capture="capture"
      />
      <footer>
        <span>ORI / 折间 <i>用折叠，重新认识一张纸。</i></span
        ><span
          ><i class="status-dot"></i> 全部计算于浏览器本地
          <small>© 2026 ORI STUDIO</small></span
        >
      </footer>
    </main>
    <div v-if="toast" role="status" class="toast">✓ {{ toast }}</div>
    <div v-if="help" class="modal-backdrop" @click.self="help = false">
      <section class="help-modal">
        <button class="close" @click="help = false">×</button>
        <div class="eyebrow">A SMALL GUIDE</div>
        <h2>从第一道折痕开始</h2>
        <p>
          在右侧「尺寸参数」里拖动纸张宽高、折痕位置比例或目标开口角，整套纸面、折轴与步骤会重新求解，而不是把成品整体拉伸。
        </p>
        <p>
          调整期间画布以虚线显示参数预览，纸上标记点始终贴在原来的材料位置上。确认后一次性提交所有关联变化；取消会完整恢复之前的纸张与折法。
        </p>
        <p>
          若参数使折痕顺序改变，步骤会标注是否还能迁移；无法迁移的步骤会被收回，回退参数即可恢复。作品保留在本次会话中。
        </p>
        <button class="primary" @click="help = false">开始探索 ↗</button>
      </section>
    </div>
  </div>
</template>
