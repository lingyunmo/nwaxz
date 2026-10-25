# 负一楼秘密浴场美术

2026-10-25，使用内置 imagegen 生成。恐怖奶蛙原图作为壁画身份参考，原角色文件不改动。

运行素材 `public/assets/scenes/escape-basement-atlas-v1.webp` 为1024×1024、不透明2×2图集：墙面、积水地面、天花、秘密档案壁画。前三格供真3D场景固定UV贴图，壁画只放在指定墙面，不重复铺满全楼。FFmpeg只做缩放与WebP编码，PNG母版保留`.local/art/basement/`。

完整提示词：

```text
Use case: stylized-concept.
Asset type: a hand-painted production texture atlas for the SECRET BASEMENT of our original first-person horror milk frog game. The supplied image is ONLY the antagonist identity reference: pear-shaped golden-yellow body, huge cream belly, small greenish eyes sunk in black sockets, dense curved ivory tooth grin. Do not include the reference sheet or cute frog.

Deliver ONE square opaque image divided into exactly TWO columns and TWO rows, four equal square cells, edges at50%. No gutters, no text, no UI, no frames. Every quadrant is straight orthographic surface view covering its whole square, no perspective room rendering. Moody charcoal, decomposed cold green-black, aged bone, corroded rusty iron; strongly distinct from an ordinary tiled bathroom, sinister forbidden underground research facility. Render materials with enough medium-value detail for an in-game flashlight to relight them, not a flat black painting, no built-in strong spotlights, no readable text.
TOP LEFT: seamless blackened industrial ceramic and cracked cement wall; old horizontal copper pipe scars, irregular damp tide marks, fungal darkness, peeled dark-green paint, small unrecognizable scratched tally marks; edges tile seamlessly.
TOP RIGHT: seamless wet gray-black stone and concrete floor, shallow dirty water staining, rust flecks, fine cracked grout, large subtle damp footprints; no objects casting shadows; edges tile seamlessly.
BOTTOM LEFT: seamless dark moldy concrete ceiling with hairline cracks and fine rust seepage, a little old pipe marking; broad material detail, not solid black; edges tile seamlessly.
BOTTOM RIGHT: a SINGLE disturbing clandestine archival wall collage painted directly on dirty concrete: a faded front portrait silhouette of the reference horror yellow milk frog with pale staring eyes and its same broad tooth grin; overlapping old photographic contact-sheet squares showing empty containment tanks, distorted toothy shadows and industrial reservoir plans; faint concentric scan/radar rings scratched behind it, blacked-out record strips, old copper stencil motifs, aging paper and pinholes. Make the implication unsettling: the frog's secret source and sensory experiments. One readable narrative composition, no gore, no injured people, no children, no real-world brands, no readable writing or letters, no repeated full-body sprites, no floor or UI around the collage.

Hand-painted realistic horror-game surface art, cohesive grimy tactile detail, no vector graphics, no clean flat shapes, no glossy cheerful cartoon material. Preserve the antagonist's recognizable scary grin only in the archival mural.
```
