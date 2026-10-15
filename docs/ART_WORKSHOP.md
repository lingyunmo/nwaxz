# 第四章暖色工坊场景

本素材使用内置 ImageGen 生成（非 CLI/API 后备模式），以既有 `bath-stage-v2.webp` 作为水平分区、视角与质感参考。新图采用暖杏色、奶油色与淡陶土色瓷砖，保留原关卡地形轮廓。未覆盖旧素材；本文件只记录素材，接入代码和发布状态由相应版本说明确认。

- 浏览器资源：`/assets/scenes/workshop-stage-v1.webp`。
- 实际尺寸：480 × 800，RGB、不透明，107,652 字节。
- 原始 PNG：ImageGen 实绘 971 × 1619，保存在忽略目录 `.local/art-workshop/workshop-stage-v1-source.png`。
- 生成后仅用 Lanczos 常规重采样到逻辑画布，WebP quality 88；未绘制或合成新元素。
- 顶部 `[0, 0, 480, 178]` 为暖色砖墙与空的浅池凹槽，中段约 `y = 180–623` 为满宽土层，底部 `[0, 628, 480, 172]` 为奶油与陶土色地砖。
- 土层内部安全纹理区域：`[0, 192, 480, 414]`，可继续用于既有关卡挖掘蒙版。矩形采用 `[x, y, width, height]`。
- 已直接查看生成图与压缩后图片：水平分区与旧场景相容，无奶蛙、浴缸、互动道具、水、预挖路径、文字或界面。泥土中的小颗粒为纹理，不代表石块障碍。

## 完整提示词

```text
Use case: stylized-concept
Asset type: one opaque raster environment background for chapter four of a portrait mobile water-digging puzzle game, exact portrait 3:5 layout, desired 960 x 1600.
Primary request: create an ORIGINAL warm steam-workshop bathroom underground cutaway background. Reference image 1 is ONLY a structural layout, horizontal-band proportions, camera and visual quality reference; make the new scene visibly distinct through honey-cream ceramic tile, warm peach light and subtle copper-colored grout accents instead of mint/turquoise.
Composition and strict normalized layout matching the reference:
Top y=0..178 on a 480x800 logical canvas (0..22.25%): calm pale apricot and honey-cream tiled interior wall, softly rounded ceramic edges, an empty dry shallow recessed basin ledge near its bottom. Keep wall space uncluttered for a game HUD and tank overlay. A softly glowing workshop bathroom atmosphere, only very subtle diffuse ambient steam-like light high on the wall, never fog obscuring detail. No pipes or mechanical objects.
Middle y=180..624 (22.5%..78%): full-width continuous solid dark warm brown diggable earth, extending cleanly to BOTH image side edges. Fine tactile granular soil, small low-contrast ochre speckles, sparse tiny embedded stone grains and a very few delicate short root fibers. Simple perfectly horizontal boundaries. No holes, tunnels, excavated paths, cavities, decorative landscape or standalone obstacle rocks. This soil will be masked away interactively.
Bottom y=628..800 (78.5%..100%): warm ivory, soft terracotta and pale golden ceramic bathroom wall/floor, several broad restrained tile seams, quiet open space for the frog and tub that the game overlays separately. Ground plane composition close to reference.
Style/medium: polished friendly casual mobile game environment art, softly sculpted rounded ceramic, subtle hand-painted texture, matte surfaces, gentle ambient occlusion, warm diffuse lighting, straight-on orthographic cutaway. Simple visual hierarchy, rich but restrained earth texture. Keep the three horizontal zones and exact soil boundary positions compatible with reference.
Constraints: full opaque frame, 3:5 portrait. This is background ONLY. No characters or animals, no frog, no crocodile, no bathtub, no water or droplets or bubbles, no faucet, no pipes, no machinery, no fans, valves, sponges, tools or gameplay props. No furniture, plants, coins, crystals or collectible icons. No solid rock obstacles. No text, labels, numbers, logo, border, watermark, UI or buttons. Do not draw gameplay routes.
```
