# 奶蛙角色素材

## 现有素材

使用内置 ImageGen，根据用户提供的五张奶蛙参考图生成，并做一次局部修正去除敲击姿态旁的橙色动作标记。主体保留黄色梨形身材、奶白大肚皮、绿色凸眼、深棕色手脚和短粗四肢，采用柔和 3D 风格。已通过合成到浅蓝底的人工检查以及 RGBA alpha 检查。

`public/assets/character/milk-frog-atlas.webp` 是推荐浏览器资源，`milk-frog-atlas.png` 为 PNG 保真备份。八个同名独立 WebP 可用于预览。实际包装图集为 **2048 × 1024**，**4 列 × 2 行**，每格 **512 × 512**。脚底统一在单元局部 `y = 476`，双脚中点锚点 `x = 256`。绘制时保持此锚点，可叠加轻微呼吸缩放、眨眼和姿态切换。

| 索引 | 文件名/姿态 | 建议用途 |
| --- | --- | --- |
| 0 | neutral | 默认待机 |
| 1 | blink | 短暂眨眼 |
| 2 | look | 看向右侧水龙头 |
| 3 | raise | 抬手准备敲击 |
| 4 | tap | 伸手轻敲 |
| 5 | wait | 等待、扶肚子 |
| 6 | laugh | 放声大笑、揉肚子 |
| 7 | celebrate | 通关欢呼 |

图集坐标、逐格实际可见边界与原图裁剪矩形见 `atlas.json`。边界以 alpha > 20 测量，右下坐标为 exclusive。源输出为 1536 × 1024；第 4 索引姿态原本横跨源图格线，因此按完整角色边界裁剪，再缩放和定位到规范网格。只做裁剪、等比缩放、图集包装和格式转换，未用代码抠背景或改变肤色。所有透明像素来自 ImageGen 的实际 alpha；PNG 与 WebP 均保留 alpha。

## 透明通道复核

PNG 与 WebP 的 alpha 通道逐像素相同，范围为 0–255。绝大部分背景完全透明，但 ImageGen 在角色外围留下了少量 alpha = 1/255 的极微弱像素；例如第一格 `(389, 397)` 为 `(255, 0, 0, 1)`。原始透明图预览器可能把这些低 alpha 像素显示成明显的红黄点。正常按 alpha 合成到深灰 `(35, 40, 48)` 和浅蓝 `(225, 237, 249)` 背景时，已人工检查没有明显外部碎片。一次定向清理生成未改善这个问题且改变画布尺寸，因此未采用。游戏应以浏览器 Canvas 的实际合成显示为最终视觉验收依据。

## 生成提示词

模式：内置 ImageGen。参考图角色仅作为角色身份、身材、材质与表情参考，非直接截图使用。

```text
Use case: stylized-concept
Asset type: a production 2D browser-game character sprite atlas, a single PNG with real transparent alpha.
Primary request: create an eight-pose sprite sheet of the EXACT yellow milk-frog meme character in the five reference images, not a new substitute character. References 1 and 3 establish the full body and silhouette. References 2, 4 and 5 establish the face and laughing expressions. Keep the pear-shaped yellow body, tiny round tapered frog head connected directly into the broad rounded torso, very large cream oval belly patch, bulging round green eyes with small black pupils, short broad yellow arms, dark brown hands/fingers and dark brown flat frog feet. Its funny awkward expression and unclothed chunky body are crucial.
Style/medium: soft polished 3D clay render matching the references, smooth matte yellow skin, gentle ambient occlusion only ON the character, warm friendly top-left light, no dramatic texture. Full body, front three-quarter view toward the right, mostly frontal so both eyes and belly are readable. This SAME identity, proportions, yellow/cream colors, camera angle, lighting and character scale in all frames.
Composition/framing: a landscape 4-column by 2-row grid, exactly EIGHT cells in row-major order. All cells have equal dimensions. Each pose is a single complete character including feet, entirely inside its own cell with at least 12 percent transparent margins. No overlap between cells, no dividers or labels. Keep fixed foot baseline and equal standing height across cells; center the torso in each cell.
Pose order:
Row 1 column 1: relaxed neutral, eyes open, small awkward smile, arms resting beside or slightly in front of belly.
Row 1 column 2: same neutral pose with eyes fully closed for a blink, small smile.
Row 1 column 3: curious look toward the right as if glancing at a nearby faucet, right-side hand slightly lifted.
Row 1 column 4: one dark hand raised on the right, preparing to knock or tap an imaginary faucet outside the cell.
Row 2 column 1: same right hand reaches sideways to the right and makes a tapping gesture, head watching hand. No actual faucet.
Row 2 column 2: waiting with slight comic boredom, hands on belly, subtle head tilt, eyes open.
Row 2 column 3: big laugh like references 4 and 5, curved closed laughing eyes, wide open dark mouth with small white teeth, both hands touching the belly.
Row 2 column 4: delighted celebration, cheerful smile, both arms raised, feet remain grounded.
Scene/backdrop: genuinely fully transparent background outside the character in every cell; no ground plane, no floor shadow, no opaque white, no checkerboard painted pixels.
Constraints: preserve identity from the images very closely. This is an ordinary frog meme character and must stay recognizable. No clothing, diapers, horns, hair, tail, wings, extra body parts, babies, crocodile, dragon, toy accessory, faucet, bathtub, props, text, cell numbers, watermark or scenery. No cropped hands, head or feet.
```

## 局部修正提示词

```text
Edit target: the attached eight-pose yellow frog sprite atlas.
Make only one precise correction: remove the three small floating orange motion marks immediately to the right of the tapping hand of the bottom-left character. These marks lie in the narrow space between bottom-left and bottom-second characters. Replace ONLY those tiny floating orange marks with the same real transparent background.
Keep every character pixel, all eight poses, faces, colors, lighting, camera, full body proportions, positions, margins, original 1536 by 1024 dimensions and existing transparent alpha exactly unchanged. Do not redraw or move the sprites. No new marks, props, objects or backgrounds. Preserve existing transparency.
```
