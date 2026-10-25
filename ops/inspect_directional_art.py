"""Read final atlas alpha bounds and emit UV/ground metadata; never edits pixels.

Run after packing the generated paintings with FFmpeg. Requires Pillow.
The largest connected silhouette ignores detached generation dust at cell edges.
"""
from collections import deque
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def bounds(alpha):
    width, height = alpha.size
    pixels = bytearray(alpha.point(lambda a: 1 if a >= 64 else 0).tobytes())
    best = None
    for start, value in enumerate(pixels):
        if not value:
            continue
        queue = deque([start])
        pixels[start] = 0
        count, left, top, right, bottom = 0, width, height, 0, 0
        while queue:
            index = queue.popleft()
            x, y = index % width, index // width
            count += 1
            left, top, right, bottom = min(left, x), min(top, y), max(right, x), max(bottom, y)
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < width and 0 <= ny < height:
                    nxt = ny * width + nx
                    if pixels[nxt]:
                        pixels[nxt] = 0
                        queue.append(nxt)
        if best is None or count > best[0]:
            best = (count, left, top, right + 1, bottom + 1)
    assert best and best[0] > width * height * .08, "Missing full-body frame"
    return best[1:]


def atlas(name, rows):
    file = ROOT / "public/assets/character" / name
    image = Image.open(file).convert("RGBA")
    width, height = image.size
    assert width % 4 == 0 and height % rows == 0
    cw, ch = width // 4, height // rows
    frames = []
    for row in range(rows):
        for col in range(4):
            cell = image.getchannel("A").crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
            left, top, right, foot = bounds(cell)
            x, y = max(0, left - 4), max(0, top - 4)
            end, bottom = min(cw, right + 4), min(ch, foot + 4)
            frames.append(dict(x=col * cw + x, y=row * ch + y, width=end - x, height=bottom - y, ground=bottom - foot))
    return dict(width=width, height=height, frames=frames)


data = {
    "directionIdle": atlas("haunted-frog-directions-idle-v1.webp", 2),
    "directionWalk": atlas("haunted-frog-directions-walk-v1.webp", 4),
}
text = "// Generated alpha/foot bounds; run python ops/inspect_directional_art.py.\n"
text += "export const DIRECTIONAL_ART = " + json.dumps(data, ensure_ascii=False, indent=2) + " as const;\n"
(ROOT / "src/escape/directional-art.ts").write_text(text, encoding="utf-8", newline="\n")
print(json.dumps({key: {"width": value["width"], "height": value["height"], "frames": len(value["frames"])} for key, value in data.items()}))
