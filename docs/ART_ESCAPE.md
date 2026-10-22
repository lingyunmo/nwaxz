# 极限恐怖：原创逃生美术

本批使用内置 imagegen 生成原创浴场封面、材质与道具。旧恐怖奶蛙图集仅作为角色参考并继续用于追捕和经典捧腹大笑；未复制《恐怖奶奶》的地图、图像或声音。FFmpeg 仅做缩放及 WebP 编码，PNG 母版保留本地生成目录，不进入运行缓存。

第一人称画面采用 Canvas 2D 光线投射，墙面、地板、天花板和木门采样绘制纹理，立体投影、遮挡、手电和柜子门缝由代码完成；交互道具是透明绘制图集。原18关的美术不变。

| 素材 | 项目路径 | 格式 |
| --- | --- | --- |
| 纹理 | `public/assets/scenes/escape-materials-v1.webp` | 1024 × 1024，2×2 材质 |
| 道具 | `public/assets/props/escape-props-v1.webp` | 768 × 1152，2×3 透明图集 |
| 封面 | `public/assets/scenes/escape-cover-v1.webp` | 576 × 960 |
| 出口细节 | `public/assets/props/escape-details-v1.webp` | 768 × 768，2×2 透明图集 |

## 纹理提示

```text
Use case: stylized-concept. Create a production texture atlas for an ORIGINAL first-person horror game inside an abandoned bathhouse, art is painterly realistic premium atmospheric horror. Exactly square 2x2 grid of FOUR equal square material tiles, no gutters, no frames, straight orthographic surface view, evenly lit with no dramatic shadows so the game can relight them. TOP LEFT: cracked grimy dark teal ceramic wall tiles with subtle mildew, aging plaster and small scratches, tactile unsettling detail. TOP RIGHT: full-width closed old dark brown vertical plank door surface with rust stains, no handle and no perspective. BOTTOM LEFT: dirty small gray-green stone floor tiles, worn, scuffed, a few cracks, seamless surface. BOTTOM RIGHT: damp pale gray concrete ceiling surface with sparse mold and fine cracks, seamless surface. Surfaces cover their entire square; no architecture, windows, furniture, creatures, large objects, text, blood, UI, no logos. Individual textures will be sampled by a code raycaster. All four tile boundaries must be at precisely x=50% and y=50%. High quality hand-painted horror environment materials with legible medium-value texture, not solid black.
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
