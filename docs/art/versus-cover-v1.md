# 对抗模式预告封面

- 文件：`public/assets/scenes/versus-cover-v1.png`。
- 内置 imagegen 生成；`bath-cover-v2.webp`仅作材质风格参考，原普通封面没有改动。
- 原生1024×1536、RGB PNG、2,731,581字节。直接复制生成文件，未缩小、转码或有损再压缩。
- SHA-256：`f8f1ba97fa46b14a4bff3a0cc3385e60d1866338dd2a154cd1d2c9c7582ce0ab`。
- 图中竞技场仅是3v3 MOBA的概念预告，不是实机截图，也没有已实现的对抗玩法。首页卡片禁用并显示“筹备中”。
- 图像加入完整资源预缓存；HTTP静态PNG使用no-transform，构建保留原始字节。

## 完整提示词

```text
Use case: stylized-concept. Asset type: portrait 2:3 game mode teaser cover, high-resolution bitmap, without text. 
Create an illustrated concept for a FUTURE 3-versus-3 MOBA battleground inside the world of a magical bathhouse. The reference is ONLY for material style, mint glazed tiles, worn brass pipes, golden frog design motifs and warm painterly 3D illustration quality. Do not copy its composition or add the bathing character.
Scene: an ancient open-roof tiled bathhouse transformed into a small symmetrical arena; left side glows muted cyan, right side glows amber, three branching tiled paths and shallow water channels converge on a raised circular stone bridge in the center. Frog-head carved fountains on opposite sides, old copper valves, curling steam, reflective wet tiles. Dynamic, mysterious competitive atmosphere, high-quality richly drawn environment, believable stylized materials and clear composition, not a neon sci-fi map. Low aerial three-quarter view with a dramatic clear central bridge; opposing cyan and amber lights both visible in the central 70% of image, so it works when cropped as a mobile horizontal card.
No characters, no game HUD, no letters, numbers, logos, title, watermark or border. Image must be one uninterrupted environment painting, not a split screen and not UI. Keep the bottom quarter darker and quieter for later game title overlay. Fully opaque background. This is a teaser environment illustration, not a claim that the battleground is playable. Native high detail; do not downscale.
```
