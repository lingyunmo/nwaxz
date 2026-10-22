# 极限恐怖：原创逃生美术

本批原创浴场封面、材质与道具图集构成极限恐怖 v1 的绘制美术来源；旧恐怖奶蛙图集继续作为专用恐怖角色参考，保留经典捧腹大笑造型。普通模式的 Cute turnaround 不用于恐怖角色建模。未复制《恐怖奶奶》的地图、图像或声音。FFmpeg 仅做缩放及 WebP 编码，PNG 母版保留本地生成目录，不进入运行缓存。

已发布的 0.11.0 逃生篇采用 Canvas 2D 光线投射，以绘制纹理和透明道具图集表现立体投影；0.11.0 的准确发布证据见[GitHub记录](https://github.com/lingyunmo/nwaxz/pull/34#issuecomment-6343588123)。0.12.0 已发布 Babylon.js 9.32 / WebGL 真3D场景，加入可开合的双门衣柜与真实柜内藏身空间、木柜和抽屉 UV 木纹、金属阀门、配电箱、铁网与管道。[0.12.0 发布证据及精确 main SHA `f6f4dee296eb280aa387dbfc440b33024b2287a0`](https://github.com/lingyunmo/nwaxz/pull/38#issuecomment-6349588315)。普通12关和恐怖洗澡6关的美术不变。

0.13.0 仍是本地候选、尚未发布。为贴合用户指定的恐怖奶蛙形象，追捕者从原骨骼 GLB 切换为原画二维直立角色：仅绕 Y 轴面向玩家，受场景墙体遮挡。站立和经典捧腹大笑直接取自 `haunted-frog-v1.webp`，新增 `haunted-frog-actions-v2.webp` 的 4×2 八动作（眨眼、左看、右看、搜查、窥探、扑抓、跑步左步、跑步右步），呼吸/笑/步态连续播放并约 120 ms 混合切换。真实3D家具继续使用 GLB。新候选的浏览器和真机表现尚待验收，不在此记录未完成的帧率或听感结论。

| 素材 | 项目路径 | 格式 |
| --- | --- | --- |
| 纹理 | `public/assets/scenes/escape-materials-v1.webp` | 1024 × 1024，2×2 材质 |
| 道具 | `public/assets/props/escape-props-v1.webp` | 768 × 1152，2×3 透明图集 |
| 封面 | `public/assets/scenes/escape-cover-v1.webp` | 576 × 960 |
| 出口细节 | `public/assets/props/escape-details-v1.webp` | 768 × 768，2×2 透明图集 |
| 恐怖奶蛙动作图集 | `public/assets/character/haunted-frog-v1.webp` | 复用站立与经典捧腹大笑原画 |
| 恐怖奶蛙动作图集 | `public/assets/character/haunted-frog-actions-v2.webp` | 4×2，八个凝视、搜查、扑抓与跑步动作 |
| 像素地图图集 | `public/assets/ui/escape-map-atlas-v1.webp` | 4×2，石墙、地板、木材、纸张、水、迷雾、铜与危险纹理 |
| 逃生家具与设施模型 | `public/assets/models/escape-props-v1.glb` | GLB，六组根节点：衣柜、抽屉、配电箱、阀门、铁网、管道 |
| 恐怖奶蛙模型源资产 | `public/assets/models/extreme-milk-frog-v1.glb` | GLB，保留的旧18关节模型；0.13.0 运行时及预缓存不使用 |

两个 GLB 源资产由 `ops/build_escape_props.py` 和 `ops/build_escape_character.py` 生成；已有绘制材质图集 `escape-materials-v1.webp` 的右上旧木门象限裁切后用于家具模型木材 UV，并作为 PNG 嵌入道具 GLB。当前角色表现使用恐怖奶蛙原画图集；`milk-frog-turnaround-v1.png`、`normal-milk-frog-turnaround-v1.png` 是普通模式 Cute 角色建模草稿，不作为恐怖版参考。0.13.0 运行时保留家具 GLB，但不加载或预缓存角色 GLB。候选浏览器脚本为 `ops/escape-browser.mjs`，需要独立安装 Playwright 或配置 `PLAYWRIGHT_MODULE`，可选配置 `CHROMIUM_PATH`，并始终以 headless 软件渲染和独立 profile 运行。地图图集用于探索地图的材质采样。

## 纹理提示

```text
Use case: stylized-concept. Create a production texture atlas for an ORIGINAL first-person horror game inside an abandoned bathhouse, art is painterly realistic premium atmospheric horror. Exactly square 2x2 grid of FOUR equal square material tiles, no gutters, no frames, straight orthographic surface view, evenly lit with no dramatic shadows so the game can relight them. TOP LEFT: cracked grimy dark teal ceramic wall tiles with subtle mildew, aging plaster and small scratches, tactile unsettling detail. TOP RIGHT: full-width closed old dark brown vertical plank door surface with rust stains, no handle and no perspective. BOTTOM LEFT: dirty small gray-green stone floor tiles, worn, scuffed, a few cracks, seamless surface. BOTTOM RIGHT: damp pale gray concrete ceiling surface with sparse mold and fine cracks, seamless surface. Surfaces cover their entire square; no architecture, windows, furniture, creatures, large objects, text, blood, UI, no logos. Individual textures will be sampled by the game's surface and prop materials. All four tile boundaries must be at precisely x=50% and y=50%. High quality hand-painted horror environment materials with legible medium-value texture, not solid black.
```

## 道具提示

```text
Use case: stylized-concept. Asset type: transparent sprite atlas for an ORIGINAL first person abandoned bathhouse horror game. Exact TWO columns and THREE rows, SIX equal square cells, no gutters and no overlap. Each isolated object fills 80% of cell with clean transparent margins, full front-facing view, feet/base aligned at 90% of each cell; painterly realistic dark haunted-game style, high quality rusted wood and metal detail, readable at small size. Top left: tall closed weathered wooden double-door wardrobe, ornate simple vertical planks, dark brown. Top right: same wardrobe with both doors open and a very dark empty interior (empty, no person). Middle left: low decrepit wooden dresser with two slightly open drawers, whole object. Middle right: old corroded wall-mounted electrical fuse box, open lid, small red unlit lamp and obvious missing fuse slot; no writing. Bottom left: single large antique brass key with round handle on a small ring, bright brass for clear silhouette. Bottom right: full pair of heavy red-handled bolt cutters, silver jaws with scratches, diagonal but whole tool. Genuinely transparent background across all cells and around every item, no ground plane, no scene, no shadow outside the objects, no creatures, no blood, no writing, no borders. Exact 2 by 3 sprite sheet with each prop confined to its own equally sized cell, consistent hand-painted game art.
```

## 封面提示

```text
Use case: stylized-concept. Asset type: polished full-screen key art for an ORIGINAL first-person horror escape game. Reference image identifies ONLY the antagonist: yellow pear-shaped fat milk frog, huge creamy belly, dark hands, pale glowing green eyes, uncanny toothy smile. Paint a frightening abandoned bathhouse at night, a long narrow decayed teal-tiled hallway in deep cold shadows. On the right a tall old wooden wardrobe with a door slightly ajar. Farther down the hallway stands this same sinister yellow frog, partially emerging from darkness, both hands clutching its belly as it laughs, mouth wide open. A rusty sewer opening in the floor at the near lower left reveals a faint cold light and a ladder down, suggesting a dangerous escape. First-person atmospheric cinematic composition, powerful depth, peeling plaster, damp floor, rusted pipes. Premium painterly realistic horror game art, amber flashlight accent, gloomy charcoal and dark teal palette, visible readable details. Portrait 3:5 composition with open dark upper center reserved for game title drawn by UI; central frog is visible and scary but not filling the entire image. No text, no UI, no logos, no blood, no copy of any existing commercial game scene. Do not reproduce the reference grid; this is a single finished scene.
```

## 出口细节提示

```text
Create a premium painterly realistic horror-game transparent sprite sheet in an exact 2x2 grid of FOUR equally sized square cells. Every prop isolated, front facing, complete, fits 82 percent of its own cell, clean genuinely transparent background and generous transparent margins, no overlap. Top left: a large circular rusty sewer pipe entrance seen straight on, thick corroded metal rim and square rusted iron grate across its black opening, no scenery. Top right: a large red rusted circular pipe valve wheel, mounted on a very short dark pipe segment, full silhouette. Bottom left: a single creased off-white paper note, slightly curled corners, faint smudges but no letters or writing. Bottom right: a single old white ceramic cylindrical electrical fuse with brass end caps and a slightly aged finish. Consistent abandoned bathhouse material palette, legible geometry, detailed painted textures, no ground plane, no shadows outside props, no text, no characters, no decorative frame.
```
