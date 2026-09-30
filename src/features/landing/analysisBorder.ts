import * as THREE from 'three';

function roundedPath(width: number, height: number, radius: number) {
  const x = width / 2, y = height / 2, r = radius;
  const path = new THREE.Path();
  path.moveTo(-x + r, y);
  path.lineTo(x - r, y); path.quadraticCurveTo(x, y, x, y - r);
  path.lineTo(x, -y + r); path.quadraticCurveTo(x, -y, x - r, -y);
  path.lineTo(-x + r, -y); path.quadraticCurveTo(-x, -y, -x, -y + r);
  path.lineTo(-x, y - r); path.quadraticCurveTo(-x, y, -x + r, y);
  return path;
}

export function createAnalysisBorderGeometry() {
  const count = 240;
  const outer = roundedPath(3.46, 2.64, 0.08).getSpacedPoints(count);
  const inner = roundedPath(3.32, 2.5, 0.045).getSpacedPoints(count);
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let index = 0; index <= count; index++) {
    positions.push(inner[index].x, inner[index].y, 0, outer[index].x, outer[index].y, 0);
    uv.push(index / count, 0, index / count, 1);
    if (index < count) {
      const start = index * 2;
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  return geometry;
}

export function createAnalysisBorderMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { progress: { value: 0 }, time: { value: 0 }, opacity: { value: 1 } },
    vertexShader: `
      varying vec2 borderUv;
      void main() {
        borderUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float progress;
      uniform float time;
      uniform float opacity;
      varying vec2 borderUv;
      void main() {
        if (borderUv.x > progress || progress <= 0.0) discard;
        float flowing = step(0.75, opacity);
        float tint = 0.5 + 0.5 * sin(6.283185 * (borderUv.x * 1.5 - time * 0.8));
        vec3 color = mix(vec3(0.25, 0.015, 0.72), vec3(0.91, 0.055, 0.44), tint);
        // A train of narrow highlights travels along the revealed edge, with a soft leading tail.
        float pulse = pow(0.5 + 0.5 * cos(6.283185 * (borderUv.x * 4.0 - time * 2.8)), 7.0) * flowing;
        float head = exp(-pow((progress - borderUv.x) / 0.021, 2.0)) * flowing;
        float tail = exp(-max(0.0, progress - borderUv.x) / 0.09) * flowing;
        float core = exp(-pow((borderUv.y - 0.5) / 0.22, 2.0));
        float halo = exp(-pow((borderUv.y - 0.5) / 0.39, 2.0));
        vec3 light = mix(color, vec3(0.98, 0.55, 0.9), min(0.75, pulse * 0.38 + head * 0.62));
        float alpha = (core * 0.86 + halo * 0.26) * (0.84 + pulse * 0.2 + tail * 0.16);
        gl_FragColor = vec4(light, min(1.0, alpha) * opacity);
        #include <colorspace_fragment>
      }
    `,
  });
}
