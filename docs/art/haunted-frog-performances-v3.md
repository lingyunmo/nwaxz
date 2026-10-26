# 恐怖奶蛙状态动作八向素材

使用内置 imagegen，参考原恐怖奶蛙及既有八向站立，原造型和被抓后的经典捧腹大笑未替换。新增五张 RGBA PNG，每张1774×887、4列2行，共40个方向姿态；潜行A/B为交替脚步，其余为听声、扑抓和狂笑。全部以生成原文件字节复制，未缩小、转WebP或有损再编码。

文件：public/assets/character/haunted-frog-extra-v3/{stalk-a,stalk-b,listen,grab,laugh}.png。manifest.json保存SHA、尺寸和脚底/UV边界。ops/inspect_frog_extra_art.py只读取Alpha，未编辑图像像素。边界使用实际原图像素，不强制图像宽高整除网格，也不按512采样。

方向顺序：正面、左前、左侧、左后、背面、右后、右侧、右前；依据奶蛙真实朝向与玩家位置选图。施法预警和开始干扰时停步狂笑；巡逻间隔尝试停步大笑；线索调查先短暂听声再靠近；追捕穿插较慢的A/B潜行，近身扑抓。动作由模型时间控制，冻结可暂停，联机房主权威世界同步给所有玩家。动作随机数独立，不消耗感知与技能RNG。

用户要求本批不完整运行游戏。已进行素材目视、PNG字节/尺寸、CPU状态及NullEngine的UV/脚底/冻结检查；不将其称为完整浏览器或真机验收。局域网开发仍暂停。

## 完整提示词

参考1：public/assets/character/haunted-frog-v1.webp；参考2：haunted-frog-directions-idle-v1.webp。潜行B以新潜行A原图为编辑目标。

### stalk-a

`	ext
Use case: identity-preserve. Asset type: high-resolution production eight-direction transparent full-body sprite atlas, for the EXISTING horror milk frog game, not a cute frog and not a new monster.
Image 1 is the CANONICAL IDENTITY: use the TOP LEFT figure for anatomy and face and TOP RIGHT for classic belly laugh identity. Image 2 is ONLY a direction layout reference. Preserve the recognisable smooth golden ochre pear-shaped bulky body, enormous ivory cream belly marking, short heavy legs, dark brown blunt hands and feet, no neck or ears, deeply slanted black eye sockets and small sickly yellow-green eyes, wide dense two rows of ivory teeth. Enhance menace with subtle damp rough skin, deeper eye sockets, hostile brow and irregular tooth shading, but NO gore, blood, horns, clothes, accessories, skeleton anatomy, extra limbs or redesign.
DELIVER: one clean genuinely transparent RGBA PNG sprite sheet, wide 2:1 aspect, EXACTLY FOUR COLUMNS by TWO ROWS of equal square cells. Highest native image detail available. One complete full-body character per cell, not touching edges, common scale and foot baseline at 92% cell height, crown around 8%, neutral orthographic eye-level camera, consistent subdued material lighting; enough fill to see ALL sides clearly. No environment, floor, cast shadows, fog, particles, checkerboard painted in, text, labels, grid lines, outline, watermark or cropped feet.
Eight directions in READING ORDER, rotating body, face AND feet as a unit:
0 front, facing viewer;
1 front 3/4 facing IMAGE LEFT;
2 true left side, nose points IMAGE LEFT;
3 back 3/4 facing away toward IMAGE LEFT;
4 DIRECT BACK: yellow back only, NO face, eyes, mouth or frontal white belly;
5 back 3/4 facing away toward IMAGE RIGHT;
6 true right side, nose points IMAGE RIGHT;
7 front 3/4 facing IMAGE RIGHT.
Never turn the head back toward camera on rear views. Actual silhouettes of eight rotations, not eight front views. Same pose in all cells rotated correctly.
ACTION FOR THIS SHEET: PREDATORY STALK / THREATENING APPROACH. Low heavy stance, slightly bent knees, body pitched forward, shoulders subtly raised, both dark hands hanging forward with bent tense fingers, fixed hostile grin, eyes narrowed and focused straight ahead along the body heading. One small deliberate step forward, not running, not a leap. Pose should look poised to spring from a dark corridor. Keep the massive belly and iconic familiar silhouette; uncanny malicious expression, not comical happiness. All eight cells show this SAME stalking pose from the specified eight angles.
`

### stalk-b

`	ext
Use case: identity-preserve. Asset type: opposite footfall for the supplied eight-direction STALK sprite sheet.
Image 1 is the exact EDIT TARGET atlas. Keep its 4x2 layout, exact eight facing directions, identical character scale, golden bulky pear body, enormous cream belly, menacing eyes and toothy face, lighting, camera and transparent background. Each full body remains in its own cell. Produce a companion sheet with the OPPOSITE walking stride so the two sheets can alternate. In the FRONT cell (top left), the character's LEFT foot (VIEWER RIGHT) now steps forward, and the right foot (VIEWER LEFT) goes back; reverse the arms slightly. All other cells show that same opposite stride rotated to their original direction. The character is creeping deliberately, knees bent, heavy shoulders forward. Do NOT mirror the whole atlas, do NOT swap direction cells, do NOT leave the same leading leg unchanged, do not add limbs. Direction order: front, front-left, left, back-left / back, back-right, right, front-right. True back has no face or belly. Crisp alpha edges, no colored fringes or isolated dots. No text, ground, shadows, grid or background. Same native wide 2:1 aspect and high detail as the input. Preserve real RGBA transparency.
`

### listen

`	ext
Use case: identity-preserve. Asset type: high-resolution production eight-direction transparent full-body sprite atlas, for the EXISTING horror milk frog game, not a cute frog and not a new monster.
Image 1 is the CANONICAL IDENTITY: use the TOP LEFT figure for anatomy and face and TOP RIGHT for classic belly laugh identity. Image 2 is ONLY a direction layout reference. Preserve the recognisable smooth golden ochre pear-shaped bulky body, enormous ivory cream belly marking, short heavy legs, dark brown blunt hands and feet, no neck or ears, deeply slanted black eye sockets and small sickly yellow-green eyes, wide dense two rows of ivory teeth. Enhance menace with subtle damp rough skin, deeper eye sockets, hostile brow and irregular tooth shading, but NO gore, blood, horns, clothes, accessories, skeleton anatomy, extra limbs or redesign.
DELIVER: one clean genuinely transparent RGBA PNG sprite sheet, wide 2:1 aspect, EXACTLY FOUR COLUMNS by TWO ROWS of equal square cells. Highest native image detail available. One complete full-body character per cell, not touching edges, common scale and foot baseline at 92% cell height, crown around 8%, neutral orthographic eye-level camera, consistent subdued material lighting; enough fill to see ALL sides clearly. No environment, floor, cast shadows, fog, particles, checkerboard painted in, text, labels, grid lines, outline, watermark or cropped feet.
Eight directions in READING ORDER, rotating body, face AND feet as a unit:
0 front, facing viewer;
1 front 3/4 facing IMAGE LEFT;
2 true left side, nose points IMAGE LEFT;
3 back 3/4 facing away toward IMAGE LEFT;
4 DIRECT BACK: yellow back only, NO face, eyes, mouth or frontal white belly;
5 back 3/4 facing away toward IMAGE RIGHT;
6 true right side, nose points IMAGE RIGHT;
7 front 3/4 facing IMAGE RIGHT.
Never turn the head back toward camera on rear views. Actual silhouettes of eight rotations, not eight front views. Same pose in all cells rotated correctly.
CRITICAL ALPHA CLEANLINESS: the reference has compression-colored fringes. DO NOT copy those artifacts. All empty space between figures must have zero alpha. Crisp natural edges with NO isolated red/orange/yellow/green specks, NO halos, no little dots or debris. Dark neutral lighting and aged ochre skin rather than bright toy-yellow; enough detail in the face and feet to remain readable. Horror rendered illustration, not cheerful cartoon.
ACTION: LISTENING AND SEARCHING, all eight angles of the SAME pose. Body stopped, knees slightly bent, neckless head tilted subtly to one side WITHOUT turning back toward the camera; one dark hand raised beside the near cheek as if listening, the other close to the belly. Wide black eye sockets with an unblinking tiny sickly glow; mouth almost closed with a thin unsettling tooth-lined rictus. Predatory suspicious concentration. Keep two normal short arms, rounded pear mass and enormous cream belly, no props.
`

### grab

`	ext
Use case: identity-preserve. Asset type: high-resolution production eight-direction transparent full-body sprite atlas, for the EXISTING horror milk frog game, not a cute frog and not a new monster.
Image 1 is the CANONICAL IDENTITY: use the TOP LEFT figure for anatomy and face and TOP RIGHT for classic belly laugh identity. Image 2 is ONLY a direction layout reference. Preserve the recognisable smooth golden ochre pear-shaped bulky body, enormous ivory cream belly marking, short heavy legs, dark brown blunt hands and feet, no neck or ears, deeply slanted black eye sockets and small sickly yellow-green eyes, wide dense two rows of ivory teeth. Enhance menace with subtle damp rough skin, deeper eye sockets, hostile brow and irregular tooth shading, but NO gore, blood, horns, clothes, accessories, skeleton anatomy, extra limbs or redesign.
DELIVER: one clean genuinely transparent RGBA PNG sprite sheet, wide 2:1 aspect, EXACTLY FOUR COLUMNS by TWO ROWS of equal square cells. Highest native image detail available. One complete full-body character per cell, not touching edges, common scale and foot baseline at 92% cell height, crown around 8%, neutral orthographic eye-level camera, consistent subdued material lighting; enough fill to see ALL sides clearly. No environment, floor, cast shadows, fog, particles, checkerboard painted in, text, labels, grid lines, outline, watermark or cropped feet.
Eight directions in READING ORDER, rotating body, face AND feet as a unit:
0 front, facing viewer;
1 front 3/4 facing IMAGE LEFT;
2 true left side, nose points IMAGE LEFT;
3 back 3/4 facing away toward IMAGE LEFT;
4 DIRECT BACK: yellow back only, NO face, eyes, mouth or frontal white belly;
5 back 3/4 facing away toward IMAGE RIGHT;
6 true right side, nose points IMAGE RIGHT;
7 front 3/4 facing IMAGE RIGHT.
Never turn the head back toward camera on rear views. Actual silhouettes of eight rotations, not eight front views. Same pose in all cells rotated correctly.
CRITICAL ALPHA CLEANLINESS: the reference has compression-colored fringes. DO NOT copy those artifacts. All empty space between figures must have zero alpha. Crisp natural edges with NO isolated red/orange/yellow/green specks, NO halos, no little dots or debris. Dark neutral lighting and aged ochre skin rather than bright toy-yellow; enough detail in the face and feet to remain readable. Horror rendered illustration, not cheerful cartoon.
ACTION: CAPTURE / LUNGING GRAB, all eight angles of the SAME reaching pose. Both thick short arms reach forward along the direction the body faces, dark fingers spread to seize someone, heavy body leans forward with one foot planted forward and one behind, both feet visible in every cell. Mouth stretched unnaturally wide with a BLACK mouth cavity and dense blunt ivory teeth, tiny hostile glowing eyes under a severe brow. A startling aggressive horror expression, not a joyful smile. Full-body silhouette contained within each cell, no perspective close-up, no motion blur, no ghost limbs.
`

### laugh

`	ext
Use case: identity-preserve. Asset type: high-resolution production eight-direction transparent full-body sprite atlas, for the EXISTING horror milk frog game, not a cute frog and not a new monster.
Image 1 is the CANONICAL IDENTITY: use the TOP LEFT figure for anatomy and face and TOP RIGHT for classic belly laugh identity. Image 2 is ONLY a direction layout reference. Preserve the recognisable smooth golden ochre pear-shaped bulky body, enormous ivory cream belly marking, short heavy legs, dark brown blunt hands and feet, no neck or ears, deeply slanted black eye sockets and small sickly yellow-green eyes, wide dense two rows of ivory teeth. Enhance menace with subtle damp rough skin, deeper eye sockets, hostile brow and irregular tooth shading, but NO gore, blood, horns, clothes, accessories, skeleton anatomy, extra limbs or redesign.
DELIVER: one clean genuinely transparent RGBA PNG sprite sheet, wide 2:1 aspect, EXACTLY FOUR COLUMNS by TWO ROWS of equal square cells. Highest native image detail available. One complete full-body character per cell, not touching edges, common scale and foot baseline at 92% cell height, crown around 8%, neutral orthographic eye-level camera, consistent subdued material lighting; enough fill to see ALL sides clearly. No environment, floor, cast shadows, fog, particles, checkerboard painted in, text, labels, grid lines, outline, watermark or cropped feet.
Eight directions in READING ORDER, rotating body, face AND feet as a unit:
0 front, facing viewer;
1 front 3/4 facing IMAGE LEFT;
2 true left side, nose points IMAGE LEFT;
3 back 3/4 facing away toward IMAGE LEFT;
4 DIRECT BACK: yellow back only, NO face, eyes, mouth or frontal white belly;
5 back 3/4 facing away toward IMAGE RIGHT;
6 true right side, nose points IMAGE RIGHT;
7 front 3/4 facing IMAGE RIGHT.
Never turn the head back toward camera on rear views. Actual silhouettes of eight rotations, not eight front views. Same pose in all cells rotated correctly.
CRITICAL ALPHA CLEANLINESS: the reference has compression-colored fringes. DO NOT copy those artifacts. All empty space between figures must have zero alpha. Crisp natural edges with NO isolated red/orange/yellow/green specks, NO halos, no little dots or debris. Dark neutral lighting and aged ochre skin rather than bright toy-yellow; enough detail in the face and feet to remain readable. Horror rendered illustration, not cheerful cartoon.
ACTION: THE CLASSIC BELLY-CLUTCHING HORROR LAUGH, all eight angles of the SAME pose. Both dark hands visibly hold the large cream belly, elbows bent outward, head tipped back, huge open black mouth with dense two ivory tooth rows and dark tongue, narrowed almost closed menacing eyelids, heavy legs planted. This MUST retain the iconic pose of the TOP RIGHT figure of Image 1. More unsettling through cold skin shadows and a wide possessed laugh, not cute, not a different character. From direct back the hands and mouth are correctly hidden, NOT pasted on the back.
`
