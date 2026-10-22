"""Build the six low-poly escape-room props and export escape-props-v1.glb.

Run only in a disposable Blender background process. The script creates all
geometry procedurally and never opens or saves a .blend file. Coordinates use
Blender's Z-up convention; each prop's front faces -Y.
"""

import bpy
import math
from mathutils import Vector
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "assets" / "models" / "escape-props-v1.glb"
ATLAS = ROOT / "public" / "assets" / "scenes" / "escape-materials-v1.webp"
WOOD_CROP = ROOT / ".local" / "modeling" / "escape-wood.png"

# Remove only Blender's startup scene objects in memory. No filesystem cleanup.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
    for block in list(datablocks):
        if block.users == 0:
            datablocks.remove(block)


def material(name, color, metallic=0.0, roughness=0.82):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


wood = material("wood_dark_old", (0.105, 0.052, 0.027))
wood_edge = material("wood_worn_edge", (0.19, 0.095, 0.044))
wood_shadow = material("wood_interior", (0.047, 0.028, 0.018))
iron = material("iron_blackened", (0.075, 0.085, 0.083), 0.72, 0.5)
rust = material("iron_rust", (0.24, 0.075, 0.027), 0.35, 0.76)
steel = material("iron_worn", (0.25, 0.27, 0.25), 0.8, 0.43)
glass = material("fuse_glass", (0.55, 0.72, 0.48), 0.1, 0.25)
green = material("fuse_on_green", (0.025, 0.8, 0.16), 0.05, 0.25)
ceramic = material("pipe_ceramic_old", (0.19, 0.2, 0.18), 0.35, 0.54)

roots = {}
for name in ("wardrobe", "drawer", "fusebox", "valve", "grate", "pipe"):
    root = bpy.data.objects.new(name, None)
    root.empty_display_type = "PLAIN_AXES"
    bpy.context.collection.objects.link(root)
    roots[name] = root


def parent(obj, target):
    obj.parent = target
    obj.matrix_parent_inverse.identity()
    return obj


def finish_mesh(obj, mat, bevel=0.0):
    obj.data.materials.append(mat)
    if mat.name in {"wood_dark_old", "wood_worn_edge"}:
        uv = obj.data.uv_layers.new(name="UVMap")
        for polygon in obj.data.polygons:
            axis = max(range(3), key=lambda index: abs(polygon.normal[index]))
            for loop_index in polygon.loop_indices:
                vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                if axis == 1:
                    horizontal, vertical = vertex.x, vertex.z
                elif axis == 0:
                    horizontal, vertical = vertex.y, vertex.z
                else:
                    horizontal, vertical = vertex.x, vertex.y
                uv.data[loop_index].uv = (horizontal * 2.0 + 0.5,
                                          vertical * (0.45 if axis != 2 else 2.0) + 0.5)
    if bevel:
        mod = obj.modifiers.new("small_edge_rounds", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def set_wood_texture():
    """Crop the atlas's upper-right wood quadrant and embed a darkened PNG."""
    WOOD_CROP.parent.mkdir(parents=True, exist_ok=True)
    atlas = bpy.data.images.load(str(ATLAS), check_existing=True)
    width, height = atlas.size
    crop_width, crop_height = width // 2, height // 2
    source_pixels = atlas.pixels[:]
    cropped = bpy.data.images.new("escape_wood_dark", width=crop_width,
                                  height=crop_height, alpha=False)
    pixels = [0.0] * (crop_width * crop_height * 4)
    # Blender image pixels use a bottom-left origin. This selects the upper
    # right quadrant as displayed in the source atlas.
    for y in range(crop_height):
        for x in range(crop_width):
            src = ((y + crop_height) * width + (x + crop_width)) * 4
            dst = (y * crop_width + x) * 4
            pixels[dst] = source_pixels[src] * 0.72
            pixels[dst + 1] = source_pixels[src + 1] * 0.72
            pixels[dst + 2] = source_pixels[src + 2] * 0.72
            pixels[dst + 3] = 1.0
    cropped.pixels[:] = pixels
    cropped.filepath_raw = str(WOOD_CROP)
    cropped.file_format = "PNG"
    cropped.save()
    cropped.pack()
    for mat in (wood, wood_edge):
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.name = "darkened_wood_uv"
        tex.image = cropped
        tex.interpolation = "Linear"
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])


def cube(name, dims, loc, mat, target, bevel=0.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish_mesh(obj, mat, min(bevel, min(dims) * 0.2) if bevel else 0)
    return parent(obj, target)


def cylinder(name, radius, depth, loc, mat, target, axis="Z", vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    if axis == "Y":
        obj.rotation_euler[0] = math.pi / 2
    elif axis == "X":
        obj.rotation_euler[1] = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    finish_mesh(obj, mat)
    return parent(obj, target)


def rod(name, p1, p2, radius, mat, target, vertices=10):
    a, b = Vector(p1), Vector(p2)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=d.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = d.to_track_quat("Z", "Y")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    finish_mesh(obj, mat)
    return parent(obj, target)


def torus(name, major, minor, loc, mat, target, front_axis="Y", segments=20):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=segments, minor_segments=6,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    if front_axis == "Y":
        obj.rotation_euler[0] = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    finish_mesh(obj, mat)
    return parent(obj, target)


def sphere(name, radius, loc, mat, target, segments=10, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    finish_mesh(obj, mat)
    return parent(obj, target)


# Wardrobe carcass: open front and a deep cavity for a player to hide in.
r = roots["wardrobe"]
cube("wardrobe_back", (1.16, .055, 2.26), (0, .3975, 1.15), wood_shadow, r, .018)
cube("wardrobe_side_L", (.055, .82, 2.3), (-.5725, 0, 1.15), wood, r, .025)
cube("wardrobe_side_R", (.055, .82, 2.3), (.5725, 0, 1.15), wood, r, .025)
cube("wardrobe_top", (1.2, .85, .065), (0, 0, 2.2675), wood, r, .022)
cube("wardrobe_bottom", (1.2, .85, .075), (0, 0, .0375), wood, r, .022)
cube("wardrobe_plinth", (1.16, .79, .075), (0, .015, .112), wood_edge, r, .012)
cube("wardrobe_shelf_low", (1.08, .72, .045), (0, .025, .43), wood_edge, r, .012)
cube("wardrobe_shelf_top", (1.08, .72, .045), (0, .025, 1.98), wood_edge, r, .012)
# Narrow rails and visible side-wall strips add board construction detail.
for z in (.2, .6, 1.0, 1.4, 1.8, 2.13):
    cube("wardrobe_interior_rib", (.018, .72, .018), (-.535, .025, z), wood_edge, r, .003)
    cube("wardrobe_interior_rib", (.018, .72, .018), (.535, .025, z), wood_edge, r, .003)
for x in (-.38, -.19, 0, .19, .38):
    cube("wardrobe_back_board_seam", (.008, .012, 2.16), (x, .365, 1.15), wood, r, .002)
for x in (-.53, .53):
    # Carcass-side hinge leaves sit against the fixed hinge axis at x=+/-0.594.
    inner_sign = -1 if x > 0 else 1
    for z in (.28, 1.13, 2.02):
        cube("wardrobe_hinge_carcass_leaf", (.08, .012, .13),
             (x + inner_sign * .04, -.448, z), iron, r, .004)
        cylinder("wardrobe_hinge_pin", .014, .15, (x, -.46, z), rust, r)

for side, hinge_x, sign in (("left", -.594, 1), ("right", .594, -1)):
    door = bpy.data.objects.new("wardrobe_door_" + side, None)
    door.empty_display_type = "PLAIN_AXES"
    bpy.context.collection.objects.link(door)
    parent(door, r)
    door.location = (hinge_x, -.4225, .04)
    # Closed leaves meet with a 12 mm center gap. The local hinge edge is x=0.
    panel_w = .588
    center_x = sign * panel_w / 2
    cube("wardrobe_door_panel_" + side, (panel_w, .045, 2.22),
         (center_x, 0, 1.11), wood, door, .018)
    # Raised framing and vertical plank seams on the exterior face.
    for xoff in (sign * .06, sign * (panel_w - .06)):
        cube("wardrobe_door_stile_" + side, (.045, .025, 2.1),
             (xoff, -.034, 1.11), wood_edge, door, .008)
    for z in (.11, 2.11):
        cube("wardrobe_door_rail_" + side, (panel_w - .08, .026, .055),
             (center_x, -.035, z), wood_edge, door, .008)
    for z in (.28, 1.13, 2.02):
        cube("wardrobe_hinge_door_leaf_" + side, (.08, .012, .13),
             (sign * .04, -.04, z - .04), iron, door, .004)
    for xoff in (sign * .18, sign * .36):
        cube("wardrobe_door_board_line_" + side, (.009, .012, 1.94),
             (xoff, -.030, 1.11), wood_shadow, door, .002)
    handle_x = sign * (panel_w - .13)
    cylinder("wardrobe_handle_rose_" + side, .045, .018,
             (handle_x, -.061, 1.12), iron, door, axis="Y")
    rod("wardrobe_handle_grip_" + side,
        (handle_x, -.095, 1.05), (handle_x, -.095, 1.19), .013, steel, door)

# Low chest with three independently recessed drawer faces and pulls.
r = roots["drawer"]
cube("drawer_left_side", (.055, .65, .81), (-.4725, 0, .425), wood, r, .018)
cube("drawer_right_side", (.055, .65, .81), (.4725, 0, .425), wood, r, .018)
cube("drawer_top", (1, .65, .06), (0, 0, .82), wood_edge, r, .018)
cube("drawer_bottom", (1, .65, .06), (0, 0, .03), wood, r, .014)
cube("drawer_back", (.89, .045, .73), (0, .3025, .425), wood, r, .012)
for z in (.16, .42, .68):
    # Inner box is set back; each front has a proud frame and a dark inset.
    cube("drawer_box_bottom", (.86, .5, .025), (0, .005, z - .095), wood_shadow, r, .004)
    cube("drawer_box_back", (.86, .035, .19), (0, .245, z), wood, r, .008)
    cube("drawer_front_inset", (.84, .045, .19), (0, -.33, z), wood_edge, r, .012)
    cube("drawer_front_face", (.76, .018, .125), (0, -.357, z), wood, r, .01)
    for x in (-.405, .405):
        cylinder("drawer_pull_rosette", .033, .016, (x, -.374, z), iron, r, axis="Y")
    rod("drawer_pull", (-.11, -.394, z), (.11, -.394, z), .012, steel, r)
    for x in (-.095, .095):
        rod("drawer_pull_stem", (x, -.37, z), (x, -.394, z), .009, iron, r)

# Wall-mounted fuse cabinet, conduit runs, individual fuses and lit indicator.
r = roots["fusebox"]
cube("fusebox_back", (.6, .035, .8), (0, .0725, .4), iron, r, .025)
cube("fusebox_body", (.55, .13, .74), (0, -.005, .4), rust, r, .025)
cube("fusebox_door", (.49, .028, .67), (0, -.086, .405), iron, r, .018)
cube("fusebox_door_inner", (.43, .012, .61), (0, -.107, .405), steel, r, .01)
cube("fusebox_panel_dark", (.39, .012, .55), (0, -.116, .405), iron, r, .008)
for x in (-.17, -.055, .06, .175):
    cube("fuse_slot", (.066, .014, .24), (x, -.126, .42), rust, r, .008)
    cylinder("fuse_cap", .024, .04, (x, -.143, .42), glass, r, axis="Y")
    cube("fuse_link", (.009, .016, .12), (x, -.148, .42), steel, r, .003)
sphere("fusebox_status_lamp", .025, (.18, -.145, .665), green, r)
for z in (.12, .68):
    for x in (-.24, .24):
        cylinder("fusebox_bolt", .018, .018, (x, -.13, z), steel, r, axis="Y", vertices=8)
for x in (-.22, .22):
    rod("fusebox_conduit", (x, .07, .82), (x, .07, 1.05), .032, ceramic, r, 10)
    for z in (.84, 1.01):
        cylinder("conduit_coupler", .039, .045, (x, .07, z), rust, r)

# Corroded handwheel on a short wall pipe. Wheel is an independent pivot node.
r = roots["valve"]
rod("valve_wall_pipe", (0, .18, .62), (0, -.08, .62), .075, rust, r, 12)
cylinder("valve_flange", .19, .07, (0, -.055, .62), iron, r, axis="Y", vertices=16)
torus("valve_flange_rim", .16, .018, (0, -.1, .62), steel, r)
for i in range(8):
    a = math.tau * i / 8
    cylinder("valve_flange_bolt", .018, .025,
             (.155 * math.cos(a), -.105, .62 + .155 * math.sin(a)), rust, r,
             axis="Y", vertices=8)
wheel = bpy.data.objects.new("valve_wheel", None)
wheel.empty_display_type = "PLAIN_AXES"
bpy.context.collection.objects.link(wheel)
parent(wheel, r)
wheel.location = (0, -.19, .62)
torus("valve_wheel_rim", .28, .027, (0, 0, 0), rust, wheel)
cylinder("valve_wheel_hub", .075, .09, (0, 0, 0), steel, wheel, axis="Y")
for i in range(6):
    a = math.tau * i / 6
    rod("valve_wheel_spoke", (0, 0, 0),
        (.255 * math.cos(a), 0, .255 * math.sin(a)), .021, iron, wheel, 8)
    sphere("valve_wheel_grip", .034,
           (.28 * math.cos(a), 0, .28 * math.sin(a)), rust, wheel, 8, 5)

# Floor grate with a thick outer frame and individual iron bars.
r = roots["grate"]
cube("grate_frame_top", (1.1, .07, .07), (0, 0, 1.0), iron, r, .015)
cube("grate_frame_bottom", (1.1, .07, .07), (0, 0, .035), iron, r, .015)
for x in (-.515, .515):
    cube("grate_frame_side", (.07, .07, .93), (x, 0, .5175), rust, r, .012)
cube("grate_shadow", (.98, .025, .84), (0, .025, .5175), wood_shadow, r, .004)
for x in (-.44, -.33, -.22, -.11, 0, .11, .22, .33, .44):
    cube("grate_vertical_bar", (.027, .055, .84), (x, -.018, .5175), steel, r, .006)
for z in (.16, .27, .38, .49, .60, .71, .82, .93):
    cube("grate_horizontal_bar", (.98, .055, .027), (0, -.02, z), iron, r, .006)
for x in (-.49, .49):
    for z in (.09, .965):
        cylinder("grate_screw", .018, .02, (x, -.047, z), rust, r, axis="Y", vertices=8)

# Tall standpipe with collars, couplings and small visible clamp bolts.
r = roots["pipe"]
rod("pipe_main", (0, 0, 0), (0, 0, 2.8), .035, ceramic, r, 12)
for z in (.12, .72, 1.42, 2.12, 2.68):
    cylinder("pipe_coupling", .055, .105, (0, 0, z), rust, r, vertices=12)
    cylinder("pipe_coupling_ridge", .06, .022, (0, 0, z + .038), iron, r, vertices=12)
for z in (.4, 1.05, 1.75, 2.42):
    cube("pipe_wall_clamp", (.15, .028, .035), (0, .038, z), iron, r, .007)
    for x in (-.06, .06):
        cylinder("pipe_clamp_bolt", .012, .018, (x, .018, z), steel, r,
                 axis="Y", vertices=8)

set_wood_texture()

# Join static meshes by parent and material to keep draw calls modest. Dynamic
# door leaves and the valve wheel keep their own transform nodes.
groups = {}
for obj in list(bpy.context.scene.objects):
    if obj.type != "MESH":
        continue
    key = (obj.parent, obj.data.materials[0].name if obj.data.materials else "")
    groups.setdefault(key, []).append(obj)
for (owner, mat_name), objects in groups.items():
    if len(objects) < 2:
        continue
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    active = objects[0]
    bpy.context.view_layer.objects.active = active
    bpy.ops.object.join()
    active.name = owner.name + "__" + mat_name

# Export only this generated hierarchy; no .blend save and no render.
bpy.ops.object.select_all(action="DESELECT")
for obj in list(bpy.context.scene.objects):
    obj.select_set(False)
for root in roots.values():
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
bpy.context.view_layer.objects.active = roots["wardrobe"]
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB",
                           use_selection=True, export_apply=True,
                           export_yup=True, export_materials="EXPORT")
print("Wrote", OUTPUT)
