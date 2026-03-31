import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';
import React, { useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping, AmbientLight, Clock, Color, InstancedMesh,
  MathUtils, MeshPhysicalMaterial, Object3D, PerspectiveCamera, Plane,
  PMREMGenerator, PointLight, Raycaster, Scene, ShaderChunk, SphereGeometry,
  SRGBColorSpace, Vector2, Vector3, WebGLRenderer, type WebGLRendererParameters
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

gsap.registerPlugin(Observer);

interface SizeData { width: number; height: number; wWidth: number; wHeight: number; ratio: number; pixelRatio: number; }

class X {
  #config: any; #postprocessing: any; #resizeObserver?: ResizeObserver;
  #intersectionObserver?: IntersectionObserver; #resizeTimer?: number;
  #animationFrameId: number = 0; #clock: Clock = new Clock();
  #animationState = { elapsed: 0, delta: 0 }; #isAnimating = false; #isVisible = false;
  canvas!: HTMLCanvasElement; camera!: PerspectiveCamera; cameraMinAspect?: number;
  cameraMaxAspect?: number; cameraFov!: number; maxPixelRatio?: number; minPixelRatio?: number;
  scene!: Scene; renderer!: WebGLRenderer;
  size: SizeData = { width: 0, height: 0, wWidth: 0, wHeight: 0, ratio: 0, pixelRatio: 0 };
  render: () => void = this.#render.bind(this);
  onBeforeRender: (s: { elapsed: number; delta: number }) => void = () => {};
  onAfterRender: (s: { elapsed: number; delta: number }) => void = () => {};
  onAfterResize: (s: SizeData) => void = () => {};
  isDisposed = false;

  constructor(config: any) {
    this.#config = { ...config };
    this.camera = new PerspectiveCamera(); this.cameraFov = this.camera.fov;
    this.scene = new Scene();
    if (config.canvas) { this.canvas = config.canvas; }
    this.canvas.style.display = 'block';
    this.renderer = new WebGLRenderer({ canvas: this.canvas, powerPreference: 'high-performance', ...(config.rendererOptions ?? {}) });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.resize();
    if (!(config.size instanceof Object)) {
      window.addEventListener('resize', this.#onResize.bind(this));
      if (config.size === 'parent' && this.canvas.parentNode) {
        this.#resizeObserver = new ResizeObserver(this.#onResize.bind(this));
        this.#resizeObserver.observe(this.canvas.parentNode as Element);
      }
    }
    this.#intersectionObserver = new IntersectionObserver(this.#onIntersection.bind(this), { root: null, rootMargin: '0px', threshold: 0 });
    this.#intersectionObserver.observe(this.canvas);
    document.addEventListener('visibilitychange', this.#onVisibilityChange.bind(this));
  }

  #onResize() { if (this.#resizeTimer) clearTimeout(this.#resizeTimer); this.#resizeTimer = window.setTimeout(this.resize.bind(this), 100); }

  resize() {
    let w: number, h: number;
    if (this.#config.size === 'parent' && this.canvas.parentNode) {
      w = (this.canvas.parentNode as HTMLElement).offsetWidth;
      h = (this.canvas.parentNode as HTMLElement).offsetHeight;
    } else { w = window.innerWidth; h = window.innerHeight; }
    this.size.width = w; this.size.height = h; this.size.ratio = w / h;
    this.camera.aspect = w / h;
    if (this.cameraMaxAspect && this.camera.aspect > this.cameraMaxAspect) {
      const tanFov = Math.tan(MathUtils.degToRad(this.cameraFov / 2));
      const newTan = tanFov / (this.camera.aspect / this.cameraMaxAspect);
      this.camera.fov = 2 * MathUtils.radToDeg(Math.atan(newTan));
    } else { this.camera.fov = this.cameraFov; }
    this.camera.updateProjectionMatrix();
    const fovRad = (this.camera.fov * Math.PI) / 180;
    this.size.wHeight = 2 * Math.tan(fovRad / 2) * this.camera.position.length();
    this.size.wWidth = this.size.wHeight * this.camera.aspect;
    this.renderer.setSize(w, h);
    let pr = window.devicePixelRatio;
    if (this.maxPixelRatio && pr > this.maxPixelRatio) pr = this.maxPixelRatio;
    this.renderer.setPixelRatio(pr);
    this.size.pixelRatio = pr;
    this.onAfterResize(this.size);
  }

  #onIntersection(entries: IntersectionObserverEntry[]) {
    this.#isAnimating = entries[0].isIntersecting;
    this.#isAnimating ? this.#startAnimation() : this.#stopAnimation();
  }
  #onVisibilityChange() { if (this.#isAnimating) { document.hidden ? this.#stopAnimation() : this.#startAnimation(); } }
  #startAnimation() {
    if (this.#isVisible) return;
    const animate = () => {
      this.#animationFrameId = requestAnimationFrame(animate);
      this.#animationState.delta = this.#clock.getDelta();
      this.#animationState.elapsed += this.#animationState.delta;
      this.onBeforeRender(this.#animationState);
      this.render();
      this.onAfterRender(this.#animationState);
    };
    this.#isVisible = true; this.#clock.start(); animate();
  }
  #stopAnimation() { if (this.#isVisible) { cancelAnimationFrame(this.#animationFrameId); this.#isVisible = false; this.#clock.stop(); } }
  #render() { this.renderer.render(this.scene, this.camera); }
  clear() {
    this.scene.traverse(obj => {
      const o = obj as any;
      if (o.isMesh) { o.material?.dispose(); o.geometry?.dispose(); }
    });
    this.scene.clear();
  }
  dispose() {
    window.removeEventListener('resize', this.#onResize.bind(this));
    this.#resizeObserver?.disconnect(); this.#intersectionObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.#onVisibilityChange.bind(this));
    this.#stopAnimation(); this.clear(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.isDisposed = true;
  }
}

class W {
  config: any; positionData: Float32Array; velocityData: Float32Array; sizeData: Float32Array; center = new Vector3();
  constructor(config: any) {
    this.config = config;
    this.positionData = new Float32Array(3 * config.count).fill(0);
    this.velocityData = new Float32Array(3 * config.count).fill(0);
    this.sizeData = new Float32Array(config.count).fill(1);
    this.center.toArray(this.positionData, 0);
    for (let i = 1; i < config.count; i++) {
      const idx = 3 * i;
      this.positionData[idx] = MathUtils.randFloatSpread(2 * config.maxX);
      this.positionData[idx+1] = MathUtils.randFloatSpread(2 * config.maxY);
      this.positionData[idx+2] = MathUtils.randFloatSpread(2 * config.maxZ);
    }
    this.sizeData[0] = config.size0;
    for (let i = 1; i < config.count; i++) this.sizeData[i] = MathUtils.randFloat(config.minSize, config.maxSize);
  }
  update(di: { delta: number }) {
    const { config, positionData, sizeData, velocityData, center } = this;
    let start = config.controlSphere0 ? 1 : 0;
    if (config.controlSphere0) {
      new Vector3().fromArray(positionData, 0).lerp(center, 0.1).toArray(positionData, 0);
      new Vector3(0,0,0).toArray(velocityData, 0);
    }
    for (let i = start; i < config.count; i++) {
      const b = 3*i, pos = new Vector3().fromArray(positionData, b), vel = new Vector3().fromArray(velocityData, b);
      vel.y -= di.delta * config.gravity * sizeData[i];
      vel.multiplyScalar(config.friction).clampLength(0, config.maxVelocity);
      pos.add(vel); pos.toArray(positionData, b); vel.toArray(velocityData, b);
    }
    for (let i = start; i < config.count; i++) {
      const b = 3*i, pos = new Vector3().fromArray(positionData, b), vel = new Vector3().fromArray(velocityData, b), r = sizeData[i];
      for (let j = i+1; j < config.count; j++) {
        const ob = 3*j, op = new Vector3().fromArray(positionData, ob), ov = new Vector3().fromArray(velocityData, ob);
        const diff = new Vector3().copy(op).sub(pos), dist = diff.length(), sr = r + sizeData[j];
        if (dist < sr) {
          const ov2 = diff.normalize().multiplyScalar(0.5*(sr-dist));
          const vc = ov2.clone().multiplyScalar(Math.max(vel.length(),1));
          pos.sub(ov2); vel.sub(vc); pos.toArray(positionData,b); vel.toArray(velocityData,b);
          op.add(ov2); ov.add(ov2.clone().multiplyScalar(Math.max(ov.length(),1)));
          op.toArray(positionData,ob); ov.toArray(velocityData,ob);
        }
      }
      if (config.controlSphere0) {
        const sp = new Vector3().fromArray(positionData,0), d = new Vector3().copy(sp).sub(pos), dist2 = d.length(), sr0 = r+sizeData[0];
        if (dist2 < sr0) { const c = d.normalize().multiplyScalar(sr0-dist2); pos.sub(c); vel.sub(c.clone().multiplyScalar(Math.max(vel.length(),2))); }
      }
      if (Math.abs(pos.x)+r > config.maxX) { pos.x = Math.sign(pos.x)*(config.maxX-r); vel.x = -vel.x*config.wallBounce; }
      if (config.gravity === 0) { if (Math.abs(pos.y)+r > config.maxY) { pos.y = Math.sign(pos.y)*(config.maxY-r); vel.y = -vel.y*config.wallBounce; } }
      else if (pos.y-r < -config.maxY) { pos.y = -config.maxY+r; vel.y = -vel.y*config.wallBounce; }
      const mb = Math.max(config.maxZ, config.maxSize);
      if (Math.abs(pos.z)+r > mb) { pos.z = Math.sign(pos.z)*(config.maxZ-r); vel.z = -vel.z*config.wallBounce; }
      pos.toArray(positionData,b); vel.toArray(velocityData,b);
    }
  }
}

class Y extends MeshPhysicalMaterial {
  uniforms: any = { thicknessDistortion:{value:0.1}, thicknessAmbient:{value:0}, thicknessAttenuation:{value:0.1}, thicknessPower:{value:2}, thicknessScale:{value:10} };
  defines: any;
  constructor(params: any) {
    super(params); this.defines = { USE_UV: '' };
    this.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.fragmentShader = `uniform float thicknessPower;uniform float thicknessScale;uniform float thicknessDistortion;uniform float thicknessAmbient;uniform float thicknessAttenuation;` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', `void RE_Direct_Scattering(const in IncidentLight directLight,const in vec2 uv,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,inout ReflectedLight reflectedLight){vec3 scatteringHalf=normalize(directLight.direction+(geometryNormal*thicknessDistortion));float scatteringDot=pow(saturate(dot(geometryViewDir,-scatteringHalf)),thicknessPower)*thicknessScale;#ifdef USE_COLOR\nvec3 scatteringIllu=(scatteringDot+thicknessAmbient)*vColor;#else\nvec3 scatteringIllu=(scatteringDot+thicknessAmbient)*diffuse;#endif\nreflectedLight.directDiffuse+=scatteringIllu*thicknessAttenuation*directLight.color;}void main(){`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', ShaderChunk.lights_fragment_begin.replaceAll('RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );', `RE_Direct(directLight,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);RE_Direct_Scattering(directLight,vUv,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,reflectedLight);`));
    };
  }
}

const U = new Object3D();
let globalPointerActive = false;
const pointerPosition = new Vector2();
const pointerMap = new Map<HTMLElement, any>();

function createPointerData(options: any) {
  const data: any = { position: new Vector2(), nPosition: new Vector2(), hover: false, touching: false, onEnter:()=>{}, onMove:()=>{}, onClick:()=>{}, onLeave:()=>{}, ...options };
  if (!pointerMap.has(options.domElement)) {
    pointerMap.set(options.domElement, data);
    if (!globalPointerActive) {
      document.body.addEventListener('pointermove', onPointerMove as any);
      document.body.addEventListener('pointerleave', onPointerLeave as any);
      document.body.addEventListener('touchstart', onTouchStart as any, { passive: false });
      document.body.addEventListener('touchmove', onTouchMove as any, { passive: false });
      document.body.addEventListener('touchend', onTouchEnd as any);
      globalPointerActive = true;
    }
  }
  data.dispose = () => {
    pointerMap.delete(options.domElement);
    if (pointerMap.size === 0) {
      document.body.removeEventListener('pointermove', onPointerMove as any);
      document.body.removeEventListener('pointerleave', onPointerLeave as any);
      document.body.removeEventListener('touchstart', onTouchStart as any);
      document.body.removeEventListener('touchmove', onTouchMove as any);
      document.body.removeEventListener('touchend', onTouchEnd as any);
      globalPointerActive = false;
    }
  };
  return data;
}

function isInside(rect: DOMRect) { return pointerPosition.x>=rect.left&&pointerPosition.x<=rect.left+rect.width&&pointerPosition.y>=rect.top&&pointerPosition.y<=rect.top+rect.height; }
function updatePointerData(data: any, rect: DOMRect) { data.position.set(pointerPosition.x-rect.left,pointerPosition.y-rect.top); data.nPosition.set((data.position.x/rect.width)*2-1,(-data.position.y/rect.height)*2+1); }
function processPointer() { for(const[elem,data]of pointerMap){const rect=elem.getBoundingClientRect();if(isInside(rect)){updatePointerData(data,rect);if(!data.hover){data.hover=true;data.onEnter(data);}data.onMove(data);}else if(data.hover&&!data.touching){data.hover=false;data.onLeave(data);}}}
function onPointerMove(e:PointerEvent){pointerPosition.set(e.clientX,e.clientY);processPointer();}
function onPointerLeave(){for(const data of pointerMap.values())if(data.hover){data.hover=false;data.onLeave(data);}}
function onTouchStart(e:TouchEvent){if(e.touches.length>0){e.preventDefault();pointerPosition.set(e.touches[0].clientX,e.touches[0].clientY);for(const[elem,data]of pointerMap){const rect=elem.getBoundingClientRect();if(isInside(rect)){data.touching=true;updatePointerData(data,rect);if(!data.hover){data.hover=true;data.onEnter(data);}data.onMove(data);}}}}
function onTouchMove(e:TouchEvent){if(e.touches.length>0){e.preventDefault();pointerPosition.set(e.touches[0].clientX,e.touches[0].clientY);for(const[elem,data]of pointerMap){const rect=elem.getBoundingClientRect();updatePointerData(data,rect);if(isInside(rect)){if(!data.hover){data.hover=true;data.touching=true;data.onEnter(data);}data.onMove(data);}else if(data.hover&&data.touching)data.onMove(data);}}}
function onTouchEnd(){for(const[,data]of pointerMap)if(data.touching){data.touching=false;if(data.hover){data.hover=false;data.onLeave(data);}}}

const DEFAULT_CONFIG = { count:200, colors:[0,0,0], ambientColor:0xffffff, ambientIntensity:1, lightIntensity:200, materialParams:{metalness:0.5,roughness:0.5,clearcoat:1,clearcoatRoughness:0.15}, minSize:0.5, maxSize:1, size0:1, gravity:0.5, friction:0.9975, wallBounce:0.95, maxVelocity:0.15, maxX:5, maxY:5, maxZ:2, controlSphere0:false, followCursor:true };

class Z extends InstancedMesh {
  config: any; physics: W; ambientLight?: AmbientLight; light?: PointLight;
  constructor(renderer: WebGLRenderer, params: any = {}) {
    const config = { ...DEFAULT_CONFIG, ...params };
    const pmrem = new PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment()).texture;
    const material = new Y({ envMap: envTexture, ...config.materialParams });
    material.envMapRotation.x = -Math.PI / 2;
    super(new SphereGeometry(), material, config.count);
    this.config = config; this.physics = new W(config);
    this.ambientLight = new AmbientLight(config.ambientColor, config.ambientIntensity); this.add(this.ambientLight);
    this.light = new PointLight(config.colors[0], config.lightIntensity); this.add(this.light);
    this.setColors(config.colors);
  }
  setColors(colors: number[]) {
    if (!Array.isArray(colors)||colors.length<2) return;
    const objs = colors.map(c => new Color(c));
    const getColor = (ratio: number, out = new Color()) => {
      const clamped = Math.max(0,Math.min(1,ratio)), scaled = clamped*(colors.length-1), idx = Math.floor(scaled);
      const s = objs[idx]; if(idx>=colors.length-1)return s.clone();
      const a = scaled-idx, e = objs[idx+1];
      out.r=s.r+a*(e.r-s.r); out.g=s.g+a*(e.g-s.g); out.b=s.b+a*(e.b-s.b); return out;
    };
    for(let i=0;i<this.count;i++){this.setColorAt(i,getColor(i/this.count));if(i===0)this.light!.color.copy(getColor(0));}
    if(this.instanceColor)this.instanceColor.needsUpdate=true;
  }
  update(di: { delta: number }) {
    this.physics.update(di);
    for(let i=0;i<this.count;i++){
      U.position.fromArray(this.physics.positionData,3*i);
      U.scale.setScalar(i===0&&this.config.followCursor===false?0:this.physics.sizeData[i]);
      U.updateMatrix(); this.setMatrixAt(i,U.matrix);
      if(i===0)this.light!.position.copy(U.position);
    }
    this.instanceMatrix.needsUpdate=true;
  }
}

function createBallpit(canvas: HTMLCanvasElement, config: any = {}) {
  const three = new X({ canvas, size:'parent', rendererOptions:{antialias:true,alpha:true} });
  three.renderer.toneMapping = ACESFilmicToneMapping;
  three.camera.position.set(0,0,20); three.camera.lookAt(0,0,0);
  three.cameraMaxAspect = 1.5; three.resize();
  let spheres = new Z(three.renderer, config);
  three.scene.add(spheres);
  const raycaster = new Raycaster(), plane = new Plane(new Vector3(0,0,1),0), ip = new Vector3();
  const pd = createPointerData({
    domElement: canvas,
    onMove() { raycaster.setFromCamera(pd.nPosition,three.camera); three.camera.getWorldDirection(plane.normal); raycaster.ray.intersectPlane(plane,ip); spheres.physics.center.copy(ip); spheres.config.controlSphere0=true; },
    onLeave() { spheres.config.controlSphere0=false; }
  });
  three.onBeforeRender = di => { spheres.update(di); };
  three.onAfterResize = size => { spheres.config.maxX=size.wWidth/2; spheres.config.maxY=size.wHeight/2; };
  return { three, get spheres(){return spheres;}, dispose(){pd.dispose?.();three.dispose();} };
}

interface BallpitProps {
  className?: string;
  followCursor?: boolean;
  [key: string]: any;
}

const Ballpit: React.FC<BallpitProps> = ({ className = '', followCursor = true, ...props }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<any>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    instanceRef.current = createBallpit(canvasRef.current, { followCursor, ...props });
    return () => { instanceRef.current?.dispose(); };
  }, []);
  return <canvas ref={canvasRef} className={className} style={{ width:'100%', height:'100%' }} />;
};

export default Ballpit;
