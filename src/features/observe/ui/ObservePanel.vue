<script setup lang="ts">
import type { Document, SchemeReport } from "../../../shared/types";
defineProps<{ doc: Document; report?: SchemeReport }>();
</script>
<template>
  <section class="panel observe-panel">
    <div class="section-heading">
      <span>标记与观察</span><small>INSPECT</small>
    </div>
    <p>纸上标记点始终贴在原来的材料位置，用来核对重解后是否仍是同一片纸。</p>
    <div class="mark-list">
      <div
        v-for="m in doc.report.marks"
        :key="m.id"
        class="mark-row"
        :class="m.status"
      >
        <span>{{ m.label }}</span>
        <small>{{ m.note }}</small>
      </div>
    </div>
    <div class="legend">
      <span><i :style="{ background: doc.front }"></i>正面</span
      ><span><i :style="{ background: doc.back }"></i>背面</span
      ><span>┄ 折痕</span>
    </div>
  </section>
</template>
