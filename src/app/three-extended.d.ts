// src/app/three-extended.d.ts
declare module "three/examples/jsm/controls/OrbitControls" {
  import { Camera, EventDispatcher } from "three";

  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    enablePan: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
    update(): void;
    dispose(): void;
    // Add more as you use them
  }
}