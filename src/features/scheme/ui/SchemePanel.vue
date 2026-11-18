<script setup lang="ts">
import { computed } from "vue";
import { Check, RotateCcw, TriangleAlert, X } from "lucide-vue-next";
import type { Document } from "../../../shared/types";
import type { useScheme } from "../model/session";

const props = defineProps<{
  doc: Document;
  session: ReturnType<typeof useScheme>;
}>();
const emit = defineEmits<{ notify: [message: string] }>();

const draft = props.session.draft;
const resolution = computed(() => props.session.resolve());
const errors = computed(() => resolution.value.errors);
const valid = computed(() => resolution.value.ok && !!resolution.value.paper);
const summary = computed(() => resolution.value.report.summary);
const steps = computed(() => resolution.value.report.steps);
const retired = computed(() => resolution.value.report.retired);
const marks = computed(() => resolution.value.report.marks);
const orderChanged = computed(
  () => resolution.value.ok && resolution.value.report.orderChanged,
);
const reachable = computed(() => resolution.value.reachable);
const opening = computed(() => resolution.value.opening);

const edgeName = { right: "右边缘", top: "上边缘" } as const;
const ratioEntries = computed(() =>
  props.doc.paper.creases.map((c) => {
    const spec = props.session.template.creases.find((s) => s.id === c.id);
    const edge = spec?.edge ?? "right";
    return {
      crease: c,
      edge,
      origin: edge === "right" ? "右下角" : "右上角",
      ratio: draft.params.ratios[c.id] ?? spec?.ratio ?? 0,
      stage: resolution.value.order.indexOf(c.id),
    };
  }),
);

function commit() {
  const result = props.session.commit();
  emit(
    "notify",
    result.ok ? "尺寸参数已确认，整套折法已重新求解" : result.errors[0]!,
  );
}
function cancel() {
  props.session.reset();
  emit("notify", "已取消调整，恢复之前的纸张与折法");
}
const statusLabel = { migrated: "可迁移", meaningless: "已失效" } as const;
</script>

<template>
  <section class="panel scheme-panel">
    <div class="section-heading">
      <span>尺寸参数</span><small>PARAMETRIC</small>
    </div>
    <p class="muted">
      拖动参数会重新求解纸面、折轴与全部步骤，而不是拉伸成品。
    </p>

    <div class="param-row">
      <label for="param-width">纸张宽</label>
      <div class="param-value">
        <input
          id="param-width"
          type="number"
          :value="draft.params.width"
          min="60"
          max="600"
          step="5"
          @change="
            session.setParam(
              'width',
              Number(($event.target as HTMLInputElement).value),
            )
          "
        /><span>mm</span>
      </div>
    </div>
    <input
      aria-label="纸张宽度"
      type="range"
      min="60"
      max="600"
      step="5"
      :value="draft.params.width"
      @input="session.setParam('width', +($event.target as HTMLInputElement).value)"
    />
    <div class="param-row">
      <label for="param-height">纸张高</label>
      <div class="param-value">
        <input
          id="param-height"
          type="number"
          :value="draft.params.height"
          min="60"
          max="600"
          step="5"
          @change="
            session.setParam(
              'height',
              Number(($event.target as HTMLInputElement).value),
            )
          "
        /><span>mm</span>
      </div>
    </div>
    <input
      aria-label="纸张高度"
      type="range"
      min="60"
      max="600"
      step="5"
      :value="draft.params.height"
      @input="session.setParam('height', +($event.target as HTMLInputElement).value)"
    />

    <div class="line-label">
      <label>折痕位置</label><span>距边缘比例</span>
    </div>
    <div v-for="entry in ratioEntries" :key="entry.crease.id" class="param-crease">
      <div class="param-row tight">
        <label :for="'ratio-' + entry.crease.id"
          >{{ entry.crease.name }}
          <em class="edge-tag">{{ edgeName[entry.edge] }}</em></label
        >
        <div class="param-value">
          <input
            :id="'ratio-' + entry.crease.id"
            type="number"
            :value="(entry.ratio * 100).toFixed(1)"
            min="1"
            max="99"
            step="0.5"
            @change="
              session.setRatio(
                entry.crease.id,
                Number(($event.target as HTMLInputElement).value) / 100,
              )
            "
          /><span>%</span>
        </div>
      </div>
      <input
        :aria-label="entry.crease.name + ' 位置比例'"
        type="range"
        min="1"
        max="99"
        step="0.5"
        :value="entry.ratio * 100"
        @input="
          session.setRatio(entry.crease.id, +($event.target as HTMLInputElement).value / 100)
        "
      />
      <small class="stage-hint">
        距{{ entry.origin }}
        <template v-if="entry.stage >= 0"
          > · 整套第 {{ String(entry.stage + 1).padStart(2, "0") }} 步</template
        >
      </small>
    </div>

    <div class="param-row">
      <label for="param-opening">目标开口角</label>
      <div class="param-value">
        <input
          id="param-opening"
          type="number"
          :value="draft.params.opening"
          min="0"
          max="180"
          step="1"
          @change="
            session.setParam(
              'opening',
              Number(($event.target as HTMLInputElement).value),
            )
          "
        /><span>°</span>
      </div>
    </div>
    <input
      aria-label="目标开口角"
      type="range"
      min="0"
      max="180"
      step="1"
      :value="draft.params.opening"
      @input="session.setParam('opening', +($event.target as HTMLInputElement).value)"
    />
    <div class="range-labels">
      <span>0°</span
      ><span class="reach"
        >可达 {{ reachable[0].toFixed(0) }}–{{ reachable[1].toFixed(0) }}°</span
      ><span>180°</span>
    </div>

    <div v-if="valid" class="scheme-state ok">
      <span>实测开口 {{ opening.toFixed(1) }}°</span>
      <span>{{ summary }}</span>
    </div>
    <div v-else class="scheme-errors">
      <p v-for="e in errors" :key="e"><TriangleAlert :size="13" />{{ e }}</p>
    </div>

    <div v-if="valid && (orderChanged || steps.length)" class="migration">
      <div class="line-label"><label>步骤迁移</label><span>MIGRATION</span></div>
      <div v-if="orderChanged" class="order-warning">
        折痕顺序已改变：{{ resolution.report.orderAfter
          .map((id) => doc.paper.creases.find((c) => c.id === id)?.name ?? id)
          .join(" → ") }}
      </div>
      <ul class="migrate-list">
        <li
          v-for="s in steps"
          :key="s.id"
          :class="s.status === 'migrated' ? 'ok' : 'bad'"
        >
          <Check v-if="s.status === 'migrated'" :size="12" />
          <X v-else :size="12" />
          <div>
            <b>{{ s.title }}</b>
            <small>{{ s.note || statusLabel[s.status] }}</small>
          </div>
          <i>{{ s.status === "migrated" ? "第 " + (s.to + 1) + " 步" : "收回" }}</i>
        </li>
      </ul>
      <div v-if="marks.length" class="mark-list">
        <div v-for="m in marks" :key="m.id" class="mark-row" :class="m.status">
          <span>{{ m.label }}</span>
          <small>{{ m.note }}</small>
        </div>
      </div>
      <p v-if="retired.length" class="retired-note">
        {{ retired.map((r) => r.title).join("、") }} 将被收回；参数回退时会恢复。
      </p>
    </div>

    <div class="scheme-actions">
      <button class="primary full" :disabled="!valid || !draft.dirty" @click="commit">
        <Check :size="14" /> 确认并提交全部变化
      </button>
      <button class="ghost full" :disabled="!draft.dirty" @click="cancel">
        <RotateCcw :size="13" /> 取消，恢复原折法
      </button>
      <p v-if="draft.dirty" class="hint">
        {{ valid ? "确认后整套纸面、折轴与步骤一起提交" : "参数尚不可行，提交已禁用" }}
      </p>
    </div>
  </section>
</template>
