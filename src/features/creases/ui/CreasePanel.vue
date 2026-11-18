<script setup lang="ts">
import type { Document } from "../../../shared/types";
import { creaseProgress } from "../lib/availability";
defineProps<{ doc: Document; displayAngles?: Record<string, number> }>();
defineEmits<{ select: [id: string] }>();
</script>
<template>
  <section class="panel">
    <div class="section-heading">
      <span>02 / 折痕</span><small>CREASES</small>
    </div>
    <p class="muted">选择一条折痕，开始塑造纸的空间。</p>
    <button
      v-for="(c, i) in doc.paper.creases"
      :key="c.id"
      class="crease-row"
      :class="{ active: doc.selected === c.id }"
      @click="$emit('select', c.id)"
    >
      <span class="crease-num">0{{ i + 1 }}</span
      ><span class="crease-name"
        ><b>{{ c.name }}</b
        ><small
          >{{ (displayAngles?.[c.id] ?? doc.finalAngles[c.id] ?? 0).toFixed(0) }}° ·
          {{ (displayAngles?.[c.id] ?? doc.finalAngles[c.id] ?? 0) < 0 ? "山折" : "谷折" }}</small
        ><i :style="{ width: creaseProgress(doc, c.id) + '%' }"></i></span
      ><span>↗</span>
    </button>
    <div class="tip">
      <span>⌁</span>
      <p>也可以直接点击纸张上的虚线<br />选择对应折痕</p>
    </div>
  </section>
</template>
