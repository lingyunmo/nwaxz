import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math.js";
import { Viewport } from "@babylonjs/core/Maths/math.viewport.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import type { AssetContainer } from "@babylonjs/core/assetContainer.js";
import "@babylonjs/loaders/glTF/2.0/glTFLoader.js";
import "@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_emissive_strength.js";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";
import { aimCamera, CELL, createEscapeScene } from "./scene.ts";
import { installEscapeModels } from "./models.ts";
import { DOORS, MAP, ROOMS, SIZE, type EscapeWorld } from "./world.ts";

export type EscapeArt = { materials: HTMLImageElement };
export class EscapeRenderer {
  private engine: Engine;
  private view;
  private models?: ReturnType<typeof installEscapeModels>;
  private containers: AssetContainer[] = [];
  private shadow: ShadowGenerator;
  private captureLight: PointLight;
  private height = 1.65;
  private wasHidden = false;
  private disposed = false;
  constructor(private canvas: HTMLCanvasElement, art: EscapeArt, private reduced: boolean) {
    this.engine = new Engine(canvas, false, { preserveDrawingBuffer: false, stencil: false, powerPreference: "low-power" }, false);
    this.view = createEscapeScene(this.engine);
    const beam = new DynamicTexture("soft-flashlight-optics", 128, this.view.scene, false);
    const bc = beam.getContext(), gradient = bc.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(.38, "#eeeeee");
    gradient.addColorStop(.72, "#777777"); gradient.addColorStop(1, "#000000");
    bc.fillStyle = gradient; bc.fillRect(0, 0, 128, 128); beam.update(false);
    this.view.torch.projectionTexture = beam;
    for (const [name, quadrant] of [["wall", 0], ["wood", 1], ["floor", 2], ["ceiling", 3]] as const) {
      const tex = new DynamicTexture(`painted-${name}-tile`, 512, this.view.scene, true, Texture.TRILINEAR_SAMPLINGMODE);
      const s = art.materials.width / 2;
      tex.getContext().drawImage(art.materials, quadrant % 2 * s, Math.floor(quadrant / 2) * s, s, s, 0, 0, 512, 512);
      tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE; tex.anisotropicFilteringLevel = 4; tex.update(false);
      const material = this.view.scene.getMaterialByName(name === "wall" ? "painted-tile" : name === "wood" ? "painted-door" : `painted-${name}`);
      if (material && "diffuseTexture" in material) material.diffuseTexture = tex;
    }
    this.shadow = new ShadowGenerator(512, this.view.torch);
    this.shadow.usePoissonSampling = true; this.shadow.bias = .001; this.shadow.normalBias = .02; this.shadow.setDarkness(.42);
    this.captureLight = new PointLight("capture-laugh-key", Vector3.Zero(), this.view.scene);
    this.captureLight.diffuse = new Color3(.92, .84, .64); this.captureLight.range = 8; this.captureLight.intensity = 10;
    this.captureLight.setEnabled(false);
  }
  async load() {
    try {
      for (const name of ["escape-props-v1.glb", "extreme-milk-frog-v1.glb"]) {
        const container = await LoadAssetContainerAsync(`/assets/models/${name}`, this.view.scene, { pluginOptions: { gltf: { animationStartMode: 0 } } });
        if (this.disposed) { container.dispose(); return; }
        this.containers.push(container);
      }
      this.models = installEscapeModels(this.view.scene, this.containers[0], this.containers[1]);
      for (const mesh of [...this.models.actorMeshes, ...[...this.models.propRoots.values()].flatMap(n => n.getChildMeshes())]) this.shadow.addShadowCaster(mesh, false);
      for (const door of this.view.doors.values()) for (const mesh of door.getChildMeshes()) this.shadow.addShadowCaster(mesh, false);
      await this.view.scene.whenReadyAsync();
    } catch (e) { this.dispose(); throw e; }
  }
  resize(high = false) {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect(), ratio = Math.min(high ? 1.5 : 1, window.devicePixelRatio || 1);
    const cap = high ? 1600 : 1100, scale = Math.min(ratio, cap / Math.max(1, rect.width, rect.height));
    this.engine.setSize(Math.max(1, Math.round(rect.width * scale)), Math.max(1, Math.round(rect.height * scale)));
    this.shadow.getShadowMap()?.resize(high ? 1024 : 512);
  }
  draw(world: EscapeWorld, dt = 1 / 60) {
    if (this.disposed || !this.models) return;
    const d = world.data, caught = d.phase === "caught" || d.phase === "lost";
    this.models.animate(world, dt);
    const desired = d.hidden ? 1.65 : d.player.crouched ? 1.02 : 1.65;
    if (!!d.hidden !== this.wasHidden) this.height = desired;
    this.wasHidden = !!d.hidden;
    this.height += (desired - this.height) * (1 - Math.exp(-dt * 12));
    aimCamera(this.view, world, this.height);
    for (const door of DOORS) {
      const hinge = this.view.doors.get(door.id)!, target = d.opened.includes(door.id) ? Math.PI * .5 : 0;
      hinge.rotation.y += (target - hinge.rotation.y) * (1 - Math.exp(-dt * 12));
    }
    this.view.corridorLamp.setEnabled(!caught && d.player.z < 18);
    this.view.sewerGlow.setEnabled(!caught && d.player.z >= 18);
    this.view.corridorLamp.intensity = (d.power ? .65 : .30) * (this.reduced ? 1 : .8 + .2 * Math.sin(d.elapsed * 8) ** 14);
    this.captureLight.setEnabled(caught);
    this.view.ambient.intensity = caught ? .5 : .26;
    this.view.camera.viewport = caught ? this.engine.getRenderWidth() / this.engine.getRenderHeight() > 1.3 ? new Viewport(0, 0, .56, 1) : new Viewport(0, .34, 1, .66) : new Viewport(0, 0, 1, 1);
    if (caught) {
      const actor = this.models.actorRoot, center = actor.position.add(new Vector3(0, 1.05, 0));
      this.view.camera.position.copyFrom(center.add(new Vector3(0, .08, 3.05)));
      this.view.camera.setTarget(center); actor.rotation.y = 0;
      this.view.torch.intensity = 0;
      this.captureLight.position.copyFrom(center.add(new Vector3(-1.2, 1.8, 2)));
    }
    this.engine.beginFrame(); this.view.scene.render(); this.engine.endFrame();
  }
  drawMap(canvas: HTMLCanvasElement, world: EscapeWorld) {
    canvas.width = canvas.height = 500; const c = canvas.getContext("2d")!, scale = 20;
    c.fillStyle = "#151e20"; c.fillRect(0, 0, 500, 500);
    for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) if (!MAP[z][x]) { c.fillStyle = "#657273"; c.fillRect(x * scale + 1, z * scale + 1, 18, 18); }
    for (const door of DOORS) { c.fillStyle = world.data.opened.includes(door.id) ? "#9db98a" : "#c99b57"; c.fillRect(door.x * scale + 2, door.z * scale + 6, 16, 8); }
    c.textAlign = "center"; c.font = "bold 13px sans-serif";
    for (const room of ROOMS) { c.fillStyle = "#152024"; c.fillText(room.name, (room.x + room.w / 2) * scale, (room.z + room.h / 2) * scale); }
    c.fillStyle = "#b9dbb4"; c.fillRect(20 * scale, 23 * scale, 20, 13); c.font = "11px sans-serif"; c.fillText("下水道", 20.5 * scale, 24.5 * scale);
    const p = world.data.player; c.fillStyle = "#ffe29b"; c.beginPath(); c.arc(p.x * scale, p.z * scale, 5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#ffe29b"; c.beginPath(); c.moveTo(p.x * scale, p.z * scale); c.lineTo((p.x + Math.cos(p.angle) * .75) * scale, (p.z + Math.sin(p.angle) * .75) * scale); c.stroke();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.models?.dispose(); this.shadow.dispose();
    for (const container of this.containers) container.dispose();
    this.view.scene.dispose(); this.engine.dispose();
  }
}
