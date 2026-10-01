import * as THREE from 'three';

export interface GameState {
  fps: number;
  score: number;
  opponentScore: number;
  boost: number;
  speed: number;
  mode: 'menu' | 'playing' | 'gameover';
  time: number;
  goalFlash: number;
}

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private container: HTMLElement;

  // Game objects
  private playerCar: THREE.Group;
  private playerVelocity: THREE.Vector3;
  private playerRotation: number = 0;
  private ball: THREE.Group;
  private ballVelocity: THREE.Vector3;
  private opponentCar: THREE.Group;
  private opponentVelocity: THREE.Vector3;

  // Controls
  private keys: { [key: string]: boolean } = {};

  // Game state
  private state: GameState;
  private onStateChange: (state: GameState) => void;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private animationId: number = 0;

  // Physics
  private gravity: number = -30;
  private arenaLength: number = 120;
  private arenaWidth: number = 70;

  // Environment animation
  private waterMesh: THREE.Mesh | null = null;
  private clouds: THREE.Group[] = [];

  constructor(container: HTMLElement, onStateChange: (state: GameState) => void) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.clock = new THREE.Clock();

    this.state = {
      fps: 0, score: 0, opponentScore: 0,
      boost: 100, speed: 0, mode: 'menu', time: 180, goalFlash: 0
    };

    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 12, 20);

    // Renderer - high quality
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // Init objects
    this.playerCar = new THREE.Group();
    this.playerVelocity = new THREE.Vector3();
    this.ball = new THREE.Group();
    this.ballVelocity = new THREE.Vector3();
    this.opponentCar = new THREE.Group();
    this.opponentVelocity = new THREE.Vector3();

    this.setupEnvironment();
    this.setupLights();
    this.createArena();
    this.createRealisticCar(0xcc0000, this.playerCar);
    this.createRealisticCar(0x0044cc, this.opponentCar);
    this.opponentCar.position.set(20, 0, 0);
    this.opponentCar.rotation.y = Math.PI;
    this.scene.add(this.opponentCar);
    this.playerCar.position.set(-20, 0, 0);
    this.scene.add(this.playerCar);
    this.createRealisticBall();
    this.setupControls();

    window.addEventListener('resize', this.onResize.bind(this));
  }

  private setupEnvironment(): void {
    // Sky gradient
    const skyGeo = new THREE.SphereGeometry(400, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0055aa) },
        bottomColor: { value: new THREE.Color(0x88ccff) },
        offset: { value: 20 },
        exponent: { value: 0.4 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // Fog
    this.scene.fog = new THREE.FogExp2(0x88bbdd, 0.003);

    // Terrain - realistic with noise
    this.createRealisticTerrain();

    // Water lake
    this.createWater();

    // Realistic trees
    this.createForest();

    // Mountains
    this.createMountains();

    // Clouds
    this.createClouds();

    // Rocks
    this.createRocks();
  }

  private createRealisticTerrain(): void {
    const size = 500;
    const segments = 128;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const vertices = geo.attributes.position;

    // Procedural terrain with multiple octaves of noise
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const y = vertices.getY(i);
      const dist = Math.sqrt(x * x + y * y);

      let height = 0;
      // Keep arena flat
      if (dist < this.arenaLength * 0.8) {
        height = 0;
      } else {
        // Gentle hills outside arena
        height = Math.sin(x * 0.02) * Math.cos(y * 0.02) * 5;
        height += Math.sin(x * 0.05 + 1.3) * Math.cos(y * 0.04) * 2;
        height += Math.sin(x * 0.1) * Math.sin(y * 0.1) * 1;
        // Ramp up for mountains
        const mountainDist = Math.max(0, dist - 150);
        height += mountainDist * 0.15 * (Math.sin(x * 0.03) * 0.5 + 0.5);
      }
      vertices.setZ(i, height);
    }
    geo.computeVertexNormals();

    // Grass texture via vertex colors
    const colors = new Float32Array(vertices.count * 3);
    for (let i = 0; i < vertices.count; i++) {
      const y = vertices.getZ(i);
      const x = vertices.getX(i);
      const z = vertices.getY(i);
      // Vary green based on position
      const noise = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.1;
      if (y > 10) {
        // Snow
        colors[i * 3] = 0.9 + noise * 0.1;
        colors[i * 3 + 1] = 0.92 + noise * 0.1;
        colors[i * 3 + 2] = 0.95;
      } else if (y > 5) {
        // Rock
        colors[i * 3] = 0.4 + noise;
        colors[i * 3 + 1] = 0.38 + noise;
        colors[i * 3 + 2] = 0.35;
      } else {
        // Grass with variation
        const grassVar = Math.sin(x * 0.3 + z * 0.2) * 0.05;
        colors[i * 3] = 0.15 + grassVar;
        colors[i * 3 + 1] = 0.45 + grassVar + noise;
        colors[i * 3 + 2] = 0.1 + grassVar;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: false
    });

    const terrain = new THREE.Mesh(geo, mat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    this.scene.add(terrain);
  }

  private createWater(): void {
    const waterGeo = new THREE.CircleGeometry(40, 32);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x006699,
      metalness: 0.1,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
      transmission: 0.3,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(100, -1, -80);
    this.scene.add(this.waterMesh);
  }

  private createForest(): void {
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 150;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Don't place in water area
      if (Math.sqrt((x - 100) ** 2 + (z + 80) ** 2) < 45) continue;

      const tree = this.createRealisticTree();
      const scale = 0.8 + Math.random() * 1.2;
      tree.scale.set(scale, scale, scale);
      tree.position.set(x, 0, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(tree);
    }
  }

  private createRealisticTree(): THREE.Group {
    const tree = new THREE.Group();

    // Trunk - tapered cylinder
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 4, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4a3520,
      roughness: 0.95,
      metalness: 0.0
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // Foliage - multiple spheres for realistic look
    const foliageColors = [0x2d5a1b, 0x3a6b24, 0x2a5018, 0x4a7a30];
    const foliagePositions = [
      { x: 0, y: 5, z: 0, r: 2.2 },
      { x: 0.8, y: 5.5, z: 0.5, r: 1.5 },
      { x: -0.6, y: 5.8, z: -0.4, r: 1.6 },
      { x: 0.3, y: 6.5, z: -0.3, r: 1.3 },
      { x: -0.4, y: 4.5, z: 0.7, r: 1.4 },
    ];

    foliagePositions.forEach((pos, i) => {
      const fGeo = new THREE.SphereGeometry(pos.r, 8, 8);
      const fMat = new THREE.MeshStandardMaterial({
        color: foliageColors[i % foliageColors.length],
        roughness: 0.8,
        metalness: 0.0,
        flatShading: true
      });
      const foliage = new THREE.Mesh(fGeo, fMat);
      foliage.position.set(pos.x, pos.y, pos.z);
      foliage.castShadow = true;
      tree.add(foliage);
    });

    return tree;
  }

  private createMountains(): void {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 200 + Math.random() * 80;
      const height = 40 + Math.random() * 50;
      const radius = 30 + Math.random() * 20;

      const mtGeo = new THREE.ConeGeometry(radius, height, 8);
      // Deform vertices for realism
      const verts = mtGeo.attributes.position;
      for (let j = 0; j < verts.count; j++) {
        const vx = verts.getX(j);
        const vy = verts.getY(j);
        const vz = verts.getZ(j);
        verts.setX(j, vx + (Math.random() - 0.5) * 5);
        verts.setZ(j, vz + (Math.random() - 0.5) * 5);
      }
      mtGeo.computeVertexNormals();

      const mtMat = new THREE.MeshStandardMaterial({
        color: 0x556644,
        roughness: 0.9,
        flatShading: true
      });
      const mountain = new THREE.Mesh(mtGeo, mtMat);
      mountain.position.set(Math.cos(angle) * dist, height / 2 - 5, Math.sin(angle) * dist);
      mountain.castShadow = true;
      this.scene.add(mountain);

      // Snow cap
      if (height > 50) {
        const snowGeo = new THREE.ConeGeometry(radius * 0.3, height * 0.2, 8);
        const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
        const snow = new THREE.Mesh(snowGeo, snowMat);
        snow.position.set(mountain.position.x, mountain.position.y + height * 0.4, mountain.position.z);
        this.scene.add(snow);
      }
    }
  }

  private createClouds(): void {
    for (let i = 0; i < 20; i++) {
      const cloud = this.createCloud();
      cloud.position.set(
        (Math.random() - 0.5) * 400,
        50 + Math.random() * 40,
        (Math.random() - 0.5) * 400
      );
      cloud.scale.setScalar(1 + Math.random() * 2);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  private createCloud(): THREE.Group {
    const cloud = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      transparent: true,
      opacity: 0.85
    });

    const numPuffs = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < numPuffs; i++) {
      const size = 3 + Math.random() * 5;
      const geo = new THREE.SphereGeometry(size, 8, 8);
      const puff = new THREE.Mesh(geo, mat);
      puff.position.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 6
      );
      puff.scale.y = 0.6;
      cloud.add(puff);
    }
    return cloud;
  }

  private createRocks(): void {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 100;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      const rockGeo = new THREE.DodecahedronGeometry(1 + Math.random() * 2, 1);
      const verts = rockGeo.attributes.position;
      for (let j = 0; j < verts.count; j++) {
        verts.setX(j, verts.getX(j) + (Math.random() - 0.5) * 0.3);
        verts.setY(j, verts.getY(j) + (Math.random() - 0.5) * 0.3);
        verts.setZ(j, verts.getZ(j) + (Math.random() - 0.5) * 0.3);
      }
      rockGeo.computeVertexNormals();

      const rockMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.3 + Math.random() * 0.2, 0.3 + Math.random() * 0.1, 0.25),
        roughness: 0.95,
        flatShading: true
      });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, 0.5, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.y = 0.5 + Math.random() * 0.5;
      rock.castShadow = true;
      this.scene.add(rock);
    }
  }

  private setupLights(): void {
    // Ambient
    const ambient = new THREE.AmbientLight(0x445566, 0.4);
    this.scene.add(ambient);

    // Sun
    const sun = new THREE.DirectionalLight(0xffeedd, 1.8);
    sun.position.set(60, 100, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);

    // Fill light
    const fill = new THREE.DirectionalLight(0x8899bb, 0.3);
    fill.position.set(-30, 20, -20);
    this.scene.add(fill);

    // Hemisphere
    const hemi = new THREE.HemisphereLight(0x88bbff, 0x445522, 0.5);
    this.scene.add(hemi);

    // Arena spotlights
    const spotL = new THREE.SpotLight(0xff4400, 2, 80, Math.PI / 4, 0.5);
    spotL.position.set(-this.arenaLength * 0.8, 30, 0);
    spotL.target.position.set(0, 0, 0);
    this.scene.add(spotL);
    this.scene.add(spotL.target);

    const spotR = new THREE.SpotLight(0x0044ff, 2, 80, Math.PI / 4, 0.5);
    spotR.position.set(this.arenaLength * 0.8, 30, 0);
    spotR.target.position.set(0, 0, 0);
    this.scene.add(spotR);
    this.scene.add(spotR.target);
  }

  private createArena(): void {
    // Arena floor - smooth dark surface
    const floorGeo = new THREE.PlaneGeometry(this.arenaLength * 2, this.arenaWidth * 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.3,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Arena lines
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Center line
    const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(0.3, this.arenaWidth * 2), lineMat);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = 0.02;
    this.scene.add(centerLine);

    // Center circle
    const circleGeo = new THREE.RingGeometry(10, 10.3, 48);
    const circle = new THREE.Mesh(circleGeo, lineMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.02;
    this.scene.add(circle);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x333355,
      roughness: 0.5,
      metalness: 0.3,
      transparent: true,
      opacity: 0.6
    });

    // Side walls
    const sideWallGeo = new THREE.BoxGeometry(this.arenaLength * 2, 10, 1);
    const wallL = new THREE.Mesh(sideWallGeo, wallMat);
    wallL.position.set(0, 5, -this.arenaWidth);
    this.scene.add(wallL);
    const wallR = new THREE.Mesh(sideWallGeo, wallMat);
    wallR.position.set(0, 5, this.arenaWidth);
    this.scene.add(wallR);

    // Back walls with goal openings
    const backSideGeo = new THREE.BoxGeometry((this.arenaLength - 15), 10, 1);
    const bwL1 = new THREE.Mesh(backSideGeo, wallMat);
    bwL1.position.set(-(this.arenaLength / 2 + 7.5), 5, 0);
    bwL1.rotation.y = Math.PI / 2;
    this.scene.add(bwL1);
    const bwR1 = new THREE.Mesh(backSideGeo, wallMat);
    bwR1.position.set((this.arenaLength / 2 + 7.5), 5, 0);
    bwR1.rotation.y = Math.PI / 2;
    this.scene.add(bwR1);

    // Goal frames
    this.createGoalFrame(-this.arenaLength, 0xff4400);
    this.createGoalFrame(this.arenaLength, 0x0066ff);

    // Goal nets (simple representation)
    const netMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      wireframe: true
    });
    const netGeo = new THREE.BoxGeometry(5, 8, 20);
    const netL = new THREE.Mesh(netGeo, netMat);
    netL.position.set(-this.arenaLength - 2.5, 4, 0);
    this.scene.add(netL);
    const netR = new THREE.Mesh(netGeo, netMat);
    netR.position.set(this.arenaLength + 2.5, 4, 0);
    this.scene.add(netR);
  }

  private createGoalFrame(x: number, color: number): void {
    const frameMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2
    });

    // Posts
    const postGeo = new THREE.CylinderGeometry(0.3, 0.3, 8, 8);
    const postL = new THREE.Mesh(postGeo, frameMat);
    postL.position.set(x, 4, -10);
    this.scene.add(postL);
    const postR = new THREE.Mesh(postGeo, frameMat);
    postR.position.set(x, 4, 10);
    this.scene.add(postR);

    // Crossbar
    const crossGeo = new THREE.CylinderGeometry(0.3, 0.3, 20, 8);
    const cross = new THREE.Mesh(crossGeo, frameMat);
    cross.position.set(x, 8, 0);
    cross.rotation.x = Math.PI / 2;
    this.scene.add(cross);

    // Glow light
    const goalLight = new THREE.PointLight(color, 2, 20);
    goalLight.position.set(x, 4, 0);
    this.scene.add(goalLight);
  }

  private createRealisticCar(color: number, group: THREE.Group): void {
    // === ROCKET LEAGUE STYLE CAR ===
    // Sleek, low-profile sports car

    const carBody = new THREE.Group();

    // Main body - low and wide
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-2.2, 0.3);
    bodyShape.lineTo(-2.0, 0.3);
    bodyShape.lineTo(-1.5, 0.8);
    bodyShape.lineTo(1.2, 0.8);
    bodyShape.lineTo(2.0, 0.5);
    bodyShape.lineTo(2.2, 0.3);
    bodyShape.lineTo(-2.2, 0.3);

    const extrudeSettings = { depth: 1.8, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 };
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.7,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.z = -0.9;
    body.castShadow = true;
    carBody.add(body);

    // Cabin/roof
    const cabinGeo = new THREE.BoxGeometry(1.8, 0.5, 1.4);
    const cabinMat = new THREE.MeshPhysicalMaterial({
      color: 0x111122,
      metalness: 0.1,
      roughness: 0.0,
      transmission: 0.6,
      transparent: true,
      opacity: 0.7,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(-0.2, 1.05, 0);
    cabin.castShadow = true;
    carBody.add(cabin);

    // Windshield slope
    const windshieldGeo = new THREE.BoxGeometry(0.1, 0.5, 1.4);
    const windshieldMat = new THREE.MeshPhysicalMaterial({
      color: 0x334466,
      metalness: 0.0,
      roughness: 0.0,
      transmission: 0.8,
      transparent: true,
      opacity: 0.5,
    });
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    windshield.position.set(0.7, 1.0, 0);
    windshield.rotation.z = -0.4;
    carBody.add(windshield);

    // Spoiler
    const spoilerGeo = new THREE.BoxGeometry(0.3, 0.08, 1.8);
    const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.3 });
    const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
    spoiler.position.set(-2.0, 1.0, 0);
    carBody.add(spoiler);
    // Spoiler supports
    const supportGeo = new THREE.BoxGeometry(0.08, 0.3, 0.08);
    const supL = new THREE.Mesh(supportGeo, spoilerMat);
    supL.position.set(-2.0, 0.85, -0.6);
    carBody.add(supL);
    const supR = new THREE.Mesh(supportGeo, spoilerMat);
    supR.position.set(-2.0, 0.85, 0.6);
    carBody.add(supR);

    // Headlights
    const headlightGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffcc,
      emissive: 0xffffaa,
      emissiveIntensity: 1.0
    });
    const hlL = new THREE.Mesh(headlightGeo, headlightMat);
    hlL.position.set(2.1, 0.55, -0.5);
    carBody.add(hlL);
    const hlR = new THREE.Mesh(headlightGeo, headlightMat);
    hlR.position.set(2.1, 0.55, 0.5);
    carBody.add(hlR);

    // Tail lights
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.5
    });
    const tlL = new THREE.Mesh(headlightGeo, tailMat);
    tlL.position.set(-2.15, 0.55, -0.5);
    carBody.add(tlL);
    const tlR = new THREE.Mesh(headlightGeo, tailMat);
    tlR.position.set(-2.15, 0.55, 0.5);
    carBody.add(tlR);

    // Wheels - realistic with rims
    const wheelPositions = [
      { x: 1.4, z: -1.0 }, { x: 1.4, z: 1.0 },
      { x: -1.4, z: -1.0 }, { x: -1.4, z: 1.0 }
    ];

    wheelPositions.forEach(pos => {
      const wheel = this.createWheel();
      wheel.position.set(pos.x, 0.35, pos.z);
      carBody.add(wheel);
    });

    // Underbody
    const underGeo = new THREE.BoxGeometry(4.2, 0.1, 1.8);
    const underMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const under = new THREE.Mesh(underGeo, underMat);
    under.position.y = 0.25;
    carBody.add(under);

    // Boost flame
    const flameGeo = new THREE.ConeGeometry(0.2, 2, 8);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(-3.2, 0.5, 0);
    flame.rotation.z = Math.PI / 2;
    carBody.add(flame);
    carBody.userData.flame = flame;

    // Inner flame
    const innerFlameGeo = new THREE.ConeGeometry(0.1, 1.2, 8);
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0
    });
    const innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat);
    innerFlame.position.set(-2.8, 0.5, 0);
    innerFlame.rotation.z = Math.PI / 2;
    carBody.add(innerFlame);
    carBody.userData.innerFlame = innerFlame;

    group.add(carBody);
    group.userData.body = carBody;
  }

  private createWheel(): THREE.Group {
    const wheel = new THREE.Group();

    // Tire
    const tireGeo = new THREE.TorusGeometry(0.35, 0.15, 8, 16);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.y = Math.PI / 2;
    wheel.add(tire);

    // Rim
    const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 8);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    wheel.add(rim);

    // Rim spokes
    for (let i = 0; i < 5; i++) {
      const spokeGeo = new THREE.BoxGeometry(0.04, 0.22, 0.04);
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      const angle = (i / 5) * Math.PI * 2;
      spoke.position.set(Math.cos(angle) * 0.12, 0, Math.sin(angle) * 0.12);
      spoke.rotation.x = angle;
      wheel.add(spoke);
    }

    return wheel;
  }

  private createRealisticBall(): void {
    this.ball = new THREE.Group();

    // Main sphere
    const ballGeo = new THREE.SphereGeometry(2, 32, 32);
    const ballMat = new THREE.MeshPhysicalMaterial({
      color: 0xeeeeee,
      metalness: 0.0,
      roughness: 0.3,
      clearcoat: 0.5,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    this.ball.add(ballMesh);

    // Pentagon pattern
    const pentGeo = new THREE.CircleGeometry(0.7, 5);
    const pentMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });

    // Place pentagons at icosahedron vertices
    const icoGeo = new THREE.IcosahedronGeometry(2.01, 0);
    const icoVerts = icoGeo.attributes.position;
    const placed: THREE.Vector3[] = [];

    for (let i = 0; i < icoVerts.count; i++) {
      const v = new THREE.Vector3(icoVerts.getX(i), icoVerts.getY(i), icoVerts.getZ(i));
      // Check distance from already placed
      let tooClose = false;
      for (const p of placed) {
        if (v.distanceTo(p) < 1.5) { tooClose = true; break; }
      }
      if (!tooClose) {
        const pent = new THREE.Mesh(pentGeo, pentMat);
        pent.position.copy(v);
        pent.lookAt(0, 0, 0);
        this.ball.add(pent);
        placed.push(v);
      }
    }

    this.ball.position.set(0, 2, 0);
    this.scene.add(this.ball);
  }

  private setupControls(): void {
    document.addEventListener('keydown', (e) => { this.keys[e.key.toLowerCase()] = true; });
    document.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
  }

  private onResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  startGame(): void {
    this.state = {
      fps: this.state.fps, score: 0, opponentScore: 0,
      boost: 100, speed: 0, mode: 'playing', time: 180, goalFlash: 0
    };
    this.resetPositions();
    this.onStateChange({ ...this.state });
  }

  private resetPositions(): void {
    this.playerCar.position.set(-20, 0, 0);
    this.playerCar.rotation.y = 0;
    this.playerVelocity.set(0, 0, 0);
    this.playerRotation = 0;
    this.opponentCar.position.set(20, 0, 0);
    this.opponentCar.rotation.y = Math.PI;
    this.opponentVelocity.set(0, 0, 0);
    this.ball.position.set(0, 2, 0);
    this.ballVelocity.set(0, 0, 0);
  }

  private updatePlayer(delta: number): void {
    const speed = 35;
    const turnSpeed = 2.2;
    let isBoosting = false;

    if (this.keys['shift'] && this.state.boost > 0) {
      isBoosting = true;
      this.state.boost = Math.max(0, this.state.boost - 30 * delta);
    } else {
      this.state.boost = Math.min(100, this.state.boost + 5 * delta);
    }

    const actualSpeed = isBoosting ? speed * 1.8 : speed;

    // Show boost flames
    const body = this.playerCar.userData.body;
    if (body) {
      const flame = body.userData.flame;
      const innerFlame = body.userData.innerFlame;
      if (flame) (flame.material as THREE.MeshBasicMaterial).opacity = isBoosting && (this.keys['w'] || this.keys['arrowup']) ? 0.9 : 0;
      if (innerFlame) (innerFlame.material as THREE.MeshBasicMaterial).opacity = isBoosting && (this.keys['w'] || this.keys['arrowup']) ? 0.8 : 0;
    }

    // Acceleration
    if (this.keys['w'] || this.keys['arrowup']) {
      this.playerVelocity.x += Math.cos(this.playerRotation) * actualSpeed * delta;
      this.playerVelocity.z -= Math.sin(this.playerRotation) * actualSpeed * delta;
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      this.playerVelocity.x -= Math.cos(this.playerRotation) * actualSpeed * 0.5 * delta;
      this.playerVelocity.z += Math.sin(this.playerRotation) * actualSpeed * 0.5 * delta;
    }
    if (this.keys['a'] || this.keys['arrowleft']) {
      this.playerRotation += turnSpeed * delta * (this.playerVelocity.length() > 1 ? 1 : 0.3);
    }
    if (this.keys['d'] || this.keys['arrowright']) {
      this.playerRotation -= turnSpeed * delta * (this.playerVelocity.length() > 1 ? 0.3 : 0.3);
    }

    // Jump
    if (this.keys[' '] && this.playerCar.position.y <= 0.1) {
      this.playerVelocity.y = 14;
    }

    // Gravity
    this.playerVelocity.y += this.gravity * delta;

    // Friction
    this.playerVelocity.x *= 0.97;
    this.playerVelocity.z *= 0.97;

    // Position
    this.playerCar.position.add(this.playerVelocity.clone().multiplyScalar(delta));

    // Ground
    if (this.playerCar.position.y < 0) {
      this.playerCar.position.y = 0;
      this.playerVelocity.y = 0;
    }

    // Bounds
    const bx = this.arenaLength - 3;
    const bz = this.arenaWidth - 2;
    this.playerCar.position.x = Math.max(-bx, Math.min(bx, this.playerCar.position.x));
    this.playerCar.position.z = Math.max(-bz, Math.min(bz, this.playerCar.position.z));

    // Rotate car
    this.playerCar.rotation.y = this.playerRotation + Math.PI / 2;

    // Speed
    this.state.speed = Math.round(this.playerVelocity.length() * 3.6);

    // Camera
    const camDist = 14;
    const camHeight = 7;
    const camOffset = new THREE.Vector3(
      -Math.cos(this.playerRotation) * camDist,
      camHeight,
      Math.sin(this.playerRotation) * camDist
    );
    const targetPos = this.playerCar.position.clone().add(camOffset);
    this.camera.position.lerp(targetPos, 0.06);
    this.camera.lookAt(this.playerCar.position.clone().add(new THREE.Vector3(0, 2, 0)));
  }

  private updateOpponent(delta: number): void {
    const ballPos = this.ball.position;
    const oppPos = this.opponentCar.position;

    const toBall = new THREE.Vector3().subVectors(ballPos, oppPos);
    toBall.y = 0;
    const dist = toBall.length();

    let targetAngle = Math.atan2(-toBall.z, toBall.x) - Math.PI / 2;

    // Smooth rotation
    let angleDiff = targetAngle - this.opponentCar.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.opponentCar.rotation.y += angleDiff * 3 * delta;

    // Move forward
    const moveSpeed = 25;
    if (dist > 4) {
      const dir = this.opponentCar.rotation.y - Math.PI / 2;
      this.opponentVelocity.x += Math.cos(dir) * moveSpeed * delta;
      this.opponentVelocity.z -= Math.sin(dir) * moveSpeed * delta;
    }

    // Friction
    this.opponentVelocity.x *= 0.95;
    this.opponentVelocity.z *= 0.95;

    // Position
    this.opponentCar.position.add(this.opponentVelocity.clone().multiplyScalar(delta));

    // Ground
    if (this.opponentCar.position.y < 0) {
      this.opponentCar.position.y = 0;
      this.opponentVelocity.y = 0;
    }

    // Bounds
    const bx = this.arenaLength - 3;
    const bz = this.arenaWidth - 2;
    this.opponentCar.position.x = Math.max(-bx, Math.min(bx, this.opponentCar.position.x));
    this.opponentCar.position.z = Math.max(-bz, Math.min(bz, this.opponentCar.position.z));
  }

  private updateBall(delta: number): void {
    // Gravity
    this.ballVelocity.y += this.gravity * delta;

    // Position
    this.ball.position.add(this.ballVelocity.clone().multiplyScalar(delta));

    // Ground bounce
    if (this.ball.position.y < 2) {
      this.ball.position.y = 2;
      this.ballVelocity.y = Math.abs(this.ballVelocity.y) * 0.65;
      this.ballVelocity.x *= 0.97;
      this.ballVelocity.z *= 0.97;
    }

    // Wall bounces
    const bx = this.arenaLength - 3;
    if (Math.abs(this.ball.position.x) > bx) {
      // Check goals
      if (Math.abs(this.ball.position.z) < 10 && this.ball.position.y < 8) {
        if (this.ball.position.x < 0) {
          this.state.opponentScore++;
          this.state.goalFlash = 2;
        } else {
          this.state.score++;
          this.state.goalFlash = 2;
        }
        this.onStateChange({ ...this.state });
        this.resetPositions();
        return;
      }
      this.ball.position.x = Math.sign(this.ball.position.x) * bx;
      this.ballVelocity.x *= -0.7;
    }

    const bz = this.arenaWidth - 3;
    if (Math.abs(this.ball.position.z) > bz) {
      this.ball.position.z = Math.sign(this.ball.position.z) * bz;
      this.ballVelocity.z *= -0.7;
    }

    // Ceiling
    if (this.ball.position.y > 25) {
      this.ball.position.y = 25;
      this.ballVelocity.y *= -0.5;
    }

    // Rotation
    this.ball.rotation.x += this.ballVelocity.z * delta * 0.3;
    this.ball.rotation.z -= this.ballVelocity.x * delta * 0.3;

    // Collision with player car
    const pDist = this.ball.position.distanceTo(this.playerCar.position);
    if (pDist < 4) {
      const pushDir = new THREE.Vector3().subVectors(this.ball.position, this.playerCar.position).normalize();
      const force = 30 + (this.keys['shift'] ? 25 : 0);
      this.ballVelocity.add(pushDir.multiplyScalar(force));
      this.ballVelocity.y = Math.max(this.ballVelocity.y, 6);
    }

    // Collision with opponent
    const oDist = this.ball.position.distanceTo(this.opponentCar.position);
    if (oDist < 4) {
      const pushDir = new THREE.Vector3().subVectors(this.ball.position, this.opponentCar.position).normalize();
      this.ballVelocity.add(pushDir.multiplyScalar(25));
      this.ballVelocity.y = Math.max(this.ballVelocity.y, 4);
    }

    // Speed limit
    if (this.ballVelocity.length() > 70) {
      this.ballVelocity.normalize().multiplyScalar(70);
    }
  }

  private updateTimer(delta: number): void {
    if (this.state.mode === 'playing') {
      this.state.time -= delta;
      if (this.state.goalFlash > 0) this.state.goalFlash -= delta;
      if (this.state.time <= 0) {
        this.state.time = 0;
        this.state.mode = 'gameover';
      }
    }
  }

  update(): void {
    const delta = Math.min(this.clock.getDelta(), 0.05);

    // FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate > 500) {
      this.state.fps = Math.round(this.frameCount / ((now - this.lastFpsUpdate) / 1000));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    if (this.state.mode === 'playing') {
      this.updatePlayer(delta);
      this.updateOpponent(delta);
      this.updateBall(delta);
      this.updateTimer(delta);
    }

    // Animate clouds
    this.clouds.forEach((cloud, i) => {
      cloud.position.x += 0.02 * (i % 2 === 0 ? 1 : -1);
      if (cloud.position.x > 250) cloud.position.x = -250;
      if (cloud.position.x < -250) cloud.position.x = 250;
    });

    // Animate water
    if (this.waterMesh) {
      this.waterMesh.position.y = -1 + Math.sin(now * 0.001) * 0.2;
    }

    this.onStateChange({ ...this.state });
    this.renderer.render(this.scene, this.camera);
  }

  startLoop(): void {
    const loop = () => {
      this.animationId = requestAnimationFrame(loop);
      this.update();
    };
    loop();
  }

  stopLoop(): void {
    cancelAnimationFrame(this.animationId);
  }

  dispose(): void {
    this.stopLoop();
    this.renderer.dispose();
    window.removeEventListener('resize', this.onResize.bind(this));
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
