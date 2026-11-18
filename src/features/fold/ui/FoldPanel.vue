<script setup lang="ts">
import { computed } from "vue";
import type { Document } from "../../../shared/types";
import { angleHint } from "../lib/angle";
defineEmits<{ angle: [value: number]; direction: []; target: [] }>();
const p = defineProps<{ doc: Document; previewFinal?: Record<string, number> }>();
const angle = computed(() => p.doc.angles[p.doc.selected] ?? 0);
const final = computed(
  () =>
    p.previewFinal?.[p.doc.selected] ??
    p.doc.finalAngles[p.doc.selected] ??
    0,
);
const fraction = computed(() =>
  final.value ? Math.round((Math.abs(angle.value) / Math.abs(final.value)) * 100) : 0,
);
</script>
<template>
  <section class="panel fold-panel">
    <div class="section-heading"><span>折叠控制</span><small>FOLD</small></div>
    <div class="angle-display">
      <strong>{{ angle.toFixed(0) }}<sup>°</sup></strong
      ><span>{{ angleHint(angle) }} · 方案最终 {{ final.toFixed(0) }}°</span>
    </div>
    <input
      aria-label="折叠角度"
      type="range"
      min="-175"
      max="175"
      :value="angle"
      @input="$emit('angle', Number(($event.target as HTMLInputElement).value))"
    />
    <div class="range-labels">
      <span>−175°</span><span>当前进度 {{ fraction }}%</span><span>175°</span>
    </div>
    <div class="line-label">
      <label>折叠方向</label
      ><button class="text-button" @click="$emit('direction')">
        {{ final < 0 ? "山折 ↘" : "谷折 ↗" }} ⇄
      </button>
    </div>
    <button class="primary full" @click="$emit('target')">
      折至方案角度 <span>{{ final.toFixed(0) }}°</span>
    </button>
    <div v-if="!previewFinal" class="angle-presets">
      <button
        v-for="f in [0.25, 0.5, 0.75]"
        :key="f"
        @click="$emit('angle', final * f)"
      >
        {{ Math.round(f * 100) }}%
      </button>
      <button @click="$emit('angle', 0)">0%</button>
    </div>
    <p class="muted small">
      {{
        previewFinal
          ? "上方为参数预览的最终角度；确认后整套折法才会写入作品。"
          : "手动拨动只改变当前姿态；方向切换与尺寸参数会在确认后整套重解。"
      }}
    </p>
  </section>
</template>
