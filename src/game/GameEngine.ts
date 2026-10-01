import * as THREE from 'three';

export interface GameState {
  fps: number;
  score: number;
  opponentScore: number;
  boost: number;
  speed: number;
  mode: 'menu' | 'playing' | 'battle';
  time: number;
}

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  private container: HTMLElement;
  
  // Game objects
  private player: THREE.Group;
  private playerVelocity: THREE.Vector3;
  private playerRotation: number = 0;
  private ball: THREE.Mesh;
  private ballVelocity: THREE.Vector3;
  private opponent: THREE.Group;
  private opponentVelocity: THREE.Vector3;
  
  // Environment
  private terrain: THREE.Group;
  private trees: THREE.Group[];
  private buildings: THREE.Group[];
  private arena: THREE.Group;
  private goals: THREE.Mesh[];
  
  // Controls
  private keys: { [key: string]: boolean } = {};
  private mouseX: number = 0;
  private isPointerLocked: boolean = false;
  
  // Game state
  private state: GameState;
  private onStateChange: (state: GameState) => void;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private animationId: number = 0;
  
  // Physics
  private gravity: number = -25;
  private groundLevel: number = 0.5;
  private arenaSize: number = 80;
  
  constructor(container: HTMLElement, onStateChange: (state: GameState) => void) {
    this.container = container;
    this.onStateChange = onStateChange;
    this.clock = new THREE.Clock();
    
    this.state = {
      fps: 0,
      score: 0,
      opponentScore: 0,
      boost: 100,
      speed: 0,
      mode: 'menu',
      time: 180
    };
    
    // Initialize Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 100, 300);
    
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 500);
    this.camera.position.set(0, 8, 15);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);
    
    // Initialize game objects
    this.player = new THREE.Group();
    this.playerVelocity = new THREE.Vector3();
    this.ball = new THREE.Mesh();
    this.ballVelocity = new THREE.Vector3();
    this.opponent = new THREE.Group();
    this.opponentVelocity = new THREE.Vector3();
    this.terrain = new THREE.Group();
    this.trees = [];
    this.buildings = [];
    this.arena = new THREE.Group();
    this.goals = [];
    
    this.setupLights();
    this.createTerrain();
    this.createPlayer();
    this.createOpponent();
    this.createBall();
    this.createArena();
    this.createEnvironment();
    this.setupControls();
    
    window.addEventListener('resize', this.onResize.bind(this));
  }
  
  private setupLights(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambient);
    
    // Sun light
    const sun = new THREE.DirectionalLight(0xffffee, 1.5);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    this.scene.add(sun);
    
    // Hemisphere light for sky color
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3d7a3d, 0.4);
    this.scene.add(hemi);
    
    // Point lights for arena
    const arenaLight1 = new THREE.PointLight(0xff6600, 1, 50);
    arenaLight1.position.set(-35, 15, 0);
    this.scene.add(arenaLight1);
    
    const arenaLight2 = new THREE.PointLight(0x0066ff, 1, 50);
    arenaLight2.position.set(35, 15, 0);
    this.scene.add(arenaLight2);
  }
  
  private createTerrain(): void {
    // Main ground - Fortnite style green terrain
    const groundGeo = new THREE.PlaneGeometry(400, 400, 64, 64);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x4a8c3f });
    
    // Add some height variation
    const vertices = groundGeo.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const y = vertices.getY(i);
      const dist = Math.sqrt(x * x + y * y);
      if (dist > this.arenaSize * 0.7) {
        vertices.setZ(i, Math.sin(x * 0.05) * 2 + Math.cos(y * 0.05) * 2 + Math.random() * 0.5);
      }
    }
    groundGeo.computeVertexNormals();
    
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // Arena floor (darker, flat)
    const arenaFloorGeo = new THREE.PlaneGeometry(this.arenaSize * 2, this.arenaSize * 1.2);
    const arenaFloorMat = new THREE.MeshLambertMaterial({ color: 0x2a5a2a });
    const arenaFloor = new THREE.Mesh(arenaFloorGeo, arenaFloorMat);
    arenaFloor.rotation.x = -Math.PI / 2;
    arenaFloor.position.y = 0.01;
    arenaFloor.receiveShadow = true;
    this.scene.add(arenaFloor);
  }
  
  private createLegoCharacter(color: number, isPlayer: boolean): THREE.Group {
    const group = new THREE.Group();
    
    // Body (Lego brick style - rectangular)
    const bodyGeo = new THREE.BoxGeometry(1.2, 1.4, 0.8);
    const bodyMat = new THREE.MeshPhongMaterial({ color, shininess: 80 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.2;
    body.castShadow = true;
    group.add(body);
    
    // Head (cylinder like Lego minifigure)
    const headGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.6, 8);
    const headMat = new THREE.MeshPhongMaterial({ color: 0xffcc88, shininess: 60 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.3;
    head.castShadow = true;
    group.add(head);
    
    // Lego stud on head
    const studGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8);
    const studMat = new THREE.MeshPhongMaterial({ color: 0xffcc88, shininess: 100 });
    const stud = new THREE.Mesh(studGeo, studMat);
    stud.position.y = 2.65;
    group.add(stud);
    
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 2.35, 0.35);
    group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, 2.35, 0.35);
    group.add(rightEye);
    
    // Smile
    const smileGeo = new THREE.TorusGeometry(0.12, 0.03, 8, 8, Math.PI);
    const smileMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
    const smile = new THREE.Mesh(smileGeo, smileMat);
    smile.position.set(0, 2.2, 0.38);
    smile.rotation.x = Math.PI;
    group.add(smile);
    
    // Arms
    const armGeo = new THREE.BoxGeometry(0.3, 1.0, 0.3);
    const armMat = new THREE.MeshPhongMaterial({ color, shininess: 80 });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.9, 1.2, 0);
    leftArm.castShadow = true;
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.9, 1.2, 0);
    rightArm.castShadow = true;
    group.add(rightArm);
    
    // Legs
    const legGeo = new THREE.BoxGeometry(0.5, 0.9, 0.6);
    const legMat = new THREE.MeshPhongMaterial({ color: 0x1a1a4a, shininess: 60 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.3, 0.25, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.3, 0.25, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);
    
    // Vehicle/Car (Rocket League style)
    if (isPlayer) {
      const car = this.createLegoCar(0xff4444);
      car.position.y = 0;
      group.add(car);
      group.userData.car = car;
    } else {
      const car = this.createLegoCar(0x4444ff);
      car.position.y = 0;
      group.add(car);
      group.userData.car = car;
    }
    
    return group;
  }
  
  private createLegoCar(color: number): THREE.Group {
    const car = new THREE.Group();
    
    // Car body - blocky Lego style
    const bodyGeo = new THREE.BoxGeometry(2.5, 0.8, 1.4);
    const bodyMat = new THREE.MeshPhongMaterial({ color, shininess: 100 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    car.add(body);
    
    // Car roof/cabin
    const roofGeo = new THREE.BoxGeometry(1.2, 0.6, 1.2);
    const roofMat = new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 80, transparent: true, opacity: 0.8 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(-0.1, 1.2, 0);
    roof.castShadow = true;
    car.add(roof);
    
    // Lego studs on car
    const studGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8);
    const studMat = new THREE.MeshPhongMaterial({ color, shininess: 120 });
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j += 2) {
        const stud = new THREE.Mesh(studGeo, studMat);
        stud.position.set(i * 0.6, 1.05, j * 0.4);
        car.add(stud);
      }
    }
    
    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 12);
    const wheelMat = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 40 });
    const wheelPositions = [
      [-0.8, 0.35, 0.8], [0.8, 0.35, 0.8],
      [-0.8, 0.35, -0.8], [0.8, 0.35, -0.8]
    ];
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(pos[0], pos[1], pos[2]);
      wheel.rotation.x = Math.PI / 2;
      wheel.castShadow = true;
      car.add(wheel);
    });
    
    // Boost flame (initially invisible)
    const flameGeo = new THREE.ConeGeometry(0.3, 1.5, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(1.8, 0.6, 0);
    flame.rotation.z = Math.PI / 2;
    car.add(flame);
    car.userData.flame = flame;
    
    return car;
  }
  
  private createPlayer(): void {
    this.player = this.createLegoCharacter(0xff4444, true);
    this.player.position.set(-20, 0, 0);
    this.scene.add(this.player);
  }
  
  private createOpponent(): void {
    this.opponent = this.createLegoCharacter(0x4444ff, false);
    this.opponent.position.set(20, 0, 0);
    this.opponent.rotation.y = Math.PI;
    this.scene.add(this.opponent);
  }
  
  private createBall(): void {
    // Giant Lego-style soccer ball
    const ballGroup = new THREE.Group();
    
    const ballGeo = new THREE.IcosahedronGeometry(2, 1);
    const ballMat = new THREE.MeshPhongMaterial({ 
      color: 0xffffff, 
      shininess: 100,
      flatShading: true 
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    ballGroup.add(ballMesh);
    
    // Black pentagon patches
    const patchGeo = new THREE.CircleGeometry(0.6, 5);
    const patchMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
    const patchPositions = [
      [0, 2, 0], [0, -2, 0], [2, 0, 0], [-2, 0, 0], [0, 0, 2], [0, 0, -2]
    ];
    patchPositions.forEach(pos => {
      const patch = new THREE.Mesh(patchGeo, patchMat);
      patch.position.set(pos[0], pos[1], pos[2]);
      patch.lookAt(0, 0, 0);
      patch.position.multiplyScalar(1.01);
      ballGroup.add(patch);
    });
    
    // Lego studs on ball
    const studGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8);
    const studMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const stud = new THREE.Mesh(studGeo, studMat);
      stud.position.set(Math.cos(angle) * 2, Math.sin(angle) * 2, 0);
      stud.lookAt(0, 0, 0);
      ballGroup.add(stud);
    }
    
    this.ball = ballGroup as any;
    (this.ball as any).position.set(0, 2, 0);
    this.scene.add(this.ball);
    this.ballVelocity.set(0, 0, 0);
  }
  
  private createArena(): void {
    this.arena = new THREE.Group();
    
    // Arena walls (Lego brick style)
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x555577, shininess: 60 });
    
    // Side walls
    const sideWallGeo = new THREE.BoxGeometry(2, 8, this.arenaSize * 1.2);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.position.set(-this.arenaSize, 4, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    this.arena.add(leftWall);
    
    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.position.set(this.arenaSize, 4, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    this.arena.add(rightWall);
    
    // Back walls (with goal openings)
    const backWallGeo = new THREE.BoxGeometry(this.arenaSize * 2, 8, 2);
    
    // Front back wall (with gap for goal)
    const backWallLeft = new THREE.Mesh(
      new THREE.BoxGeometry((this.arenaSize * 2 - 20) / 2, 8, 2),
      wallMat
    );
    backWallLeft.position.set(-(this.arenaSize + 5), 4, -this.arenaSize * 0.6);
    this.arena.add(backWallLeft);
    
    const backWallRight = new THREE.Mesh(
      new THREE.BoxGeometry((this.arenaSize * 2 - 20) / 2, 8, 2),
      wallMat
    );
    backWallRight.position.set(this.arenaSize + 5, 4, -this.arenaSize * 0.6);
    this.arena.add(backWallRight);
    
    // Top back wall
    const topBackWall = new THREE.Mesh(
      new THREE.BoxGeometry(20, 3, 2),
      wallMat
    );
    topBackWall.position.set(0, 6.5, -this.arenaSize * 0.6);
    this.arena.add(topBackWall);
    
    // Goals
    const goalMat = new THREE.MeshPhongMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 0.3 });
    const goalGeo = new THREE.BoxGeometry(20, 5, 3);
    
    const goal1 = new THREE.Mesh(goalGeo, goalMat);
    goal1.position.set(0, 2.5, -this.arenaSize * 0.6 - 2);
    goal1.visible = false;
    this.scene.add(goal1);
    this.goals.push(goal1);
    
    const goalMat2 = new THREE.MeshPhongMaterial({ color: 0x0066ff, emissive: 0x0033ff, emissiveIntensity: 0.3 });
    const goal2 = new THREE.Mesh(goalGeo, goalMat2);
    goal2.position.set(0, 2.5, this.arenaSize * 0.6 + 2);
    goal2.visible = false;
    this.scene.add(goal2);
    this.goals.push(goal2);
    
    // Goal frames (visible)
    const frameMat = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.2 });
    const frameGeo = new THREE.BoxGeometry(0.5, 6, 0.5);
    
    // Left goal posts
    const lp1 = new THREE.Mesh(frameGeo, frameMat);
    lp1.position.set(-10, 3, -this.arenaSize * 0.6);
    this.arena.add(lp1);
    const lp2 = new THREE.Mesh(frameGeo, frameMat);
    lp2.position.set(10, 3, -this.arenaSize * 0.6);
    this.arena.add(lp2);
    const lp3 = new THREE.Mesh(new THREE.BoxGeometry(20.5, 0.5, 0.5), frameMat);
    lp3.position.set(0, 6, -this.arenaSize * 0.6);
    this.arena.add(lp3);
    
    // Right goal posts
    const rp1 = new THREE.Mesh(frameGeo, new THREE.MeshPhongMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.2 }));
    rp1.position.set(-10, 3, this.arenaSize * 0.6);
    this.arena.add(rp1);
    const rp2 = new THREE.Mesh(frameGeo, new THREE.MeshPhongMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.2 }));
    rp2.position.set(10, 3, this.arenaSize * 0.6);
    this.arena.add(rp2);
    const rp3 = new THREE.Mesh(new THREE.BoxGeometry(20.5, 0.5, 0.5), new THREE.MeshPhongMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.2 }));
    rp3.position.set(0, 6, this.arenaSize * 0.6);
    this.arena.add(rp3);
    
    // Center line
    const lineGeo = new THREE.BoxGeometry(this.arenaSize * 2, 0.05, 0.3);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const centerLine = new THREE.Mesh(lineGeo, lineMat);
    centerLine.position.y = 0.03;
    this.arena.add(centerLine);
    
    // Center circle
    const circleGeo = new THREE.RingGeometry(8, 8.3, 32);
    const circleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const centerCircle = new THREE.Mesh(circleGeo, circleMat);
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.y = 0.03;
    this.arena.add(centerCircle);
    
    // Lego studs on arena floor
    const floorStudGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.15, 8);
    const floorStudMat = new THREE.MeshPhongMaterial({ color: 0x3a6a3a });
    for (let x = -this.arenaSize + 5; x < this.arenaSize; x += 10) {
      for (let z = -this.arenaSize * 0.6 + 5; z < this.arenaSize * 0.6; z += 10) {
        if (Math.abs(x) > 12 || Math.abs(z) > 5) {
          const floorStud = new THREE.Mesh(floorStudGeo, floorStudMat);
          floorStud.position.set(x, 0.08, z);
          this.arena.add(floorStud);
        }
      }
    }
    
    this.scene.add(this.arena);
  }
  
  private createEnvironment(): void {
    // Trees (Lego style)
    for (let i = 0; i < 40; i++) {
      const tree = this.createLegoTree();
      const angle = Math.random() * Math.PI * 2;
      const dist = this.arenaSize + 15 + Math.random() * 80;
      tree.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      this.scene.add(tree);
      this.trees.push(tree);
    }
    
    // Buildings (Fortnite style)
    for (let i = 0; i < 12; i++) {
      const building = this.createLegoBuilding();
      const angle = Math.random() * Math.PI * 2;
      const dist = this.arenaSize + 30 + Math.random() * 60;
      building.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      building.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(building);
      this.buildings.push(building);
    }
    
    // Clouds
    for (let i = 0; i < 15; i++) {
      const cloud = this.createCloud();
      cloud.position.set(
        (Math.random() - 0.5) * 300,
        40 + Math.random() * 30,
        (Math.random() - 0.5) * 300
      );
      this.scene.add(cloud);
    }
    
    // Mountains in background
    for (let i = 0; i < 8; i++) {
      const mountain = this.createMountain();
      const angle = (i / 8) * Math.PI * 2;
      mountain.position.set(Math.cos(angle) * 180, 0, Math.sin(angle) * 180);
      this.scene.add(mountain);
    }
  }
  
  private createLegoTree(): THREE.Group {
    const tree = new THREE.Group();
    
    // Trunk (Lego cylinder)
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 4, 6);
    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    tree.add(trunk);
    
    // Leaves (Lego blocky style)
    const colors = [0x228B22, 0x32CD32, 0x006400];
    for (let i = 0; i < 3; i++) {
      const leafGeo = new THREE.BoxGeometry(3 - i * 0.5, 2, 3 - i * 0.5);
      const leafMat = new THREE.MeshPhongMaterial({ color: colors[i % 3] });
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = 4 + i * 1.8;
      leaf.castShadow = true;
      tree.add(leaf);
    }
    
    // Lego stud on top
    const studGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
    const studMat = new THREE.MeshPhongMaterial({ color: 0x228B22 });
    const stud = new THREE.Mesh(studGeo, studMat);
    stud.position.y = 9.5;
    tree.add(stud);
    
    return tree;
  }
  
  private createLegoBuilding(): THREE.Group {
    const building = new THREE.Group();
    const floors = 2 + Math.floor(Math.random() * 3);
    const colors = [0xcc8844, 0xaa6633, 0x996644, 0x887755];
    
    for (let i = 0; i < floors; i++) {
      const floorGeo = new THREE.BoxGeometry(8, 3, 8);
      const floorMat = new THREE.MeshPhongMaterial({ color: colors[i % colors.length] });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.position.y = 1.5 + i * 3;
      floor.castShadow = true;
      floor.receiveShadow = true;
      building.add(floor);
      
      // Windows
      const windowGeo = new THREE.BoxGeometry(1.5, 1.5, 0.1);
      const windowMat = new THREE.MeshPhongMaterial({ color: 0x88ccff, emissive: 0x224466, emissiveIntensity: 0.3 });
      for (let side = 0; side < 4; side++) {
        const win = new THREE.Mesh(windowGeo, windowMat);
        const angle = (side / 4) * Math.PI * 2;
        win.position.set(Math.sin(angle) * 4.05, 1.5 + i * 3, Math.cos(angle) * 4.05);
        win.rotation.y = angle;
        building.add(win);
      }
      
      // Lego studs on each floor
      const studGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8);
      const studMat = new THREE.MeshPhongMaterial({ color: colors[i % colors.length] });
      for (let sx = -2; sx <= 2; sx += 2) {
        for (let sz = -2; sz <= 2; sz += 2) {
          const stud = new THREE.Mesh(studGeo, studMat);
          stud.position.set(sx, 3.1 + i * 3, sz);
          building.add(stud);
        }
      }
    }
    
    // Roof
    const roofGeo = new THREE.ConeGeometry(5, 3, 4);
    const roofMat = new THREE.MeshPhongMaterial({ color: 0x882222 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = floors * 3 + 1.5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    building.add(roof);
    
    return building;
  }
  
  private createCloud(): THREE.Group {
    const cloud = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    
    for (let i = 0; i < 5; i++) {
      const size = 2 + Math.random() * 3;
      const cloudGeo = new THREE.SphereGeometry(size, 8, 8);
      const part = new THREE.Mesh(cloudGeo, cloudMat);
      part.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 4
      );
      cloud.add(part);
    }
    
    return cloud;
  }
  
  private createMountain(): THREE.Group {
    const mountain = new THREE.Group();
    const mtGeo = new THREE.ConeGeometry(30 + Math.random() * 20, 40 + Math.random() * 30, 6);
    const mtMat = new THREE.MeshPhongMaterial({ color: 0x556655, flatShading: true });
    const mt = new THREE.Mesh(mtGeo, mtMat);
    mt.position.y = 15;
    mountain.add(mt);
    
    // Snow cap
    const snowGeo = new THREE.ConeGeometry(10, 10, 6);
    const snowMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const snow = new THREE.Mesh(snowGeo, snowMat);
    snow.position.y = 35;
    mountain.add(snow);
    
    return mountain;
  }
  
  private setupControls(): void {
    document.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.mouseX += e.movementX * 0.002;
      }
    });
    
    this.renderer.domElement.addEventListener('click', () => {
      if (this.state.mode === 'playing') {
        this.renderer.domElement.requestPointerLock();
      }
    });
    
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
    });
  }
  
  private onResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  startGame(): void {
    this.state.mode = 'playing';
    this.state.score = 0;
    this.state.opponentScore = 0;
    this.state.boost = 100;
    this.state.time = 180;
    this.resetPositions();
    this.onStateChange({ ...this.state });
  }
  
  private resetPositions(): void {
    this.player.position.set(-20, 0, 0);
    this.playerVelocity.set(0, 0, 0);
    this.opponent.position.set(20, 0, 0);
    this.opponentVelocity.set(0, 0, 0);
    (this.ball as any).position.set(0, 2, 0);
    this.ballVelocity.set(0, 0, 0);
  }
  
  private updatePlayer(delta: number): void {
    const car = this.player.userData.car;
    if (!car) return;
    
    const speed = 30;
    const turnSpeed = 2.5;
    const boostMultiplier = 1.8;
    
    let currentSpeed = speed;
    let isBoosting = false;
    
    // Boost
    if (this.keys['shift'] && this.state.boost > 0) {
      currentSpeed *= boostMultiplier;
      this.state.boost = Math.max(0, this.state.boost - 30 * delta);
      isBoosting = true;
    } else {
      this.state.boost = Math.min(100, this.state.boost + 5 * delta);
    }
    
    // Show/hide boost flame
    const flame = car.userData.flame;
    if (flame) {
      (flame.material as THREE.MeshBasicMaterial).opacity = isBoosting ? 0.8 : 0;
    }
    
    // Movement
    if (this.keys['w'] || this.keys['arrowup']) {
      this.playerVelocity.z -= Math.cos(this.playerRotation) * currentSpeed * delta;
      this.playerVelocity.x -= Math.sin(this.playerRotation) * currentSpeed * delta;
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      this.playerVelocity.z += Math.cos(this.playerRotation) * currentSpeed * delta * 0.6;
      this.playerVelocity.x += Math.sin(this.playerRotation) * currentSpeed * delta * 0.6;
    }
    if (this.keys['a'] || this.keys['arrowleft']) {
      this.playerRotation += turnSpeed * delta;
    }
    if (this.keys['d'] || this.keys['arrowright']) {
      this.playerRotation -= turnSpeed * delta;
    }
    
    // Jump
    if (this.keys[' '] && this.player.position.y <= 0.1) {
      this.playerVelocity.y = 12;
    }
    
    // Apply gravity
    this.playerVelocity.y += this.gravity * delta;
    
    // Apply friction
    this.playerVelocity.x *= 0.95;
    this.playerVelocity.z *= 0.95;
    
    // Update position
    this.player.position.add(this.playerVelocity.clone().multiplyScalar(delta));
    
    // Ground collision
    if (this.player.position.y < this.groundLevel) {
      this.player.position.y = this.groundLevel;
      this.playerVelocity.y = 0;
    }
    
    // Arena bounds
    const bound = this.arenaSize - 2;
    this.player.position.x = Math.max(-bound, Math.min(bound, this.player.position.x));
    this.player.position.z = Math.max(-bound * 0.6, Math.min(bound * 0.6, this.player.position.z));
    
    // Rotate car to face direction
    car.rotation.y = this.playerRotation;
    
    // Update speed display
    this.state.speed = Math.round(this.playerVelocity.length() * 3.6);
    
    // Camera follow
    const cameraOffset = new THREE.Vector3(
      Math.sin(this.playerRotation) * 12,
      8,
      Math.cos(this.playerRotation) * 12
    );
    const targetCamPos = this.player.position.clone().add(cameraOffset);
    this.camera.position.lerp(targetCamPos, 0.05);
    this.camera.lookAt(this.player.position.clone().add(new THREE.Vector3(0, 2, 0)));
  }
  
  private updateOpponent(delta: number): void {
    // AI opponent
    const ballPos = (this.ball as any).position as THREE.Vector3;
    const oppPos = this.opponent.position;
    
    // Move towards ball
    const toBall = new THREE.Vector3().subVectors(ballPos, oppPos);
    toBall.y = 0;
    const dist = toBall.length();
    
    if (dist > 3) {
      toBall.normalize();
      this.opponentVelocity.x += toBall.x * 15 * delta;
      this.opponentVelocity.z += toBall.z * 15 * delta;
    }
    
    // Apply friction
    this.opponentVelocity.x *= 0.93;
    this.opponentVelocity.z *= 0.93;
    
    // Update position
    this.opponent.position.add(this.opponentVelocity.clone().multiplyScalar(delta));
    
    // Ground
    if (this.opponent.position.y < this.groundLevel) {
      this.opponent.position.y = this.groundLevel;
    }
    
    // Bounds
    const bound = this.arenaSize - 2;
    this.opponent.position.x = Math.max(-bound, Math.min(bound, this.opponent.position.x));
    this.opponent.position.z = Math.max(-bound * 0.6, Math.min(bound * 0.6, this.opponent.position.z));
    
    // Face ball
    const car = this.opponent.userData.car;
    if (car) {
      car.rotation.y = Math.atan2(toBall.x, toBall.z);
    }
  }
  
  private updateBall(delta: number): void {
    const ball = this.ball as any;
    
    // Apply gravity
    this.ballVelocity.y += this.gravity * delta;
    
    // Update position
    ball.position.add(this.ballVelocity.clone().multiplyScalar(delta));
    
    // Ground bounce
    if (ball.position.y < 2) {
      ball.position.y = 2;
      this.ballVelocity.y = Math.abs(this.ballVelocity.y) * 0.7;
      this.ballVelocity.x *= 0.95;
      this.ballVelocity.z *= 0.95;
    }
    
    // Wall bounces
    const bound = this.arenaSize - 3;
    if (Math.abs(ball.position.x) > bound) {
      ball.position.x = Math.sign(ball.position.x) * bound;
      this.ballVelocity.x *= -0.8;
    }
    
    const zBound = bound * 0.6;
    if (ball.position.z < -zBound) {
      // Check if in goal
      if (Math.abs(ball.position.x) < 10 && ball.position.y < 6) {
        // GOAL for player!
        this.state.score++;
        this.onStateChange({ ...this.state });
        this.resetPositions();
        return;
      }
      ball.position.z = -zBound;
      this.ballVelocity.z *= -0.8;
    }
    if (ball.position.z > zBound) {
      // Check if in goal
      if (Math.abs(ball.position.x) < 10 && ball.position.y < 6) {
        // GOAL for opponent!
        this.state.opponentScore++;
        this.onStateChange({ ...this.state });
        this.resetPositions();
        return;
      }
      ball.position.z = zBound;
      this.ballVelocity.z *= -0.8;
    }
    
    // Ceiling
    if (ball.position.y > 20) {
      ball.position.y = 20;
      this.ballVelocity.y *= -0.5;
    }
    
    // Rotate ball
    ball.rotation.x += this.ballVelocity.z * delta * 0.5;
    ball.rotation.z -= this.ballVelocity.x * delta * 0.5;
    
    // Collision with player
    const playerDist = ball.position.distanceTo(this.player.position);
    if (playerDist < 3.5) {
      const pushDir = new THREE.Vector3().subVectors(ball.position, this.player.position).normalize();
      const force = 25 + (this.keys['shift'] ? 20 : 0);
      this.ballVelocity.add(pushDir.multiplyScalar(force));
      this.ballVelocity.y = Math.max(this.ballVelocity.y, 5);
    }
    
    // Collision with opponent
    const oppDist = ball.position.distanceTo(this.opponent.position);
    if (oppDist < 3.5) {
      const pushDir = new THREE.Vector3().subVectors(ball.position, this.opponent.position).normalize();
      this.ballVelocity.add(pushDir.multiplyScalar(20));
      this.ballVelocity.y = Math.max(this.ballVelocity.y, 3);
    }
    
    // Speed limit
    const maxSpeed = 60;
    if (this.ballVelocity.length() > maxSpeed) {
      this.ballVelocity.normalize().multiplyScalar(maxSpeed);
    }
  }
  
  private updateTimer(delta: number): void {
    if (this.state.mode === 'playing') {
      this.state.time -= delta;
      if (this.state.time <= 0) {
        this.state.time = 0;
        this.state.mode = 'menu';
      }
    }
  }
  
  update(): void {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    
    // FPS counter
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
    
    // Animate environment
    this.trees.forEach((tree, i) => {
      tree.rotation.z = Math.sin(now * 0.001 + i) * 0.02;
    });
    
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
