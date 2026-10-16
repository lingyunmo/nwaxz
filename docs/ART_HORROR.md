# 恐怖模式绘制素材

本批使用内置 `image_gen.imagegen` 生成原创绘制素材，背景不由 Canvas 几何图形替代。参考既有奶蛙捧腹造型；普通角色图集保持原样。生成原图保留在维护者本地生成目录，选定成品使用 FFmpeg 缩放及 WebP 编码，不进行二次重绘。

| 成品 | 尺寸 | 用途 |
| --- | --- | --- |
| `public/assets/scenes/haunted-bath-v1.webp` | 480 × 800 | 废弃浴室，背景及泥土材质 |
| `public/assets/scenes/haunted-corridor-v1.webp` | 480 × 800 | 南瓜灯廊，背景及泥土材质 |
| `public/assets/scenes/haunted-machine-v1.webp` | 480 × 800 | 暗水机房，背景及泥土材质 |
| `public/assets/scenes/haunted-laundry-v1.webp` | 480 × 800 | 第二章地下洗衣间，选关、背景及泥土材质 |
| `public/assets/character/haunted-frog-v1.webp` | 1024 × 1024，透明 | 四个 512 格：凝视、捧腹诡笑、两步奔跑 |
| `public/assets/props/pumpkin-v1.webp` | 256 × 256，透明 | 南瓜灯，代码另绘微光 |

交互、粒子水流、灯光遮罩和动作混合使用代码。灯光每 12 秒缓慢扫过 4 秒，余下保留暗环境、南瓜微光和手边照明；没有频闪。奶蛙在下方走廊来回奔跑，随后停下凝视、诡笑，不改变水流碰撞。简化动作关闭奔跑及扫光，保留固定照明和捧腹大笑。所有动画使用游戏活动时间，暂停与后台不推进。

第二章使用内置 imagegen，以现有机房图作为结构与画风参考生成新的地下洗衣间插画，FFmpeg 仅缩放、编码为 480 × 800 WebP（114342 字节），未替换旧图。原始成品保留在本地生成目录，运行资源为上表项目内路径，加入离线预缓存。完整提示：

```text
Use case: stylized-concept. Asset type: finished hand-painted portrait 2D mobile game background, display 480x800. Reference image is for structural layout and painterly style only. Create a NEW terrifying abandoned underground laundry beneath a bathhouse. Preserve the exact reference horizontal structure: top 0-23% a shallow wall room, middle 23-77% uninterrupted packed earth cross-section filling the ENTIRE width, bottom 77-100% empty tiled lower chamber and floor reserved for live game characters. In top room: three corroded circular laundry-machine doors with black glass, bent pipes and pressure gauges, tangled dead roots and chains, one distant cold lamp, sinister crooked reflections in the glass, moss, oppressive deep blue-black and desaturated violet palette with small dirty amber highlights. Middle is beautifully hand-painted dark damp brown soil with very small buried stones and thin rotten roots; no machines, holes, paths, pipes or large props in middle. Bottom empty cracked damp tiled wall and floor, no props, leave lower right clear for live bathtub and frog. Premium eerie horror storybook game illustration, readable under a darkness overlay, atmospheric detail without gore. No text, no UI, no water, no foreground characters, no bathtub, no coins, no pumpkins. Original illustration. Portrait exact 3:5 aspect ratio.
```

绘制提示原文如下（角色用既有 `laugh.webp` 作为图像参考，两幅变体用已生成浴室作为图像参考）：

## 废弃浴室

```text
Paint an original frightening haunted bathroom stage background for a portrait mobile water-digging puzzle game. Exact structural layout is essential: portrait 3:5 aspect ratio, intended display 480x800. Top 0-23%: abandoned teal tiled bathroom, rusted overhead pipes and cracked mirror, deep atmospheric green shadows, sinister distant silhouettes, subtle cold moonlight. Middle 23-78%: continuous flat cross-section of packed dark earthen soil occupying the entire width, richly hand painted with stones, tiny roots and damp textures, no holes or paths, no large props. This central soil will be dug away by the game. Bottom 78-100%: empty cracked tiled floor and rear wall, leave room for a separate bathtub and yellow frog on lower right. Terrifying, oppressive spooky storybook game painting, sophisticated brush texture, blue black and sickly desaturated teal with restrained amber accents, readable details under low lighting. No text, no UI, no characters, no bathtub, no coins, no water, no pumpkins. No photorealism, no gore. Finished premium 2D game environment art.
```

## 南瓜灯廊

```text
Redraw this portrait 480x800 structural game environment as a deeply haunted pumpkin corridor beneath an abandoned bathhouse. Preserve exact layout: top 0-23% tiled room with door/windows/pipes; middle 23-78% packed soil cross section, continuous and completely fills width, no holes; bottom 78-100% empty tiled floor and wall for live game characters and bath. Change room to eerie old purple-black tiles, tall arch doorway with black emptiness, long tangled cobwebs, twisted bare roots hanging in corners, silhouettes of crooked pumpkin carvings in the distant upper room. Subtle amber candle illumination from upper left, sickly violet ambient darkness. More frightening atmospheric high quality hand painted game illustration. No text, no UI, no water, no foreground characters, no bathtub, no large foreground props in soil. Strong legibility, preserve terrain and floor boundaries.
```

## 暗水机房

```text
Redraw this portrait 480x800 structural game environment as a terrifying flooded machinery room under an abandoned bathhouse. Preserve exact layout: top 0-23% tiled room with rusty pipes; middle 23-78% packed soil cross section completely fills width without holes; bottom 78-100% empty tiled floor and wall reserved for live game characters and bath. Change the top room to enormous rusted ventilation fan behind a corroded iron grate, old pressure meters, hanging chains and cracked green glazed tiles. Pale sickly green emergency glow, dense oppressive blue-black shadows, mysterious fog visible in upper room. Dark soil with tangled roots and buried rubble. Bottom tiles worn and damp, a rusty leaking pipe on left wall. Finished intricate hand painted premium horror puzzle environment, readable textured soil, deeply sinister. No text, no UI, no water in central soil, no foreground characters, no bathtub, no large props in soil. Keep boundaries and composition unchanged.
```

## 恐怖奶蛙图集

```text
Create a premium hand painted 2D game sprite sheet on a genuinely transparent background, four separate full-body poses in an exact 2 by 2 grid, equal square cells, no overlap, all feet aligned at 92% of each cell and same body size. Character is an uncanny haunted version of the reference yellow pear shaped chubby milk frog, creamy white huge belly, short dark brown hands and feet. Keep yellow body recognizable. Top left: stationary staring directly outward with tiny pale green glowing pupils, a terrifying long uneven toothy smile. Top right: evil belly laugh, head thrown backward mouth wide open and eyes squeezed shut, BOTH HANDS clutching the big belly, classic laugh pose. Bottom left: running toward left, hunched, one leg forward and opposite arm raised, face three-quarter toward viewer with sinister grin. Bottom right: second leftward running stride with opposite leg forward, same size and silhouette. Ominous high quality stylized illustration, desaturated ochre skin with subtle dark eye shadows, frightening grin, no blood, no clothing, no scenery, no cast shadow outside body, no text. Clean alpha cutout edges. Exact 2x2 grid.
```

## 南瓜灯

```text
A single sinister carved Halloween pumpkin lantern prop for a premium haunted bathroom 2D game. Full pumpkin centered, slightly three-quarter view, crooked short stem, glowing warm amber triangular eyes and a wide jagged carved grin, wax light visible inside, worn richly painted orange rind, subtle spooky storybook illustration, premium hand painted texture, readable silhouette at small sizes. Transparent background, no floor, no scenery, no text, no outer frame, no large light halo (the game supplies the glow). One isolated whole pumpkin fills 85 percent of the square image.
```
