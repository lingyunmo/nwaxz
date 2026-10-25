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
import { DOORS, type EscapeWorld } from "./world.ts";
import { EscapeMap } from "./minimap.ts";
import { withTimeout } from "../loading.ts";
import { floorAt } from "./basement-map.ts";

export type EscapeArt = { materials: HTMLImageElement; map: HTMLImageElement; basement: HTMLImageElement };
export class EscapeRenderer {
  private engine: Engine;
  private view;
  private models?: ReturnType<typeof installEscapeModels>;
  private containers: AssetContainer[] = [];
  private shadow: ShadowGenerator;
  private captureLight: PointLight;
  private height = 1.65;
  private wasHidden = false;
  private wasExpanded?: boolean;
  private disposed = false;
  private map: EscapeMap;
  constructor(private canvas: HTMLCanvasElement, art: EscapeArt, private reduced: boolean) {
    this.engine = new Engine(canvas, false, { preserveDrawingBuffer: false, stencil: false, powerPreference: "low-power" }, false);
    this.view = createEscapeScene(this.engine);
    this.map = new EscapeMap(art.map);
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
    for (const [name, quadrant] of [["basement-tile", 0], ["basement-floor", 1], ["basement-ceiling", 2], ["basement-secret", 3]] as const) {
      const tex = new DynamicTexture(`painted-${name}`, 512, this.view.scene, true, Texture.TRILINEAR_SAMPLINGMODE);
      const s = art.basement.width / 2;
      tex.getContext().drawImage(art.basement, quadrant % 2 * s, Math.floor(quadrant / 2) * s, s, s, 0, 0, 512, 512);
      if (name === "basement-secret") { tex.vScale = -1; tex.vOffset = 1; }
      tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE; tex.anisotropicFilteringLevel = 4; tex.update(false);
      const material = this.view.scene.getMaterialByName(name);
      if (material && "diffuseTexture" in material) material.diffuseTexture = tex;
    }
    this.shadow = new ShadowGenerator(512, this.view.torch);
    this.shadow.usePoissonSampling = true; this.shadow.bias = .001; this.shadow.normalBias = .02; this.shadow.setDarkness(.42);
    this.captureLight = new PointLight("capture-laugh-key", Vector3.Zero(), this.view.scene);
    this.captureLight.diffuse = new Color3(.92, .84, .64); this.captureLight.range = 8; this.captureLight.intensity = 10;
    this.captureLight.setEnabled(false);
  }
  get usable() { return !this.disposed && !this.engine._gl?.isContextLost(); }
  setReducedMotion(reduced: boolean) { this.reduced = reduced; this.models?.actor.setReducedMotion(reduced); }
  async load(onStage: (stage: string) => void = () => {}) {
    try {
      onStage("正在摆放浴室里的物件…");
      for (const name of ["escape-props-v1.glb"]) {
        const task = LoadAssetContainerAsync(`/assets/models/${name}`, this.view.scene, { pluginOptions: { gltf: { animationStartMode: 0 } } }).then(container => {
          if (this.disposed) { container.dispose(); throw new Error("场景已关闭"); }
          return container;
        });
        const container = await withTimeout(task, "浴室模型准备超时，请重试。");
        this.containers.push(container);
      }
      onStage("奶蛙正在就位…");
      const texture = (url: string, noMipmaps = false) => {
        let image: Texture;
        return withTimeout(new Promise<Texture>((resolve, reject) => {
          image = new Texture(url, this.view.scene, noMipmaps, true, noMipmaps ? Texture.BILINEAR_SAMPLINGMODE : Texture.TRILINEAR_SAMPLINGMODE, () => resolve(image), message => reject(new Error(message || "奶蛙贴图未能载入")));
        }), "奶蛙贴图准备超时，请重试。");
      };
      const [original, actions, directionIdle, directionWalk] = await Promise.all([texture("/assets/character/haunted-frog-v1.webp"), texture("/assets/character/haunted-frog-actions-v2.webp"), texture("/assets/character/haunted-frog-directions-idle-v1.webp", true), texture("/assets/character/haunted-frog-directions-walk-v1.webp", true)]);
      if (this.disposed) throw new Error("场景已关闭");
      this.models = installEscapeModels(this.view.scene, this.containers[0], { original, actions, directionIdle, directionWalk }, this.reduced);
      for (const mesh of [...this.models.propRoots.values()].flatMap(n => n.getChildMeshes())) this.shadow.addShadowCaster(mesh, false);
      for (const door of this.view.doors.values()) for (const mesh of door.getChildMeshes()) this.shadow.addShadowCaster(mesh, false);
      onStage("正在点亮浴室…");
      await withTimeout(this.view.scene.whenReadyAsync(), "浴室灯光准备超时，请重试。");
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
    const expanded = !!d.expansion?.enabled;
    if (expanded !== this.wasExpanded) { for (const shard of this.view.glassMeshes) shard.setEnabled(expanded); this.wasExpanded = expanded; }
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
    const inBasement = floorAt(d.player) === -1;
    this.view.basementMaintenance.setEnabled(!caught && inBasement);
    this.view.sumpGlow.setEnabled(!caught && inBasement);
    this.view.corridorLamp.intensity = (d.power ? .30 : .15) * (this.reduced ? 1 : .8 + .2 * Math.sin(d.elapsed * 8) ** 14);
    this.captureLight.setEnabled(caught);
    this.view.ambient.intensity = caught ? .5 : inBasement ? .025 : .055;
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
  drawMap(canvas: HTMLCanvasElement, world: EscapeWorld, compact = false, floor?: 0 | -1) {
    this.map.draw(canvas, world, compact, floor);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.models?.dispose(); this.shadow.dispose();
    for (const container of this.containers) container.dispose();
    this.view.scene.dispose(); this.engine.dispose();
  }
}
