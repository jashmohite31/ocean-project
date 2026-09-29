import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getSeafloorDepth, getBathymetryColor, depthTo3DY, SEABED_FEATURES } from '../utils/bathymetry';
import { 
  INDIA_COASTLINE, 
  INDIA_LAND_BOUNDARY, 
  SRI_LANKA_COAST, 
  BANGLADESH_COAST, 
  MYANMAR_COAST, 
  PAKISTAN_COAST, 
  OMAN_COAST, 
  MALDIVES_ATOLLS, 
  LAKSHADWEEP_ISLANDS, 
  ANDAMAN_ISLANDS, 
  REGIONAL_COUNTRIES, 
  SEA_BODIES 
} from '../utils/geoBoundaries';
import DepthArrowScrubber from './DepthArrowScrubber';
import { 
  Layers, 
  Eye, 
  Wind, 
  Compass, 
  Maximize2, 
  Minimize2, 
  Play, 
  Pause, 
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Activity,
  ArrowDown,
  Globe2,
  MapPin,
  Flag,
  X
} from 'lucide-react';

export default function OceanViewer3D({
  activeVariable = 'temperature',
  onSelectVariable,
  activeDepth = 0,
  onDepthChange,
  activeTimeIndex = 0,
  onTimeChange,
  observations = [],
  selectedObservation,
  onSelectObservation,
  onOpenCompare,
  sliceData,
  isLoadingChunk = false
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);

  // Layer toggles
  const [showOceanBed, setShowOceanBed] = useState(true);
  const [bedWireframe, setBedWireframe] = useState(false);
  const [showVectors, setShowVectors] = useState(true);
  const [showArgoTracks, setShowArgoTracks] = useState(true);
  const [showCountryBorders, setShowCountryBorders] = useState(true);
  const [showLandmass, setShowLandmass] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [isPlayingTime, setIsPlayingTime] = useState(false);
  const [chunkNotification, setChunkNotification] = useState(null);

  // Auto-dismiss chunk notification after 3.5 seconds
  useEffect(() => {
    if (!chunkNotification) return;
    const timer = setTimeout(() => {
      setChunkNotification(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [chunkNotification]);

  // Mesh refs for dynamic updates
  const sliceMeshRef = useRef(null);
  const bedMeshRef = useRef(null);
  const bedWireframeMeshRef = useRef(null);
  const bordersGroupRef = useRef(null);
  const landGroupRef = useRef(null);
  const particlesRef = useRef(null);
  const floatMarkersRef = useRef([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Geographic bounds
  // Lat: 4 to 24 (delta = 20) -> map to Z: +10 to -10
  // Lon: 60 to 94 (delta = 34) -> map to X: -17 to +17
  const mapCoordsTo3D = (lat, lon, depth = 0) => {
    const x = ((lon - 77) / 17) * 17;
    const z = -((lat - 14) / 10) * 10;
    const y = depthTo3DY(depth);
    return new THREE.Vector3(x, y, z);
  };

  // 1. Initialize Three.js Scene with Normal, Standard OrbitControls
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || (window.innerHeight - 56);

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xecf4e8); // Light mint cream background from user palette!
    scene.fog = new THREE.FogExp2(0xecf4e8, 0.007);
    sceneRef.current = scene;

    // Camera (Looking from South-Southwest up towards North with normal orientation)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 36, 32);
    camera.lookAt(0, -6.5, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // OrbitControls: Normal, standard, non-inverted mouse controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, -6.5, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Do not go below horizon
    controls.minDistance = 15;
    controls.maxDistance = 110;
    controlsRef.current = controls;

    // Lighting optimized for crisp visibility on light background
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
    dirLight.position.set(20, 45, 20);
    scene.add(dirLight);

    const bedGlow = new THREE.PointLight(0x0284c7, 1.8, 90); // Ocean blue abyssal glow
    bedGlow.position.set(0, -12, 0);
    scene.add(bedGlow);

    // 2. Build Ocean Bed (Bathymetry / Seafloor) Surface Mesh
    buildOceanBedSurface(scene);

    // 3. Build Reference Bounding Volume & Coordinate Grid
    buildOceanBounds(scene);

    // 4. Build Animated Flow Vector Particles
    buildCurrentParticles(scene);

    // 5. Build Country Borders and Aligned Landmass Surfaces
    buildCountryBordersAndLand(scene);

    // Render loop
    let animationFrameId;
    let clockTime = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      clockTime += 0.016;

      // Update OrbitControls smoothly
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Animate current flow particles
      if (particlesRef.current && showVectors) {
        const positions = particlesRef.current.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i] += Math.sin(clockTime * 0.8 + positions[i + 2] * 0.2) * 0.02;
          positions[i + 2] -= 0.035;
          if (positions[i + 2] > 10.5) positions[i + 2] = -10.5;
          if (positions[i + 2] < -10.5) positions[i + 2] = 10.5;
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Subtle buoy bobbing animation for floats
      floatMarkersRef.current.forEach((marker, index) => {
        if (marker.buoyMesh) {
          marker.buoyMesh.position.y = Math.sin(clockTime * 2 + index) * 0.08;
        }
      });

      // Subtle border glow pulsing
      if (bordersGroupRef.current) {
        const pulse = 0.8 + Math.sin(clockTime * 3) * 0.2;
        bordersGroupRef.current.children.forEach(line => {
          if (line.material) {
            line.material.opacity = pulse * 0.95;
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // Canvas click detection for Argo floats
    const handleClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const interactiveObjects = floatMarkersRef.current.map(m => m.clickableMesh).filter(Boolean);
      const intersects = raycasterRef.current.intersectObjects(interactiveObjects, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const matched = floatMarkersRef.current.find(m => m.clickableMesh === hit.object || m.group === hit.object.parent);
        if (matched && matched.obsData) {
          onSelectObservation(matched.obsData);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('click', handleClick);

    // Handle resize
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // 2. Build the Ocean Bed (Bathymetry / Seafloor) Surface Mesh
  function buildOceanBedSurface(scene) {
    const segX = 68;
    const segZ = 40;
    const geometry = new THREE.PlaneGeometry(34, 20, segX, segZ);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      const lon = 77 + (x / 17) * 17;
      const lat = 14 - (z / 10) * 10;

      const depthMeters = getSeafloorDepth(lat, lon);
      const y = depthTo3DY(depthMeters);
      pos.setY(i, y);

      const color = getBathymetryColor(depthMeters);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const bedMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.15,
      side: THREE.DoubleSide,
      flatShading: false
    });

    const bedMesh = new THREE.Mesh(geometry, bedMaterial);
    bedMesh.receiveShadow = true;
    bedMeshRef.current = bedMesh;
    scene.add(bedMesh);

    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.28
    });
    const wireframeMesh = new THREE.Mesh(geometry, wireframeMat);
    bedWireframeMeshRef.current = wireframeMesh;
    scene.add(wireframeMesh);
  }

  // 3. Build Ocean Bounds, Depth Horizon Planes & Water Column Spacing
  function buildOceanBounds(scene) {
    const group = new THREE.Group();
    const abyssalY = -19.5;

    const frameGeo = new THREE.BufferGeometry();
    const frameVertices = new Float32Array([
      // Top Surface perimeter (depth = 0m)
      -17, 0, -10,   17, 0, -10,
       17, 0, -10,   17, 0,  10,
       17, 0,  10,  -17, 0,  10,
      -17, 0,  10,  -17, 0, -10,
      // Vertical corner pillars down to abyssal floor (-19.5)
      -17, 0, -10,  -17, abyssalY, -10,
       17, 0, -10,   17, abyssalY, -10,
       17, 0,  10,   17, abyssalY,  10,
      -17, 0,  10,  -17, abyssalY,  10,
      // Abyssal base perimeter
      -17, abyssalY, -10,   17, abyssalY, -10,
       17, abyssalY, -10,   17, abyssalY,  10,
       17, abyssalY,  10,  -17, abyssalY,  10,
      -17, abyssalY,  10,  -17, abyssalY, -10,
    ]);
    frameGeo.setAttribute('position', new THREE.BufferAttribute(frameVertices, 3));
    const frameMat = new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.65 });
    const wireframeBox = new THREE.LineSegments(frameGeo, frameMat);
    group.add(wireframeBox);

    // Argo Profiling Limit Horizon (2000m, Y = -12.5) with user palette aqua (#93BFC7)
    const argoLimitY = depthTo3DY(2000);
    const argoLimitGeo = new THREE.BufferGeometry();
    const argoLimitVerts = new Float32Array([
      -17, argoLimitY, -10,   17, argoLimitY, -10,
       17, argoLimitY, -10,   17, argoLimitY,  10,
       17, argoLimitY,  10,  -17, argoLimitY,  10,
      -17, argoLimitY,  10,  -17, argoLimitY, -10
    ]);
    argoLimitGeo.setAttribute('position', new THREE.BufferAttribute(argoLimitVerts, 3));
    const argoLimitMat = new THREE.LineDashedMaterial({
      color: 0x93bfc7,
      dashSize: 0.8,
      gapSize: 0.4,
      transparent: true,
      opacity: 0.65
    });
    const argoLimitLine = new THREE.LineSegments(argoLimitGeo, argoLimitMat);
    argoLimitLine.computeLineDistances();
    group.add(argoLimitLine);

    // Translucent Ocean Water Body Curtain (0m to -12.5 units / 2000m)
    const waterColumnGeo = new THREE.BoxGeometry(34, 12.5, 20);
    const waterColumnMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7, // Vibrant Ocean blue volume
      transparent: true,
      opacity: 0.09,
      side: THREE.BackSide,
      depthWrite: false
    });
    const waterColumnMesh = new THREE.Mesh(waterColumnGeo, waterColumnMat);
    waterColumnMesh.position.set(0, -6.25, 0);
    group.add(waterColumnMesh);

    // Sea Surface Translucent Plane - Distinct, Beautiful Oceanic Blue on Light Background!
    const surfaceGeo = new THREE.PlaneGeometry(34, 20);
    surfaceGeo.rotateX(-Math.PI / 2);
    const surfaceMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Rich vibrant oceanic blue!
      transparent: true,
      opacity: 0.52, // Beautifully visible blue water surface against the light background
      roughness: 0.10,
      metalness: 0.65,
      side: THREE.DoubleSide
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfaceMesh.position.y = 0.01;
    group.add(surfaceMesh);

    scene.add(group);
  }

  // 4. Build Animated Flow Particles
  function buildCurrentParticles(scene) {
    const particleCount = 750;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 32;
      positions[i * 3 + 1] = -Math.random() * 11;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 19;

      colors[i * 3] = 0.2;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.24,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, material);
    particlesRef.current = particles;
    scene.add(particles);
  }

  // 5. Build Country Borders and Precisely Aligned Landmass Meshes
  function buildCountryBordersAndLand(scene) {
    const landGroup = new THREE.Group();
    const bordersGroup = new THREE.Group();

    // Helper: Creates glowing polyline in 3D (Z is exactly mapCoordsTo3D Z, elevation +0.1)
    const createBorderLine = (coords, colorHex = 0x38bdf8, countryId = 'IND') => {
      const vertices = [];
      coords.forEach(([lat, lon]) => {
        const v = mapCoordsTo3D(lat, lon, 0);
        vertices.push(v.x, 0.1, v.z);
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const mat = new THREE.LineBasicMaterial({
        color: colorHex,
        linewidth: 2.5,
        transparent: true,
        opacity: 0.95
      });
      const line = new THREE.Line(geo, mat);
      line.userData = { countryId };
      bordersGroup.add(line);
      return line;
    };

    // Helper: Creates 2D polygon triangulated mesh with ZERO rotation error (X and Z directly assigned!)
    const createLandMesh = (coords, yElevation = 0.05) => {
      // Map lat/lon to 3D X and Z
      const points2D = coords.map(([lat, lon]) => {
        const x = ((lon - 77) / 17) * 17;
        const z = -((lat - 14) / 10) * 10;
        return new THREE.Vector2(x, z);
      });

      const triangles = THREE.ShapeUtils.triangulateShape(points2D, []);
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(triangles.length * 3 * 3);

      for (let i = 0; i < triangles.length; i++) {
        const tri = triangles[i];
        for (let j = 0; j < 3; j++) {
          const ptIndex = tri[j];
          const pt = points2D[ptIndex];
          const offset = (i * 3 + j) * 3;
          positions[offset] = pt.x;
          positions[offset + 1] = yElevation;
          positions[offset + 2] = pt.y; // Correctly maps to 3D Z axis directly!
        }
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.computeVertexNormals();

      const landMat = new THREE.MeshStandardMaterial({
        color: 0xdde7d8, // Clean light sage/land tone that defines landmass on light background
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, landMat);
      landGroup.add(mesh);
      return mesh;
    };

    // 1. INDIA PENINSULA
    // Solid land surface precisely matching the coastline
    const indiaFullPoly = [...INDIA_COASTLINE, ...INDIA_LAND_BOUNDARY];
    createLandMesh(indiaFullPoly, 0.05);
    // Glowing Coastline Border
    createBorderLine(INDIA_COASTLINE, 0x059669, 'IND');

    // 2. SRI LANKA
    createLandMesh(SRI_LANKA_COAST, 0.06);
    createBorderLine(SRI_LANKA_COAST, 0x0284c7, 'LKA');

    // 3. BANGLADESH
    createBorderLine(BANGLADESH_COAST, 0x0d9488, 'BGD');

    // 4. MYANMAR
    createBorderLine(MYANMAR_COAST, 0x0891b2, 'MMR');

    // 5. PAKISTAN
    createBorderLine(PAKISTAN_COAST, 0x0284c7, 'PAK');

    // 6. OMAN
    createBorderLine(OMAN_COAST, 0xd97706, 'OMN');

    // 7. MALDIVES ATOLLS
    MALDIVES_ATOLLS.forEach(atoll => {
      const v = mapCoordsTo3D(atoll.lat, atoll.lon, 0);
      const ringGeo = new THREE.RingGeometry(0.2, 0.45, 12);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x0284c7,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(v.x, 0.08, v.z);
      bordersGroup.add(ringMesh);
    });

    // 8. LAKSHADWEEP ISLANDS (India)
    LAKSHADWEEP_ISLANDS.forEach(isl => {
      const v = mapCoordsTo3D(isl.lat, isl.lon, 0);
      const diskGeo = new THREE.CircleGeometry(0.25, 10);
      diskGeo.rotateX(-Math.PI / 2);
      const diskMat = new THREE.MeshBasicMaterial({ color: 0x059669 });
      const diskMesh = new THREE.Mesh(diskGeo, diskMat);
      diskMesh.position.set(v.x, 0.08, v.z);
      bordersGroup.add(diskMesh);
    });

    // 9. ANDAMAN & NICOBAR ISLANDS (India)
    ANDAMAN_ISLANDS.forEach(isl => {
      const v = mapCoordsTo3D(isl.lat, isl.lon, 0);
      const diskGeo = new THREE.CircleGeometry(0.32, 10);
      diskGeo.rotateX(-Math.PI / 2);
      const diskMat = new THREE.MeshBasicMaterial({ color: 0x059669 });
      const diskMesh = new THREE.Mesh(diskGeo, diskMat);
      diskMesh.position.set(v.x, 0.08, v.z);
      bordersGroup.add(diskMesh);
    });

    landGroupRef.current = landGroup;
    bordersGroupRef.current = bordersGroup;
    scene.add(landGroup);
    scene.add(bordersGroup);
  }

  // Update country border highlight when selectedCountry changes
  useEffect(() => {
    if (!bordersGroupRef.current) return;
    bordersGroupRef.current.children.forEach(line => {
      if (!line.userData?.countryId) return;
      const isMatch = selectedCountry === 'ALL' || selectedCountry === line.userData.countryId;
      if (line.material) {
        if (selectedCountry === line.userData.countryId) {
          line.material.color.setHex(0x0284c7); // Vibrant ocean blue highlight
          line.material.opacity = 1.0;
        } else if (isMatch) {
          line.material.color.setHex(0x059669); // Rich coastline green
          line.material.opacity = 0.95;
        } else {
          line.material.color.setHex(0x93bfc7); // Muted aqua
          line.material.opacity = 0.35; // Dim non-selected
        }
      }
    });
  }, [selectedCountry]);

  // Update country borders and landmass visibility
  useEffect(() => {
    if (bordersGroupRef.current) {
      bordersGroupRef.current.visible = showCountryBorders;
    }
  }, [showCountryBorders]);

  useEffect(() => {
    if (landGroupRef.current) {
      landGroupRef.current.visible = showLandmass;
    }
  }, [showLandmass]);

  // Focus camera on sea body or country using OrbitControls
  const focusOnRegion = (targetLat, targetLon, distance = 36) => {
    if (!controlsRef.current || !cameraRef.current) return;
    const v = mapCoordsTo3D(targetLat, targetLon, 500);
    controlsRef.current.target.set(v.x, -6.5, v.z);
    cameraRef.current.position.set(v.x, 32, v.z + 24);
    controlsRef.current.update();
  };

  // 6. Update Dynamic Depth Chunk Slice & Trigger "DATA LOADED" Feedback
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    if (sliceMeshRef.current) {
      scene.remove(sliceMeshRef.current);
      if (sliceMeshRef.current.geometry) sliceMeshRef.current.geometry.dispose();
      if (sliceMeshRef.current.material) sliceMeshRef.current.material.dispose();
      sliceMeshRef.current = null;
    }

    if (activeDepth === 'bed') {
      return;
    }

    const targetY = depthTo3DY(activeDepth);

    if (sliceData && sliceData.values && sliceData.lats && sliceData.lons) {
      const lats = sliceData.lats;
      const lons = sliceData.lons;
      const values = sliceData.values;
      const stats = sliceData.stats || { min: 20, max: 32 };

      const segX = lons.length - 1;
      const segZ = lats.length - 1;

      const geometry = new THREE.PlaneGeometry(34, 20, segX, segZ);
      geometry.rotateX(-Math.PI / 2);

      const pos = geometry.attributes.position;
      const colors = new Float32Array(pos.count * 3);

      for (let j = 0; j < lats.length; j++) {
        for (let i = 0; i < lons.length; i++) {
          const vertexIdx = j * lons.length + i;
          if (vertexIdx >= pos.count) continue;

          pos.setY(vertexIdx, targetY);

          const val = values[j] ? values[j][i] : stats.min;
          const norm = Math.max(0, Math.min(1, (val - stats.min) / (stats.max - stats.min || 1)));

          let r = 0, g = 0, b = 0;
          if (activeVariable === 'temperature') {
            if (norm < 0.25) {
              r = 0.05; g = norm * 4 * 0.8; b = 0.9;
            } else if (norm < 0.5) {
              r = 0.1; g = 0.8 + (norm - 0.25) * 4 * 0.2; b = 0.9 - (norm - 0.25) * 4 * 0.5;
            } else if (norm < 0.75) {
              r = 0.4 + (norm - 0.5) * 4 * 0.6; g = 0.9 - (norm - 0.5) * 4 * 0.3; b = 0.1;
            } else {
              r = 1.0; g = 0.6 - (norm - 0.75) * 4 * 0.5; b = 0.05;
            }
          } else if (activeVariable === 'salinity') {
            r = norm * 0.8;
            g = 0.6 + Math.sin(norm * Math.PI) * 0.4;
            b = 1.0 - norm * 0.3;
          } else {
            r = norm * 0.2;
            g = 0.5 + norm * 0.5;
            b = 1.0;
          }

          colors[vertexIdx * 3] = r;
          colors[vertexIdx * 3 + 1] = g;
          colors[vertexIdx * 3 + 2] = b;
        }
      }

      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();

      const sliceMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.35,
        metalness: 0.4,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide
      });

      const sliceMesh = new THREE.Mesh(geometry, sliceMaterial);
      sliceMeshRef.current = sliceMesh;
      scene.add(sliceMesh);

      setChunkNotification({
        variable: activeVariable,
        depth: activeDepth,
        stats: stats,
        unit: sliceData.unit || '°C',
        timestamp: new Date().toLocaleTimeString()
      });
    } else {
      const geometry = new THREE.PlaneGeometry(34, 20);
      geometry.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Distinct ocean blue
        transparent: true,
        opacity: 0.60,
        side: THREE.DoubleSide
      });
      const sliceMesh = new THREE.Mesh(geometry, mat);
      sliceMesh.position.y = targetY;
      sliceMeshRef.current = sliceMesh;
      scene.add(sliceMesh);
    }
  }, [sliceData, activeDepth, activeVariable]);

  // 7. Render In-Situ Floats & Deep Water Column Clearance Lines
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    floatMarkersRef.current.forEach(m => {
      if (m.group) scene.remove(m.group);
    });
    floatMarkersRef.current = [];

    if (!observations || observations.length === 0) return;

    observations.forEach(obs => {
      const group = new THREE.Group();
      const pos3D = mapCoordsTo3D(obs.latitude, obs.longitude, 0);
      group.position.set(pos3D.x, 0, pos3D.z);

      const isSelected = selectedObservation && selectedObservation.id === obs.id;
      const isGlider = obs.type === 'GLIDER';
      const isCTD = obs.type === 'CTD';
      const isBGC = obs.type === 'BGC';

      const buoyGeo = new THREE.SphereGeometry(isSelected ? 0.42 : 0.28, 16, 16);
      let buoyColor = 0x38bdf8;
      if (isGlider) buoyColor = 0x10b981;
      if (isCTD) buoyColor = 0xf59e0b;
      if (isBGC) buoyColor = 0xa855f7;
      if (isSelected) buoyColor = 0xf43f5e;

      const buoyMat = new THREE.MeshStandardMaterial({
        color: buoyColor,
        roughness: 0.3,
        metalness: 0.8,
        emissive: buoyColor,
        emissiveIntensity: isSelected ? 0.7 : 0.35
      });
      const buoyMesh = new THREE.Mesh(buoyGeo, buoyMat);
      buoyMesh.position.y = 0.2;
      group.add(buoyMesh);

      const ringGeo = new THREE.RingGeometry(0.35, 0.55, 16);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: buoyColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSelected ? 0.9 : 0.4
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = 0.02;
      group.add(ringMesh);

      if (showArgoTracks) {
        const seafloorDepthMeters = getSeafloorDepth(obs.latitude, obs.longitude);
        const seafloorY = depthTo3DY(seafloorDepthMeters);
        const profileMaxY = depthTo3DY(obs.depth_range?.[1] || 2000);

        const trackGeo = new THREE.BufferGeometry();
        const trackVertices = new Float32Array([
          0, 0, 0,
          0, profileMaxY, 0
        ]);
        trackGeo.setAttribute('position', new THREE.BufferAttribute(trackVertices, 3));
        const trackMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0xf43f5e : buoyColor,
          transparent: true,
          opacity: isSelected ? 0.95 : 0.6,
          linewidth: isSelected ? 2.5 : 1.5
        });
        const trackLine = new THREE.Line(trackGeo, trackMat);
        group.add(trackLine);

        const parkY = depthTo3DY(1000);
        const parkGeo = new THREE.SphereGeometry(0.16, 8, 8);
        const parkMat = new THREE.MeshBasicMaterial({ color: buoyColor, wireframe: true });
        const parkMesh = new THREE.Mesh(parkGeo, parkMat);
        parkMesh.position.y = parkY;
        group.add(parkMesh);

        const probeGeo = new THREE.ConeGeometry(0.18, 0.4, 8);
        probeGeo.rotateX(Math.PI);
        const probeMat = new THREE.MeshBasicMaterial({ color: isSelected ? 0xf43f5e : buoyColor });
        const probeMesh = new THREE.Mesh(probeGeo, probeMat);
        probeMesh.position.y = profileMaxY;
        group.add(probeMesh);

        const bedTetherGeo = new THREE.BufferGeometry();
        const tetherVerts = new Float32Array([
          0, profileMaxY, 0,
          0, seafloorY, 0
        ]);
        bedTetherGeo.setAttribute('position', new THREE.BufferAttribute(tetherVerts, 3));
        const tetherMat = new THREE.LineDashedMaterial({
          color: 0x475569,
          dashSize: 0.35,
          gapSize: 0.25,
          transparent: true,
          opacity: 0.45
        });
        const tetherLine = new THREE.Line(bedTetherGeo, tetherMat);
        tetherLine.computeLineDistances();
        group.add(tetherLine);
      }

      scene.add(group);
      floatMarkersRef.current.push({
        group,
        clickableMesh: buoyMesh,
        buoyMesh,
        obsData: obs
      });
    });
  }, [observations, selectedObservation, showArgoTracks]);

  // Update Bed Visibility & Wireframe
  useEffect(() => {
    if (bedMeshRef.current) {
      bedMeshRef.current.visible = showOceanBed;
    }
    if (bedWireframeMeshRef.current) {
      bedWireframeMeshRef.current.visible = showOceanBed && bedWireframe;
    }
  }, [showOceanBed, bedWireframe]);

  // Handle Play/Pause Time Animation
  useEffect(() => {
    let timer;
    if (isPlayingTime) {
      timer = setInterval(() => {
        onTimeChange(prev => (prev + 1) % 5);
      }, 2500);
    }
    return () => clearInterval(timer);
  }, [isPlayingTime, onTimeChange]);

  const resetCamera = () => {
    if (!controlsRef.current || !cameraRef.current) return;
    cameraRef.current.position.set(0, 36, 32);
    controlsRef.current.target.set(0, -6.5, 0);
    controlsRef.current.update();
  };

  const activeCountryObj = REGIONAL_COUNTRIES.find(c => c.id === selectedCountry);

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] overflow-hidden bg-[#ECF4E8] text-slate-950 select-none">
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* FLOATING TOP-RIGHT "DATA CHUNK LOADED" TOAST */}
      {chunkNotification && (
        <div className="absolute top-3 right-4 z-30 ocean-glass-elevated px-4 py-2.5 rounded-2xl border-2 border-emerald-500 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
            </span>
            <span className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              <span>Loaded</span>
            </span>
          </div>

          <div className="h-4 w-px bg-slate-300"></div>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-blue-900 font-black capitalize">{chunkNotification.variable}</span>
            <span className="text-slate-500 font-bold">@</span>
            <span className="text-emerald-900 font-black">{chunkNotification.depth} m</span>
            <span className="text-slate-800 text-xs font-bold hidden sm:inline">
              ({chunkNotification.stats.min?.toFixed(1)} – {chunkNotification.stats.max?.toFixed(1)} {chunkNotification.unit})
            </span>
          </div>

          <div className="h-4 w-px bg-slate-300 hidden md:block"></div>

          <div className="text-xs text-emerald-900 hidden md:flex items-center gap-1.5 font-black">
            <span>QC OK</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-700">{chunkNotification.timestamp}</span>
          </div>

          <button
            onClick={() => setChunkNotification(null)}
            className="text-slate-500 hover:text-black p-0.5 rounded-lg transition-colors ml-1 cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* TOP-LEFT CONTROLS: Variable Selector + Ocean Bed Toggle + Country Borders Toggle */}
      <div className="absolute top-3 left-4 z-20 flex flex-col gap-2.5 max-w-[calc(100vw-360px)]">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Variable Pills */}
          <div className="ocean-glass rounded-2xl p-1.5 flex items-center gap-1.5 shadow-xl border-2 border-slate-300">
            {[
              { id: 'temperature', label: 'Temperature' },
              { id: 'salinity', label: 'Salinity' },
              { id: 'currents', label: 'Currents' },
              { id: 'chlorophyll', label: 'Chlorophyll' },
              { id: 'ssh', label: 'SSH' }
            ].map(v => (
              <button
                key={v.id}
                onClick={() => onSelectVariable(v.id)}
                className={`px-4 py-2 rounded-xl text-sm transition-all cursor-pointer ${
                  activeVariable === v.id
                    ? 'bg-blue-600 text-white font-black shadow-md'
                    : 'text-slate-900 font-bold hover:text-black hover:bg-slate-100'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Ocean Bed Quick Toggle */}
          <button
            onClick={() => setShowOceanBed(!showOceanBed)}
            className={`ocean-glass px-4 py-2 rounded-2xl text-sm flex items-center gap-2 transition-all shadow-xl cursor-pointer ${
              showOceanBed
                ? 'text-blue-900 border-2 border-blue-600 bg-blue-50 font-black shadow-md'
                : 'text-slate-900 border-2 border-slate-300 hover:text-black hover:bg-slate-100 font-bold'
            }`}
            title="Toggle 3D Seafloor Bathymetry Bed"
          >
            <Layers className="w-4 h-4 text-blue-600 stroke-[2.5]" />
            <span>Ocean Bed</span>
          </button>

          {/* Country Borders Toggle */}
          <button
            onClick={() => setShowCountryBorders(!showCountryBorders)}
            className={`ocean-glass px-4 py-2 rounded-2xl text-sm flex items-center gap-2 transition-all shadow-xl cursor-pointer ${
              showCountryBorders
                ? 'text-emerald-900 border-2 border-emerald-600 bg-emerald-50 font-black shadow-md'
                : 'text-slate-900 border-2 border-slate-300 hover:text-black hover:bg-slate-100 font-bold'
            }`}
            title="Highlight Coastal Borders & Landmasses"
          >
            <Flag className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
            <span>Country Borders</span>
          </button>

          {/* Landmass Toggle */}
          <button
            onClick={() => setShowLandmass(!showLandmass)}
            className={`ocean-glass px-4 py-2 rounded-2xl text-sm transition-all shadow-xl cursor-pointer ${
              showLandmass
                ? 'text-slate-950 border-2 border-slate-800 bg-slate-100 font-black'
                : 'text-slate-900 border-2 border-slate-300 hover:text-black hover:bg-slate-100 font-bold'
            }`}
            title="Toggle Landmass Shading"
          >
            Land Mask
          </button>
        </div>

        {/* REGIONAL WATER BODIES & COUNTRY SELECTOR STRIP */}
        {showCountryBorders && (
          <div className="ocean-glass rounded-2xl p-2.5 flex items-center gap-2.5 text-sm shadow-2xl max-w-4xl overflow-x-auto border-2 border-slate-300">
            <span className="text-sm font-black text-slate-950 uppercase tracking-wider pl-1.5 flex items-center gap-1.5 shrink-0">
              <Globe2 className="w-4 h-4 text-emerald-700" />
              <span>Highlight:</span>
            </span>

            {/* Country Highlight Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setSelectedCountry('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  selectedCountry === 'ALL'
                    ? 'bg-slate-900 text-white font-black shadow-md'
                    : 'text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 font-bold'
                }`}
              >
                All Coastlines
              </button>

              {REGIONAL_COUNTRIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCountry(c.id);
                    focusOnRegion(c.capitalLat, c.capitalLon, 36);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    selectedCountry === c.id
                      ? 'bg-[#CBF3BB] text-slate-950 border-2 border-emerald-700 font-black shadow-md'
                      : 'text-slate-900 bg-white border border-slate-300 hover:bg-slate-100'
                  }`}
                  title={`${c.name} (${c.coastlineKm} km coastline)`}
                >
                  <span className="text-sm">{c.flag}</span>
                  <span className="font-bold">{c.name}</span>
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-slate-300 shrink-0"></div>

            {/* Water Body Focus Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => focusOnRegion(16.0, 66.0, 36)}
                className="px-3 py-1.5 rounded-lg text-xs font-black text-blue-900 bg-blue-50 border-2 border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                title="Focus on Arabian Sea basin"
              >
                🌊 Arabian Sea
              </button>
              <button
                onClick={() => focusOnRegion(15.0, 88.0, 36)}
                className="px-3 py-1.5 rounded-lg text-xs font-black text-blue-900 bg-blue-50 border-2 border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                title="Focus on Bay of Bengal basin"
              >
                🌊 Bay of Bengal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* COUNTRY HIGHLIGHT INFO DRAWER (When a country is selected) */}
      {selectedCountry !== 'ALL' && activeCountryObj && (
        <div className="absolute top-28 left-4 z-20 ocean-glass-elevated rounded-2xl p-4 w-80 border-2 border-emerald-600 shadow-2xl animate-in slide-in-from-left duration-200 text-slate-950">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{activeCountryObj.flag}</span>
              <div>
                <h3 className="text-base font-black text-slate-950 tracking-tight">{activeCountryObj.name}</h3>
                <span className="text-xs font-mono text-emerald-800 font-extrabold">{activeCountryObj.tag}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedCountry('ALL')}
              className="text-slate-500 hover:text-black p-1 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="py-2.5 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-700 font-bold">Coastline Length:</span>
              <span className="font-mono text-slate-950 font-black">{activeCountryObj.coastlineKm.toLocaleString()} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-700 font-bold">Border Highlight:</span>
              <span className="text-emerald-800 font-black font-mono">ACTIVE (Mint Outline)</span>
            </div>
            <p className="text-xs text-slate-700 font-medium leading-snug pt-1">
              {activeCountryObj.description}
            </p>
          </div>

          <div className="pt-2.5 border-t border-slate-200">
            <button
              onClick={() => focusOnRegion(activeCountryObj.capitalLat, activeCountryObj.capitalLon, 32)}
              className="w-full py-2 rounded-xl text-xs font-black text-slate-950 bg-[#CBF3BB] hover:bg-[#ABE7B2] transition-all flex items-center justify-center gap-1.5 shadow-md border-2 border-emerald-700 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-800 stroke-[2.5]" />
              <span>Center Camera on {activeCountryObj.name}</span>
            </button>
          </div>
        </div>
      )}

      {/* LEFT WATER COLUMN DEPTH RULER (Visual Depth Clearance Indicator) */}
      <div className="absolute left-4 bottom-24 z-20 ocean-glass rounded-2xl p-4 text-sm text-slate-900 space-y-2.5 border-2 border-slate-300 shadow-2xl min-w-[240px]">
        <div className="text-sm font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
          <Compass className="w-4 h-4 text-blue-600 stroke-[2.5]" />
          <span>Water Column Profile</span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center text-blue-900 font-black">
            <span>0 m</span>
            <span className="text-slate-950 font-bold text-sm">Sea Surface</span>
          </div>
          <div className="flex justify-between items-center text-sky-800 font-black">
            <span>100 m</span>
            <span className="text-slate-900 font-bold text-sm">Thermocline</span>
          </div>
          <div className="flex justify-between items-center text-emerald-800 font-black">
            <span>1,000 m</span>
            <span className="text-slate-900 font-bold text-sm">Argo Park Depth</span>
          </div>
          <div className="flex justify-between items-center text-emerald-900 font-black">
            <span>2,000 m</span>
            <span className="text-slate-950 font-bold text-sm">Argo Max Profile</span>
          </div>
        </div>

        {/* Clear Abyssal Space Callout */}
        <div className="pt-2 border-t border-slate-200 bg-emerald-50 p-2.5 rounded-xl text-xs border border-emerald-300">
          <div className="text-emerald-950 font-black flex items-center gap-1.5">
            <ArrowDown className="w-4 h-4 text-emerald-800 stroke-[2.5]" />
            <span>1,800m+ Space Clearance</span>
          </div>
          <span className="text-slate-900 font-bold text-xs block mt-0.5">Deep abyssal waters down to ocean bed</span>
        </div>

        <div className="flex justify-between items-center text-blue-950 pt-2 border-t border-slate-200 font-black text-sm">
          <span>~3,850 m</span>
          <span className="text-slate-950 font-black text-sm">Seafloor Bed</span>
        </div>
      </div>

      {/* RIGHT FLOATING CONTROL: The Interactive Depth Arrow Scrubber */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
        <DepthArrowScrubber
          currentDepth={activeDepth}
          onDepthChange={onDepthChange}
          showOceanBed={showOceanBed}
          onToggleOceanBed={setShowOceanBed}
          isLoadingChunk={isLoadingChunk}
        />
      </div>

      {/* BOTTOM-LEFT: Minimal Scientific Color Scale */}
      <div className="absolute bottom-4 left-4 z-20 ocean-glass rounded-2xl p-4 text-sm w-80 shadow-2xl border-2 border-slate-300">
        <div className="flex justify-between items-center text-sm text-slate-950 mb-2">
          <span className="font-black capitalize text-slate-950 text-sm">{activeVariable} Scale</span>
          <span className="text-slate-700 font-bold text-xs">[{sliceData?.unit || '°C'}]</span>
        </div>
        <div 
          className="w-full h-3.5 rounded-full shadow-inner border border-slate-400"
          style={{
            background: activeVariable === 'salinity'
              ? 'linear-gradient(to right, #059669, #0284c7, #4f46e5, #9333ea)'
              : activeVariable === 'currents'
              ? 'linear-gradient(to right, #082f49, #0284c7, #06b6d4, #facc15)'
              : 'linear-gradient(to right, #0c4a6e, #0284c7, #10b981, #f59e0b, #ef4444)'
          }}
        />
        <div className="flex justify-between text-xs text-slate-950 mt-2 font-bold">
          <span>{sliceData?.stats?.min ?? 20} {sliceData?.unit || '°C'}</span>
          <span className="text-blue-900 font-black">Mean: {sliceData?.stats?.mean ?? 28}</span>
          <span>{sliceData?.stats?.max ?? 32} {sliceData?.unit || '°C'}</span>
        </div>
      </div>

      {/* BOTTOM-CENTER: Clean Time Step Scrubber */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 ocean-glass rounded-2xl px-5 py-2.5 flex items-center gap-3.5 shadow-2xl border-2 border-slate-300">
        <button
          onClick={() => setIsPlayingTime(!isPlayingTime)}
          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-sm cursor-pointer"
          title={isPlayingTime ? "Pause Timeline" : "Play Timeline Animation"}
        >
          {isPlayingTime ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
        </button>

        <div className="flex items-center gap-1.5 text-sm font-mono text-slate-950 font-black">
          <span>Day {activeTimeIndex + 1}</span>
          <span className="text-slate-400">/</span>
          <span className="text-blue-700 font-black">5</span>
        </div>

        <input
          type="range"
          min="0"
          max="4"
          step="1"
          value={activeTimeIndex}
          onChange={(e) => onTimeChange(Number(e.target.value))}
          className="w-28 accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
        />

        <button
          onClick={resetCamera}
          className="p-2 text-slate-700 hover:text-black rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          title="Reset Camera View"
        >
          <RotateCcw className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* SELECTED FLOAT POPUP DRAWER (Bottom-Right) */}
      {selectedObservation && (
        <div className="absolute bottom-4 right-44 z-20 ocean-glass-elevated rounded-2xl p-5 w-96 shadow-2xl border-2 border-slate-300 animate-in slide-in-from-bottom duration-200 text-slate-950">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <div className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                {selectedObservation.type} Observation Platform
              </div>
              <h3 className="text-base font-black text-slate-950 tracking-tight" title={selectedObservation.name}>
                {selectedObservation.id}
              </h3>
            </div>
            <button
              onClick={() => onSelectObservation(null)}
              className="text-slate-500 hover:text-black p-1 text-base font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-800 font-bold">Coordinates:</span>
              <span className="text-slate-950 font-black">{selectedObservation.latitude.toFixed(2)}°N, {selectedObservation.longitude.toFixed(2)}°E</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-800 font-bold">Surface Temperature:</span>
              <span className="text-blue-700 font-black">{selectedObservation.surface_temp} °C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-800 font-bold">Surface Salinity:</span>
              <span className="text-emerald-700 font-black">{selectedObservation.surface_salinity} PSU</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-800 font-bold">Argo Profiling Depth:</span>
              <span className="text-blue-900 font-black">0 – {selectedObservation.depth_range?.[1] || 2000} m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-800 font-bold">Seafloor Depth:</span>
              <span className="text-blue-700 font-black">
                ~{getSeafloorDepth(selectedObservation.latitude, selectedObservation.longitude)} m
              </span>
            </div>
            <div className="flex justify-between text-emerald-950 font-black text-xs pt-1.5 border-t border-slate-200 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
              <span>Seabed Clearance:</span>
              <span className="text-blue-800 font-black">
                ~{Math.max(0, getSeafloorDepth(selectedObservation.latitude, selectedObservation.longitude) - (selectedObservation.depth_range?.[1] || 2000))} m Space
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex gap-2">
            <button
              onClick={() => onOpenCompare(selectedObservation.id)}
              className="flex-1 py-2.5 rounded-xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md cursor-pointer"
            >
              Compare with Model
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
