import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { photos } from './photos';

export interface SceneMotion { progress: number; invalidate?: () => void }

const spread = [
  [-2.05, 1.1, -0.8, -0.15, 0.32, 0.19, 0.86],
  [2.15, 1.28, -1.35, 0.14, -0.35, -0.19, 0.79],
  [0.18, -0.1, 1.1, -0.08, -0.19, -0.1, 1.06],
  [-2, -1.36, -1, 0.18, 0.24, -0.21, 0.77],
  [2.12, -1.3, -0.45, -0.1, -0.3, 0.22, 0.81],
];
// All layers share a tilt, with enough depth between them to keep their faces apart.
const stackPoses = [
  [0, -0.12, 1.35, -0.02, -0.06, -0.025, 1.08],
  [-0.48, 0.14, 0.68, -0.02, -0.06, 0.055, 1.01],
  [0.5, 0.3, 0.34, -0.02, -0.06, -0.07, 0.99],
  [-0.69, 0.46, 0, -0.02, -0.06, 0.095, 0.97],
  [0.75, 0.62, -0.34, -0.02, -0.06, -0.085, 0.95],
];
const initialOrder = [2, 4, 0, 3, 1];
const blendPose = (from: number[], to: number[], progress: number) =>
  from.map((value, axis) => THREE.MathUtils.lerp(value, to[axis], progress));
const ease = (progress: number) => THREE.MathUtils.smoothstep(progress, 0, 1);

interface PhotoTransition {
  index: number;
  time: number;
  from: number[][];
  order: number[];
  out: number[];
  lifted: number[];
}

function captionTexture(index: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 768; canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#667080'; context.font = '20px sans-serif';
  context.fillText(photos[index].caption, 14, 40);
  context.fillStyle = '#5264ca'; context.font = '17px monospace';
  context.fillText(`0${index + 1}`, 712, 40);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function PhotoScene({ motion }: { motion: MutableRefObject<SceneMotion> }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [selected, setSelected] = useState(2);
  const [kept, setKept] = useState<number[]>([]);
  const choices = useRef({ selected: 2, kept: [] as number[], touched: false });

  useEffect(() => {
    choices.current.selected = selected;
    choices.current.kept = kept;
    motion.current.invalidate?.();
  }, [selected, kept, motion]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const state = motion.current;
    const selection = choices.current;
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      setInteractive(true);
      return;
    }
    const compact = window.matchMedia('(max-width: 900px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 50);
    camera.position.set(0, 0, 12.6);
    const group = new THREE.Group();
    scene.add(group);
    scene.add(new THREE.HemisphereLight(0xf4f6ff, 0xb6b6c5, 2.7));
    const key = new THREE.DirectionalLight(0xffffff, 3.3);
    key.position.set(-3, 5, 8); scene.add(key);
    const fill = new THREE.DirectionalLight(0xdce4ff, 1.5);
    fill.position.set(5, -2, 3); scene.add(fill);

    const textures: THREE.Texture[] = [];
    const geometry = new RoundedBoxGeometry(3.4, 2.58, 0.09, 2, 0.055);
    const imageGeometry = new THREE.PlaneGeometry(3.18, 2.12);
    const captionGeometry = new THREE.PlaneGeometry(3.18, 0.25);
    const loader = new THREE.TextureLoader();
    let loaded = 0;
    const papers: THREE.MeshStandardMaterial[] = [];
    const cards = photos.map((photo, index) => {
      const card = new THREE.Group();
      card.userData.photoIndex = index;
      const paper = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.02 });
      papers.push(paper); card.add(new THREE.Mesh(geometry, paper));
      const texture = loader.load(photo.src, () => {
        if (disposed) { texture.dispose(); return; }
        loaded += 1;
        if (loaded === photos.length) setReady(true);
        start();
      }, undefined, () => { /* Keep the static photo preview on failed texture loads. */ });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      textures.push(texture);
      const image = new THREE.Mesh(imageGeometry, new THREE.MeshBasicMaterial({ map: texture }));
      image.position.set(0, 0.1, 0.052); card.add(image);
      const caption = captionTexture(index); textures.push(caption);
      const label = new THREE.Mesh(captionGeometry, new THREE.MeshBasicMaterial({ map: caption, transparent: true }));
      label.position.set(0, -1.115, 0.054); card.add(label);
      card.position.set(...spread[index].slice(0, 3) as [number, number, number]);
      card.rotation.set(...spread[index].slice(3, 6) as [number, number, number]);
      card.scale.setScalar(spread[index][6]);
      group.add(card);
      return card;
    });

    const pointer = new THREE.Vector2();
    const smoothed = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const rayPointer = new THREE.Vector2();
    const down = new THREE.Vector2();
    const white = new THREE.Color(0xffffff), keepColor = new THREE.Color(0xdcf1e6);
    const review = element.parentElement?.querySelector('.landing-photo-review');
    const poses = spread.map(pose => [...pose]);
    let order = [...initialOrder];
    let transition: PhotoTransition | null = null;
    let baseCameraZ = 12.6;
    let activity = 0;
    let hover = -1;
    let canReview = false;
    let visible = true;
    let frame = 0;
    let lastTime = 0;
    let elapsed = 0;
    let lastDraw = 0;
    let lastHoverCheck = 0;
    let contextLost = false;

    const resize = () => {
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact.matches ? 1.4 : 1.8));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      baseCameraZ = Math.max(12.6, 11.7 / camera.aspect);
      camera.position.z = baseCameraZ;
      camera.updateProjectionMatrix();
      start();
    };
    const hitPhoto = (event: PointerEvent) => {
      if (!canReview || loaded !== photos.length) return -1;
      const bounds = element.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return -1;
      rayPointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      scene.updateMatrixWorld(); raycaster.setFromCamera(rayPointer, camera);
      const hit = raycaster.intersectObjects(cards, true)[0];
      return hit ? Number(hit.object.parent?.userData.photoIndex ?? -1) : -1;
    };
    const onPointer = (event: PointerEvent) => {
      if (!finePointer.matches || reduced.matches || event.pointerType === 'touch') return;
      // The whole viewport drives parallax, including the account form and page margins.
      pointer.set(event.clientX / window.innerWidth * 2 - 1, event.clientY / window.innerHeight * 2 - 1);
      if (event.timeStamp - lastHoverCheck > 40) {
        lastHoverCheck = event.timeStamp; hover = hitPhoto(event);
        renderer.domElement.style.cursor = hover >= 0 ? 'pointer' : 'default';
      }
      start();
    };
    const resetPointer = () => { pointer.set(0, 0); hover = -1; start(); };
    const onDown = (event: PointerEvent) => down.set(event.clientX, event.clientY);
    const onPick = (event: PointerEvent) => {
      if (event.button !== 0 || down.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 8) return;
      const index = hitPhoto(event);
      if (index >= 0) { selection.touched = true; selection.selected = index; setSelected(index); start(); }
    };

    function render(time: number) {
      frame = 0;
      if (disposed || contextLost || document.hidden || !visible) return;
      if (compact.matches && !reduced.matches && time - lastDraw < 32) { frame = requestAnimationFrame(render); return; }
      const delta = Math.min((time - lastTime) / 1000 || 0.016, 0.05);
      lastTime = time; lastDraw = time; elapsed += delta;
      const progress = reduced.matches ? 1 : state.progress;
      const nextInteractive = compact.matches || reduced.matches || progress >= 0.9;
      if (canReview !== nextInteractive) { canReview = nextInteractive; setInteractive(canReview); }
      const stack = selection.touched && canReview ? 1 : THREE.MathUtils.smoothstep(progress, 0.06, compact.matches ? 0.78 : 0.88);
      const damping = reduced.matches ? 1 : 1 - Math.exp(-delta * 11);
      if (reduced.matches) pointer.set(0, 0);
      smoothed.lerp(pointer, damping);
      group.rotation.set(-smoothed.y * 0.18, smoothed.x * 0.3, smoothed.x * 0.035);
      const sceneScale = compact.matches ? 0.82 : 1;
      group.scale.setScalar(sceneScale);

      // Scroll reversal takes back control smoothly; reduced motion has no extraction path.
      if ((!canReview || reduced.matches) && transition) {
        order = transition.order;
        transition = null;
      }
      if (reduced.matches && order[0] !== selection.selected) {
        order = [selection.selected, ...order.filter(index => index !== selection.selected)];
      }
      const settled = poses.every((pose, index) => pose.every((value, axis) => Math.abs(value - stackPoses[order.indexOf(index)][axis]) < 0.025));
      if (!reduced.matches && canReview && stack === 1 && !transition && settled && order[0] !== selection.selected) {
        const index = selection.selected;
        const from = poses.map(pose => [...pose]);
        const side = from[index][0] < 0 ? -1 : 1;
        transition = {
          index, time: 0, from,
          order: [index, ...order.filter(photo => photo !== index)],
          out: [side * 3.6, from[index][1] + 0.1, from[index][2], -0.02, -0.06, side * 0.08, from[index][6]],
          lifted: [side * 3.6, 0.22, 2.25, -0.02, -0.06, side * 0.05, 1.03],
        };
      }
      const active = !!transition || hover >= 0 || !!review?.contains(document.activeElement);
      activity = THREE.MathUtils.lerp(activity, active ? 1 : 0, damping);
      const stackFloat = reduced.matches ? 0 : Math.sin(elapsed * 0.9) * 0.09 * stack * (1 - activity * 0.82);
      group.position.set(smoothed.x * 0.2, -smoothed.y * 0.14 + stackFloat - stack * 0.18, 0);
      // Make room before the print clears the stack, including on narrow desktop screens.
      const extractionRoom = Math.max(1.6, 2.25 * sceneScale + (5.5 * sceneScale + 0.3)
        / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect) - baseCameraZ);
      const cameraRoom = transition ? extractionRoom * ease(transition.time / 0.22) * (1 - ease((transition.time - 0.6) / 0.4)) : 0;
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, baseCameraZ + cameraRoom, damping);
      if (transition) transition.time = Math.min(1, transition.time + delta / 1.02);
      let moving = false;
      cards.forEach((card, index) => {
        let target: number[];
        if (transition) {
          const { time: t, from, out, lifted } = transition;
          const end = stackPoses[transition.order.indexOf(index)];
          if (index === transition.index) {
            // First clear the other prints sideways, then cross their depth, then settle on top.
            target = t < 0.34 ? blendPose(from[index], out, ease(t / 0.34))
              : t < 0.58 ? blendPose(out, lifted, ease((t - 0.34) / 0.24))
              : blendPose(lifted, end, ease((t - 0.58) / 0.42));
          } else {
            target = blendPose(from[index], end, ease((t - 0.34) / 0.5));
          }
          poses[index] = target;
        } else {
          // Separate ranges let each card arrive a little later without switching layouts.
          const rank = initialOrder.indexOf(index);
          const gather = THREE.MathUtils.smoothstep(stack, rank * 0.025, 1);
          target = blendPose(spread[index], stackPoses[order.indexOf(index)], gather);
          moving ||= poses[index].some((value, axis) => Math.abs(value - target[axis]) > 0.001);
          poses[index] = blendPose(poses[index], target, damping);
        }
        const pose = poses[index];
        const floating = reduced.matches ? 0 : Math.sin(elapsed * 0.9 + index * 1.4) * 0.18 * (1 - stack);
        // Hover exposes the edge a little further instead of crossing adjacent depth layers.
        const edge = canReview && !transition && hover === index && index !== order[0] ? 0.08 : 0;
        const offset = card.userData.edgeOffset = THREE.MathUtils.lerp(card.userData.edgeOffset ?? 0, edge, damping);
        card.position.set(pose[0] + Math.sign(pose[0]) * offset, pose[1] + floating + offset * 0.5, pose[2]);
        card.rotation.set(pose[3], pose[4], pose[5] + (reduced.matches ? 0 : Math.sin(elapsed * 0.7 + index) * 0.025 * (1 - stack)));
        card.scale.setScalar(pose[6]);
        papers[index].color.lerp(selection.kept.includes(index) ? keepColor : white, damping);
      });
      if (transition?.time === 1) {
        order = transition.order;
        transition = null;
      }
      renderer.render(scene, camera);
      // Float only while visible. Reduced motion renders on demand and changes poses immediately.
      if (!reduced.matches || moving) frame = requestAnimationFrame(render);
    }
    function start() { if (!frame && !disposed && !contextLost && visible && !document.hidden) frame = requestAnimationFrame(render); }
    state.invalidate = start;
    const onContextLost = () => { if (!disposed) { contextLost = true; cancelAnimationFrame(frame); frame = 0; setReady(false); setInteractive(true); } };
    const onContextRestored = () => { if (!disposed) { contextLost = false; setReady(loaded === photos.length); start(); } };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else { lastTime = 0; start(); }
    };
    const observer = new ResizeObserver(resize); observer.observe(element);
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) { lastTime = 0; start(); }
      else { cancelAnimationFrame(frame); frame = 0; }
    });
    intersection.observe(element);
    document.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('pointerleave', resetPointer);
    window.addEventListener('blur', resetPointer);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onPick);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('scroll', start, { passive: true });
    reduced.addEventListener('change', resize); compact.addEventListener('change', resize);
    resize();

    return () => {
      disposed = true;
      if (state.invalidate === start) delete state.invalidate;
      cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      document.removeEventListener('pointermove', onPointer);
      document.removeEventListener('pointerleave', resetPointer);
      window.removeEventListener('blur', resetPointer);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onPick);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', start);
      reduced.removeEventListener('change', resize); compact.removeEventListener('change', resize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      geometry.dispose(); imageGeometry.dispose(); captionGeometry.dispose();
      cards.forEach(card => card.traverse(object => {
        if (object instanceof THREE.Mesh) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      }));
      textures.forEach(texture => texture.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [motion]);

  function choose(index: number) {
    choices.current.touched = true;
    setSelected(index);
  }
  const isKept = kept.includes(selected);
  return <div className="landing-photo-experience" data-interactive={interactive}>
    <div ref={host} className="landing-scene" data-ready={ready} aria-hidden="true">
      <div className="landing-photo-fallback">
        <img src={photos[(selected + 4) % 5].src} alt="" /><img src={photos[(selected + 1) % 5].src} alt="" /><img src={photos[selected].src} alt="" />
      </div>
    </div>
    <div className="landing-photo-review" inert={!interactive} aria-hidden={!interactive}>
      <p className="landing-review-status" aria-live="polite"><span>试试选片 · {photos[selected].title}</span><span>已保留 {kept.length} 张</span></p>
      <div className="landing-photo-actions">
        <div className="landing-photo-picker" role="group" aria-label="选择一张模拟照片">
          {photos.map((photo, index) => <button key={photo.title} type="button" aria-label={`查看${photo.title}`} aria-pressed={selected === index}
            onClick={() => choose(index)} onKeyDown={event => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const next = (index + (event.key === 'ArrowRight' ? 1 : 4)) % 5;
              choose(next);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
            }}><img src={photo.src} alt="" />{kept.includes(index) && <span><Check size={10} /></span>}</button>)}
        </div>
        <button className="landing-keep-photo" type="button" aria-pressed={isKept} onClick={() => setKept(current => current.includes(selected) ? current.filter(index => index !== selected) : [...current, selected])}>
          <Check size={14} />{isKept ? '取消保留' : '保留这张'}
        </button>
        <button className="landing-reset-photos" type="button" aria-label="重置模拟选片" onClick={() => { setKept([]); choose(2); }}><RotateCcw size={14} /></button>
      </div>
      <p className="landing-review-hint">点露出的照片边缘或缩略图，将喜欢的画面抽到最前。仅为互动演示。</p>
    </div>
  </div>;
}
