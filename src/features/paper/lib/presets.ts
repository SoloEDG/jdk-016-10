import type { PaperTemplate } from "../../../shared/types";

export interface Preset {
  template: PaperTemplate;
}

const shelter: PaperTemplate = {
  id: "shelter",
  name: "纸之庭",
  subtitle: "立体空间 · 3 道折痕",
  width: 200,
  height: 200,
  creases: [
    {
      id: "c1",
      name: "侧翼斜折",
      description: "沿第一条斜折线抬起纸面，后续纸面随动。",
      edge: "right",
      ratio: 0.72,
      angle: 75,
    },
    {
      id: "c2",
      name: "对角深折",
      description: "沿对角线继续折叠，形成开放的空间。",
      edge: "top",
      ratio: 0.45,
      angle: 65,
    },
    {
      id: "c3",
      name: "侧翼回折",
      description: "在已经转动的纸面上收拢最后一翼。",
      edge: "top",
      ratio: 0.8,
      angle: -80,
    },
  ],
};

const ribbon: PaperTemplate = {
  id: "ribbon",
  name: "山谷回廊",
  subtitle: "连续折叠 · 3 道折痕",
  width: 180,
  height: 180,
  creases: [
    {
      id: "c1",
      name: "第一道山脊",
      description: "右侧相邻纸面围绕轴心向上翻起。",
      edge: "right",
      ratio: 0.84,
      angle: 60,
    },
    {
      id: "c2",
      name: "入口谷折",
      description: "中段纸面反向下压，打开通廊。",
      edge: "top",
      ratio: 0.3,
      angle: -33,
    },
    {
      id: "c3",
      name: "回廊转角",
      description: "末端纸面沿局部折轴回转收束。",
      edge: "top",
      ratio: 0.72,
      angle: 48,
    },
  ],
};

export const presets: Preset[] = [
  { template: shelter },
  { template: ribbon },
];

export const presetById = (id: string) =>
  presets.find((p) => p.template.id === id) ?? presets[0]!;

export const swatches = [
  { name: "柿子", front: "#e88459", back: "#f8dec2" },
  { name: "苔绿", front: "#718c79", back: "#dce6cf" },
  { name: "雾蓝", front: "#7496ac", back: "#d8e5eb" },
  { name: "紫藤", front: "#ad8fb1", back: "#eadfea" },
  { name: "米白", front: "#e8d6b5", back: "#fff7e8" },
];

