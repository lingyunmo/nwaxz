# 恐怖奶蛙八方向图集

2026-10-25，使用内置 imagegen 技能与工具，原恐怖奶蛙为身份参考，不改写原文件。实际交付运行素材：

- `public/assets/character/haunted-frog-directions-idle-v1.webp`：4×2，8向站立。
- `public/assets/character/haunted-frog-directions-walk-v1.webp`：4×4，前两行为步态A，后两行为补绘步态B。
- `src/escape/directional-art.ts`：读取透明轮廓得到的UV边界和脚底偏移，由 `python ops/inspect_directional_art.py` 生成。脚本只分析图片，不改像素。

PNG母版保留工作区 `.local/art/eight-direction/`（不进入运行缓存）。WebP使用FFmpeg缩放和排图、质量90压缩；交替步态采用初稿前两行与单独补绘的八帧B，未用初稿中腿部不明确的重复行。原站立、眨眼、近身扑抓与经典大笑继续使用既有素材；正面站立和捧腹大笑不被新图替换。

方向按玩家位置相对奶蛙实际朝向选择，依次为正面、图中朝左前斜、朝左侧面、左后斜、背面、右后斜、朝右侧面、朝右前斜；每45度一区，边界带5度迟滞。玩家仅原地转动镜头不会改变选图。冻结时步态和AI方向停止，玩家绕行仍能看到正确的侧背面。追击不再有360度视觉豁免，HUD视觉与朝向一致。

以下保存完整提示词。输入参考依次使用现有恐怖原图、首张八向图、行走初稿；不使用普通版Cute角色。

## 八向站立

```text
Use case: identity-preserve.
Asset type: production eight-direction standing sprite atlas for the existing horror milk frog in a first-person stealth game.
Input image 1 is the CANONICAL IDENTITY REFERENCE, specifically its TOP LEFT standing figure. The other three poses are identity support only. Keep the exact same recognizable face, proportions, smooth golden-yellow pear-shaped body, huge flat creamy-white oval belly marking, short thick limbs, dark brown hands and broad feet, deeply inset black menacing slanted eye sockets with small glowing yellow-green eyes, dense curved rows of blunt ivory teeth. This is the scary version, not the cute normal frog. Do not redesign.
Deliver one transparent sprite sheet with EXACTLY FOUR columns and TWO rows (8 cells); all cells equal square, grid edges exactly 25/50/75 percent horizontally and 50 percent vertically. One complete full-body frog per cell, same straight neutral standing pose, feet on an identical baseline at 93 percent of cell, head near 7 percent, consistent scale, soft neutral material lighting identical in every direction, no floor, no shadow outside body.
Directions are a TURNAROUND with BODY, HEAD, EYES AND FEET all turning together, no looking back at camera. Order left to right, top to bottom:
0 DIRECT FRONT looking at viewer.
1 FRONT THREE-QUARTER, nose and belly pointing diagonally to IMAGE LEFT, 45 degrees from front.
2 TRUE LEFT-FACING SIDE PROFILE, nose points left; only side silhouette and near eye, NOT frontal belly.
3 REAR THREE-QUARTER turned away toward IMAGE LEFT, 135 degrees; broad yellow back is dominant, little or no face visible, no full frontal belly.
4 DIRECT BACK, completely facing away. Golden-yellow back, backs of arms and feet; NO eyes, mouth, teeth, or cream belly visible from behind.
5 REAR THREE-QUARTER turned away toward IMAGE RIGHT, 225 degrees, back dominant.
6 TRUE RIGHT-FACING SIDE PROFILE, nose points right.
7 FRONT THREE-QUARTER toward IMAGE RIGHT, 315 degrees.
Orthographic eye-level camera, same lens/scale, no perspective distortion, no poses varying between cells. Genuinely transparent RGBA background; no checkerboard painted in, no black/white background, no words/numbers/labels/frames. Preserve the frightening canonical identity strictly. This is one 8-view atlas, not eight front-facing frogs.
```

## 行走初稿

```text
Use case: identity-preserve.
Asset type: a 16-frame eight-direction WALK CYCLE sprite atlas for the supplied existing horror milk frog.
Image 1 is the approved EIGHT-DIRECTION STANDING TURNAROUND: preserve its exact character and the exact eight body/head directions. Image 2 is the canonical original identity, especially its top-left standing character; retain its scary face and huge cream belly. Do not redesign or make cute.
Create ONE atlas, EXACTLY FOUR columns and FOUR rows, SIXTEEN equal square cells, transparent RGBA. Every figure full body, consistent height/scale, generous clean transparent margins inside each cell, aligned flat ground baseline. Same neutral soft shading, complete feet/hands, no floor or cast shadow outside the figure, no labels, no grid or text. Clean cutout edges with no stray red/green pixels or colored outline artifacts.
Every cell is the same creature WALKING FORWARD IN THE DIRECTION ITS BODY AND HEAD FACE. Head does not turn to watch the camera. Arms swing naturally, short legs take ordinary steps, no high kicks, no jumping, no props.
FIRST TWO ROWS are stride A: the creature's left foot forward, right foot back, opposite arm forward.
Row 1 left to right: DIRECT FRONT; FRONT THREE-QUARTER pointing IMAGE LEFT (45 degrees); TRUE LEFT-FACING SIDE PROFILE (90); REAR THREE-QUARTER AWAY LEFT (135).
Row 2 left to right: DIRECT BACK (180, no eyes/mouth/cream belly visible); REAR THREE-QUARTER AWAY RIGHT (225); TRUE RIGHT-FACING SIDE PROFILE (270); FRONT THREE-QUARTER pointing IMAGE RIGHT (315).
LAST TWO ROWS repeat those EXACT DIRECTIONS in the same order, but stride B: right foot forward, left foot back, arms reverse. Row3 repeats row1 directions; Row4 repeats row2 directions. Keep body/head facing unchanged between paired frames eight cells apart.
The round broad pear-shaped golden-yellow body, broad creamy-white oval belly skin marking, dark-brown hands/feet, slanted black eye sockets, glowing tiny greenish-yellow eyes and frightening two dense rows of blunt ivory teeth must remain identical to references. Back poses have the same round yellow back and NO face pasted onto the back. True side poses show a side silhouette, not a full front belly. At all 16 positions the crown is at approximately 8% of cell height and feet at 93%, one shared character scale. Orthographic eye-level. Actual transparent background, no checkerboard, no black or white backdrop. This is a game sprite sheet, not a concept illustration.
```

## 交替步态补绘

```text
Use case: identity-preserve.
Asset type: exactly EIGHT full-body directional frames for the OPPOSITE HALF of a walk cycle, transparent 4 columns x 2 rows sprite sheet.
Image 1 is the canonical EIGHT standing directions and character identity. Image 2's TOP TWO ROWS are stride A of the walk cycle, with the creature's LEFT knee leading (in its front view the knee on the VIEWER'S RIGHT is raised). Do not repeat that leading leg.
PRIMARY CHANGE: draw stride B with the creature's RIGHT FOOT AND RIGHT KNEE forward. In cell 0 FRONT VIEW, the knee/foot on the VIEWER'S LEFT must clearly be forward and raised, and the VIEWER'S RIGHT leg is extended behind; the fist on the VIEWER'S RIGHT swings forward. This MUST be visibly opposite to reference stride A. Use a natural ordinary walking step, not a kick.
Deliver exactly 4 columns x 2 rows, eight equal square cells, complete figure and identical body size/baseline in all cells. Directions in reading order: 0 DIRECT FRONT; 1 front-quarter nose toward IMAGE LEFT; 2 TRUE LEFT-facing PROFILE; 3 BACK-quarter AWAY LEFT; 4 DIRECT BACK with NO face or cream belly visible; 5 BACK-quarter AWAY RIGHT; 6 TRUE RIGHT-facing PROFILE; 7 front-quarter nose toward IMAGE RIGHT.
The body and head turn TOGETHER and do not look at the viewer in side or rear views. Across all eight views, it is the SAME right leg leading and left arm leading in the creature's anatomical coordinates. Preserve the golden-yellow pear-shaped obese body, huge cream belly skin marking, no neck, short thick legs, dark brown hands/feet, frightening slanted black eye sockets, tiny yellow-green glowing eyes and dense two-row blunt ivory tooth grin EXACTLY. Same soft material, orthographic eye-level rendering and scale as reference. Crown near8% and feet93% of cell. Clean transparent RGBA cutouts with generous clear margins; remove stray colored particles, no red or yellow speckles outside the bodies, no colored outlines, no ground, no shadows outside figure, no black/white background, no text, no labels, no checkerboard.
Do not output 16 frames. Only the eight opposite-stride B frames.
```
