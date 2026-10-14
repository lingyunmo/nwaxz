# 浴室玩法道具图集

这套资源使用内置 ImageGen 一次生成，适用于奶蛙爱洗澡的风扇与喷水阀玩法。采用奶白、薄荷绿、银色和黄色点缀的柔和 3D 卡通风格。后期只做裁剪、统一网格定位、等比重采样与格式压缩；未用代码生成图形或抠除背景。

## 资源与几何

- 推荐资源：`/assets/props/bath-props-v1.webp`，101,430 字节。
- PNG master：`/assets/props/bath-props-v1.png`，362,680 字节。
- Metadata：`/assets/props/atlas.json`。
- 实际尺寸：1024 × 1024，2 列 × 2 行，每格 512 × 512。
- 裁剪矩形均为 `[x, y, width, height]`。锚点为各格局部坐标，可见边界为 alpha > 20 的 `[left, top, right, bottom]`，右下 exclusive。

| 索引 | 名称 | 图集裁剪矩形 | 绘制锚点 | 可见边界 |
| --- | --- | --- | --- | --- |
| 0 | fanBody | [0, 0, 512, 512] | [256, 190] | [106, 42, 408, 430] |
| 1 | fanBlades | [512, 0, 512, 512] | [256, 190] | [154, 83, 360, 277] |
| 2 | valveClosed | [0, 512, 512, 512] | [256, 300] | [74, 116, 460, 389] |
| 3 | valveOpen | [512, 512, 512, 512] | [256, 300] | [69, 178, 461, 389] |

原始生成画布为 1254 × 1254，原图逐件裁剪矩形已经写入 metadata 的 `originalRect`。各格四边 20px 区域均为 alpha = 0，完整道具不重叠、不碰格边。WebP 与 PNG master 的 alpha 通道逐像素一致，范围为 0–255。

## 风扇动画

`fanBody` 包含空壳、中心马达、支撑杆、底座，不含扇叶。圆壳内部保留真实透明空间。底座底部局部 `y = 429`。

`fanBlades` 仅含三叶转子和中心银色轮毂。风扇圆心和扇叶旋转锚点均为 `[256, 190]`。先绘制机壳，再绕同一个屏幕圆心旋转绘制扇叶；不要围绕整个 512px 格子的中心 `[256, 256]` 旋转。扇叶最大半径约 108px，机壳内径半径约 115px，旋转后仍留出间隙。

建议 Canvas 绘制顺序：

1. 将风扇圆心平移到玩法坐标，统一缩放。
2. 在局部 `(-256, -190)` 绘制第 0 格。
3. 保存状态、旋转角度，在同一个局部 `(-256, -190)` 绘制第 1 格，再恢复状态。

已检查 0° 与 55° 组装预览，圆心吻合，扇叶没有碰壳边。

## 喷水阀交互

关闭姿态手柄竖直，开启姿态手柄朝右；阀体、喷口和缩放保持匹配。游戏状态切换索引 2/3，流水粒子与压力效果由玩法层叠加。

| 状态 | 手柄转轴 | 喷水出口 | 喷水方向 |
| --- | --- | --- | --- |
| 关闭 | [254, 210] | [435, 370] | [0, 1] |
| 开启 | [255, 210] | [434, 371] | [0, 1] |

喷水出口是每格局部像素坐标，正式玩法应从开启姿态出口转换到屏幕坐标后产生水流。图片没有绘制水、风、泡泡、动作线或文字。

## 验证

生成后核实 RGBA 真实透明通道、四格透明边距及风扇空壳内部 alpha = 0。分别在深灰与浅蓝背景按正常 alpha 合成检查，所有道具完整、无可见外围碎片。代码、提交、部署均不在本资源任务中。

## 完整生成提示词

```text
Use case: stylized-concept
Asset type: a single transparent 2D game prop sprite atlas for a polished soft-3D mint-green bathroom puzzle game, 2 columns x 2 rows, four isolated props.
Primary request: create four production game-prop components in exactly this row-major order: FAN BODY/STAND with NO BLADES, separate FAN ROTOR, closed WATER SPRAY VALVE, open WATER SPRAY VALVE. These sprites will be assembled and animated in browser Canvas; geometry, empty transparent spaces and matching scales matter.
Style/medium: soft polished 3D cartoon/clay game assets, smooth rounded forms, warm milk-white ceramic and pale mint/turquoise plastic, gentle silver metal, small warm yellow accents, top-left soft lighting, consistent front-facing orthographic camera. Match a bright friendly bathroom game with a yellow frog character, but no character appears here.
Composition/framing: a square four-cell atlas, exactly 2 by 2 equal cells, each prop completely isolated on genuinely transparent alpha, broad margins and no overlap. No ground plane or cast floor shadow. No borders, labels, text, numbers or grid lines.
Cell 0 top-left FAN BODY/STAND: a compact freestanding desk fan seen straight-on. A milk-white and mint circular outer housing ring, open EMPTY transparent circular interior, a small round silver central motor cap supported by a very slim vertical mint strut, short mint pedestal below it and a stable rounded milk-white base. NO integrated fan blades. Keep the housing interior transparent so the separate rotor can rotate in front. Circular ring center at approximately 50% of cell width and 40% of cell height. Fan overall height around 78% of cell, base bottom at 88%.
Cell 1 top-right FAN ROTOR: only an independent 3-bladed fan rotor, straight-on flat plane, with three broad smoothly curved pale turquoise blades with warm-yellow edge accents and a clean small round silver center hub. No housing, no stand or cage. Rotation pivot is exactly the center of the circular hub, approximately 50% cell width and 40% cell height. Rotor diameter around 50% cell width, matching the open interior of cell 0. All three blades on real transparent background.
Cell 2 bottom-left CLOSED WATER SPRAY VALVE: a short horizontal silver pipe with a rounded chunky mint valve body, left inlet collar and right outlet collar. A small right outlet nozzle bends down slightly for spraying, but no water is drawn. Large simple yellow quarter-turn lever above the valve, in the closed state PERPENDICULAR to the horizontal pipe (lever upright in the image). Center valve body at cell center; pipe assembly occupies about 70% cell width. Rounded polished silver metal, friendly and clearly interactive.
Cell 3 bottom-right OPEN WATER SPRAY VALVE: exact same horizontal silver pipe, same mint body, same collars, same right nozzle and SAME pixel-scale camera/lighting/position as cell 2. Change ONLY the yellow quarter-turn lever to the OPEN state PARALLEL to horizontal pipe (lever points right in the image). No water drawn. This is the identical hardware in a different lever position, not a different valve.
Constraints: all four parts complete and inside separate cells, genuine transparent alpha outside their silhouettes and inside the fan ring. No water, foam, bubbles, floating particles, motion marks, shadows on background, arrows, wind symbol, human, frog, crocodile, texture tiles, environment, text, buttons, logo or watermark. No integrated blades in cell 0. No housing or base in cell 1. Do not merge or overlap props.
```

