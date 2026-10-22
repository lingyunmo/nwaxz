"""Build the original extreme-mode frog as a solid, skinned glTF character.

Run with Blender --background --factory-startup --threads 1 --python this_file.
No render, downloads, user scene loading or .blend modification. Front is -Y.
The existing haunted-frog-v1 sprite supplies the character identity; the side
and back silhouettes are authored approximations, not recovered source models.
"""
import bpy
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/assets/models/extreme-milk-frog-v1.glb'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(32)

def material(name, color, roughness=.85, glow=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    if glow:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = glow
    return m

skin = material('sickly_ochre_skin', (.46, .31, .042))
belly = material('stained_cream_belly', (.57, .51, .30))
dark = material('deep_eye_and_mouth_cavities', (.008, .006, .004))
hands = material('muddy_hands_and_feet', (.065, .045, .019))
lip = material('dark_ochre_lips', (.20, .12, .014))
teeth = material('uneven_old_teeth', (.62, .58, .39), .68)
iris = material('small_sulfur_eyes', (.72, .86, .12), .4, 1.8)
pupil = material('black_pupils', (.001, .002, .001), .25)
tongue = material('dry_mouth_interior', (.16, .039, .021))

# Vertex colour gives the skin restrained, non-repeating grime without a
# procedural shader dependency or a camera-facing picture.
for m in (skin, belly, hands, teeth):
    p = m.node_tree.nodes.get('Principled BSDF')
    attr = m.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Weathering'
    m.node_tree.links.new(attr.outputs['Color'], p.inputs['Base Color'])

parts = []
def finish(obj, mat, weights):
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    col = obj.data.color_attributes.new(name='Weathering', type='FLOAT_COLOR', domain='POINT')
    base = mat.diffuse_color
    for v in obj.data.vertices:
        pos = obj.matrix_world @ v.co
        grain = .91 + .09 * math.sin(pos.x * 32 + pos.z * 43) * math.sin(pos.y * 39 - pos.z * 9)
        stain = 1 - .20 * max(0, math.sin(pos.x * 9 + pos.y * 11 + pos.z * 5)) ** 6
        col.data[v.index].color = (base[0]*grain*stain, base[1]*grain*stain, base[2]*grain*stain, 1)
    for name in (weights if isinstance(weights, dict) else {weights: 1}):
        group = obj.vertex_groups.new(name=name)
        group.add(list(range(len(obj.data.vertices))), weights[name] if isinstance(weights, dict) else 1, 'REPLACE')
    parts.append(obj)
    return obj

def ellipsoid(name, loc, scale, mat, bone, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, bone)

def limb(name, a, b, r1, r2, mat, bone):
    a, b = Vector(a), Vector(b)
    axis = (b-a).normalized()
    side = axis.cross(Vector((0,1,0))).normalized()
    if side.length < .1:
        side = axis.cross(Vector((1,0,0))).normalized()
    other = axis.cross(side).normalized()
    verts, faces = [], []
    for j in range(9):
        t = j/8
        radius = ((1-t)*r1 + t*r2) * (.65+.35*math.sin(math.pi*t)**.5)
        for i in range(12):
            ang = math.tau*i/12
            verts.append(a.lerp(b,t)+radius*(side*math.cos(ang)+other*math.sin(ang)))
    for j in range(8):
        for i in range(12):
            n=(i+1)%12
            faces.append((j*12+i,j*12+n,(j+1)*12+n,(j+1)*12+i))
    faces.extend([tuple(reversed(range(12))),tuple(8*12+i for i in range(12))])
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    obj=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj,mat,bone)

# One broad pear-shaped torso/head, with actual cut-out mouth and eye sockets.
rings=[(.27,.24,.22),(.38,.37,.30),(.56,.49,.38),(.80,.59,.43),
       (1.05,.60,.43),(1.28,.51,.37),(1.47,.40,.30),(1.65,.35,.28),
       (1.82,.31,.26),(1.95,.24,.20),(2.04,.12,.12),(2.065,.015,.015)]
verts=[]; faces=[]; count=48
for z,rx,ry in rings:
    for i in range(count):
        a=math.tau*i/count
        verts.append((math.cos(a)*rx, math.sin(a)*ry+.035, z))
for j in range(len(rings)-1):
    for i in range(count):
        n=(i+1)%count
        faces.append((j*count+i,j*count+n,(j+1)*count+n,(j+1)*count+i))
faces.extend([tuple(reversed(range(count))),tuple((len(rings)-1)*count+i for i in range(count))])
mesh=bpy.data.meshes.new('continuous_pear_body')
mesh.from_pydata(verts,[],faces)
body=bpy.data.objects.new('continuous_pear_body',mesh)
bpy.context.collection.objects.link(body)
bpy.context.view_layer.objects.active=body
for loc,scale in [((0,-.28,1.64),(.335,.22,.145)),((-.225,-.185,1.865),(.112,.13,.105)),((.225,-.185,1.865),(.112,.13,.105))]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=14,location=loc)
    cut=bpy.context.object; cut.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.context.view_layer.objects.active=body
    mod=body.modifiers.new('carved_face_cavity','BOOLEAN'); mod.operation='DIFFERENCE'; mod.object=cut
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cut,do_unlink=True)
finish(body,skin,'spine')
# Gradual torso/head bending rather than moving a rigid torso box.
for name in ('root','head'):
    body.vertex_groups.new(name=name)
for v in body.data.vertices:
    z=v.co.z
    wh=max(0,min(1,(z-1.25)/.3))
    wr=max(0,min(1,(.6-z)/.3))
    body.vertex_groups['head'].add([v.index],wh,'REPLACE')
    body.vertex_groups['root'].add([v.index],wr,'REPLACE')
    body.vertex_groups['spine'].add([v.index],1-wh-wr,'REPLACE')

# Cream belly is a curved surface following the torso, not a flat decal plane.
ellipsoid('cream_belly', (0,-.285,.87),(.455,.168,.49),belly,'spine',32,20)
ellipsoid('mouth_cavity', (0,-.205,1.64),(.323,.06,.139),dark,'head')
ellipsoid('upper_lip', (0,-.31,1.768),(.31,.045,.025),lip,'head')
ellipsoid('lower_lip', (0,-.322,1.525),(.31,.047,.028),lip,'jaw')
ellipsoid('tongue', (0,-.274,1.54),(.18,.035,.027),tongue,'jaw')
for i in range(13):
    x=(i-6)*.047
    curve=(abs(x)/.31)**2
    for row in ('upper','lower'):
        z=1.735-.025*curve if row=='upper' else 1.557+.018*curve
        ellipsoid(row+'_tooth_%02d'%i,(x,-.33+.074*curve,z),
                  (.019,.028,.037+random.random()*.008),teeth,'head' if row=='upper' else 'jaw',10,6)
for side in (-1,1):
    x=side*.225
    ellipsoid('recessed_eye_socket', (x,-.195,1.865),(.112,.052,.101),dark,'head')
    ellipsoid('sulfur_eye', (x,-.241,1.866),(.035,.026,.039),iris,'eye.L' if side<0 else 'eye.R')
    ellipsoid('pinpoint_pupil', (x,-.264,1.867),(.012,.009,.024),pupil,'eye.L' if side<0 else 'eye.R',12,8)
    brow=ellipsoid('lowered_heavy_brow', (x,-.237,1.953),(.137,.052,.031),lip,'head')
    brow.rotation_euler[1]=side*-.22
    ellipsoid('cheek_fold',(side*.326,-.20,1.63),(.031,.055,.132),lip,'head',12,8)

# Short legs, splayed feet, thick arms and individually modelled dark fingers.
for side,suffix in ((-1,'.L'),(1,'.R')):
    hip=(side*.235,.025,.43); knee=(side*.27,-.01,.26); ankle=(side*.28,-.02,.10)
    limb('thigh'+suffix,hip,knee,.145,.12,skin,'thigh'+suffix)
    limb('shin'+suffix,knee,ankle,.115,.08,skin,'shin'+suffix)
    ellipsoid('foot'+suffix,(side*.29,-.105,.065),(.15,.23,.065),hands,'foot'+suffix)
    for j in range(3):
        ellipsoid('toe'+suffix,(side*.29+(j-1)*.07,-.275,.055),(.046,.075,.042),hands,'foot'+suffix,10,6)
    shoulder=(side*.385,.015,1.39); elbow=(side*.61,-.02,1.08); wrist=(side*.55,-.22,.86)
    limb('upper_arm'+suffix,shoulder,elbow,.16,.125,skin,'upper_arm'+suffix)
    ellipsoid('elbow'+suffix,elbow,(.12,.12,.12),skin,'forearm'+suffix)
    limb('forearm'+suffix,elbow,wrist,.12,.095,skin,'forearm'+suffix)
    ellipsoid('palm'+suffix,(side*.54,-.245,.80),(.105,.075,.13),hands,'hand'+suffix)
    for j in range(4):
        x=side*.54+(j-1.5)*.043
        limb('finger'+suffix,(x,-.275,.80),(x-side*.025,-.30,.66+(abs(j-1.5)*.025)),.023,.016,hands,'hand'+suffix)
    limb('thumb'+suffix,(side*.47,-.26,.84),(side*.43,-.32,.755),.034,.025,hands,'hand'+suffix)

# Humanoid armature. Separate jaw and eyes preserve the classic belly laugh.
arm=bpy.data.armatures.new('milk_frog_skeleton')
rig=bpy.data.objects.new('extreme_milk_frog',arm)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,a,b,parent=None):
    x=arm.edit_bones.new(name); x.head=a; x.tail=b
    if parent: x.parent=arm.edit_bones[parent]
bone('root',(0,0,.25),(0,0,.5))
bone('spine',(0,0,.5),(0,0,1.4),'root')
bone('head',(0,0,1.4),(0,0,2.03),'spine')
bone('jaw',(0,-.05,1.65),(0,-.27,1.53),'head')
for side,suf in ((-1,'.L'),(1,'.R')):
    bone('eye'+suf,(side*.225,-.20,1.866),(side*.225,-.24,1.866),'head')
    bone('thigh'+suf,(side*.235,.025,.43),(side*.27,-.01,.26),'root')
    bone('shin'+suf,(side*.27,-.01,.26),(side*.28,-.02,.1),'thigh'+suf)
    bone('foot'+suf,(side*.28,-.02,.1),(side*.28,-.23,.05),'shin'+suf)
    bone('upper_arm'+suf,(side*.385,.015,1.39),(side*.61,-.02,1.08),'spine')
    bone('forearm'+suf,(side*.61,-.02,1.08),(side*.55,-.22,.86),'upper_arm'+suf)
    bone('hand'+suf,(side*.55,-.22,.86),(side*.54,-.26,.72),'forearm'+suf)
bpy.ops.object.mode_set(mode='OBJECT')

# Merge by material, keeping skin weights; fewer render calls on mobile.
groups={m: [o for o in parts if o.data.materials[0]==m] for m in (skin,belly,dark,hands,lip,teeth,iris,pupil,tongue)}
for mat,subset in groups.items():
    if not subset: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in subset: o.select_set(True)
    bpy.context.view_layer.objects.active=subset[0]
    bpy.ops.object.join()
    obj=bpy.context.object; obj.name=mat.name+'_mesh'; obj.parent=rig
    modifier=obj.modifiers.new('skeletal_deformation','ARMATURE'); modifier.object=rig

# Key all channels on every clip, avoiding pose bleed between animations.
rig.animation_data_create()
def aim_bone(name, target):
    """Aim a posed bone at an armature-space point, preserving its roll."""
    p=rig.pose.bones[name]
    bpy.context.view_layer.update()
    parent=p.parent
    base=(parent.matrix.to_quaternion() @ parent.bone.matrix_local.to_quaternion().inverted() @ p.bone.matrix_local.to_quaternion()) if parent else p.bone.matrix_local.to_quaternion()
    direction=Vector(target)-p.head
    rotation=(base @ Vector((0,1,0))).rotation_difference(direction.normalized())
    p.rotation_euler=(base.inverted() @ rotation @ base).to_euler('XYZ')
    bpy.context.view_layer.update()

def cradle_belly(side, suffix, beat):
    """Analytic two-bone pose keeps both hands in contact with the belly."""
    bpy.context.view_layer.update()
    upper=rig.pose.bones['upper_arm'+suffix]
    lower=rig.pose.bones['forearm'+suffix]
    a=upper.head.copy()
    target=Vector((side*.19,-.445,1.025+.008*beat))
    delta=target-a
    distance=min(delta.length,upper.length+lower.length-.001)
    direction=delta.normalized()
    along=(upper.length**2-lower.length**2+distance**2)/(2*distance)
    height=math.sqrt(max(0,upper.length**2-along**2))
    outward=Vector((side,0,0))
    perpendicular=(outward-direction*outward.dot(direction)).normalized()
    elbow=a+direction*along+perpendicular*height
    aim_bone('upper_arm'+suffix,elbow)
    aim_bone('forearm'+suffix,target)
fps=24
bpy.context.scene.render.fps=fps
for clip,duration in [('idle',4),('walk',1.2),('run',.72),('laugh',2.4)]:
    rig.animation_data.action=None
    clip_action=None
    total_frames=round(duration*fps)
    for frame in sorted(set(range(0,total_frames+1,2)) | {total_frames}):
        # Pose updates used by the arm solver must not evaluate a previous
        # key/action over the newly authored pose.
        rig.animation_data.action=None
        t=frame/total_frames; wave=math.sin(t*math.tau)
        for p in rig.pose.bones:
            p.rotation_mode='XYZ'; p.rotation_euler=(0,0,0); p.location=(0,0,0); p.scale=(1,1,1)
        pb=rig.pose.bones
        if clip=='idle':
            pb['spine'].rotation_euler.x=.016*wave
            pb['head'].rotation_euler.y=.045*wave
            pb['root'].location.y=.008*wave
        elif clip in ('walk','run'):
            amp=.48 if clip=='walk' else .85
            for side,suf in ((-1,'.L'),(1,'.R')):
                pb['thigh'+suf].rotation_euler.x=side*amp*wave
                pb['shin'+suf].rotation_euler.x=max(0,-side*wave)*.65
                pb['foot'+suf].rotation_euler.x=-.12*side*wave
                pb['upper_arm'+suf].rotation_euler.x=-side*amp*wave
                pb['forearm'+suf].rotation_euler.x=-.25 if clip=='walk' else -.65
            pb['root'].location.y=.025*abs(wave)
            pb['spine'].rotation_euler.x=.08 if clip=='walk' else .17
            pb['spine'].rotation_euler.z=.035*wave
        else:
            # Both hands cradle the belly; jaw opens, eyes squint, shoulders
            # shudder. It remains a belly laugh even with reduced root motion.
            beat=math.sin(t*math.tau*4)
            pb['spine'].rotation_euler.x=.12+.025*beat
            pb['head'].rotation_euler.x=-.19+.035*beat
            pb['jaw'].rotation_euler.x=.35+.11*beat
            pb['jaw'].location.y=-.035
            for side,suf in ((-1,'.L'),(1,'.R')):
                cradle_belly(side,suf,beat)
                pb['hand'+suf].rotation_euler.x=.15+.04*beat
                pb['eye'+suf].scale=(1,.16,1)
        if clip_action is not None:
            rig.animation_data.action=clip_action
        for p in pb:
            p.keyframe_insert('location',frame=frame)
            p.keyframe_insert('rotation_euler',frame=frame)
            p.keyframe_insert('scale',frame=frame)
        clip_action=rig.animation_data.action
    action=clip_action
    action.name=clip
    track=rig.animation_data.nla_tracks.new(); track.name=clip
    track.strips.new(clip,0,action)
    track.mute=True
    rig.animation_data.action=None
for track in rig.animation_data.nla_tracks: track.mute=True

bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active=rig
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT),export_format='GLB',export_yup=True,
    use_selection=True,export_animations=True,export_animation_mode='ACTIONS',
    export_nla_strips=True,export_skins=True,export_all_influences=False)
print('Wrote',OUTPUT)
