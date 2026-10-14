# 水草与海绵资源

这些素材已准备，当前污水版本尚未接入水草或海绵玩法，供后续开发使用。

本图集使用内置 ImageGen 一次生成，延续奶蛙浴室的柔和 3D 卡通风格。仅做裁剪、共同尺度重采样、固定锚点定位和 WebP 压缩，透明通道来自生成结果；未用代码绘制素材或移除背景。素材不包含水池、泥土、地面或场景背景。

## 文件与网格

- `/assets/props/garden-props-v1.webp`：浏览器主资源，160,002 字节。
- `/assets/props/garden-props-v1.png`：PNG master，593,973 字节。
- `/assets/props/garden-atlas.json`：坐标、锚点、原图边界与名称映射。
- 实际尺寸 1024 × 1024，2 列 × 2 行，每格 512 × 512。
- `sourceRect` 使用 `[x, y, width, height]`；`bounds` 和 `originalRect` 使用 `[left, top, right, bottom]`，右下坐标 exclusive。
- `bounds` 按 alpha > 20 测量，均为单元局部坐标。

| 索引 | 名称 | sourceRect | 局部锚点 | bounds |
| --- | --- | --- | --- | --- |
| 0 | grassHealthy | [0, 0, 512, 512] | [256, 436] | [67, 69, 419, 480] |
| 1 | grassWithered | [512, 0, 512, 512] | [256, 436] | [63, 109, 417, 479] |
| 2 | spongeDry | [0, 512, 512, 512] | [256, 256] | [74, 122, 438, 389] |
| 3 | spongeWet | [512, 512, 512, 512] | [256, 256] | [73, 122, 437, 389] |

## 水草

健康与枯萎水草均有四片柔软叶片，采用相同尺度、对应根部与固定绘制锚点。锚点 `[256, 436]` 位于叶片汇入根部的位置，不是整格中心，也不是最下方细根尖。最下方可见细根为局部 `y = 479` / `478`。

枯萎状态颜色转为橄榄灰黄，叶尖自然下垂，所以可见顶点降低约 40px；没有把枯萎状态放大补齐高度。状态切换时保持根部锚点和缩放一致即可避免植物位置跳动。可绕根部小幅摆动，污染腐蚀进度可在两个状态间渐变；阻挡判定由物理层处理。

## 海绵

干湿海绵使用相同主体中心锚点 `[256, 256]`、相同相机与尺度，可见宽高几乎相同。干海绵为温暖浅黄多孔方块，湿海绵色泽加深、表面润泽并有三颗附着清水珠，没有背景积水或脱离主体的水滴。

吸水量可混合两个状态，挤水时围绕主体中心缩放；喷出水滴与吸水守恒由玩法层实现。

## 验证

RGBA alpha 范围为 0–255，PNG 与 WebP 的 alpha 通道逐像素一致。四个单元四边 20px 区域均为 alpha = 0，各格完整且不交叠。已分别在深灰与浅蓝背景按正常 alpha 合成检查，根部、叶片间隙及海绵完整，无可见外围碎片。

本资源任务没有修改其他素材、代码或既有文档，没有提交、推送或操作服务器。

## 完整生成提示词

```text
Use case: stylized-concept
Asset type: a transparent 2D game prop atlas, 2 columns by 2 rows, four isolated sprites for a mint-green bathroom water puzzle with a yellow milk-frog character.
Primary request: exactly four props in row-major order: healthy water grass, withered water grass, dry sponge, water-saturated sponge. Soft polished 3D cartoon/clay style, broad rounded readable forms, warm gentle top-left light, friendly casual-mobile-game quality. No character in this asset.
Composition/framing: square canvas with exactly four equal cells, broad transparent margins, no overlap, no ground plane, no background shadow. Complete prop silhouettes must stay inside their own cells. No grid lines, labels, numbers, text or watermark. Background must be real transparent alpha, not painted white, black or checkerboard.
Cell 0 TOP LEFT HEALTHY WATER GRASS: a little clump of aquatic grass with 3 or 4 upright softly curving long green leaves, lush bright leaf-green and teal shading, clean tapered leaf tips, simple smooth leaf surfaces. A very small readable root cluster at the bottom centered horizontally; fine short roots are clearly visible but no soil, pot, stones or water. Leaf clump is about 70% cell height, rooted near 86% cell height. Clearly show the bottom root pivot for gameplay bending.
Cell 1 TOP RIGHT WITHERED WATER GRASS: the EXACT SAME clump, same four-leaf count, same camera, width/height scale and SAME root location as cell 0, now wilted by dirty water. Leaves have desaturated olive-brown/yellow-gray colors, slightly folded edges and gently drooping tips, while retaining enough original overall height and silhouette for state switching. Roots match cell 0 exactly. No dirty water or particles drawn; just the damaged plant state.
Cell 2 BOTTOM LEFT DRY SPONGE: a single warm yellow porous rounded rectangular sponge block. View from a gentle front-right three-quarter angle showing top, front and right side. Rounded cuboid silhouette, friendly irregular small sponge holes and gentle matte dry texture. No face, arms or props. Centered in the cell with generous margins, approximately 65% cell width and 48% cell height.
Cell 3 BOTTOM RIGHT WATER-SATURATED SPONGE: the EXACT SAME rounded cuboid sponge shape, camera, physical width and height scale, perspective and center position as cell 2. It is now fuller and softly swollen with water, colored a slightly deeper golden yellow, with a subtle moist sheen and just THREE small clear water beads attached to the outer side/top surfaces. No flowing streams, puddles or detached droplets. Preserve the same anchor and recognizable outline; do not create a different sponge.
Constraints: no pond, bathroom tiles, tub, pot, water plane, grass patch, garden scenery, dirt, root mound, pipe, valve, flower, frog, human, crocodile, face, bubbles, floating particles, text, buttons, motion marks, logo or watermark. Transparency remains outside each isolated object including between leaves. Four assets only, not animation duplicate frames or extra props.
```

