# 第二版游戏美术资源

本批素材使用内置 ImageGen 生成，角色参考既有奶蛙姿态与用户原始图片。未覆盖第一版角色图集，未改动游戏代码。生成后只做常规裁剪、等比重采样、图集定位与 WebP 格式压缩。

## 封面

- 浏览器资源：`/assets/scenes/bath-cover-v2.webp`。
- 实际尺寸：1024 × 1536，RGB、不透明，63,794 字节。
- 青绿色浴室、奶白浴缸、银色龙头、黄色奶蛙与少量泡泡，图片不含文字或按钮。
- 顶部约 30% 留空用于代码排版“奶蛙爱洗澡”；底部约 20% 留空用于普通模式按钮。
- 建议文字安全矩形：`[102, 30, 820, 380]`，按钮安全矩形：`[102, 1240, 820, 266]`。矩形使用 `[x, y, width, height]`，见 `cover-v2.json`。
- 原始 PNG 保留在 `.local/art-v2/bath-cover-v2-source.png`。

## 补充动作

- 浏览器资源：`/assets/character/milk-frog-extra-v2.webp`。
- 实际尺寸：1024 × 1024，2 列 × 2 行，每格 512 × 512，105,382 字节。
- 统一局部脚底基线 `y = 476`，双脚中点 `x = 256`，可与第一版姿态直接共用绘制锚点。
- 逐格原图裁剪矩形、图集坐标、可见边界见 `extra-v2.json`。
- 源 PNG 与规范包装后的 PNG master 保留在 `.local/art-v2/`。
- 真正 RGBA 透明图；已分别合成到深灰、浅蓝底检查，四个角色完整、无重叠或裁切、无可见外围碎片。保留 ImageGen 原有 alpha，未用代码抠背景。

| 索引 | 名称 | 动作 |
| --- | --- | --- |
| 0 | wave | 举手招呼 |
| 1 | yawn | 闭眼打哈欠、一手遮嘴 |
| 2 | surprise | 水来时惊喜、一手张开 |
| 3 | wash | 双手揉肚皮、放松洗澡 |

图集不包含漂浮泡泡、肥皂或动作线；泡泡和姿态过渡由游戏动画层处理。

## 地下剖面场景

- 浏览器资源：`/assets/scenes/bath-stage-v2.webp`。
- 实际尺寸：480 × 800，RGB、不透明，113,990 字节。
- 源图为 ImageGen 实绘 971 × 1619，常规重采样至游戏逻辑画布，PNG 保留在 `.local/art-v2/bath-stage-v2-source.png`。
- 上部为青绿色干水池与墙面；中部约 `y = 180–623` 为全宽土层；下部为奶白与青绿瓷砖。
- 场景不含奶蛙、浴缸、龙头、管道、关卡障碍、水、金币或文字。
- `stage-v2.json` 给出取景矩形：顶部 `[0, 0, 480, 178]`、土层内部安全纹理 `[0, 192, 480, 414]`、底部 `[0, 628, 480, 172]`。关卡地形蒙版只负责交互挖掘，底图和土壤外观均来自生成图片。

## 完整提示词

### 封面

```text
Use case: stylized-concept
Asset type: portrait mobile H5 water-puzzle game title-screen and loading-screen background, desired 1024 x 1536, full opaque scene.
Primary request: a cheerful polished soft-3D bathroom illustration starring exactly the yellow milk-frog character from the supplied references. This is a professional casual game cover image with no text, title, logo or UI baked into it.
Input images: reference 1 is the EXISTING game's character and defines the identity, proportions, colors and rendering style; references 2-5 are original character images defining the yellow pear-shaped body, cream oval large belly, raised green round eyes, dark brown short broad hands and feet and expressive funny frog face. Preserve this identity, not a generic human infant, dinosaur or crocodile.
Scene/backdrop: a bright mint-green and turquoise bathroom. Very soft pale green walls with minimal tiled detail, an elegant warm milk-white freestanding bathtub, a clean silver pipe/faucet entering near the bathtub, a few clear delicate soap bubbles around the bathtub only. Soft sunny lighting from the upper left, attractive smooth ceramic and polished metal. The yellow frog cheerfully awaits a bath beside/partially leaning into the tub, its belly, round eyes, smile and most of its body clearly readable.
Composition/framing: strict portrait 2:3 composition. Top 30 percent of the image must remain quiet, uncluttered pale mint-green wall/soft gradient with no character, objects, bubbles or busy tile lines, so code can place the Chinese title later. The main frog, bathtub and faucet illustration occupies the middle 30%-80% band, with frog as central visual focus and silver faucet beside it. Bottom 20 percent is quiet softly lit pale aqua tiled floor with very low detail and no objects or bubbles, suitable for a game menu button overlay. Frog head begins below the top clear band. Keep complete composition inside frame.
Style/medium: polished friendly stylized 3D matte clay/plastic render, gentle ambient occlusion, refined casual mobile game aesthetic, consistent with reference 1; friendly, playful, slightly absurd.
Constraints: no text of any kind, no labels, no button shapes, no interface icons, no frames, no watermark, no original-game logos, no crocodiles, no clothes, diapers, human baby face or hair. Do not redesign the reference frog.
```

### 补充动作图集

```text
Use case: stylized-concept
Asset type: four-pose transparent PNG game-character sprite atlas, 2 columns x 2 rows.
Primary request: FOUR additional full-body animation poses of EXACTLY the EXISTING game yellow milk-frog character from reference image 1. References 2-5 additionally define the original funny milk frog. Preserve yellow pear-shaped chunky torso connected to a small round head, huge cream oval belly, bulging green eyes with black pupils, dark brown hands/fingers and dark brown flat frog feet, broad short yellow limbs. Match reference 1's character proportions, front-facing slightly right-facing camera, smooth matte soft 3D style, lighting and yellow/cream palette exactly.
Scene/backdrop: real transparent alpha. Outside each character silhouette must be fully transparent; no shadows on a ground plane, no opaque white, black, painted checkerboard or colored background.
Composition/framing: square 2-by-2 equal-cell atlas, four separate complete characters. Keep identical standing scale and fixed foot baseline, centered foot midpoint in each cell, clear margins all sides, no overlaps, no cropped feet/hands/head. Torso remains frontal and full cream belly readable, both feet grounded.
Pose order row-major:
0 top-left: friendly greeting, one dark hand beside the head waving open fingers toward the player, cheerful small smile, eyes open.
1 top-right: sleepy idle yawn, both eyes softly closed, one dark hand covering the open yawning mouth, other hand by belly. Comic relaxed shoulders.
2 bottom-left: delighted surprise as water arrives, eyes wide open with raised eyebrows, small open happy mouth, one hand opens toward the right at chest height and other rests near the belly.
3 bottom-right: washing/rubbing the belly, both dark hands touching and rubbing the large cream belly, warm cheerful relaxed grin, eyes slightly narrowed. Show just the character and hands, no visible floating bubbles or soap props: game code adds foam particles.
Constraints: no props, no tap, no bathtub, no soap bottle, no bubbles, no motion marks, no text, no labels, no grid lines, no cell numbers, no watermark, no extra characters, no generic baby, crocodile, dinosaur, horns, hair, clothing or diaper. Keep the SAME identity, exact proportions and render style in all four cells.
```

### 地下剖面场景

```text
Use case: stylized-concept
Asset type: painted game environment background/terrain texture image for a vertical mobile water-digging puzzle, desired exact aspect ratio 3:5 such as 960 x 1600, opaque full frame.
Primary request: a polished soft 3D-style bright mint-green bathroom underground cross-section, viewed straight-on orthographically, layered horizontal environment with no characters or gameplay objects. This image supplies the REAL background art and the diggable soil texture in a Canvas game, so the main soil layer must cover the entire image width.
Scene/backdrop and strict composition: 
Top 0-25%: clean pale mint/turquoise tiled interior wall and a hint of an empty dry shallow teal basin recess. Soft ambient light. No liquid, no spout, no pipes and no object silhouette. Mostly calm spacious atmosphere.
Middle 25%-78%: a continuous full-width underground cutaway of deep warm dark-brown earth with refined detailed natural fine-grain soil, faint ochre specks, very small embedded stone grains and subtle varied texture. Absolutely fill the ENTIRE horizontal width with soil in this middle band, from left image edge to right image edge. Make it rich enough to look tactile and satisfying to dig, but avoid high-contrast clutter. Soil appears dense and solid with a simple horizontal top edge. No tunnels, channels, caves, cavities or pre-dug tracks. The renderer will cut tunnels interactively, so no excavation should be illustrated already.
Bottom 78%-100%: warm milk-white and pale aqua/teal tiled bathroom wall and floor, clean and softly lit, gentle ceramic surface texture, a few broad subtle tile seams, ample empty space for the game character and bath overlay.
Style/medium: polished casual mobile game environmental art, soft 3D clay/ceramic look with refined warm lighting and gentle ambient depth. Light cheerful bathroom colors above and below, darker earthy middle. Front-facing view without perspective vanishing lines; horizontal layers are unambiguous. Keep simple visual hierarchy.
Constraints: exact portrait 3:5 composition. No text, buttons, labels, logos, UI, grid, frame or watermark. No frog, crocodile or any character, no bathtub, faucet, pipes, valves, rocks as standalone obstacles, coins, collectible items, water, foam, bubbles, tool, decorative plant or furniture. No game paths or obstacle designs baked into the soil.
```

