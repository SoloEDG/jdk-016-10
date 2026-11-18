<script setup lang="ts">
import { computed, ref } from "vue";
import type { Document, MarkPlacement, PoseFace } from "../../../shared/types";
import { project, polygon } from "../lib/projection";
import { orbit, zoom, setView } from "../model/camera";
import { downloadView } from "../lib/export";
const props = defineProps<{
  doc: Document;
  pose: PoseFace[];
  hinges: { id: string; a: [number, number, number]; b: [number, number, number] }[];
  scale?: number;
  /** 参数预览中的替代纸面：与已提交姿态叠加显示。 */
  ghostPose?: PoseFace[];
  ghostHinges?: { id: string; a: [number, number, number]; b: [number, number, number] }[];
  ghostScale?: number;
  markers?: MarkPlacement[];
  ghostMarkers?: MarkPlacement[];
  previewing?: boolean;
  dims?: string;
}>();
defineEmits<{ select: [id: string] }>();
const svg = ref<SVGSVGElement>();
let drag = false,
  lastX = 0,
  lastY = 0;
const s = computed(() => props.scale ?? 1);
function decorate(faces: PoseFace[], scale: number) {
  return faces
    .map((f) => ({
      ...f,
      scale,
      depth:
        f.points.reduce((sum, p) => sum + project(p, props.doc.view, scale).z, 0) /
        f.points.length,
      back: project(f.normal, props.doc.view, scale).z > 0,
    }))
    .sort((a, b) => a.depth - b.depth);
}
const faces = computed(() => decorate(props.pose, s.value));
const ghosts = computed(() =>
  props.ghostPose ? decorate(props.ghostPose, props.ghostScale ?? s.value) : [],
);
const px = (p: [number, number, number], scale = s.value) => project(p, props.doc.view, scale);
function down(e: PointerEvent) {
  if ((e.target as Element).closest(".hinge, .marker")) return;
  drag = true;
  lastX = e.clientX;
  lastY = e.clientY;
  (e.currentTarget as Element).setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (!drag) return;
  orbit(props.doc, e.clientX - lastX, e.clientY - lastY);
  lastX = e.clientX;
  lastY = e.clientY;
}
</script>
<template>
  <section class="viewport">
    <div class="viewport-top">
      <div class="view-tabs">
        <button class="active" @click="setView(doc, 'iso')">立体视图</button
        ><button @click="setView(doc, 'top')">俯视</button
        ><button @click="setView(doc, 'front')">正视</button>
      </div>
      <span class="live" :class="{ preview: previewing }"
        ><i></i> {{ previewing ? "参数预览中" : "实时预览" }}
        <b v-if="dims" class="dims">{{ dims }}</b></span
      >
    </div>
    <svg
      ref="svg"
      class="paper-scene"
      viewBox="0 0 800 560"
      aria-label="三维折纸预览"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="drag = false"
      @pointercancel="drag = false"
      @wheel.prevent="zoom(doc, -$event.deltaY * 0.001)"
    >
      <defs>
        <pattern id="grid" width="35" height="35" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill="#d4d9d0" />
        </pattern>
        <pattern id="fiber" width="13" height="17" patternUnits="userSpaceOnUse">
          <path
            d="M1 2l3 1M8 11l2 -2M3 14l1 -2"
            stroke="#fff"
            stroke-opacity=".22"
            stroke-width=".7"
          />
        </pattern>
        <pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".65" fill="#fff" fill-opacity=".4" />
        </pattern>
        <filter id="shadow"><feGaussianBlur stdDeviation="15" /></filter>
      </defs>
      <rect width="800" height="560" fill="#f6f7f2" />
      <rect v-if="doc.view.grid" width="800" height="560" fill="url(#grid)" />
      <ellipse
        cx="400"
        cy="401"
        rx="180"
        ry="32"
        fill="#63705a"
        opacity=".15"
        filter="url(#shadow)"
      />
      <g v-for="f in faces" :key="f.id" :data-face="f.id">
        <polygon
          :points="polygon(f.points, doc.view, f.scale)"
          :fill="f.back ? doc.back : doc.front"
          stroke="#785945"
          stroke-opacity=".35"
          stroke-width="1.2"
          stroke-linejoin="round"
        />
        <polygon
          :points="polygon(f.points, doc.view, f.scale)"
          fill="#314638"
          :opacity="Math.max(0, 0.1 + f.normal[1] * 0.08)"
        />
        <polygon
          v-if="doc.texture !== 'plain'"
          :points="polygon(f.points, doc.view, f.scale)"
          :fill="'url(#' + doc.texture + ')'"
        />
      </g>
      <g v-for="f in ghosts" :key="'g-' + f.id" class="ghost-face" :data-face="f.id">
        <polygon
          :points="polygon(f.points, doc.view, f.scale)"
          fill="#fffaf1"
          fill-opacity=".28"
          stroke="#b8734a"
          stroke-width="1.3"
          stroke-dasharray="6 4"
        />
      </g>
      <g v-if="previewing && ghostHinges" class="ghost-hinges">
        <line
          v-for="h in ghostHinges"
          :key="'gh-' + h.id"
          :x1="px(h.a, ghostScale ?? s).x"
          :y1="px(h.a, ghostScale ?? s).y"
          :x2="px(h.b, ghostScale ?? s).x"
          :y2="px(h.b, ghostScale ?? s).y"
          stroke="#c9906b"
          stroke-width="1.2"
          stroke-dasharray="3 4"
          opacity=".7"
        />
      </g>
      <g v-if="doc.view.wire">
        <g
          v-for="(h, i) in hinges"
          :key="h.id"
          class="hinge"
          @click.stop="$emit('select', h.id)"
        >
          <line
            :x1="px(h.a).x"
            :y1="px(h.a).y"
            :x2="px(h.b).x"
            :y2="px(h.b).y"
            stroke="transparent"
            stroke-width="18"
          />
          <line
            :x1="px(h.a).x"
            :y1="px(h.a).y"
            :x2="px(h.b).x"
            :y2="px(h.b).y"
            :stroke="h.id === doc.selected ? '#fff8d9' : '#746f57'"
            :stroke-width="h.id === doc.selected ? 2.5 : 1.2"
            stroke-dasharray="5 4"
          />
          <circle
            :cx="(px(h.a).x + px(h.b).x) / 2"
            :cy="(px(h.a).y + px(h.b).y) / 2"
            r="11"
            :fill="h.id === doc.selected ? '#384d3f' : '#f7f6ee'"
          />
          <text
            :x="(px(h.a).x + px(h.b).x) / 2"
            :y="(px(h.a).y + px(h.b).y) / 2 + 3.5"
            text-anchor="middle"
            font-size="10"
            :fill="h.id === doc.selected ? 'white' : '#555'"
          >
            {{ i + 1 }}
          </text>
        </g>
      </g>
      <g v-if="markers" class="markers">
        <g
          v-for="m in markers"
          :key="m.id"
          class="marker"
          :class="m.status"
          :transform="`translate(${px(m.position).x},${px(m.position).y})`"
        >
          <circle r="8" />
          <text text-anchor="middle" y="3.2">{{ m.label }}</text>
        </g>
      </g>
      <g v-if="previewing && ghostMarkers" class="markers ghost">
        <circle
          v-for="m in ghostMarkers"
          :key="'gm-' + m.id"
          class="ghost-dot"
          :class="m.status"
          :cx="px(m.position, ghostScale ?? s).x"
          :cy="px(m.position, ghostScale ?? s).y"
          r="3.4"
        />
      </g>
      <g transform="translate(58,475)" stroke-width="1.5">
        <path d="M0 0l28 12" stroke="#be806c" />
        <path d="M0 0v-30" stroke="#839b72" />
        <path d="M0 0l-18 15" stroke="#839eae" />
        <text x="32" y="17" font-size="10" fill="#ad7a69">X</text>
        <text x="-3" y="-37" font-size="10" fill="#789069">Y</text>
        <text x="-28" y="23" font-size="10" fill="#839eae">Z</text>
      </g>
    </svg>
    <div class="scene-caption">
      <span>拖动旋转视角 · 滚轮缩放</span
      ><b>{{ Math.round(doc.view.zoom * 100) }}%</b>
    </div>
    <div class="scene-tools">
      <button
        :class="{ selected: doc.view.grid }"
        title="网格"
        @click="doc.view.grid = !doc.view.grid"
      >
        ▦</button
      ><button
        :class="{ selected: doc.view.wire }"
        title="折痕"
        @click="doc.view.wire = !doc.view.wire"
      >
        ⌁</button
      ><i></i><button title="放大" @click="zoom(doc, 0.1)">＋</button
      ><button title="缩小" @click="zoom(doc, -0.1)">−</button
      ><button title="重置视角" @click="setView(doc, 'iso')">⤢</button><i></i
      ><button title="下载观察图" @click="svg && downloadView(svg)">↓</button>
    </div>
  </section>
</template>
