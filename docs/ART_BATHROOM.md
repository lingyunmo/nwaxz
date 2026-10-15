# 浴室道具素材：浴缸

游戏中的浴缸资源位于 `public/assets/props/bathtub-v1.webp`。素材由内置 ImageGen 生成，使用透明背景；输出为 512×512 RGBA WebP，文件大小 12,006 字节。生成后的处理仅包括常规裁剪、Lanczos 重采样、放入透明方形画布和 WebP 压缩，没有代码绘图、重着色或重建 alpha。原始生成文件保存在被忽略的本地目录 `.local/tub-art-v1/`，不随站点发布。

alpha≥16 的可见主体边界为 `[20,212,492,332]`（右、下边界不包含在内），建议锚点为 `(256,335)`。游戏绘制变换使用缩放 `0.4`，将锚点放在世界坐标 `(376,796)`；整张图的目标矩形为 `(273.6,662,204.8,204.8)`，主体在游戏坐标中的近似可见范围为 `(283,747,188,49)`。这个 alpha 阈值下主体约 472×120 像素，实际比例比提示词中约 470×140 的目标更扁。

浴缸前壁会遮住角色的脚；动态水面涟漪由 Canvas 绘制，静态素材中的水面保持浅而平静。以上记录素材来源和几何参数，不代表浏览器验收或线上部署已完成。

## 完整生成提示词

```text
Use case: stylized-concept
Asset type: one transparent-background game prop cutout, final intended square canvas 512 x 512; create 1024 x 1024 if useful for quality.
Primary request: a single original low, VERY WIDE freestanding ceramic bathtub for a casual mobile water puzzle game. Cream-white ceramic body, soft desaturated mint/aqua rim, wide flattened elliptical opening, rounded front apron, exactly two short stubby feet. This is a very wide low bathtub, total visible silhouette width about 470 and height about 140 on the final 512 canvas (approximately 3.4:1). It must fit as an overlay at the very bottom of a narrow mobile game.
Input images: reference 1 is the existing game screenshot, ONLY for matching environmental lighting, palette, camera and small display scale. Reference 2 is the existing prop atlas, ONLY for matching soft sculpted painted ceramic/material quality. Do not copy any prop, character or UI from either reference.
Composition/framing: STRICT square transparent canvas, single bathtub centered horizontally. On a 512 x 512 coordinate system, put the full visible object approximately x=20..492, y=194..335, center-bottom anchor near (256,335). Equivalently on a 1024 square: object x=40..984, y=388..670. Upper and lower canvas remain generously TRANSPARENT. No extra scene or ground plane. View almost straight-on front, very slight view down into the wide oval mouth, fully horizontal, symmetric left/right. The mouth is broad and shallow rather than a deep bucket; front wall is low and rounded, with soft width-preserving curves.
Style/medium: polished original mobile game prop, hand-painted soft 3D clay/ceramic sculptural look, smooth friendly curves, gentle warm lighting from upper left, restrained highlights and ambient shading. Match cream and mint materials of reference 2. The inside may contain only a very shallow still pale aqua surface, no foam or high water.
Constraints: genuine alpha transparency outside the bathtub silhouette. No white, black, colored, checkerboard or gradient backdrop. No cast shadow extending outside the object, no floor. No character, frog, crocodile, person, limbs, text, logo, watermark, UI, accessories, soap, towels, decorations, pipes, faucet, shower, water stream, drops, bubbles or splashes. No claw feet, complex ornate legs, strong perspective or tilted angle. Do not fill the canvas with the bathtub: preserve the specified transparent margins and very flat wide proportions.
```
