import "./touch-visual-fix.js";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createPlayerController } from "./core/player-controller.js";
import { bindInput } from "./core/input-controller.js";
import { createGameAudio } from "./core/game-audio.js";
import { advanceNeighborQuestStep, isCourierEncounterActive, normalizeNeighborQuestStep } from "./core/story-rules.js";
import { moveVehicleWithCollisions, stepVehicleDynamics, vehicleAabb, VEHICLE_TUNING } from "./core/vehicle-controller.js";
import { buildApartmentInterior } from "./world/apartment-interior.js";
import { createBuildingElevationResolver } from "./world/building-navigation.js";
import { calculateFloorSlabSegments, calculatePanelakLayout, calculateElevatorShaftLayout, calculateEntranceDoorLayout, calculateEntranceBellLayout, calculateApartmentDoorPlacement, calculateRoofGuardrailSegments } from "./world/building-geometry.js";
import { createBuildingElevator } from "./world/building-elevator.js";
import { createVehicleCameraRig } from "./world/vehicle-camera.js";
import { calculateVehicleModelFit, isFavoritWheelMesh } from "./world/vehicle-model.js";
import { restoreBuildingDoorStates, serializeBuildingDoorStates } from "./world/building-state.js";
import { resolvePrimaryMenuAction } from "./ui/menu-flow.js";
import { describeStartupError, WEBGL_RENDERER_OPTIONS } from "./ui/startup-error.js";

function showStartupError(error){
  const root=document.getElementById("startupError");
  if(!root){console.error("MÍR 12 startup failed",error);return;}
  const status=describeStartupError(error);
  document.getElementById("startupErrorTitle").textContent=status.title;
  document.getElementById("startupErrorMessage").textContent=status.message;
  document.getElementById("startupErrorSteps").textContent=status.steps;
  document.getElementById("startupErrorDetail").textContent=status.detail;
  root.hidden=false;
  document.getElementById("menuScreen")?.setAttribute("aria-hidden","true");
  document.getElementById("startupRetry")?.addEventListener("click",()=>window.location.reload(),{once:true});
  console.error("MÍR 12 startup failed",error);
}

function bootGame(){
let renderer=null;
try{
const gameAudio=createGameAudio();
const unlockGameAudio=()=>gameAudio.unlock();
window.addEventListener("pointerdown",unlockGameAudio,{once:true,capture:true});
window.addEventListener("keydown",unlockGameAudio,{once:true,capture:true});
const $ = id => document.getElementById(id);
const mount = $("game"), coordinates = $("coordinates"), toast = $("toast"), hint = $("hint");
const pauseScreen = $("pauseScreen"), combatPanel = $("combatPanel");
const SAVE_KEY = "mir12-save-v1";
function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "null") || {}; }
  catch { return {}; }
}
const saved = readSave();
let neighborQuestStep=normalizeNeighborQuestStep(saved.neighborQuestStep);
const savedVehicleSafe=saved.vehicle&&Math.abs(saved.vehicle.x)<=23&&saved.vehicle.z>-101&&saved.vehicle.z<34;
const savedInVehicle=Boolean(saved.inVehicle&&savedVehicleSafe);
let totalPlaySeconds=Number(saved.playSeconds)||0;
let endingChoice=saved.ending||null;
const mission = { stage: Math.max(0, Math.min(5, saved.missionStage || 0)), complete: false };
const state = { started: false, paused: false, combat: false, dialogue: false, inVehicle: savedInVehicle, inventory:false };
const stats = { hp: 74, maxHp: 74, energy: 32, maxEnergy: 32, xp: 0, level: 1, credits: 120, medkits: 2, weaponLevel:0, armorLevel:0, guard: false, ...saved.stats };
const foe = { hp: 42, maxHp: 42, defeated: Boolean(saved.foeDefeated), busy: false };
const secondFoe = { hp: 68, maxHp: 68, defeated: Boolean(saved.courierDefeated), busy: false };
let activeFoe=foe;
let combatSelection = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x536170);
scene.fog = new THREE.Fog(0x536170, 74, 156);
const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 220);
scene.add(camera);
if(savedInVehicle){camera.fov=80;camera.updateProjectionMatrix();}
let rendererError=null;
for(const options of WEBGL_RENDERER_OPTIONS){
  try{renderer=new THREE.WebGLRenderer(options);break;}
  catch(error){rendererError=error;}
}
if(!renderer)throw rendererError??new Error("WebGL 2 is unavailable.");
const touchDevice=matchMedia("(pointer: coarse)").matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touchDevice ? 1.35 : 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.domElement.id = "screenCanvas";
renderer.domElement.setAttribute("aria-label", "Mír 12 — 3D herní scéna");
renderer.domElement.tabIndex = 0;
mount.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xb8c7d2, 0x34332f, .92));
const sun = new THREE.DirectionalLight(0xf0d1a5, 2.05);
sun.position.set(-42, 72, 28);
sun.target.position.set(0, 0, -30);
sun.castShadow = true;
sun.shadow.mapSize.set(touchDevice ? 1024 : 2048, touchDevice ? 1024 : 2048);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 64;
sun.shadow.camera.bottom = -64;
sun.shadow.camera.near = .5;
sun.shadow.camera.far = 180;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -.00015;
sun.shadow.normalBias = .025;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
const fill = new THREE.PointLight(0xffbd7d, 5.2, 32, 2);
fill.position.set(4.8, 4.2, -5);
scene.add(fill);

const colliders = [];
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map();
function material(color, roughness = .86, emissive = 0, intensity = 0) {
  const key = `${color}/${roughness}/${emissive}/${intensity}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness, emissive, emissiveIntensity: intensity }));
  return mats.get(key);
}
let plasterTexture = null;
const plasterMaterials = new Map();
function getPlasterTexture() {
  if (plasterTexture) return plasterTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const context = canvas.getContext("2d");
  const image = context.createImageData(128,128);
  for (let y=0;y<128;y++) for(let x=0;x<128;x++) {
    const i=(y*128+x)*4;
    const grain=Math.abs(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;
    const value=205+Math.round(grain*48);
    image.data[i]=image.data[i+1]=image.data[i+2]=value;
    image.data[i+3]=255;
  }
  context.putImageData(image,0,0);
  plasterTexture=new THREE.CanvasTexture(canvas);
  plasterTexture.colorSpace=THREE.SRGBColorSpace;
  plasterTexture.wrapS=plasterTexture.wrapT=THREE.RepeatWrapping;
  plasterTexture.repeat.set(3.5,3.5);
  plasterTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  return plasterTexture;
}
let microSurfaceTexture = null;
function getMicroSurfaceTexture() {
  if (microSurfaceTexture) return microSurfaceTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4;
    const grain = Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
    const fine = Math.abs(Math.sin(x * 19.19 + y * 73.73) * 9631.417) % 1;
    const value = Math.max(0, Math.min(255, 142 + Math.round(grain * 72 + fine * 28)));
    image.data[index] = image.data[index + 1] = image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  microSurfaceTexture = new THREE.CanvasTexture(canvas);
  microSurfaceTexture.colorSpace = THREE.NoColorSpace;
  microSurfaceTexture.wrapS = microSurfaceTexture.wrapT = THREE.RepeatWrapping;
  microSurfaceTexture.repeat.set(3.5, 3.5);
  microSurfaceTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return microSurfaceTexture;
}
function cloneMicroSurfaceTexture(repeatX = 3.5, repeatY = 3.5) {
  const texture = getMicroSurfaceTexture().clone();
  texture.repeat.set(repeatX, repeatY);
  texture.needsUpdate = true;
  return texture;
}
function plasterMaterial(color) {
  if(!plasterMaterials.has(color)) {
    const detail = cloneMicroSurfaceTexture(3.5, 3.5);
    plasterMaterials.set(color,new THREE.MeshStandardMaterial({
      color,
      map:getPlasterTexture(),
      roughness:.94,
      roughnessMap:detail,
      bumpMap:detail,
      bumpScale:.022
    }));
  }
  return plasterMaterials.get(color);
}
let woodFloorTexture = null;
function getWoodFloorTexture() {
  if (woodFloorTexture) return woodFloorTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ded2bf";
  context.fillRect(0, 0, 256, 256);
  const plankTones = ["#e4d8c5", "#d8c9b3", "#e0d3c0", "#d9cbb6"];
  for (let plank = 0; plank < 4; plank++) {
    const top = plank * 64;
    context.fillStyle = plankTones[plank];
    context.fillRect(0, top + 1, 256, 62);
    context.strokeStyle = "rgba(80,59,39,.18)";
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(0, top + 1); context.lineTo(256, top + 1); context.stroke();
    context.strokeStyle = "rgba(93,69,46,.11)";
    context.lineWidth = 1;
    for (let line = 0; line < 9; line++) {
      const y = top + 8 + line * 6;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(66, y - 2, 176, y + 2, 256, y);
      context.stroke();
    }
    context.fillStyle = "rgba(86,61,39,.13)";
    context.fillRect((plank % 2) * 118 + 82, top + 1, 1, 62);
  }
  woodFloorTexture = new THREE.CanvasTexture(canvas);
  woodFloorTexture.colorSpace = THREE.SRGBColorSpace;
  woodFloorTexture.wrapS = woodFloorTexture.wrapT = THREE.RepeatWrapping;
  woodFloorTexture.repeat.set(1.5, 1.5);
  woodFloorTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return woodFloorTexture;
}
let tileFloorTexture = null;
function getTileFloorTexture() {
  if (tileFloorTexture) return tileFloorTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = "#e7e4da";
  context.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    const tone = (row + column) % 2 ? "#e4e1d7" : "#eeebe2";
    context.fillStyle = tone;
    context.fillRect(column * 64 + 2, row * 64 + 2, 60, 60);
  }
  context.strokeStyle = "rgba(82,88,83,.38)";
  context.lineWidth = 3;
  for (let point = 0; point <= 256; point += 64) {
    context.beginPath(); context.moveTo(point, 0); context.lineTo(point, 256); context.stroke();
    context.beginPath(); context.moveTo(0, point); context.lineTo(256, point); context.stroke();
  }
  tileFloorTexture = new THREE.CanvasTexture(canvas);
  tileFloorTexture.colorSpace = THREE.SRGBColorSpace;
  tileFloorTexture.wrapS = tileFloorTexture.wrapT = THREE.RepeatWrapping;
  tileFloorTexture.repeat.set(1, 1);
  tileFloorTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return tileFloorTexture;
}
const apartmentFinishMaterials = new Map();
function apartmentFinishMaterial(color, surface) {
  const key = color + "/" + surface;
  if (!apartmentFinishMaterials.has(key)) {
    const detail = cloneMicroSurfaceTexture(surface === "woodFloor" ? 2.5 : 4, surface === "woodFloor" ? 2.5 : 4);
    const isWood = surface === "woodFloor";
    apartmentFinishMaterials.set(key, new THREE.MeshStandardMaterial({
      color,
      map: isWood ? getWoodFloorTexture() : getTileFloorTexture(),
      roughness: isWood ? .82 : .58,
      roughnessMap: detail,
      bumpMap: detail,
      bumpScale: isWood ? .009 : .004,
      metalness: 0
    }));
  }
  return apartmentFinishMaterials.get(key);
}
const facadeMaterials={
  windowDark:new THREE.MeshStandardMaterial({color:0x26363c,roughness:.3,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}),
  windowLit:new THREE.MeshStandardMaterial({color:0xe7b46a,roughness:.48,emissive:0xa86730,emissiveIntensity:.48,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false}),
  frame:material(0xa6aaa6,.82),
  joint:material(0x596266,.96),
  slab:material(0x727a79,.9),
  rail:material(0x485153,.62),
  pipe:material(0x4a5354,.74),
  glass:new THREE.MeshPhysicalMaterial({color:0xc4d6d8,roughness:.2,metalness:.035,clearcoat:.72,clearcoatRoughness:.18,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}),
  laundry:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95})
};
const facadeInstances=new Map();
function queueFacadePart(type,x,y,z,w,h,d,color=null){
  if(!facadeInstances.has(type))facadeInstances.set(type,[]);
  facadeInstances.get(type).push({x,y,z,w,h,d,color});
}
function flushFacadeParts(){
  for(const [type,parts] of facadeInstances){
    const mesh=new THREE.InstancedMesh(boxGeo,facadeMaterials[type],parts.length);
    mesh.name=`fasádní prvky · ${type}`;mesh.castShadow=false;mesh.receiveShadow=true;
    if(type==="glass")mesh.renderOrder=8;
    else if(type==="windowDark"||type==="windowLit")mesh.renderOrder=6;
    const position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),matrix=new THREE.Matrix4();
    for(let index=0;index<parts.length;index++){
      const part=parts[index];position.set(part.x,part.y,part.z);scale.set(part.w,part.h,part.d);matrix.compose(position,rotation,scale);mesh.setMatrixAt(index,matrix);
      if(part.color!==null)mesh.setColorAt(index,new THREE.Color(part.color));
    }
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();scene.add(mesh);
  }
  facadeInstances.clear();
}
const phoneGroup=new THREE.Group();
phoneGroup.position.set(.38,-.22,-.56);phoneGroup.rotation.set(-.08,-.18,-.08);phoneGroup.visible=false;camera.add(phoneGroup);
let phoneDrawn=false;
const phoneHand=new THREE.Mesh(new THREE.BoxGeometry(.145,.22,.095),material(0x8b6d57,.94));phoneHand.position.set(0,-.16,-.055);phoneHand.rotation.z=-.08;phoneGroup.add(phoneHand);
const phoneBody=new THREE.Mesh(new THREE.BoxGeometry(.122,.238,.026),material(0x242725,.34,.02,.08));phoneBody.position.set(0,.015,0);phoneBody.castShadow=true;phoneGroup.add(phoneBody);
const phoneBezel=new THREE.Mesh(new THREE.BoxGeometry(.104,.148,.006),material(0x080d0b,.25));phoneBezel.position.set(0,.045,.016);phoneGroup.add(phoneBezel);
const phoneScreenCanvas=document.createElement("canvas");phoneScreenCanvas.width=256;phoneScreenCanvas.height=360;
const phoneScreenContext=phoneScreenCanvas.getContext("2d");
phoneScreenContext.fillStyle="#07130d";phoneScreenContext.fillRect(0,0,256,360);
phoneScreenContext.fillStyle="#a8e1ad";phoneScreenContext.font="bold 25px monospace";phoneScreenContext.fillText("MÍR 12",20,42);
phoneScreenContext.fillStyle="#d3e6ce";phoneScreenContext.font="18px monospace";phoneScreenContext.fillText("07:45",20,88);
phoneScreenContext.fillStyle="#7bbd86";phoneScreenContext.fillRect(20,112,216,2);
phoneScreenContext.font="15px monospace";phoneScreenContext.fillText("SIGNÁL 03",20,151);phoneScreenContext.fillText("ZPRÁVY  02",20,183);phoneScreenContext.fillText("VOLÁNÍ",20,215);
phoneScreenContext.fillStyle="#6caa76";for(let bar=0;bar<4;bar++)phoneScreenContext.fillRect(20+bar*13,248,8,12+(bar%2)*12);
const phoneScreenTexture=new THREE.CanvasTexture(phoneScreenCanvas);phoneScreenTexture.colorSpace=THREE.SRGBColorSpace;
const phoneScreen=new THREE.Mesh(new THREE.PlaneGeometry(.091,.132),new THREE.MeshBasicMaterial({map:phoneScreenTexture,toneMapped:false}));phoneScreen.position.set(0,.045,.020);phoneGroup.add(phoneScreen);
const phoneSpeaker=new THREE.Mesh(new THREE.BoxGeometry(.035,.004,.002),material(0x9eaa9e,.55));phoneSpeaker.position.set(0,.121,.017);phoneGroup.add(phoneSpeaker);
for(let row=0;row<3;row++)for(let column=0;column<3;column++){const key=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.003,8),material(0x858c82,.62));key.rotation.x=Math.PI/2;key.position.set((column-1)*.021,-.065-row*.018,.019);phoneGroup.add(key);}
const phoneAntenna=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,.052,6),material(0x858a80,.5));phoneAntenna.position.set(.047,.15,-.002);phoneAntenna.rotation.z=-.12;phoneGroup.add(phoneAntenna);
function block(name, x, y, z, w, h, d, color, solid = true, emissive = 0, intensity = 0, materialOverride = null) {
  const mesh = new THREE.Mesh(boxGeo, materialOverride ?? material(color, .88, emissive, intensity));
  mesh.name = name; mesh.position.set(x, y + h / 2, z); mesh.scale.set(w, h, d); mesh.castShadow = h > .9; mesh.receiveShadow = true; scene.add(mesh);
  if (solid) colliders.push({ name, minX:x-w/2, maxX:x+w/2, minZ:z-d/2, maxZ:z+d/2, minY:y, maxY:y+h });
  return mesh;
}
const apartmentBlockBatches=new Map();
function queueApartmentBlock(name,x,y,z,w,h,d,color,solid=false){
  const surface=name.includes("parketová podlaha")?"woodFloor":name.includes("koupelnová dlažba")?"tileFloor":"plain";
  const key=String(color)+"/"+surface;
  if(!apartmentBlockBatches.has(key))apartmentBlockBatches.set(key,{color,surface,items:[]});
  apartmentBlockBatches.get(key).items.push({name,x,y,z,w,h,d});
  if(solid)colliders.push({name,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:y,maxY:y+h});
}
function flushApartmentBlocks(){
  const position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),matrix=new THREE.Matrix4();
  let total=0;
  for(const batch of apartmentBlockBatches.values()){
    const surfaceMaterial=batch.surface==="woodFloor"||batch.surface==="tileFloor"
      ?apartmentFinishMaterial(batch.color,batch.surface)
      :material(batch.color,.88);
    const instances=new THREE.InstancedMesh(boxGeo,surfaceMaterial,batch.items.length);
    instances.name="bytový interiér — sdílené stavební a nábytkové instance";
    instances.castShadow=true;instances.receiveShadow=true;
    for(let index=0;index<batch.items.length;index++){
      const item=batch.items[index];
      position.set(item.x,item.y+item.h/2,item.z);
      scale.set(item.w,item.h,item.d);
      matrix.compose(position,rotation,scale);
      instances.setMatrixAt(index,matrix);
    }
    instances.instanceMatrix.needsUpdate=true;
    instances.computeBoundingBox();instances.computeBoundingSphere();
    scene.add(instances);
    total+=batch.items.length;
  }
  apartmentBlockBatches.clear();
  return total;
}
function beamBetween(name,start,end,size,color){
  const direction=new THREE.Vector3(end.x-start.x,end.y-start.y,end.z-start.z);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(size,direction.length(),size),material(color,.72));
  mesh.name=name;mesh.position.set((start.x+end.x)/2,(start.y+end.y)/2,(start.z+end.z)/2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());scene.add(mesh);return mesh;
}
function buildWalkablePanelak(x,z,width,depth,height,inward,options={}){
  const wall=.32,storyCount=Math.max(2,Math.round(height/2.9)),storyHeight=height/storyCount;
  const buildingId=options.id||"PANELÁK",kind=options.kind||"panelak";
  const floorOffset=.18,entryStepLength=.9;
  const wallColor=options.wallColor||(kind==="tenement"?0x817365:kind==="shop"?0x788080:0x727c7e);
  const innerColor=kind==="tenement"?0xb6aa98:0xaaa79c;
  const shellMaterial=plasterMaterial(wallColor),partitionMaterial=plasterMaterial(innerColor);
  const floorPlan=calculatePanelakLayout({x,z,width,depth,inward,wall});
  const {frontX,frontWallX,backX,endWallCenters,stairX,landingX,flightLength,insideFront,insideBack,minHallX,maxHallX,hallHalf}=floorPlan;
  const concrete=wallColor,inner=innerColor,doorWidth=kind==="shop"?1.72:1.34;
  const halfFlight=8,run=flightLength/halfFlight,apartmentDoors=[];
  const elevatorDoorWidth=1.12,elevatorSideZ=1,elevatorLayout=calculateElevatorShaftLayout({stairX,inward,z,elevatorSideZ,hallHalf,doorWidth:elevatorDoorWidth,wall:.24});
  const elevatorRailStopX=elevatorLayout.centerX-inward*(elevatorDoorWidth/2+.16);
  const elevatorFloorHeights=Array.from({length:storyCount},(_,index)=>floorOffset+index*storyHeight);
  const elevatorMotion=createBuildingElevator(elevatorFloorHeights);
  const elevatorCab=new THREE.Group();elevatorCab.name=buildingId+" — kabina výtahu";
  elevatorCab.position.set(elevatorLayout.centerX,floorOffset-.12,elevatorLayout.cabCenterZ);elevatorCab.rotation.y=elevatorSideZ*Math.PI/2;scene.add(elevatorCab);
  const cabPart=(name,w,h,d,color,xp,yp,zp,roughness=.78)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,roughness));mesh.name=name;
    mesh.position.set(xp,yp,zp);mesh.castShadow=true;mesh.receiveShadow=true;elevatorCab.add(mesh);return mesh;
  };
  cabPart("výtah — podlaha",1.22,.12,1.28,0x777a76,0,.06,0);
  cabPart("výtah — zadní stěna",.07,2.22,1.28,0x8b8c84,-.57,1.17,0);
  cabPart("výtah — levá stěna",1.22,2.22,.07,0x99998f,0,1.17,-.605);
  cabPart("výtah — pravá stěna",1.22,2.22,.07,0x99998f,0,1.17,.605);
  cabPart("výtah — strop",1.22,.07,1.28,0x676e6b,0,2.27,0);
  cabPart("výtah — madlo",.05,.08,.72,0xb8b7a9,.43,1.0,.1,.52);
  cabPart("výtah — ovládací panel",.045,.55,.23,0x303a3b,.48,1.35,.36,.52);
  for(let button=0;button<storyCount;button++)cabPart("výtah — tlačítko "+(button+1),.025,.055,.055,0xd6c9a5,.51,1.55-button*.12,.36,.4);
  const cabDoorLeft=cabPart("výtah — levé dveře kabiny",.055,2.08,.55,0x9c9e97,.66,1.16,-.28,.58);
  const cabDoorRight=cabPart("výtah — pravé dveře kabiny",.055,2.08,.55,0x9c9e97,.66,1.16,.28,.58);
  const elevatorCabDoorCollider={name:buildingId+" — dveře kabiny výtahu",minX:elevatorLayout.centerX-.62,maxX:elevatorLayout.centerX+.62,minZ:elevatorLayout.doorPlaneZ-.07,maxZ:elevatorLayout.doorPlaneZ+.07,minY:floorOffset,maxY:floorOffset+2.08,enabled:true};
  const elevatorFloorDoors=[],elevatorCallInteractables=[];
  colliders.push(elevatorCabDoorCollider);
  const elevatorControlX=elevatorLayout.centerX+elevatorSideZ*.36;
  const elevatorControlZ=elevatorLayout.cabCenterZ-elevatorSideZ*.48;
  const elevatorUpInteractable={id:buildingId+" — výtah o patro výš",x:elevatorControlX-elevatorSideZ*.12,z:elevatorControlZ,levelY:floorOffset,verticalRange:.75,range:.75,enabled:false,
    action(){const next=Math.min(storyCount-1,elevatorMotion.currentFloor+1);if(next===elevatorMotion.currentFloor)return;elevatorMotion.rider=true;elevatorMotion.requestFloor(next);gameAudio.ui();showToast("VÝTAH · "+(next+1)+". PATRO");}};
  const elevatorDownInteractable={id:buildingId+" — výtah o patro níž",x:elevatorControlX+elevatorSideZ*.12,z:elevatorControlZ,levelY:floorOffset,verticalRange:.75,range:.75,enabled:false,
    action(){const next=Math.max(0,elevatorMotion.currentFloor-1);if(next===elevatorMotion.currentFloor)return;elevatorMotion.rider=true;elevatorMotion.requestFloor(next);gameAudio.ui();showToast("VÝTAH · "+(next+1)+". PATRO");}};
  const apartmentXs=[x];

  block(buildingId+" — základový sokl",x,0,z,width+.34,.18,depth+.34,kind==="tenement"?0x746b60:0x626a6b,false);
  block(buildingId+" — zadní obvodová stěna",backX,floorOffset,z,wall,height,depth,concrete,true,0,0,shellMaterial);
  const shaftHeight=height+.24;
  for(const side of [-1,1])block(buildingId+" — boční stěna výtahové šachty",
    elevatorLayout.sideWallXs[side<0?0:1],floorOffset,elevatorLayout.centerZ,
    elevatorLayout.wallThickness,shaftHeight,elevatorLayout.shaftDepth,concrete,true,0,0,shellMaterial);
  block(buildingId+" — zadní stěna výtahové šachty",elevatorLayout.centerX,floorOffset,elevatorLayout.backWallZ,
    elevatorLayout.shaftWidth,shaftHeight,elevatorLayout.wallThickness,concrete,true,0,0,shellMaterial);
  block(buildingId+" — strop výtahové šachty",elevatorLayout.centerX,floorOffset+height,elevatorLayout.centerZ,
    elevatorLayout.shaftWidth,.24,elevatorLayout.shaftDepth,0x676e6b,false);
  for(const sideZ of [-1,1]){
    const sideWallZ=sideZ<0?endWallCenters[0]:endWallCenters[1];
    block(buildingId+" — štítová stěna",x,floorOffset,sideWallZ,width,height,wall,concrete,true,0,0,shellMaterial);
    const outsideFaceZ=sideWallZ+sideZ*(wall/2+.012);
    queueFacadePart("slab",x,.09,outsideFaceZ,width+.04,.18,.035);
    for(let floorJoint=1;floorJoint<storyCount;floorJoint++)
      queueFacadePart("joint",x,floorOffset+floorJoint*storyHeight,outsideFaceZ,width-.26,.035,.025);
    const panelCount=Math.max(2,Math.round(width/3));
    for(let panelJoint=1;panelJoint<panelCount;panelJoint++)
      queueFacadePart("joint",x-width/2+width*panelJoint/panelCount,floorOffset+height/2,outsideFaceZ,.035,height-.2,.025);
  }

  for(let story=0;story<storyCount;story++){
    const base=floorOffset+story*storyHeight,top=base+storyHeight;
    const liftDoorZ=elevatorLayout.doorPlaneZ;
    if(storyHeight>2.08)block(buildingId+" — překlad výtahového vstupu",
      elevatorLayout.centerX,base+2.08,liftDoorZ,elevatorDoorWidth,storyHeight-2.08,.14,concrete,true,0,0,shellMaterial);
    const liftDoorLeft=new THREE.Mesh(new THREE.BoxGeometry(elevatorDoorWidth/2,2.08,.055),material(0x8f928d,.62));
    const liftDoorRight=new THREE.Mesh(new THREE.BoxGeometry(elevatorDoorWidth/2,2.08,.055),material(0x8f928d,.62));
    liftDoorLeft.name=buildingId+" — výtahové dveře vlevo · "+(story+1);
    liftDoorRight.name=buildingId+" — výtahové dveře vpravo · "+(story+1);
    liftDoorLeft.position.set(elevatorLayout.centerX-elevatorDoorWidth/4,base+1.04,liftDoorZ);
    liftDoorRight.position.set(elevatorLayout.centerX+elevatorDoorWidth/4,base+1.04,liftDoorZ);
    scene.add(liftDoorLeft,liftDoorRight);
    const liftDoorCollider={name:buildingId+" — zavřené dveře výtahu · "+(story+1),
      minX:elevatorLayout.centerX-elevatorDoorWidth/2,maxX:elevatorLayout.centerX+elevatorDoorWidth/2,
      minZ:liftDoorZ-.07,maxZ:liftDoorZ+.07,minY:base,maxY:base+2.08,enabled:story!==0};
    colliders.push(liftDoorCollider);
    elevatorFloorDoors.push({left:liftDoorLeft,right:liftDoorRight,collider:liftDoorCollider,base,floor:story});
    const callPanelX=elevatorLayout.centerX+inward*(elevatorDoorWidth/2+.065);
    const callPanelZ=liftDoorZ-elevatorSideZ*.10;
    const callX=callPanelX,callZ=liftDoorZ-elevatorSideZ*.42;
    block(buildingId+" — panel přivolání výtahu",callPanelX,base+1.08,callPanelZ,.10,.46,.06,0x343b3b,false);
    block(buildingId+" — tlačítko výtahu",callPanelX,base+1.27,callPanelZ-elevatorSideZ*.06,.05,.075,.025,0xd7c99e,false,0x9d8756,.12);
    elevatorCallInteractables.push({id:buildingId+" — přivolat výtah · "+(story+1)+". patro",x:callX,z:callZ,levelY:base,verticalRange:.55,range:1.25,enabled:true,
      action(){elevatorMotion.requestFloor(story);gameAudio.ui();showToast("VÝTAH · PŘIVOLÁNÍ DO "+(story+1)+". PATRA");}});
    const floorSlabSegments=calculateFloorSlabSegments({
      x,z,width,depth,stairX,landingX,storyIndex:story,
      elevatorOpening:elevatorLayout.opening,perimeterInset:.045
    });
    floorSlabSegments.forEach((segment,index)=>{
      block(buildingId+" — železobetonová podlahová deska "+(story+1)+". patra · "+(index+1),
        segment.x,base-.16,segment.z,segment.width,.16,segment.depth,0x777a76,false);
    });
    const corridorCenterX=(minHallX+maxHallX)/2,corridorWidth=maxHallX-minHallX;
    const corridorFloorSegments=calculateFloorSlabSegments({
      x:corridorCenterX,z,width:corridorWidth,depth:hallHalf*2,stairX,landingX,storyIndex:story,
      elevatorOpening:elevatorLayout.opening,perimeterInset:.025
    });
    corridorFloorSegments.forEach((segment,index)=>block(
      buildingId+" — nášlap chodby "+(story+1)+". patra · "+(index+1),
      segment.x,base+.001,segment.z,segment.width,.012,segment.depth,0x817d72,false
    ));
    const openings=[];
    for(let column=-2;column<=2;column++){
      if(story===0&&column===0){
        openings.push({kind:"door",z,width:doorWidth,bottom:base,top:base+2.18});
        continue;
      }
      const shopWindow=kind==="shop"&&story===0;
      openings.push({kind:"window",column,z:z+column*2.25,width:shopWindow?1.55:1.28,
        bottom:base+(shopWindow?.48:.68),top:base+(shopWindow?2.28:2.13)});
    }
    openings.sort((a,b)=>a.z-b.z);
    let cursor=z-depth/2;
    for(const opening of openings){
      const left=opening.z-opening.width/2,right=opening.z+opening.width/2;
      if(left-cursor>.05)block(buildingId+" — fasádní pilíř",frontWallX,base,(cursor+left)/2,wall,storyHeight,left-cursor,concrete,true,0,0,shellMaterial);
      if(opening.bottom>base+.03)block(buildingId+" — okenní parapet",frontWallX,base,opening.z,wall,opening.bottom-base,opening.width,concrete,true,0,0,shellMaterial);
      if(top-opening.top>.03)block(buildingId+" — nadpraží",frontWallX,opening.top,opening.z,wall,top-opening.top,opening.width,concrete,true,0,0,shellMaterial);

      if(opening.kind==="window"){
        const centerY=(opening.bottom+opening.top)/2,paneX=frontX+inward*.09,frameX=frontX+inward*.16;
        const lit=(story+Math.abs(opening.column*3)+Math.abs(Math.floor(z)))%5<2;
        queueFacadePart(lit?"windowLit":"windowDark",frontX-inward*.2,centerY,opening.z,.025,opening.top-opening.bottom-.08,opening.width-.1);
        queueFacadePart("glass",paneX,centerY,opening.z,.055,opening.top-opening.bottom,opening.width-.08);
        queueFacadePart("frame",frameX,centerY,opening.z-opening.width/2-.035,.08,opening.top-opening.bottom+.12,.07);
        queueFacadePart("frame",frameX,centerY,opening.z+opening.width/2+.035,.08,opening.top-opening.bottom+.12,.07);
        queueFacadePart("frame",frameX,opening.bottom-.015,opening.z,.08,.075,opening.width+.16);
        queueFacadePart("frame",frameX,opening.top+.015,opening.z,.08,.075,opening.width+.16);
        queueFacadePart("frame",frameX,centerY,opening.z,.08,opening.top-opening.bottom,.045);
        queueFacadePart("slab",frontX+inward*.22,opening.bottom-.08,opening.z,.24,.12,opening.width+.22);
        colliders.push({name:buildingId+" — zasklené okno",minX:paneX-.15,maxX:paneX+.15,
          minZ:opening.z-opening.width/2,maxZ:opening.z+opening.width/2,minY:opening.bottom,maxY:opening.top});
        block(buildingId+" — radiátor pod oknem",frontX-inward*.42,opening.bottom+.05,opening.z,.16,.42,.88,0x858b88,false);
        if(story>0&&Math.abs(opening.column)===2&&story<storyCount*.65&&story%3!==1){
          queueFacadePart("slab",frontX+inward*.48,base+.04,opening.z,.9,.14,1.76);
          queueFacadePart("rail",frontX+inward*.94,base+1.0,opening.z,.07,.065,1.76);
          for(const side of [-1,1])queueFacadePart("rail",frontX+inward*.74,base+.5,opening.z+side*.82,.48,.9,.07);
          for(let baluster=-2;baluster<=2;baluster++)queueFacadePart("rail",frontX+inward*.94,base+.5,opening.z+baluster*.31,.065,1.0,.065);
          if((story+opening.column)%2===0)queueFacadePart("laundry",frontX+inward*.7,base+1.1,opening.z+.16,.07,.57,.4,[0xbab29f,0x78889a,0x914f42,0xc7c3ad][Math.abs(opening.column+story)%4]);
        }
      }
      cursor=right;
    }
    if(z+depth/2-cursor>.05)block(buildingId+" — fasádní pilíř",frontWallX,base,(cursor+z+depth/2)/2,wall,storyHeight,z+depth/2-cursor,concrete,true,0,0,shellMaterial);

    for(const sideZ of [-1,1]){
      const wallZ=z+sideZ*hallHalf;
      const wallOpenings=[
        ...apartmentXs.map(doorX=>({type:"apartment",center:doorX,halfWidth:.48})),
        ...(sideZ===elevatorSideZ?[{type:"elevator",center:elevatorLayout.centerX,halfWidth:elevatorDoorWidth/2}]:[])
      ].sort((a,b)=>a.center-b.center);
      let wallCursor=minHallX;
      for(const opening of wallOpenings){
        const gapStart=opening.center-opening.halfWidth,gapEnd=opening.center+opening.halfWidth;
        if(gapStart-wallCursor>.08)block(buildingId+" — příčka chodby",(wallCursor+gapStart)/2,base,wallZ,gapStart-wallCursor,storyHeight,.14,inner,true,0,0,partitionMaterial);
        if(opening.type==="apartment"){
          const doorX=opening.center,doorFloorY=base+.013;
          const doorPlan=calculateApartmentDoorPlacement({doorX,wallZ,sideZ,floorY:doorFloorY});
          const apartmentDoor=new THREE.Group();
          apartmentDoor.name=buildingId+" — bytové dveře "+(story+1)+"."+(sideZ<0?"A":"B");
          apartmentDoor.position.set(doorPlan.pivotX,doorFloorY,doorPlan.pivotZ);scene.add(apartmentDoor);
          const doorLeaf=new THREE.Mesh(new THREE.BoxGeometry(.86,2.08,.055),material(story===0?0x69503d:0x75604c,.72));
          doorLeaf.position.set(.43,1.04,0);doorLeaf.castShadow=true;doorLeaf.receiveShadow=true;apartmentDoor.add(doorLeaf);
          const doorPanel=new THREE.Mesh(new THREE.BoxGeometry(.62,.72,.015),material(story===0?0x765b42:0x846d53,.86));
          doorPanel.position.set(.43,.55,.037);apartmentDoor.add(doorPanel);
          const doorHandle=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),material(0xc0ad79,.4));
          doorHandle.position.set(.73,1.03,.052);apartmentDoor.add(doorHandle);
          const apartmentDoorCollider={name:apartmentDoor.name,...doorPlan.collider,enabled:true};
          colliders.push(apartmentDoorCollider);
          apartmentDoors.push({x:doorPlan.approachX,z:doorPlan.approachZ,floorLevel:base,doorPivot:apartmentDoor,
            doorCollider:apartmentDoorCollider,openAngle:doorPlan.openAngle,open:false});
          for(const hinge of [-1,1])block("bytová zárubeň",doorX+hinge*.47,doorFloorY,wallZ+sideZ*.1,.07,2.2,.1,0x858073,false);
          block("bytová zárubeň — nadpraží",doorX,base+2.17,wallZ+sideZ*.1,1.01,.08,.1,0x858073,false);
          if(storyHeight>2.25)block(buildingId+" — stěna nad bytovými dveřmi",doorX,base+2.25,wallZ,.96,storyHeight-2.25,.14,inner,true,0,0,partitionMaterial);
        }
        wallCursor=gapEnd;
      }
      if(maxHallX-wallCursor>.08)block(buildingId+" — příčka chodby",(wallCursor+maxHallX)/2,base,wallZ,maxHallX-wallCursor,storyHeight,.14,inner,true,0,0,partitionMaterial);
      if(sideZ===elevatorSideZ&&storyHeight>2.08)block(buildingId+" — nadpraží výtahu",elevatorLayout.centerX,base+2.08,wallZ,elevatorDoorWidth,storyHeight-2.08,.14,inner,true,0,0,partitionMaterial);
      const roomDepth=depth/2-wall-hallHalf,roomCenterZ=z+sideZ*(hallHalf+roomDepth/2);
      for(let divider=0;divider<apartmentXs.length-1;divider++){
        const dividerX=(apartmentXs[divider]+apartmentXs[divider+1])/2;
        block(buildingId+" — vnitřní příčka bytu",dividerX,base,roomCenterZ,.12,storyHeight,roomDepth,0x99968c,true);
      }
      for(let unit=0;unit<apartmentXs.length;unit++){
        const unitX=apartmentXs[unit],tone=(unit+story+(sideZ>0?1:0))%3;
        const unitMinX=unit===0?minHallX:(apartmentXs[unit-1]+unitX)/2;
        const unitMaxX=unit===apartmentXs.length-1?maxHallX:(unitX+apartmentXs[unit+1])/2;
        buildApartmentInterior({
          THREE,scene,block:queueApartmentBlock,material,x:unitX,z,base,storyHeight,sideZ,unitMinX,unitMaxX,unitX,tone,
          lighting:options.lighting!==false,elevatorOpening:sideZ===elevatorSideZ?elevatorLayout.opening:null,inward
        });
      }
    }
    block(buildingId+" — osvětlení chodby",frontX-inward*2.25,top-.38,z,.18,.07,.46,0xffd28a,false,0xb97631,.62);
    if(options.lighting!==false){
      const corridorLight=new THREE.PointLight(0xffc982,kind==="shop"?1.05:.72,6.5,2);
      corridorLight.position.set(frontX-inward*2.25,top-.55,z);scene.add(corridorLight);
    }
    if(story<storyCount){
      const rise=storyHeight/16;
      for(let step=0;step<halfFlight;step++){
        const firstX=stairX-inward*(step*run+run/2);
        const secondX=landingX+inward*(step*run+run/2);
        const firstTreadTop=base+rise*(step+.5);
        const secondTreadTop=base+storyHeight/2+rise*(step+.5);
        const firstTreadBottom=step===0?base:firstTreadTop-rise;
        const secondTreadBottom=step===0?base+storyHeight/2:secondTreadTop-rise;
        block(buildingId+" — schodišťový stupeň",firstX,firstTreadBottom,z-.72,.27,firstTreadTop-firstTreadBottom,1.28,0x77766f,false);
        block(buildingId+" — schodišťový stupeň",secondX,secondTreadBottom,z+.72,.27,secondTreadTop-secondTreadBottom,1.28,0x77766f,false);
        if(step%2===0){
          block("schodišťové zábradlí — sloupek",firstX,firstTreadTop+.025,z-1.35,.065,.88,.065,0x5a605f,false);
          block("schodišťové zábradlí — středový sloupek",firstX,firstTreadTop+.025,z,.065,.88,.065,0x5a605f,false);
          if((secondX-elevatorRailStopX)*inward<=0)block("schodišťové zábradlí — sloupek",secondX,secondTreadTop+.025,z+1.35,.065,.88,.065,0x5a605f,false);
          block("schodišťové zábradlí — středový sloupek",secondX,secondTreadTop+.025,z,.065,.88,.065,0x5a605f,false);
        }
      }
      block(buildingId+" — schodišťová podesta",landingX,base+storyHeight/2-rise*.5,z,.88,rise*.5,2.72,0x77766f,false);
      block(buildingId+" — horní výstupní podesta",stairX+inward*.065,base+storyHeight-rise*.5,z+.72,.19,rise*.5,1.28,0x77766f,false);
      beamBetween("schodišťové madlo",{x:stairX,y:base+1.0,z:z-1.35},{x:landingX,y:base+storyHeight/2+1.0,z:z-1.35},.07,0x565c5a);
      beamBetween("schodišťové středové madlo",{x:stairX,y:base+1.0,z:z},{x:landingX,y:base+storyHeight/2+1.0,z:z},.07,0x565c5a);
      beamBetween("schodišťové madlo",{x:landingX,y:base+storyHeight/2+1.0,z:z+1.35},{x:elevatorRailStopX,y:base+storyHeight+1.0,z:z+1.35},.07,0x565c5a);
      beamBetween("schodišťové středové madlo",{x:landingX,y:base+storyHeight/2+1.0,z:z},{x:stairX,y:base+storyHeight+1.0,z:z},.07,0x565c5a);
    }
  }

  for(const pipeZ of [-depth/2+.35,depth/2-.35])queueFacadePart("pipe",frontX+inward*.16,floorOffset+height/2,z+pipeZ,.08,height,.08);
  const roofY=floorOffset+height;
  const roofSegments=calculateFloorSlabSegments({
    x,z,width,depth,stairX,landingX,storyIndex:storyCount,
    elevatorOpening:elevatorLayout.opening,perimeterInset:.045
  });
  roofSegments.forEach((segment,index)=>block(buildingId+" — střešní deska · "+(index+1),segment.x,roofY-.16,segment.z,segment.width,.16,segment.depth,concrete,false));
  const roofRailStart=landingX-inward*.34,roofRailEnd=stairX+inward*.5;
  for(const railZ of [-1.39,1.39]){
    beamBetween("střešní zábradlí", {x:roofRailStart,y:roofY+.92,z:z+railZ},{x:roofRailEnd,y:roofY+.92,z:z+railZ},.07,0x565c5a);
    for(let post=0;post<=4;post++){
      const px=roofRailStart+(roofRailEnd-roofRailStart)*post/4;
      block("střešní zábradlí — sloupek",px,roofY,z+railZ,.065,.92,.065,0x5a605f,false);
    }
  }
  beamBetween("střešní zábradlí — čelo šachty",{x:roofRailStart,y:roofY+.92,z:z-1.39},{x:roofRailStart,y:roofY+.92,z:z+1.39},.07,0x565c5a);
  for(let post=-2;post<=2;post++)block("střešní zábradlí — čelní sloupek",roofRailStart,roofY,z+post*.56,.065,.92,.065,0x5a605f,false);
  const roofGuardSegments=calculateRoofGuardrailSegments({x,z,width,depth});
  for(const segment of roofGuardSegments){
    beamBetween("obvodové střešní zábradlí",{x:segment.start.x,y:roofY+.92,z:segment.start.z},{x:segment.end.x,y:roofY+.92,z:segment.end.z},.07,0x565c5a);
    beamBetween("obvodové střešní madlo",{x:segment.start.x,y:roofY+.48,z:segment.start.z},{x:segment.end.x,y:roofY+.48,z:segment.end.z},.055,0x565c5a);
    const length=Math.hypot(segment.end.x-segment.start.x,segment.end.z-segment.start.z);
    const posts=Math.max(1,Math.ceil(length/1.25));
    for(let post=0;post<=posts;post++){
      const t=post/posts,px=segment.start.x+(segment.end.x-segment.start.x)*t,pz=segment.start.z+(segment.end.z-segment.start.z)*t;
      block("obvodové střešní zábradlí — sloupek",px,roofY,pz,.065,.92,.065,0x5a605f,false);
    }
    colliders.push({
      name:buildingId+" — ochranné zábradlí střechy",
      minX:Math.min(segment.start.x,segment.end.x)-.06,maxX:Math.max(segment.start.x,segment.end.x)+.06,
      minZ:Math.min(segment.start.z,segment.end.z)-.06,maxZ:Math.max(segment.start.z,segment.end.z)+.06,
      minY:roofY,maxY:roofY+.94,enabled:true
    });
  }
  const roofDoorX=stairX+inward*.24,roofDoorZ=z+.72,roofDoorWidth=1.02;
  block(buildingId+" — střešní výlez levé ostění",roofDoorX,roofY,roofDoorZ-.63,.18,2.16,.22,concrete,true,0,0,shellMaterial);
  block(buildingId+" — střešní výlez pravé ostění",roofDoorX,roofY,roofDoorZ+.63,.18,2.16,.22,concrete,true,0,0,shellMaterial);
  block(buildingId+" — střešní výlez nadpraží",roofDoorX,roofY+2.08,roofDoorZ,.18,.16,1.48,concrete,true,0,0,shellMaterial);
  const roofDoor=new THREE.Group();roofDoor.name=buildingId+" — dveře na střechu";
  roofDoor.position.set(roofDoorX,roofY,roofDoorZ-roofDoorWidth/2);scene.add(roofDoor);
  const roofDoorLeaf=new THREE.Mesh(new THREE.BoxGeometry(.065,2.04,roofDoorWidth-.035),material(0x62584a,.76));
  roofDoorLeaf.position.set(0,1.02,(roofDoorWidth-.035)/2);roofDoor.add(roofDoorLeaf);
  const roofDoorCollider={name:buildingId+" — zavřené dveře na střechu",minX:roofDoorX-.12,maxX:roofDoorX+.12,minZ:roofDoorZ-roofDoorWidth/2,maxZ:roofDoorZ+roofDoorWidth/2,minY:roofY,maxY:roofY+2.04,enabled:true};colliders.push(roofDoorCollider);
  const entranceDoorPlan=calculateEntranceDoorLayout({frontX,inward,z,doorWidth,floorOffset});
  const doorPivot=new THREE.Group();doorPivot.name=buildingId+" — vstupní dveře";
  doorPivot.position.set(entranceDoorPlan.planeX,floorOffset,entranceDoorPlan.hingeZ);scene.add(doorPivot);
  const entranceLeaf=new THREE.Mesh(new THREE.BoxGeometry(.09,2.14,doorWidth-.04),material(kind==="tenement"?0x493e35:0x554338,.72));
  entranceLeaf.position.set(0,1.07,(doorWidth-.04)/2);entranceLeaf.castShadow=true;doorPivot.add(entranceLeaf);
  const entranceWindow=new THREE.Mesh(new THREE.BoxGeometry(.025,.56,.72),facadeMaterials.glass);
  entranceWindow.position.set(inward*.055,1.5,(doorWidth-.04)/2);doorPivot.add(entranceWindow);
  const entranceHandle=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),material(0xb79a59,.4));
  entranceHandle.position.set(inward*.085,1.05,doorWidth-.22);doorPivot.add(entranceHandle);
  for(const sideDoor of [-1,1])block(buildingId+" — kamenná zárubeň",frontX+inward*.14,floorOffset,z+sideDoor*(doorWidth/2+.09),.26,2.26,.15,0x9b9b91,false);
  block(buildingId+" — nadpraží vchodu",frontX+inward*.14,floorOffset+2.18,z,.26,.12,doorWidth+.18,0x9b9b91,false);
  for(let step=0;step<3;step++){
    const distance=entryStepLength-.3*step,stepCenter=distance-.14;
    block(buildingId+" — vstupní schod "+(step+1),frontX+inward*stepCenter,step*.06,z,.3,.06,doorWidth+.34,0x777975,false);
  }
  block(buildingId+" — vstupní stříška",frontX+inward*.5,floorOffset+2.38,z,1.12,.14,doorWidth+.42,0x555d60,false);
  block(buildingId+" — světlo nad vchodem",frontX+inward*.25,floorOffset+2.48,z,.14,.09,.3,0xffd18a,false,0xb8742a,.72);
  const bellLayout=calculateEntranceBellLayout({frontX,inward,z,doorWidth,floorOffset,wall});
  const bellPanel=bellLayout.panel;
  block(buildingId+" — domovní zvonky",bellPanel.x,bellPanel.y,bellPanel.z,
    bellPanel.width,bellPanel.height,bellPanel.depth,0x787c78,false);
  bellLayout.buttons.forEach((button,index)=>block(
    buildingId+" — zvonkové tlačítko "+(index+1),button.x,button.y,button.z,
    button.width,button.height,button.depth,index===0?0xc5b99d:0xa2a49f,false
  ));
  for(let box=0;box<6;box++)block(buildingId+" — domovní schránka",frontX-inward*.48,floorOffset+1.08,z-.58+box*.23,.12,.19,.19,[0x777d7b,0x908b7d][box%2],false);
  const doorCollider={name:buildingId+" — zavřené vstupní dveře",...entranceDoorPlan.collider,enabled:true};
  colliders.push(doorCollider);
  const elevator={x:elevatorLayout.centerX,z:elevatorLayout.cabCenterZ,doorPlaneZ:elevatorLayout.doorPlaneZ,layout:elevatorLayout,motion:elevatorMotion,cab:elevatorCab,
    cabDoorLeft,cabDoorRight,shaftDoors:elevatorFloorDoors,cabDoorCollider:elevatorCabDoorCollider,
    callInteractables:elevatorCallInteractables,upInteractable:elevatorUpInteractable,downInteractable:elevatorDownInteractable,
    controlX:elevatorControlX,controlZ:elevatorControlZ,elevatorSideZ};
  return {id:buildingId,kind,x,z,width,depth,floorOffset,entryStepLength,doorWidth,frontX,inward,
    storyHeight,storyCount,stairX,landingX,flightLength,apartmentDoors,elevator,
    roofY,roofDoor,roofDoorCollider,roofInteractX:roofDoorX-inward*.48,roofInteractZ:roofDoorZ,roofOpenAngle:-inward*Math.PI/2,
    interactX:entranceDoorPlan.interactX,doorPivot,doorCollider,openAngle:entranceDoorPlan.openAngle,open:false,roofOpen:false};
}
function plane(w, d, color, x=0, y=0, z=0, roughness=.9, metalness=0) {
  const surfaceMaterial = new THREE.MeshStandardMaterial({color,roughness,metalness});
  if(color===0x363c42||color===0x8e8879){
    const detail=cloneMicroSurfaceTexture(Math.max(2,w*1.8),Math.max(2,d*1.8));
    surfaceMaterial.bumpMap=detail;
    surfaceMaterial.roughnessMap=detail;
    surfaceMaterial.bumpScale=color===0x363c42?.028:.016;
    surfaceMaterial.roughness=color===0x363c42?.96:.94;
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w,d), surfaceMaterial);
  mesh.rotation.x=-Math.PI/2; mesh.position.set(x,y,z); mesh.receiveShadow=true; scene.add(mesh); return mesh;
}
function puddle(x,z,width,depth,rotation=0) {
  const shape=new THREE.Shape();
  shape.moveTo(-.5,-.12);shape.lineTo(-.34,-.38);shape.lineTo(.12,-.46);shape.lineTo(.47,-.22);
  shape.lineTo(.4,.2);shape.lineTo(.08,.42);shape.lineTo(-.35,.3);shape.closePath();
  const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial({
    color:0x28323a,roughness:.16,metalness:.24,transparent:true,opacity:.76,side:THREE.DoubleSide,depthWrite:false
  }));
  mesh.name="mělká kaluž";mesh.rotation.set(-Math.PI/2,rotation,0);mesh.scale.set(width,depth,1);mesh.position.set(x,.006,z);scene.add(mesh);return mesh;
}

function printedSign(name, x, y, z, width, height, title, subtitle, rotationY=0, paper="#e8e0cd", ink="#3d3931") {
  const canvas=document.createElement("canvas");canvas.width=768;canvas.height=320;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle=paper;ctx.fillRect(0,0,768,320);
  ctx.strokeStyle=ink;ctx.lineWidth=10;ctx.strokeRect(14,14,740,292);
  ctx.fillStyle=ink;ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font="bold 58px 'Arial Narrow', sans-serif";ctx.fillText(title.toLocaleUpperCase("cs-CZ"),384,125,700);
  ctx.font="bold 28px monospace";ctx.fillText(subtitle.toLocaleUpperCase("cs-CZ"),384,224,700);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const signMesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}));
  signMesh.name=name;signMesh.position.set(x,y,z);signMesh.rotation.y=rotationY;scene.add(signMesh);return signMesh;
}
function propagandaPoster(x,y,z,width,height,rotationY=0) {
  const canvas=document.createElement("canvas");canvas.width=384;canvas.height=576;
  const ctx=canvas.getContext("2d");ctx.fillStyle="#e5ddc9";ctx.fillRect(0,0,384,576);
  ctx.fillStyle="#9e2e2a";ctx.fillRect(0,0,384,154);ctx.fillStyle="#f4ead1";
  ctx.font="bold 42px sans-serif";ctx.textAlign="center";ctx.fillText("SPARTAKIÁDA",192,62);ctx.font="bold 34px monospace";ctx.fillText("1975",192,117);
  ctx.fillStyle="#d4b44b";ctx.beginPath();ctx.arc(190,250,52,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#304c6b";ctx.lineWidth=24;ctx.lineCap="round";
  for(const [ox,oy] of [[-80,0],[0,6],[80,0]]){ctx.beginPath();ctx.moveTo(190+ox,302+oy);ctx.lineTo(190+ox,420+oy);ctx.moveTo(190+ox,330+oy);ctx.lineTo(142+ox,376+oy);ctx.moveTo(190+ox,330+oy);ctx.lineTo(238+ox,376+oy);ctx.moveTo(190+ox,420+oy);ctx.lineTo(150+ox,505+oy);ctx.moveTo(190+ox,420+oy);ctx.lineTo(230+ox,505+oy);ctx.stroke();}
  ctx.fillStyle="#413d35";ctx.font="bold 21px sans-serif";ctx.textAlign="center";ctx.fillText("MLÁDÍ · PRÁCE · RADOST",192,548);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}));
  mesh.name="plakát Spartakiáda 1975";mesh.position.set(x,y,z);mesh.rotation.y=rotationY;scene.add(mesh);return mesh;
}

// Sídliště Mír, 1975: paneláky, stará zástavba, tramvajový most a ručně lepené plakáty.
plane(150,150,0x666a69,0,-.09,0);
plane(10.5,150,0x363c42,0,-.025,-20,.96,.01);
puddle(-2.8,-12,2.8,1.1,-.18);puddle(2.1,-31,1.9,.7,.24);puddle(-1.1,-49,3.1,.85,-.08);puddle(3.2,-71,2.2,.8,.17);
let apartmentEntry=null;
const buildingEntries=[];
for (const side of [-1,1]) {
  plane(3.5,150,0x8e8879,side*7,-.005,-20);
  for (let z=11; z>=-76; z-=17) {
    const height=16+((Math.abs(z*7+side*19)%9));
    const width=9.2+((Math.abs(z+side*11)%3));
    const x=side*14.2;
    const oldTown=side===-1&&z===11;
    const departmentStore=side===1&&z===-40;
    const specialPanelak=side===-1&&z===-6;
    const buildingVariant=Math.abs(Math.floor(z/17)+side+8)%4;
    const color=oldTown?0x776b60:departmentStore?0x747a7b:[0x737b7d,0x80827d,0x697277,0x89877f][buildingVariant];
    const buildingId=specialPanelak?"DŮM MÍR":departmentStore?"OBCHODNÍ DŮM MÍR":oldTown?"ČINŽOVNÍ DŮM":"PANELÁK "+(side<0?"ZÁPAD":"VÝCHOD")+" · "+Math.abs(z);
    const buildingKind=departmentStore?"shop":oldTown?"tenement":"panelak";
    const buildingWallColor=oldTown?0x817365:departmentStore?0x788080:[0x737b7d,0x80827d,0x697277,0x89877f][buildingVariant];
    const buildingHeight=departmentStore?12:oldTown?11:height;
    const entry=buildWalkablePanelak(x,z,departmentStore?13:width,departmentStore?15:13,buildingHeight,-side,{
      id:buildingId,kind:buildingKind,wallColor:buildingWallColor,lighting:specialPanelak
    });
    buildingEntries.push(entry);
    if(specialPanelak){
      apartmentEntry=entry;
      printedSign("domovní cedule vchodu",entry.frontX+entry.inward*.22,2.72,z+1.02,.82,.34,"VCHOD 12","DŮM MÍR",entry.inward*Math.PI/2,"#ddd7c8","#33393a");
    }
    if(departmentStore){
      printedSign("nápis obchodní dům Mír",entry.frontX+entry.inward*.22,6.8,z,6.2,1.2,"OBCHODNÍ DŮM MÍR","POTRAVINY · TEXTIL · DOMÁCÍ POTŘEBY",side===1?-Math.PI/2:Math.PI/2,"#ded4bd","#762c25");
    }
    if(oldTown)propagandaPoster(entry.frontX+entry.inward*.12,6.3,z-1.1,1.1,1.8,Math.PI/2);
    if(z===-57&&side===1)printedSign("smaltovaná cedule Potraviny",entry.frontX+entry.inward*.12,5.1,z,2.8,.65,"POTRAVINY","8.00—18.00",-Math.PI/2,"#d7d0b9","#a2382e");
    // Trees, sodium lamps and telephone poles repeat along the block.
    if(z%34!==0) {
      const tx=side*5.3, tz=z+5;
      block("kmen",tx,0,tz,.36,2,.36,0x574438,false);
      const crown=block("koruna",tx,2,tz,2.1,2.4,2.1,0x4b5e45,false);
      crown.material=material(0x53664b,.96);
    }
    block("stožár veřejného osvětlení",side*8.5,0,z+2,.13,5,.13,0x4b4c48,false);
    block("žluté pouliční svítidlo",side*8.5,4.65,z+2,.72,.2,.42,0xf0c06a,false,0xb77735,.58);
    if(z%34!==0){
      const streetLight=new THREE.PointLight(0xffc77f,.62,10.5,2);
      streetLight.position.set(side*8.5,4.45,z+2);
      scene.add(streetLight);
    }
  }
}
// Batch static apartment floors, partitions, kitchen and furniture while keeping per-item AABB collision.
flushApartmentBlocks();

// A second, more distant row closes the skyline when viewed from the hovering car.
for(const side of [-1,1])for(let z=11;z>=-76;z-=17){
  const x=side*30.7,width=12.5,height=24+Math.abs(Math.floor(z*3+side*11)%13),depth=13.5;
  block("vzdálený panelový blok",x,0,z,width,height,depth,[0x626d72,0x70797b,0x657074][Math.abs(Math.floor(z/17)+side)%3],true);
  const inward=-side,faceX=x+inward*(width/2-.045);
  for(let floor=1.1,floorIndex=0;floor<height-1.35;floorIndex++,floor+=2.75){
    queueFacadePart("joint",faceX-inward*.015,floor-.25,z,.04,.04,depth-.35);
    for(let column=-2;column<=2;column++){
      const windowZ=z+column*2.35,lit=Math.abs(floorIndex*7+column*5+Math.floor(z)+side*3)%7<2;
      queueFacadePart(lit?"windowLit":"windowDark",faceX,floor+.48,windowZ,.05,1.18,1.3);
      queueFacadePart("glass",faceX+inward*.045,floor+.48,windowZ,.04,1.1,1.22);
    }
  }
  block("vzdálený panelák — střešní římsa",x,height-.2,z,width+.24,.4,depth+.25,0x505a5d,false);
}
flushFacadeParts();
// Worn asphalt, painted crossings and embedded tram rails.
for(let z=20;z>-84;z-=7) block("oprýskaná středová čára",0,.004,z,.11,.018,3.1,0xb9b5a7,false);
for(let z=-3;z>-72;z-=34) {
  for(let i=-4;i<=4;i++) block("přechod",i*.85,.006,z, .48,.02,2.2,0xd9d8c7,false);
}
block("tramvajový most",0,12,-60,47,1.4,4.5,0x777975,false);
for(const x of [-.72,.72])block("tramvajová kolejnice",x,13.43,-60,47,.07,.08,0x393a38,false);
for(let x=-22;x<=22;x+=1.6)block("tramvajový pražec",x,13.41,-60,.09,.05,2,0x746d5e,false);
for(let x=-22;x<=22;x+=4) block("zábradlí mostu",x,13,-60,.14,.75,4.2,0x9a9a8e,false);
block("telefonní ústředna",-2,0,-91,7,19,7,0x88857b,false);
for(let y=12;y<29;y+=3){block("stožár antény",-2,y,-87.1,.12,1.4,.12,0x4c4c49,false);block("anténa — příčka",-2,y+.55,-87.1,3.5,.09,.1,0x555651,false);}
for(let side of [-1,1])for(let z=-30;z>=-66;z-=18){
  block("telefonní sloup",side*8.7,0,z,.14,8,.14,0x594e3f,false);
  for(let arm=-1;arm<=1;arm++)block("telefonní příčka",side*8.7,7.15+arm*.48,z,2,.08,.08,0x554c40,false);
}

// The neighborhood pub and Mira's repair bench: warm bulbs, enamel signs and a radio.
block("hostinec — tmavé dveře",5.5,0,-3.7,.12,2.4,1.1,0x30302d,false);
block("hostinec — výloha",5.55,1,-5.2,.12,2,2.1,0x554b3d,false,0x3a2510,.18);
printedSign("hostinec U Mostu",5.62,4.9,-4.55,3.5,.85,"HOSTINEC U MOSTU","PIVO · LIMO · VEČERKA",-Math.PI/2,"#e3d6bd","#8b3026");
for(let bulb=0;bulb<7;bulb++)block("žárovka výlohy",5.66,3.92,-6.4+bulb*.55,.11,.16,.16,0xffcf74,false,0xb27230,.45);
block("hospoda — rádio",4.7,.83,-4.8,.46,.42,.35,0x624835,false);
const mechanic=new THREE.Group();
const miraCoat=new THREE.Mesh(new THREE.BoxGeometry(.7,1.05,.42),material(0x704b3c));miraCoat.position.y=1.0;mechanic.add(miraCoat);
const miraCollar=new THREE.Mesh(new THREE.BoxGeometry(.86,.18,.49),material(0xd7c4a2));miraCollar.position.set(0,1.42,-.02);mechanic.add(miraCollar);
const miraHead=new THREE.Mesh(new THREE.BoxGeometry(.46,.48,.46),material(0xb99274));miraHead.position.y=1.78;mechanic.add(miraHead);
const miraHair=new THREE.Mesh(new THREE.BoxGeometry(.57,.24,.53),material(0x282727));miraHair.position.y=2.05;mechanic.add(miraHair);
mechanic.position.set(4.8,0,-4.8);scene.add(mechanic);
colliders.push({name:"Mira",minX:4.35,maxX:5.25,minZ:-5.1,maxZ:-4.5,enabled:true});

// A period Tatra T3 tram crosses the overpass above the street.
const tram=new THREE.Group();
function tramPart(w,h,d,color,x,y,z,roughness=.65){const part=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,roughness));part.position.set(x,y,z);tram.add(part);return part;}
tramPart(11.5,2.35,2.25,0xb7aa8c,0,1.45,0);
tramPart(11.55,.44,2.28,0x9b352e,0,.42,0);
tramPart(11.55,.2,2.3,0xe2d4b6,0,2.68,0);
for(let x=-4.45;x<=4.45;x+=1.48)tramPart(1.15,1.05,2.31,0x394444,x,1.62,-.01,.35);
tramPart(.1,2.2,.1,0x46403a,-5.72,1.5,0);tramPart(.1,2.2,.1,0x46403a,5.72,1.5,0);
for(const x of [-4.15,4.15])for(const z of [-.82,.82]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.16,12),material(0x292a28));wheel.rotation.x=Math.PI/2;wheel.position.set(x,.24,z);tram.add(wheel);}
tramPart(1.8,.5,.08,0xe8ddc4,0,1.7,-1.18,.4);
tram.position.set(-7,13.45,-60);scene.add(tram);
const tramCollider={name:"projíždějící tramvaj T3",minX:tram.position.x-5.75,maxX:tram.position.x+5.75,minZ:-61.15,maxZ:-58.85,minY:13.35,maxY:16.25,enabled:true};colliders.push(tramCollider);
for(const side of [-1,1])block("trolejové vedení",side*.72,17.4,-60,47,.035,.035,0x4d4a43,false);

const stateCar=new THREE.Group();
const fallbackCar=new THREE.Group();stateCar.add(fallbackCar);
const importedCar=new THREE.Group();stateCar.add(importedCar);
const cabinInterior=new THREE.Group();cabinInterior.visible=false;stateCar.add(cabinInterior);
const carPaint=0x175b36,carRoof=0x226b43,carTrim=0x232a27;
const carGlass=new THREE.MeshPhysicalMaterial({color:0x738787,roughness:.2,metalness:.12,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false});
function carPart(w,h,d,color,x,y,z,roughness=.68){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,roughness));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;fallbackCar.add(m);return m;}
function cabinPart(w,h,d,color,x,y,z,roughness=.68){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,roughness));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;cabinInterior.add(m);return m;}
function carWindow(w,h,d,x,y,z,tilt=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),carGlass);m.position.set(x,y,z);m.rotation.x=tilt;m.castShadow=false;fallbackCar.add(m);return m;}
function carPlate(z,front=false){
  const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext("2d");ctx.fillStyle="#ecebe4";ctx.fillRect(0,0,512,128);ctx.strokeStyle="#252925";ctx.lineWidth=8;ctx.strokeRect(4,4,504,120);
  ctx.fillStyle="#3868a0";ctx.fillRect(12,12,40,104);ctx.fillStyle="#fff";ctx.font="bold 19px sans-serif";ctx.textAlign="center";ctx.fillText("ČS",32,72);
  ctx.fillStyle="#202320";ctx.font="bold 58px monospace";ctx.fillText("B 091 518",282,83);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const plate=new THREE.Mesh(new THREE.PlaneGeometry(.78,.2),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}));
  plate.position.set(0,.87,z);if(front)plate.rotation.y=Math.PI;fallbackCar.add(plate);
}
// Green five-door hatchback with visible cabin and period luggage details.
carPart(2.06,.58,4.08,carPaint,0,.88,0,.48);
carPart(1.9,.17,1.18,carRoof,0,1.21,-1.37,.46);
carPart(1.88,.17,.98,carRoof,0,1.2,1.53,.46);
carPart(2.02,.14,1.72,carRoof,0,2.19,.07,.46);
carPart(1.82,.25,.22,carPaint,0,1.52,-1.05,.5);
carPart(1.8,.3,.26,carPaint,0,1.54,1.17,.5);

// Framed, lightly tinted glazing keeps the cabin readable from the chase camera.
carWindow(1.55,.58,.045,0,1.83,-.97,.4);
carWindow(1.48,.55,.045,0,1.82,1.28,-.36);
for(const side of [-1,1]){
  // Real cutouts: glass sits outside the door line, leaving the seats visible.
  carPart(.11,.34,1.78,carPaint,side*1.015,1.34,.12,.5);
  carWindow(.045,.5,.78,side*1.085,1.84,-.39);
  carWindow(.045,.5,.67,side*1.085,1.84,.54);
  carPart(.075,.61,.09,carPaint,side*1.045,1.86,-.94,.5);
  carPart(.08,.65,.09,carTrim,side*1.055,1.83,.11,.58);
  carPart(.14,.7,.12,carPaint,side*1.035,1.78,1.05,.5);
  carPart(.075,.54,.09,carPaint,side*1.045,1.84,1.14,.5);
  carPart(.065,.045,1.72,carTrim,side*1.065,1.56,.05,.62);
  carPart(.05,.035,1.68,carTrim,side*1.04,2.08,.07,.62);
  carPart(.05,.055,.32,0xb9b6a6,side*1.04,1.46,-.12,.48);
  carPart(.04,.065,.13,carTrim,side*1.08,1.54,-.83,.62);
  carPart(.2,.13,.24,carRoof,side*1.17,1.56,-.82,.48);
  carPart(.05,.035,1.72,0x343a36,side*1.02,.87,.02,.66);
  carPart(.055,.025,.07,0x4b4d47,side*1.075,1.38,-.06,.62);
  carPart(.055,.025,.07,0x4b4d47,side*1.075,1.38,.77,.62);
}
carPart(1.58,.045,.075,carTrim,0,2.28,.08,.58);

// Cabin: front seats, rear bench, steering wheel, dashboard and a few things in the boot.
carPart(1.62,.1,2.02,0x2f3533,0,.87,.08,.86);
for(const seatX of [-.43,.43]){
  carPart(.46,.16,.48,0x4a4c45,seatX,1.04,-.06,.84);
  carPart(.44,.61,.17,0x4a4c45,seatX,1.39,.2,.84);
  carPart(.31,.2,.14,0x454741,seatX,1.81,.27,.84);
}
carPart(1.28,.16,.42,0x454741,0,1.07,.91,.86);
carPart(1.3,.42,.16,0x4c4d47,0,1.36,1.04,.86);
carPart(1.45,.25,.29,0x303533,0,1.43,-.72,.76);
carPart(.42,.08,.2,0x9b9077,0,1.57,-.73,.6);
carPart(.38,.3,.27,0x485c55,-.39,1.53,-.08,.86);
carPart(.29,.34,.3,0xb48a6b,-.39,1.84,-.1,.88);
carPart(.32,.1,.34,0x3c342c,-.39,2.01,-.1,.9);
const steeringWheel=new THREE.Mesh(new THREE.TorusGeometry(.235,.035,6,16),material(0x252927,.55));
steeringWheel.position.set(-.43,1.52,-.53);fallbackCar.add(steeringWheel);
carPart(.07,.22,.07,0x292d2a,-.43,1.35,-.62,.7);
carPart(.08,.25,.08,0x46463f,.08,1.13,.03,.76);
carPart(.34,.27,.35,0x70624d,-.43,1.04,1.55,.9);
carPart(.32,.21,.28,0x5d574b,.4,1.01,1.57,.9);

// Front grille, lamps, segmented tail lights, bumpers, trim and readable plates.
carPart(2.12,.16,.14,carTrim,0,.64,-2.08,.62);
carPart(2.12,.16,.14,carTrim,0,.64,2.08,.62);
carPart(.78,.3,.075,0x272c2b,0,.98,-2.075,.78);
for(let slat=0;slat<4;slat++)carPart(.68,.025,.025,0x9b9d91,0,.88+slat*.068,-2.12,.56);
for(const side of [-1,1]){
  carPart(.38,.26,.09,0xf0e7c4,side*.72,1.08,-2.08,.42);
  carPart(.08,.24,.09,0xb48d56,side*.45,1.08,-2.075,.52);
  carPart(.28,.28,.1,0xb5362d,side*.74,1.04,2.08,.48);
  carPart(.28,.13,.11,0xd39145,side*.74,.84,2.08,.52);
  carPart(.24,.09,.1,0xe9e0c8,side*.74,1.2,2.08,.5);
  carPart(.44,.11,.05,carTrim,side*.73,1.35,-2.1,.68);
  carPart(.44,.065,.05,carTrim,side*.73,1.34,2.1,.68);
}
carPart(.1,.11,.08,0xb5b6a5,0,1.12,-2.13,.42);
carPart(.08,.08,.06,0xb5b6a5,0,1.16,2.13,.42);
carPlate(-2.16,true);carPlate(2.16,false);
for(const side of [-1,1]){const wiper=carPart(.64,.025,.035,carTrim,side*.36,2.035,-.78,.62);wiper.rotation.z=side*.12;}
const rearWiper=carPart(.62,.025,.035,carTrim,.08,1.67,1.55,.62);rearWiper.rotation.z=-.18;
const wheels=[],wheelHubs=[],frontWheelPivots=[];
for(const x of [-1.03,1.03])for(const z of [-1.28,1.28]){
  const pivot=new THREE.Group();pivot.position.set(x,0,z);fallbackCar.add(pivot);
  const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.25,12),material(0x292b29,.96));
  wheel.rotation.z=Math.PI/2;wheel.position.set(0,.48,0);wheel.castShadow=true;pivot.add(wheel);wheels.push(wheel);
  if(z<0)frontWheelPivots.push(pivot);
  for(const side of [-1,1]){
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.045,12),material(0xb8b7aa,.52,.03,.05));rim.position.set(0,side*.13,0);wheel.add(rim);wheelHubs.push(rim);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.055,10),material(0x777d71,.48));cap.position.set(0,side*.16,0);wheel.add(cap);wheelHubs.push(cap);
    for(let spokeIndex=0;spokeIndex<6;spokeIndex++){const spoke=new THREE.Mesh(new THREE.BoxGeometry(.04,.018,.29),material(0xc4c2b4,.46));spoke.position.set(0,side*.155,0);spoke.rotation.y=spokeIndex*Math.PI/3;wheel.add(spoke);wheelHubs.push(spoke);}
  }
}
const thrusters=[],hoverPods=[],hoverPodLights=[],importedWheelParts=[];
const thrusterMaterial=new THREE.MeshBasicMaterial({color:0x41dfff,transparent:true,opacity:.82,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
const hoverPodShellMaterial=material(0x202a2d,.42,0x03141a,.08);
const hoverPodGlowMaterial=new THREE.MeshBasicMaterial({color:0x31dfff,transparent:true,opacity:.84,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
for(const x of [-.63,.63])for(const z of [-.7,1.4]){
  const pod=new THREE.Group();pod.name="Favorit — výsuvný vznášecí modul";
  const shell=new THREE.Mesh(new THREE.BoxGeometry(.43,.22,.58),hoverPodShellMaterial);shell.position.y=.02;shell.castShadow=true;pod.add(shell);
  const underside=new THREE.Mesh(new THREE.BoxGeometry(.36,.035,.49),hoverPodGlowMaterial);underside.position.y=-.105;pod.add(underside);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.18,.018,6,18),hoverPodGlowMaterial);ring.rotation.x=Math.PI/2;ring.position.y=-.115;pod.add(ring);
  pod.position.set(x,.19,z);pod.visible=false;stateCar.add(pod);hoverPods.push(pod);
  const light=new THREE.PointLight(0x31dfff,.34,1.65,2);light.position.set(x,-.2,z);light.visible=false;stateCar.add(light);hoverPodLights.push(light);
}
for(const x of [-.63,.63])for(const z of [-.7,1.4]){
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.18,.45,8),thrusterMaterial);flame.rotation.x=Math.PI;flame.position.set(x,-.13,z);flame.visible=false;stateCar.add(flame);thrusters.push(flame);
}
stateCar.position.set(2.5,0,6);scene.add(stateCar);
fallbackCar.visible=true;importedCar.visible=false;
const favoritLoader=new GLTFLoader();
favoritLoader.load(import.meta.env.BASE_URL+"models/skoda-favorit/scene.gltf",gltf=>{
  const model=gltf.scene;
  model.traverse(object=>{
    if(object.isCamera||object.isLight){object.visible=false;return;}
    if(!object.isMesh)return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    const tuned=materials.map(original=>{
      const mat=original.clone(),name=(mat.name||"").toUpperCase();
      if(/KAPOTA|KAPOZ/.test(name)){
        mat.color.setHex(0x155b35);mat.roughness=.44;mat.metalness=.12;
      }else if(/OKNA|ZATMAVENI/.test(name)){
        mat.color.setHex(0x263b40);mat.transparent=true;mat.opacity=.3;mat.depthWrite=false;mat.side=THREE.DoubleSide;mat.roughness=.2;
      }else if(/NARAZNIKY|ZASTERKY/.test(name)){
        mat.color.setHex(0x202523);mat.roughness=.82;
      }else if(/PNEU/.test(name)){
        mat.color.setHex(0x202321);mat.roughness=.96;
      }else if(/DISK/.test(name)){
        mat.color.setHex(0x9b9d98);mat.metalness=.48;mat.roughness=.52;
      }else if(/PRENI_SVETLA|ZADNI_.*SVETLA|BLINKRY/.test(name)){
        mat.color.setHex(/BLINK/.test(name)?0xd17a38:/ZADNI/.test(name)?0xc84839:0xe9e7d7);
      }
      mat.needsUpdate=true;return mat;
    });
    object.material=Array.isArray(object.material)?tuned:tuned[0];
    if(isFavoritWheelMesh(materials.map(mat=>mat.name),object.name))importedWheelParts.push(object);
    object.castShadow=true;object.receiveShadow=true;
  });
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model);
  const fit=calculateVehicleModelFit({min:box.min,max:box.max});
  const fitRoot=new THREE.Group();fitRoot.name="ŠKODA FAVORIT — normalizovaný model";fitRoot.rotation.y=Math.PI;fitRoot.add(model);
  fitRoot.scale.set(fit.scale.x,fit.scale.y,fit.scale.z);
  fitRoot.position.set(fit.position.x,fit.position.y,fit.position.z);
  importedCar.add(fitRoot);
  importedCar.visible=true;fallbackCar.visible=false;
},undefined,error=>{
  console.warn("Škoda Favorit GLTF se nepodařilo načíst; použit fallback.",error);
  importedCar.visible=false;fallbackCar.visible=true;
});
const vehicle={x:savedVehicleSafe?saved.vehicle.x:2.5,z:savedVehicleSafe?saved.vehicle.z:10.5,yaw:savedVehicleSafe&&Number.isFinite(saved.vehicle.yaw)?saved.vehicle.yaw:0,yawRate:0,speed:0,vx:0,vz:0,horizontalSpeed:0,firstPerson:false,cameraSnap:true,altitude:savedVehicleSafe?THREE.MathUtils.clamp(Number(saved.vehicle.altitude)||0,0,42):0,verticalSpeed:0,battery:savedVehicleSafe?THREE.MathUtils.clamp(Number(saved.vehicle.battery??100)||0,0,100):100,occupied:savedInVehicle,lookSteer:0,lookSteerUntil:0};
const vehicleCollider={name:"ŠKODA FAVORIT",...vehicleAabb(vehicle.x,vehicle.z,vehicle.yaw),minY:vehicle.altitude,maxY:vehicle.altitude+VEHICLE_TUNING.bodyHeight,enabled:!vehicle.occupied};colliders.push(vehicleCollider);
const vehicleCameraPosition=new THREE.Vector3(),vehicleLookTarget=new THREE.Vector3();
const vehicleCameraRig=createVehicleCameraRig();
function syncVehicleCollider(){Object.assign(vehicleCollider,vehicleAabb(vehicle.x,vehicle.z,vehicle.yaw));vehicleCollider.minY=vehicle.altitude;vehicleCollider.maxY=vehicle.altitude+VEHICLE_TUNING.bodyHeight;}
stateCar.position.set(vehicle.x,vehicle.altitude,vehicle.z);
for(const flame of thrusters)flame.visible=vehicle.altitude>.8;
$("vehicleHud").hidden=!vehicle.occupied;
$("crosshair").hidden=vehicle.occupied;
$("vehicleViewLabel").textContent="THIRD PERSON · V";
$("touchUI").classList.toggle("is-vehicle",vehicle.occupied);
  if(vehicle.occupied){$("touchUI").querySelector('[data-touch-action="jump"]').textContent="STOUPAT";$("touchUI").querySelector('[data-touch-action="run"]').textContent="KLESAT";}

// Parked yellow-and-white Veřejná bezpečnost patrol car at the curb.
const vbCar=new THREE.Group();
function vbPart(w,h,d,color,x,y,z){const part=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,.72));part.position.set(x,y,z);vbCar.add(part);return part;}
vbPart(2.02,.66,4.0,0xe2ddc9,0,.93,0);
vbPart(1.72,.72,1.9,0xddd8c7,0,1.5,.05);
vbPart(1.49,.5,.07,0x3a4849,0,1.56,-.91);vbPart(1.49,.48,.07,0x3a4849,0,1.56,1.01);
for(const side of [-1,1]){
  vbPart(.08,.48,1.35,0xd1b744,side*.92,1.02,0);
  vbPart(.16,.12,.35,0xe8dcb5,side*1.01,1.3,-1.45);
  const mirror=new THREE.Mesh(new THREE.BoxGeometry(.14,.13,.22),material(0x474740));mirror.position.set(side*1.03,1.38,-.7);vbCar.add(mirror);
}
vbPart(.28,.26,.1,0xe8ddb8,-.68,1.02,-2.02);vbPart(.28,.26,.1,0xe8ddb8,.68,1.02,-2.02);
vbPart(.25,.25,.1,0xa13c32,-.68,1.02,2.02);vbPart(.25,.25,.1,0xa13c32,.68,1.02,2.02);
vbPart(.92,.12,.4,0x8a8980,0,1.95,.04);
vbPart(.36,.18,.13,0x9d3a32,-.22,2.1,.04);vbPart(.36,.18,.13,0xeee3c9,.22,2.1,.04);
for(const x of [-1.02,1.02])for(const z of [-1.25,1.25]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.2,12),material(0x292927,.95));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.48,z);vbCar.add(wheel);}
vbCar.position.set(-5.9,0,-29);scene.add(vbCar);
colliders.push({name:"zaparkovaný vůz Veřejné bezpečnosti",minX:-6.96,maxX:-4.84,minZ:-31.1,maxZ:-26.9,minY:0,maxY:2.25,enabled:true});
printedSign("označení vozu Veřejné bezpečnosti",-4.82,1.08,-29,.62,.34,"VB","VEŘEJNÁ BEZPEČNOST",Math.PI/2,"#eee8d8","#403a31");

const carColliders=colliders;
const avatarTarget={x:-1.2,z:-18};
function makeEnemy() {
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.72,1.1,.44),material(0x62624f));body.position.y=1.03;g.add(body);
  const shoulders=new THREE.Mesh(new THREE.BoxGeometry(.88,.22,.5),material(0x66654f));shoulders.position.y=1.43;g.add(shoulders);
  const belt=new THREE.Mesh(new THREE.BoxGeometry(.76,.13,.46),material(0x302e29));belt.position.y=.64;g.add(belt);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.5,.48,.48),material(0x9a765d));head.position.y=1.85;g.add(head);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(.59,.17,.58),material(0x44463c));cap.position.set(0,2.12,0);g.add(cap);
  const brim=new THREE.Mesh(new THREE.BoxGeometry(.62,.07,.25),material(0x3c3d35));brim.position.set(0,2.07,-.2);g.add(brim);
  const collar=new THREE.Mesh(new THREE.BoxGeometry(.82,.14,.48),material(0xb1a487));collar.position.set(0,1.43,-.02);g.add(collar);
  for(const x of [-.22,.22]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.18,.29,.78,6),material(0x32332e));leg.position.set(x,.36,0);g.add(leg);}
  for(const x of [-.47,.47]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.2,.82,.3),material(0x5b5b49));arm.position.set(x,1.02,0);g.add(arm);}
  g.position.set(avatarTarget.x,0,avatarTarget.z);scene.add(g);return g;
}
const enemyMesh=makeEnemy();
if (foe.defeated) scene.remove(enemyMesh);
const enemyCollider={name:"vyvrhel",minX:avatarTarget.x-.42,maxX:avatarTarget.x+.42,minZ:avatarTarget.z-.34,maxZ:avatarTarget.z+.34,enabled:!foe.defeated};
colliders.push(enemyCollider);
let activeEnemyMesh=enemyMesh,activeEnemyCollider=enemyCollider;
const courierGuard=new THREE.Group();
const guardBody=new THREE.Mesh(new THREE.BoxGeometry(.68,1.03,.42),material(0x353f43));guardBody.position.y=.99;courierGuard.add(guardBody);
const guardCollar=new THREE.Mesh(new THREE.BoxGeometry(.85,.16,.48),material(0xb3a78e));guardCollar.position.set(0,1.38,-.02);courierGuard.add(guardCollar);
const guardHead=new THREE.Mesh(new THREE.BoxGeometry(.46,.46,.44),material(0xa7846b));guardHead.position.y=1.76;courierGuard.add(guardHead);
const guardHair=new THREE.Mesh(new THREE.BoxGeometry(.56,.22,.5),material(0x292724));guardHair.position.y=2.02;courierGuard.add(guardHair);
for(const x of [-.21,.21]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.17,.29,.78,6),material(0x30333a));leg.position.set(x,.36,0);courierGuard.add(leg);}
for(const x of [-.45,.45]){const arm=new THREE.Mesh(new THREE.BoxGeometry(.19,.8,.28),material(0x3e484c));arm.position.set(x,1,0);courierGuard.add(arm);}
courierGuard.position.set(-1.8,0,-68);if(isCourierEncounterActive(mission.stage,secondFoe.defeated))scene.add(courierGuard);
const courierCollider={name:"útočník kurýra",minX:-2.22,maxX:-1.38,minZ:-68.34,maxZ:-67.66,enabled:isCourierEncounterActive(mission.stage,secondFoe.defeated)};colliders.push(courierCollider);
const courier=new THREE.Group();
const courierBody=new THREE.Mesh(new THREE.BoxGeometry(.62,1,.38),material(0x57646c));courierBody.position.y=.9;courier.add(courierBody);
const courierCollar=new THREE.Mesh(new THREE.BoxGeometry(.78,.14,.45),material(0xc9b89b));courierCollar.position.set(0,1.28,-.02);courier.add(courierCollar);
const courierHead=new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.42),material(0xb58a69));courierHead.position.y=1.62;courier.add(courierHead);
const courierHair=new THREE.Mesh(new THREE.BoxGeometry(.52,.23,.48),material(0x3c332a));courierHair.position.y=1.9;courier.add(courierHair);
for(const x of [-.2,.2]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.16,.27,.75,6),material(0x3e5360));leg.position.set(x,.35,0);courier.add(leg);}
courier.position.set(2.8,0,-72);if(mission.stage>=3)scene.add(courier);
const courierSceneActive=isCourierEncounterActive(mission.stage,secondFoe.defeated);courierGuard.visible=courierSceneActive;courier.visible=mission.stage>=3;
const courierBeacon=new THREE.Mesh(new THREE.TorusGeometry(.85,.04,8,32),material(0xffffff,.4,0xffffff,.55));courierBeacon.rotation.x=Math.PI/2;courierBeacon.position.set(2.8,.1,-72);courierBeacon.visible=courierSceneActive;scene.add(courierBeacon);
const miraBeacon=new THREE.Mesh(new THREE.TorusGeometry(.72,.035,8,28),material(0xffffff,.4,0xffffff,.4));miraBeacon.rotation.x=Math.PI/2;miraBeacon.position.set(4.8,.08,-4.8);miraBeacon.visible=mission.stage===2;scene.add(miraBeacon);

const relay=block("telefonní rozvodna",0,0,-43,.8,2.2,.72,0x777166,false);
relay.material=material(0x706a5f,.78);
block("rozvodna — smaltovaný panel",0,1.2,-42.56,.52,.62,.06,0xd5ccb5,false);
for(let n=0;n<3;n++)block("rozvodna — kontrolka",-.16+n*.16,1.27,-42.51,.055,.08,.035,[0x9b302b,0xa4823b,0x60765d][n],false,[0x43201a,0x443719,0x273a28][n],.25);
const markerRing=new THREE.Mesh(new THREE.TorusGeometry(1.1,.045,8,40),material(0x5de8d7,.4,0x2cf3d8,1.8));markerRing.rotation.x=Math.PI/2;markerRing.position.set(0,.12,-43);scene.add(markerRing);
markerRing.visible=mission.stage===1;
const archiveTerminal=block("krátkovlnný vysílač",-2,0,-85,.85,2.1,.72,0x5f5e58,false);
archiveTerminal.material=material(0x57564f,.68);
block("vysílač — stupnice",-2,1.24,-84.6,.5,.48,.06,0xd1c5a6,false,0x8d7640,.18);
const towerBeacon=new THREE.Mesh(new THREE.TorusGeometry(1,.045,8,32),material(0xffffff,.4,0xffffff,.55));towerBeacon.rotation.x=Math.PI/2;towerBeacon.position.set(-2,.1,-85);towerBeacon.visible=mission.stage===4;scene.add(towerBeacon);

function showToast(message) {
  toast.textContent=message;toast.classList.add("visible");clearTimeout(showToast.timeout);
  showToast.timeout=setTimeout(()=>toast.classList.remove("visible"),2300);
}
function makeSupplyCache(name,x,z,tone){
  const cache=new THREE.Group();cache.name=name;
  const body=new THREE.Mesh(new THREE.BoxGeometry(.68,.38,.52),material(tone,.92));body.position.y=.26;body.castShadow=true;cache.add(body);
  const lid=new THREE.Mesh(new THREE.BoxGeometry(.72,.09,.56),material(0x77746b,.88));lid.position.y=.49;lid.castShadow=true;cache.add(lid);
  for(const strapZ of [-.17,.17]){
    const strap=new THREE.Mesh(new THREE.BoxGeometry(.73,.045,.055),material(0xb9ad91,.82));strap.position.set(0,.31,strapZ);cache.add(strap);
  }
  const seal=new THREE.Mesh(new THREE.BoxGeometry(.22,.13,.025),material(0xd5c8a4,.8));seal.position.set(0,.38,.268);cache.add(seal);
  const marker=new THREE.Mesh(new THREE.TorusGeometry(.58,.025,6,22),material(0xf0eee4,.55,0xffffff,.3));marker.rotation.x=Math.PI/2;marker.position.y=.045;cache.add(marker);
  cache.position.set(x,0,z);scene.add(cache);return cache;
}
const savedSupplyIds=new Set(Array.isArray(saved.collectedSupplies)?saved.collectedSupplies:[]);
const supplies=[
  {id:"bandages-street",label:"BALÍČEK OBVAZŮ",x:-4.5,z:-32,medkits:1,credits:0,xp:15,tone:0x776448},
  {id:"voucher-courtyard",label:"POUKÁZKA 60 KČS",x:-2.9,z:-54.4,medkits:0,credits:60,xp:15,tone:0x6b6659},
  {id:"mechanic-crate",label:"DÍLENSKÁ BEDNA",x:4.2,z:-77.5,medkits:1,credits:0,xp:20,tone:0x66574a}
].map(item=>({...item,collected:savedSupplyIds.has(item.id),group:makeSupplyCache(item.label,item.x,item.z,item.tone),interactable:null}));
for(const supply of supplies)supply.group.visible=!supply.collected;
function saveGame() {
  const p=controller?.player;
  try { localStorage.setItem(SAVE_KEY,JSON.stringify({
    missionStage:mission.stage,foeDefeated:foe.defeated,courierDefeated:secondFoe.defeated,ending:endingChoice,inVehicle:state.inVehicle,
    neighborQuestStep,
    stats:{hp:stats.hp,maxHp:stats.maxHp,energy:stats.energy,maxEnergy:stats.maxEnergy,xp:stats.xp,level:stats.level,credits:stats.credits,medkits:stats.medkits,weaponLevel:stats.weaponLevel,armorLevel:stats.armorLevel},
    player:p?{x:p.x,z:p.z,elevation:p.elevation,yaw:p.yaw}:null,
    collectedSupplies:supplies.filter(supply=>supply.collected).map(supply=>supply.id),
    buildings:serializeBuildingDoorStates(buildingEntries),
    panelak:apartmentEntry?{entranceOpen:apartmentEntry.open,doors:apartmentEntry.apartmentDoors.map(door=>door.open)}:null,
    vehicle:{x:vehicle.x,z:vehicle.z,yaw:vehicle.yaw,altitude:vehicle.altitude,battery:vehicle.battery},playSeconds:totalPlaySeconds
  }));const continueButton=document.getElementById("continueOption");if(continueButton)continueButton.disabled=false; } catch { showToast("POSTUP SE NEPODAŘILO ULOŽIT"); }
}
function awardXP(amount) {
  stats.xp+=amount;
  let levels=0;
  while(stats.xp>=100){stats.xp-=100;stats.level++;stats.maxHp+=8;stats.maxEnergy+=4;stats.hp=Math.min(stats.maxHp,stats.hp+18);stats.energy=stats.maxEnergy;levels++;}
  if(levels) showToast(`NOVÁ ÚROVEŇ ${stats.level} · VITALITA +${levels*8}`);
}
function updateMission() {
  const title=$("missionTitle"),text=$("missionText"),index=$("missionIndex"),progress=$("missionProgress");
  if(mission.stage===0){title.textContent="Ticho v bloku";text.textContent="Dostaň se přes hlídku k telefonní rozvodně. Někdo přerušil spojení.";index.textContent="01 / 05";progress.style.width="15%";}
  else if(mission.stage===1){title.textContent="Telefonní ústředna";text.textContent="Obnov linku v rozvodně pod sídlištěm.";index.textContent="02 / 05";progress.style.width="34%";}
  else if(mission.stage===2){title.textContent="Zpráva od Evy";text.textContent="Vrať se do hostince a promluv s mechanickou Mirou.";index.textContent="03 / 05";progress.style.width="53%";}
  else if(mission.stage===3){title.textContent="Kurýr pod mostem";text.textContent="Najdi kurýra s páskou z nepovoleného koncertu a dostaň ho z nebezpečí.";index.textContent="04 / 05";progress.style.width="72%";}
  else if(mission.stage===4){title.textContent="Páska pro Evropu";text.textContent="Dones nahrávku ke krátkovlnnému vysílači a rozhodni, komu bude patřit.";index.textContent="05 / 05";progress.style.width="91%";}
  else {title.textContent="Po půlnoci";text.textContent=endingChoice==="public"?"Kopie pásky kolují po bytech. Zakázaná hudba překročila hranice bloku.":"Eva ukryla originál. Lidé z hostince mají čas připravit další kopie.";index.textContent="HOTOVO";progress.style.width="100%";}
  const found=supplies.filter(supply=>supply.collected).length,sideObjective=$("supplyProgress");
  sideObjective.textContent=found===supplies.length?"ZÁSOBY NALEZENY · "+found+" / "+supplies.length:"ZTRACENÉ ZÁSOBY · "+found+" / "+supplies.length;
  sideObjective.classList.toggle("complete",found===supplies.length);
  const neighborObjective=$("neighborObjective");
  neighborObjective.textContent=["SOUSEDÉ · ZEPTEJ SE ANNY","SOUSEDÉ · SEŠIT VE VESTIBULU","SOUSEDÉ · DONES SEŠIT IVANĚ","SOUSEDÉ · HOTOVO"][neighborQuestStep];
  neighborObjective.classList.toggle("complete",neighborQuestStep===3);
}
function updateObjectivePointer(){
  const targets=[
    {label:"HLÍDKA",x:avatarTarget.x,z:avatarTarget.z},
    {label:"ROZVODNA",x:0,z:-43},
    {label:"MIRA",x:4.8,z:-4.8},
    {label:"KURÝR",x:-1.8,z:-68},
    {label:"VYSÍLAČ",x:-2,z:-85}
  ];
  const target=targets[mission.stage],pointer=$("objectivePointer");
  if(!target){pointer.hidden=true;return;}
  pointer.hidden=false;
  const origin=state.inVehicle?vehicle:controller.player;
  const dx=target.x-origin.x,dz=target.z-origin.z;
  const distance=Math.hypot(dx,dz),bearing=Math.atan2(dx,-dz);
  const facing=state.inVehicle?vehicle.yaw:controller.player.yaw;
  const relative=Math.atan2(Math.sin(bearing-facing),Math.cos(bearing-facing));
  const arrow=Math.abs(relative)<Math.PI/4?"↑":Math.abs(relative)>Math.PI*3/4?"↓":relative>0?"→":"←";
  $("objectiveArrow").textContent=arrow;
  $("objectiveReadout").textContent=`${target.label} · ${Math.round(distance)} M`;
}
function updateInventory(){
  const items=[
    {glyph:"TEL",name:"TELEFON",description:"Osobní komunikační přístroj",amount:"VÝCHOZÍ VÝBAVA"},
    {glyph:"OBV",name:"OBVAZY",description:"Zdravotnický materiál",amount:"× "+stats.medkits},
    {glyph:"KČS",name:"HOTOVOST",description:"Československé koruny",amount:stats.credits+" KČS"}
  ];
  if(neighborQuestStep===2)items.push({glyph:"SEŠ",name:"SEŠIT STŘIHŮ",description:"Modrý sešit pro Ivanu",amount:"U SEBE"});
  if(mission.stage>=4)items.push({glyph:"MC",name:"KONCERTNÍ PÁSKA",description:"Nahrávka zakázané kapely",amount:"U SEBE"});
  $("inventoryItems").innerHTML=items.map(item=>'<article class="inventory-item"><div class="inventory-glyph">'+item.glyph+'</div><div class="inventory-item-copy"><b>'+item.name+'</b><span>'+item.description+'</span></div><strong>'+item.amount+'</strong></article>').join("");
  $("inventoryVitals").textContent=stats.hp+" / "+stats.maxHp+" HP  ·  "+stats.energy+" / "+stats.maxEnergy+" EN";
  $("inventoryMission").textContent="ÚKOL "+String(Math.min(mission.stage+1,5)).padStart(2,"0")+" / 05 · "+$("missionTitle").textContent;
}
function updateStats(){
  $("loadoutValue").textContent="VÝSTROJ · BUNDA · "+["I","II","III"][Math.min(stats.armorLevel,2)];
  $("attackHint").textContent=(14+stats.weaponLevel*3)+"–"+(20+stats.weaponLevel*3)+" poškození · 0 EN";
  $("aimHint").textContent=(24+stats.weaponLevel*5)+"–"+(32+stats.weaponLevel*5)+" poškození · 8 EN";
  $("weaponOffer").textContent=stats.weaponLevel>=2?"ŠKORPION · MAX":"VYLEPŠIT ŠKORPION · "+(stats.weaponLevel===0?130:190)+" KČS";
  $("armorOffer").textContent=stats.armorLevel>=2?"PODŠÍVKA · MAX":"PODŠÍT BUNDU · "+(stats.armorLevel===0?120:180)+" KČS";
  $("enemyName").textContent=activeFoe===foe?"HLÍDKA VEŘEJNÉ BEZPEČNOSTI":"MUŽ V CIVILU";
  $("enemyLevel").textContent=activeFoe===foe?"HLÍDKA · LVL 02":"SLEDOVAČ KURÝRA · LVL 04";
  $("enemyBar").style.width=Math.max(0,activeFoe.hp/activeFoe.maxHp*100)+"%";
  $("enemyHP").textContent=Math.max(0,activeFoe.hp)+" / "+activeFoe.maxHp+" HP";
  $("level").textContent=String(stats.level).padStart(2,"0");
  $("hpBar").style.width=`${stats.hp/stats.maxHp*100}%`;$("hpValue").textContent=`${stats.hp} / ${stats.maxHp}`;
  $("energyBar").style.width=`${stats.energy/stats.maxEnergy*100}%`;$("energyValue").textContent=`${stats.energy} / ${stats.maxEnergy}`;
  $("xpValue").textContent=`${stats.xp} / 100`;$("creditValue").textContent=String(stats.credits);$("medkitValue").textContent=`× ${stats.medkits}`;
  $("enemyBar").style.width=`${Math.max(0,activeFoe.hp/activeFoe.maxHp*100)}%`;$("enemyHP").textContent=`${Math.max(0,activeFoe.hp)} / ${activeFoe.maxHp} HP`;
  updateInventory();
}
function collectSupply(supply){
  if(supply.collected||state.inVehicle||state.combat||state.dialogue||state.paused)return;
  supply.collected=true;supply.group.visible=false;supply.interactable.enabled=false;gameAudio.reward();
  stats.medkits+=supply.medkits;stats.credits+=supply.credits;awardXP(supply.xp);
  updateStats();updateMission();saveGame();
  const reward=[supply.medkits?"+".concat(supply.medkits," OBVAZY"):null,supply.credits?"+".concat(supply.credits," KČS"):null,"+".concat(supply.xp," XP")].filter(Boolean).join(" · ");
  showToast(supply.label+" · "+reward);
}

const relayInteractable={id:"relay",x:0,z:-43,range:2.6,enabled:mission.stage===1,action(){
  if(mission.stage<1){showToast("ROZVODNA JE STÁLE ZAMČENÁ");return;}
  mission.stage=2;mission.complete=false;mechanicInteractable.enabled=true;miraBeacon.visible=true;awardXP(45);stats.credits+=140;stats.energy=stats.maxEnergy;updateMission();updateStats();saveGame();
  markerRing.visible=false;
  showToast("TELEFONNÍ LINKA OBNOVENA · +45 XP · +140 KČS");
}};
const enemyInteractable={id:"street-enemy",x:avatarTarget.x,z:avatarTarget.z,range:2.8,enabled:!foe.defeated,action:()=>{activeFoe=foe;activeEnemyMesh=enemyMesh;activeEnemyCollider=enemyCollider;startCombat();}};
const mechanicInteractable={id:"mira",x:4.8,z:-4.8,range:2.5,enabled:mission.stage===2,action:()=>openMechanicDialogue()};
const courierInteractable={id:"courier-ambush",x:-1.8,z:-68,range:3.1,enabled:isCourierEncounterActive(mission.stage,secondFoe.defeated),action:()=>{activeFoe=secondFoe;activeEnemyMesh=courierGuard;activeEnemyCollider=courierCollider;startCombat();}};
const towerInteractable={id:"archive-tower",x:-2,z:-85,range:3,enabled:mission.stage===4,action:()=>openEndingChoice()};
const supplyInteractables=supplies.map(supply=>{
  const interactable={id:supply.id,x:supply.x,z:supply.z,range:1.8,enabled:!supply.collected,action:()=>collectSupply(supply)};
  supply.interactable=interactable;return interactable;
});
function makeResident(data){
  const group=new THREE.Group();group.name=data.name;
  const addBox=(w,h,d,color,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color,.9));mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh;};
  addBox(.49,.7,.32,data.coat,0,1.08,0);
  addBox(.52,.13,.36,data.scarf,0,1.42,-.015);
  addBox(.38,.34,.31,data.trousers,0,.57,0);
  addBox(.34,.4,.34,data.skin,0,1.7,-.015);
  addBox(.4,.18,.39,data.hair,0,1.94,0);
  addBox(.42,.09,.39,data.hair,0,1.82,.025);
  for(const eyeX of [-.09,.09])addBox(.035,.035,.02,0x252420,eyeX,1.74,-.19);
  addBox(.06,.07,.075,data.skin,0,1.66,-.205);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.3,1.34,0);group.add(arm);
    const sleeve=new THREE.Mesh(new THREE.BoxGeometry(.17,.57,.2),material(data.coat,.9));sleeve.position.y=-.29;sleeve.castShadow=true;arm.add(sleeve);arms.push(arm);
    const leg=new THREE.Group();leg.position.set(side*.13,.43,0);group.add(leg);
    const trouserLeg=new THREE.Mesh(new THREE.BoxGeometry(.18,.55,.23),material(data.trousers,.9));trouserLeg.position.y=-.24;trouserLeg.castShadow=true;leg.add(trouserLeg);
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(.2,.12,.31),material(0x302b27,.9));shoe.position.set(0,-.51,-.035);shoe.castShadow=true;leg.add(shoe);legs.push(leg);
  }
  if(data.bag){
    addBox(.23,.32,.15,0x665340,-.31,1.08,.12);
    addBox(.3,.07,.08,0x3f3931,-.27,1.29,.05);
  }
  const direction=data.direction??1;
  group.position.set(data.x,0,data.z);group.rotation.y=direction>0?Math.PI:0;scene.add(group);
  const collider={name:data.name,minX:data.x-.32,maxX:data.x+.32,minZ:data.z-.24,maxZ:data.z+.24,minY:0,maxY:1.85,enabled:true};
  colliders.push(collider);
  const resident={...data,group,collider,arms,legs,routeIndex:0,waitTimer:0,heading:direction>0?Math.PI:0,idleYaw:direction>0?Math.PI:0,lineIndex:0,interactable:null,phase:Math.random()*Math.PI*2};
  const interactable={id:"resident-"+data.id,x:data.x,z:data.z,range:1.55,enabled:true,action:()=>{
    if(neighborQuestStep===0&&resident.id==="anna"){
      neighborQuestStep=advanceNeighborQuestStep(neighborQuestStep,"talk","anna");updateMission();saveGame();gameAudio.ui();showToast("PANÍ ANNA: „Ivana nechala sešit střihů ve vestibulu. Odneseš jí ho?“");return;
    }
    if(neighborQuestStep===1&&resident.id==="anna"){gameAudio.ui();showToast("PANÍ ANNA: „Modrý sešit bude u schránek ve vstupní chodbě.“");return;}
    if(neighborQuestStep===2&&resident.id==="ivana"){
      neighborQuestStep=advanceNeighborQuestStep(neighborQuestStep,"talk","ivana");stats.credits+=35;awardXP(20);updateStats();updateMission();saveGame();gameAudio.reward();showToast("IVANA: „Díky, máma z něj zase ušije kabát.“ · +35 KČS · +20 XP");return;
    }
    if(neighborQuestStep===2&&resident.id==="anna"){gameAudio.ui();showToast("PANÍ ANNA: „Ivana čeká na svůj sešit střihů.“");return;}
    const line=resident.lines[resident.lineIndex%resident.lines.length];resident.lineIndex++;
    gameAudio.ui();showToast(resident.name+" · „"+line+"“");
  }};
  resident.interactable=interactable;return resident;
}
const residents=[
  {id:"anna",name:"PANÍ ANNA",x:-7.25,z:24,direction:-1,speed:.42,route:[{x:-6.9,z:19,wait:1},{x:-7.3,z:13,wait:8,face:-1.1},{x:-7.05,z:17,wait:2},{x:-7.25,z:24,wait:5,face:1.1}],coat:0x655b4f,trousers:0x48433e,skin:0xb88c6b,hair:0x514238,scarf:0x9b4637,bag:true,lines:["Večer hrají v bytě na konci chodby. Jen potichu.","V pekárně dnes měli ještě teplý chleba.","Syn sousedů si šije zvony podle Burdy."]},
  {id:"karel",name:"KAREL",x:7.25,z:-10,direction:-1,speed:.48,route:[{x:7.1,z:-14,wait:1},{x:6.75,z:-20,wait:7,face:1.3},{x:7.35,z:-17,wait:2},{x:7.25,z:-10,wait:4,face:-1.3}],coat:0x52605c,trousers:0x343c40,skin:0xc09270,hair:0x34302a,scarf:0xb5a78e,bag:false,lines:["Tramvaj zase stojí u výhybky.","V Tuzexu mají džíny. Ale bez bonů jsou k ničemu.","Včera hráli v rádiu písničku a náhle ji přerušili."]},
  {id:"ivana",name:"IVANA",x:7.25,z:-25,direction:-1,speed:.38,route:[{x:6.85,z:-27,wait:2},{x:6.75,z:-29,wait:11,face:-1.4},{x:7.15,z:-28,wait:2},{x:7.25,z:-25,wait:6,face:1.4}],coat:0x77463a,trousers:0x635345,skin:0xc39776,hair:0x302722,scarf:0xd1c3a6,bag:false,lines:["Máma mi přešívá kabát po sestře.","U výměníku nechal někdo bednu. Vypadá nedotčeně.","Na dvoře si děti kreslí křídou, i když prší."]},
  {id:"milan",name:"MILAN",x:7.25,z:-37,direction:1,speed:.45,route:[{x:7.35,z:-43,wait:1},{x:7.05,z:-49,wait:12,face:1.2},{x:6.8,z:-46,wait:3},{x:7.25,z:-37,wait:5,face:-1.2}],coat:0x4c555c,trousers:0x383a38,skin:0xa87e62,hair:0x282522,scarf:0x8c8d7f,bag:true,lines:["Večer se scházíme u mostu. Bez plakátů, beze jmen.","V tomhle domě je pořád slyšet výtah.","Nové boty z výlohy zmizely dřív, než otevřeli."]},
  {id:"eva",name:"EVA",x:7.25,z:-59,direction:1,speed:.43,route:[{x:6.8,z:-63,wait:1},{x:6.75,z:-71,wait:8,face:-1.2},{x:7.3,z:-68,wait:2},{x:7.25,z:-59,wait:6,face:1.2}],coat:0x6b5145,trousers:0x4c4b49,skin:0xc49372,hair:0x5a3c2b,scarf:0x9b9180,bag:true,lines:["Když se člověk dívá z okna, celé sídliště svítí.","Někdo tu hledal kurýra. Ptal se na kazetu.","Mám doma střih z Burdy. Chceš si ho půjčit?"]},
  {id:"josef",name:"JOSEF",x:-7.25,z:-77,direction:1,speed:.4,route:[{x:-7.05,z:-82,wait:2},{x:-7.3,z:-89,wait:10,face:1.1},{x:-6.85,z:-85,wait:3},{x:-7.25,z:-77,wait:5,face:-1.1}],coat:0x665f4e,trousers:0x3b4140,skin:0xb18468,hair:0x39352d,scarf:0x958a70,bag:false,lines:["Vysílač na konci ulice je slyšet až v noci.","Lidé si půjčují desky po bytech. Aspoň tak se něco dozvíme.","Při dešti je v přízemí vždycky cítit mokrý beton."]}
].map(makeResident);
const residentInteractables=residents.map(resident=>resident.interactable);
const patternBook=new THREE.Group();patternBook.name="modrý sešit střihů";
const patternPages=new THREE.Mesh(new THREE.BoxGeometry(.3,.045,.22),material(0xd7d0bd,.94));patternPages.position.y=.12;patternBook.add(patternPages);
const patternCover=new THREE.Mesh(new THREE.BoxGeometry(.33,.035,.25),material(0x536b78,.86));patternCover.position.set(0,.15,0);patternCover.castShadow=true;patternBook.add(patternCover);
const patternSpine=new THREE.Mesh(new THREE.BoxGeometry(.035,.04,.25),material(0x394d59,.86));patternSpine.position.set(-.145,.15,0);patternBook.add(patternSpine);
const patternMarker=new THREE.Mesh(new THREE.TorusGeometry(.48,.025,6,24),material(0xffffff,.55,0xffffff,.3));patternMarker.rotation.x=Math.PI/2;patternMarker.position.y=.045;patternBook.add(patternMarker);
patternBook.position.set(-10.2,0,-6);patternBook.visible=neighborQuestStep===1;scene.add(patternBook);
const patternInteractable={id:"sešit-střihů",x:-10.2,z:-6,range:1.65,enabled:neighborQuestStep===1,action(){
  const next=advanceNeighborQuestStep(neighborQuestStep,"pickup","pattern");if(next===neighborQuestStep)return;
  neighborQuestStep=next;patternBook.visible=false;patternInteractable.enabled=false;gameAudio.reward();updateMission();saveGame();showToast("SEŠIT STŘIHŮ VZAT · DONES HO IVANĚ");
}};
const buildingDoorInteractables=buildingEntries.map(entry=>({
  id:"vstup-"+entry.id,x:entry.interactX,z:entry.z,minY:0,maxY:2.5,
  levelY:entry.floorOffset,verticalRange:.55,range:2.1,enabled:true,
  action(item,player){
    if(entry.open&&Math.hypot(player.x-item.x,player.z-item.z)<.72){showToast("USTUP OD DVEŘÍ, AŤ JE MŮŽU ZAVŘÍT");return;}
    entry.open=!entry.open;entry.doorPivot.rotation.y=entry.open?entry.openAngle:0;
    entry.doorCollider.enabled=!entry.open;gameAudio.door(entry.open);
    showToast(entry.id+(entry.open?" · VSTUP OTEVŘEN":" · VSTUP ZAVŘEN"));saveGame();
  }
}));
const elevatorCallInteractables=buildingEntries.flatMap(entry=>entry.elevator.callInteractables);
const elevatorControlInteractables=buildingEntries.flatMap(entry=>[entry.elevator.upInteractable,entry.elevator.downInteractable]);
const roofDoorInteractables=buildingEntries.map(entry=>({
  id:entry.id+" — vstup na střechu",x:entry.roofInteractX,z:entry.roofInteractZ,
  minY:entry.roofY,maxY:entry.roofY+2.1,levelY:entry.roofY,verticalRange:.6,range:1.4,enabled:true,
  action(){
    entry.roofOpen=!entry.roofOpen;entry.roofDoor.rotation.y=entry.roofOpen?entry.roofOpenAngle:0;
    entry.roofDoorCollider.enabled=!entry.roofOpen;gameAudio.door(entry.roofOpen);
    showToast(entry.roofOpen?"VÝCHOD NA STŘECHU OTEVŘEN":"VÝCHOD NA STŘECHU ZAVŘEN");saveGame();
  }
}));
const apartmentDoorInteractables=buildingEntries.flatMap(entry=>entry.apartmentDoors.map(door=>({
  id:door.doorPivot.name,x:door.x,z:door.z,
  minY:door.doorCollider.minY,maxY:door.doorCollider.maxY,
  levelY:door.floorLevel,verticalRange:.42,range:1.45,enabled:true,
  action(item,player){
    if(door.open&&Math.hypot(player.x-item.x,player.z-item.z)<.82){showToast("USTUP OD DVEŘÍ, AŤ JE MŮŽU ZAVŘÍT");return;}
    door.open=!door.open;door.doorPivot.rotation.y=door.open?door.openAngle:0;door.doorCollider.enabled=!door.open;
    gameAudio.door(door.open);showToast(door.open?"BYT OTEVŘEN":"BYT ZAVŘEN");saveGame();
  }
})));
const interactables=[enemyInteractable,relayInteractable,mechanicInteractable,courierInteractable,towerInteractable,patternInteractable,...supplyInteractables,...residentInteractables,...buildingDoorInteractables,...apartmentDoorInteractables,...elevatorCallInteractables,...elevatorControlInteractables,...roofDoorInteractables];
const navigation={bounds:{minX:-23.2,maxX:23.2,minZ:-92,maxZ:29},elevationAt:createBuildingElevationResolver(buildingEntries)};
const controller=createPlayerController({camera,colliders,interactables,state,ui:{showToast},navigation});
if(!restoreBuildingDoorStates(buildingEntries,saved.buildings)&&apartmentEntry&&saved.panelak){
  // Backward compatibility with saves created before all houses became walkable.
  apartmentEntry.open=Boolean(saved.panelak.entranceOpen);
  apartmentEntry.doorPivot.rotation.y=apartmentEntry.open?apartmentEntry.openAngle:0;
  apartmentEntry.doorCollider.enabled=!apartmentEntry.open;
  for(let index=0;index<apartmentEntry.apartmentDoors.length;index++){
    const door=apartmentEntry.apartmentDoors[index];
    door.open=Boolean(saved.panelak.doors?.[index]);
    door.doorPivot.rotation.y=door.open?door.openAngle:0;
    door.doorCollider.enabled=!door.open;
  }
}
function updateBuildingElevators(deltaTime){
  const player=controller.player;
  let carryingPlayer=false;
  for(const entry of buildingEntries){
    const lift=entry.elevator,motion=lift.motion;
    const frame=motion.step(deltaTime),doorAmount=frame.doorOpen;
    lift.cab.position.y=frame.y-.12;
    for(const floorDoor of lift.shaftDoors){
      const amount=floorDoor.floor===frame.currentFloor?doorAmount:0;
      floorDoor.left.position.x=lift.x-1.12/4-amount*.38;
      floorDoor.right.position.x=lift.x+1.12/4+amount*.38;
      floorDoor.collider.enabled=!(floorDoor.floor===frame.currentFloor&&amount>.92);
    }
    cabDoorLeftPosition(lift.cabDoorLeft,-.28-doorAmount*.38);
    cabDoorLeftPosition(lift.cabDoorRight,.28+doorAmount*.38);
    Object.assign(lift.cabDoorCollider,{
      minX:lift.x-.62,maxX:lift.x+.62,
      minZ:lift.doorPlaneZ-.07,maxZ:lift.doorPlaneZ+.07,minY:frame.y,maxY:frame.y+2.08,
      enabled:doorAmount<.92
    });
    const inCab=Math.abs(player.x-lift.x)<.56&&Math.abs(player.z-lift.z)<.56&&Math.abs(player.elevation-frame.y)<.95;
    if(motion.rider&&!inCab)motion.rider=false;
    if(inCab&&doorAmount>.92)motion.rider=true;
    lift.upInteractable.x=lift.controlX-lift.elevatorSideZ*.12;lift.upInteractable.z=lift.controlZ;lift.upInteractable.levelY=frame.y;
    lift.downInteractable.x=lift.controlX+lift.elevatorSideZ*.12;lift.downInteractable.z=lift.controlZ;lift.downInteractable.levelY=frame.y;
    lift.upInteractable.enabled=inCab&&doorAmount>.92&&!frame.moving&&frame.currentFloor<lift.motion.floorCount-1;
    lift.downInteractable.enabled=inCab&&doorAmount>.92&&!frame.moving&&frame.currentFloor>0;
    if(motion.rider&&inCab&&frame.moving){
      player.elevation=frame.y;
      controller.syncCamera(deltaTime);
      carryingPlayer=true;
    }
  }
  return carryingPlayer;
}
function cabDoorLeftPosition(mesh,z){mesh.position.z=z;}
const savedPlayerSafe=saved.player&&Math.abs(saved.player.x)<=22.9&&saved.player.z>-88&&saved.player.z<25;
if (!controller.setSpawn(savedPlayerSafe?saved.player:{x:0,z:8,yaw:0})) controller.setSpawn({x:0,z:8,yaw:0});
updateBuildingElevators(0);
mission.complete=mission.stage>=5;

function enterVehicle(){
  input.clear();controller.setAnalogMove(0,0);phoneDrawn=false;phoneGroup.visible=false;vehicle.occupied=true;vehicle.firstPerson=false;vehicle.cameraSnap=true;vehicleCollider.enabled=false;state.inVehicle=true;$("touchUI").classList.add("is-vehicle");$("crosshair").hidden=true;$("vehicleViewLabel").textContent="THIRD PERSON · V";vehicle.speed=0;vehicle.vx=0;vehicle.vz=0;vehicle.yawRate=0;showToast("ŠKODA FAVORIT · SHIFT STOUPÁ · CTRL KLESÁ · E VYSTOUPIT");
  vehicle.horizontalSpeed=0;
  gameAudio.door(true);
  camera.fov=80;camera.updateProjectionMatrix();$("vehicleHud").hidden=false;
  $("touchUI").querySelector('[data-touch-action="jump"]').textContent="STOUPAT";
  $("touchUI").querySelector('[data-touch-action="run"]').textContent="KLESAT";
  saveGame();
}
function exitVehicle(){
  if(vehicle.altitude>.7){showToast("PŘISTAŇ PŘED VYSTOUPENÍM · CTRL KLESAT");return false;}
  const sideX=Math.cos(vehicle.yaw)*1.8,sideZ=-Math.sin(vehicle.yaw)*1.8;
  const exits=[
    {x:vehicle.x+sideX,z:vehicle.z+sideZ,yaw:vehicle.yaw},
    {x:vehicle.x-sideX,z:vehicle.z-sideZ,yaw:vehicle.yaw},
    {x:vehicle.x-Math.sin(vehicle.yaw)*2.5,z:vehicle.z-Math.cos(vehicle.yaw)*2.5,yaw:vehicle.yaw},
    {x:vehicle.x+Math.sin(vehicle.yaw)*2.5,z:vehicle.z+Math.cos(vehicle.yaw)*2.5,yaw:vehicle.yaw}
  ];
  if(!exits.some(spawn=>controller.setSpawn(spawn))){showToast("KOLEM VOZU NENÍ BEZPEČNÉ MÍSTO K VYSTOUPENÍ");return false;}
  input.clear();
  vehicle.occupied=false;vehicle.firstPerson=false;vehicle.cameraSnap=false;state.inVehicle=false;$("touchUI").classList.remove("is-vehicle");$("crosshair").hidden=false;vehicle.speed=0;vehicle.vx=0;vehicle.vz=0;vehicle.yawRate=0;vehicle.altitude=0;vehicle.verticalSpeed=0;stateCar.position.y=0;vehicleCollider.enabled=true;syncVehicleCollider();controller.setAnalogMove(0,0);
  vehicle.horizontalSpeed=0;
  gameAudio.door(false);
  camera.fov=74;camera.updateProjectionMatrix();$("vehicleHud").hidden=true;
  $("touchUI").querySelector('[data-touch-action="jump"]').textContent="SKOK";
  $("touchUI").querySelector('[data-touch-action="run"]').textContent="BĚH";
  saveGame();showToast("VYSTOUPIL JSI Z VOZU");
  return true;
}
function toggleVehicleView(){
  if(!state.started||state.paused||state.combat||state.dialogue||!state.inVehicle)return;
  vehicle.firstPerson=!vehicle.firstPerson;
  vehicle.cameraSnap=true;
  $("vehicleViewLabel").textContent=vehicle.firstPerson?"FIRST PERSON · V":"THIRD PERSON · V";
  camera.fov=vehicle.firstPerson?76:80;camera.updateProjectionMatrix();
  gameAudio.ui();
  showToast(vehicle.firstPerson?"POHLED ŘIDIČE":"POHLED ZA VOZEM");
}
function togglePhone(){
  if(!state.started||state.paused||state.combat||state.dialogue||state.inventory||state.inVehicle)return;
  phoneDrawn=!phoneDrawn;phoneGroup.visible=phoneDrawn;gameAudio.ui();
  showToast(phoneDrawn?"TELEFON V RUCE · T ZAVŘÍT":"TELEFON UKLIZEN");
}
function toggleInventory(){
  if(!state.started||state.paused||state.combat||state.dialogue)return;
  state.inventory=!state.inventory;$("inventoryPanel").hidden=!state.inventory;
  if(state.inventory){phoneDrawn=false;phoneGroup.visible=false;input.clear();document.exitPointerLock?.();updateInventory();}
  else{input.clear();renderer.domElement.focus();}
}
function interact(){
  if(!state.started||state.combat||state.dialogue||state.paused)return;
  if(vehicle.occupied){exitVehicle();return;}
  const p=controller.player;
  if(Math.hypot(p.x-vehicle.x,p.z-vehicle.z)<3.8){enterVehicle();return;}
  if(controller.doInteract())gameAudio.confirm();
}
const input=bindInput({element:renderer.domElement,controller,state,onInteract:interact,onCombatAction(command){
  gameAudio.unlock();
  if(command==="up"){combatSelection=(combatSelection+3)%4;selectCombat();}
  else if(command==="down"){combatSelection=(combatSelection+1)%4;selectCombat();}
  else if(command==="confirm")action(["attack","aim","guard","heal"][combatSelection]);
  else action(command);
},onDialogueAction(command){
  gameAudio.unlock();
  if(endingMode){
    if(command==="up"||command==="down"){endingSelection=(endingSelection+1)%2;selectEnding();}
    else if(command==="confirm")finishEnding(endingSelection===0?"eva":"public");
    return;
  }
  if(command==="up"){dialogueSelection=(dialogueSelection+4)%5;selectDialogue();}
  else if(command==="down"){dialogueSelection=(dialogueSelection+1)%5;selectDialogue();}
  else if(command==="confirm")chooseDialogue(["accept","buy","weapon","armor","leave"][dialogueSelection]);
  else if(command==="back")closeDialogue();
},onMenuAction(command){
  gameAudio.unlock();
  const items=currentMenuItems();
  if(command==="up"){menuSelection=(menuSelection+items.length-1)%items.length;selectMenuItem();}
  else if(command==="down"){menuSelection=(menuSelection+1)%items.length;selectMenuItem();}
  else if(command==="left"||command==="right"){
    const item=items[menuSelection];
    if(item?.dataset.setting==="sensitivity")userSettings.sensitivity=((userSettings.sensitivity-1+(command==="right"?1:9))%10)+1;
    else if(item?.dataset.setting==="crt")userSettings.crt=!userSettings.crt;
    else if(item?.dataset.setting==="sound")userSettings.sound=!userSettings.sound;
    renderSettings();
  }else if(command==="confirm")activateMenuItem(items[menuSelection]);
  else if(command==="back"&&menuPage!=="main")setMenuPage("main");
},onPauseChange(paused){pauseScreen.hidden=!paused;renderer.domElement.classList.toggle("is-paused",paused);},onTogglePhone:togglePhone,onToggleInventory:toggleInventory,onToggleVehicleView:toggleVehicleView,onVehicleLook(dx,_dy,source="mouse"){
  if(source==="gamepad")vehicle.lookSteer=THREE.MathUtils.clamp(dx*60/2.2,-1,1);
  else vehicle.lookSteer=THREE.MathUtils.clamp(vehicle.lookSteer+dx*(source==="touch"?15:45),-1,1);
  vehicle.lookSteerUntil=gameTime+(source==="gamepad"?.08:.16);
}});
$("inventoryClose").addEventListener("click",toggleInventory);
const dialoguePanel=$("dialoguePanel");
const endingPanel=$("endingPanel");
let dialogueSelection=0,endingSelection=0,endingMode=false,endingChosen=false;
function selectDialogue(){[...dialoguePanel.querySelectorAll("[data-dialogue]")].forEach((b,i)=>b.classList.toggle("selected",i===dialogueSelection));gameAudio.ui();}
function openMechanicDialogue(){
  if(mission.stage!==2)return;
  input.clear();state.dialogue=true;dialogueSelection=0;dialoguePanel.hidden=false;document.exitPointerLock?.();
  $("dialogueText").textContent="„Telefon zase funguje. Pod mostem zadrželi kluka s páskou z koncertu. Jestli ji zabaví, zmizí poslední kopie. Pomůžeš mu? A jestli chceš, upravím ti Škorpion nebo podšiju bundu.“";
  selectDialogue();
}
function closeDialogue(){input.clear();state.dialogue=false;dialoguePanel.hidden=true;}
function chooseDialogue(choice){
  if(!state.dialogue||state.paused)return;
  if(choice==="accept"){
    mission.stage=3;mechanicInteractable.enabled=false;courierInteractable.enabled=true;
    courierGuard.visible=true;courierCollider.enabled=true;courier.visible=true;courierBeacon.visible=true;miraBeacon.visible=false;
    updateMission();saveGame();closeDialogue();showToast("MIRA: „Díky. Kurýr čeká pod tramvajovým mostem.“");return;
  }
  if(choice==="buy"){
    if(stats.credits<75){$("dialogueText").textContent="„Na obvazy ti chybí peníze. Nejdřív pomož kurýrovi.“";return;}
    stats.credits-=75;stats.medkits++;updateStats();saveGame();
    $("dialogueText").textContent="„Tady máš balíček obvazů. Kurýra najdeš pod tramvajovým mostem.“";showToast("OBVAZY ZAKOUPENY · −75 KČS");return;
  }
  if(choice==="weapon"){
    if(stats.weaponLevel>=2){$("dialogueText").textContent="„Na Škorpionu už není co ladit. Drž ho čistý a poslouchej pružinu.“";return;}
    const cost=stats.weaponLevel===0?130:190;
    if(stats.credits<cost){$("dialogueText").textContent="„Na úpravu Škorpionu ti chybí "+(cost-stats.credits)+" Kčs.“";return;}
    stats.credits-=cost;stats.weaponLevel++;updateStats();saveGame();
    $("dialogueText").textContent="„Hotovo. Vz. 61 teď kope jistěji.“";showToast("ŠKORPION VYLEPŠEN · ÚROVEŇ "+stats.weaponLevel);return;
  }
  if(choice==="armor"){
    if(stats.armorLevel>=2){$("dialogueText").textContent="„Bunda už má dvojitou podšívku. Víc by tě jen zpomalilo.“";return;}
    const cost=stats.armorLevel===0?120:180;
    if(stats.credits<cost){$("dialogueText").textContent="„Na podšívku ti chybí "+(cost-stats.credits)+" Kčs.“";return;}
    stats.credits-=cost;stats.armorLevel++;stats.maxHp+=8;stats.hp=Math.min(stats.maxHp,stats.hp+8);updateStats();saveGame();
    $("dialogueText").textContent="„Podšívka drží. Zásah tolik neprojde a bunda vydrží víc.“";showToast("BUNDA ZPEVNĚNA · −"+(stats.armorLevel*2)+" ZRANĚNÍ");return;
  }
  closeDialogue();
}
dialoguePanel.querySelectorAll("[data-dialogue]").forEach((button,index)=>{
  button.addEventListener("mouseenter",()=>{dialogueSelection=index;selectDialogue();});
  button.addEventListener("click",()=>chooseDialogue(button.dataset.dialogue));
});
window.addEventListener("keydown",event=>{
  if(!state.dialogue||state.paused||endingMode)return;
  if(event.code==="ArrowDown"){event.preventDefault();dialogueSelection=(dialogueSelection+1)%5;selectDialogue();}
  else if(event.code==="ArrowUp"){event.preventDefault();dialogueSelection=(dialogueSelection+4)%5;selectDialogue();}
  else if(event.code==="Enter"){event.preventDefault();chooseDialogue(["accept","buy","weapon","armor","leave"][dialogueSelection]);}
  else if(["Digit1","Digit2","Digit3","Digit4","Digit5"].includes(event.code)){event.preventDefault();chooseDialogue(["accept","buy","weapon","armor","leave"][Number(event.code.slice(-1))-1]);}
  else if(event.code==="Escape"){event.preventDefault();closeDialogue();}
},{capture:true});
function openEndingChoice(){
  if(mission.stage!==4)return;
  input.clear();endingMode=true;endingChosen=false;state.dialogue=true;endingSelection=0;dialoguePanel.hidden=true;endingPanel.hidden=false;document.exitPointerLock?.();
  $("endingTitle").textContent="POSLEDNÍ ROZHODNUTÍ";
  $("endingText").textContent="Kurýr přinesl nahrávku zakázané kapely. Rozhodni, zda ji předáš Evě, nebo necháš rozšířit po bytech.";
  endingPanel.querySelector(".ending-actions").hidden=false;$("endingContinue").hidden=true;selectEnding();
}
function selectEnding(){[...endingPanel.querySelectorAll("[data-ending]")].forEach((button,index)=>button.classList.toggle("selected",index===endingSelection));gameAudio.ui();}
function finishEnding(choice){
  if(!endingMode||endingChosen||state.paused)return;
  endingChosen=true;endingChoice=choice;mission.stage=5;mission.complete=true;gameAudio.reward();
  if(choice==="public"){
    $("endingTitle").textContent="HLAS Z BYTŮ";$("endingText").textContent="Kopie nahrávky putují mezi lidmi z bloku. Zakázaná kapela hraje v kuchyních a garážích — a už ji nelze umlčet.";
    awardXP(100);stats.credits+=260;
  }else{
    $("endingTitle").textContent="TICHÁ DOHODA";$("endingText").textContent="Eva ukryla originální pásku a předala několik kopií důvěryhodným lidem. Hostinec dnes v noci zůstane v bezpečí, ale pravda se šíří pomalu.";
    awardXP(85);stats.credits+=180;
  }
  endingPanel.querySelector(".ending-actions").hidden=true;$("endingContinue").hidden=false;updateMission();updateStats();saveGame();
}
endingPanel.querySelectorAll("[data-ending]").forEach((button,index)=>{
  button.addEventListener("mouseenter",()=>{endingSelection=index;selectEnding();});
  button.addEventListener("click",()=>finishEnding(button.dataset.ending));
});
window.addEventListener("keydown",event=>{
  if(!endingMode||endingChosen||state.paused)return;
  if(event.code==="ArrowDown"||event.code==="ArrowUp"){event.preventDefault();endingSelection=(endingSelection+1)%2;selectEnding();}
  else if(event.code==="Digit1"||event.code==="Digit2"){event.preventDefault();finishEnding(event.code==="Digit1"?"eva":"public");}
  else if(event.code==="Enter"){event.preventDefault();finishEnding(endingSelection===0?"eva":"public");}
},{capture:true});
$("endingContinue").addEventListener("click",()=>{input.clear();endingPanel.hidden=true;state.dialogue=false;endingMode=false;endingChosen=false;renderer.domElement.focus();});

const menuScreen=$("menuScreen"),menuMain=$("menuMain"),menuSettings=$("menuSettings"),menuControls=$("menuControls"),menuConfirm=$("menuConfirm");
const menuPages={main:menuMain,settings:menuSettings,controls:menuControls,newconfirm:menuConfirm};
let menuPage="main",menuSelection=0;
const settingsKey=SAVE_KEY+"-settings";
let userSettings={sensitivity:5,crt:true,sound:true};
try{userSettings={...userSettings,...JSON.parse(localStorage.getItem(settingsKey)||"{}")};}catch{}
function renderSettings(){
  $("sensitivityValue").textContent=String(userSettings.sensitivity).padStart(2,"0");$("crtValue").textContent=userSettings.crt?"ZAP":"VYP";
  $("soundValue").textContent=userSettings.sound?"ZAP":"VYP";gameAudio.setMuted(!userSettings.sound);
  input.setMouseSensitivity(.00035+userSettings.sensitivity*.00013);
  document.documentElement.style.setProperty("--crt-line-opacity",userSettings.crt?".17":"0");
  try{localStorage.setItem(settingsKey,JSON.stringify(userSettings));}catch{}
}
function currentMenuItems(){return [...menuPages[menuPage].querySelectorAll("button:not(:disabled)")];}
function selectMenuItem(){currentMenuItems().forEach((b,i)=>b.classList.toggle("selected",i===menuSelection));gameAudio.ui();}
function setMenuPage(page){
  menuPage=page;for(const [name,panel] of Object.entries(menuPages))panel.hidden=name!==page;
  $("menuSubtitle").textContent=page==="main"?"SÍDLIŠTĚ MÍR · ČESKOSLOVENSKO · 1975":page==="settings"?"OBRAZ · OVLÁDÁNÍ · NASTAVENÍ":page==="controls"?"KLÁVESNICE · MYŠ · OVLADAČ":"POTVRZENÍ · NOVÁ HRA";
  menuSelection=0;selectMenuItem();
}
function closeMenu(){menuScreen.hidden=true;state.started=true;renderer.domElement.focus();if(matchMedia("(pointer:fine)").matches){try{const lock=renderer.domElement.requestPointerLock?.();lock?.catch?.(()=>{});}catch{}}}
function startNewGame(){
  try{localStorage.removeItem(SAVE_KEY);}catch{}
  for(const entry of buildingEntries){entry.open=false;entry.doorPivot.rotation.y=0;entry.doorCollider.enabled=true;entry.roofOpen=false;entry.roofDoor.rotation.y=0;entry.roofDoorCollider.enabled=true;entry.elevator.motion.rider=false;entry.elevator.motion.requestFloor(0);for(const door of entry.apartmentDoors){door.open=false;door.doorPivot.rotation.y=0;door.doorCollider.enabled=true;}}
  mission.stage=0;mission.complete=false;neighborQuestStep=0;patternBook.visible=false;patternInteractable.enabled=false;endingChoice=null;state.dialogue=false;state.paused=false;state.combat=false;state.inVehicle=false;$("touchUI").classList.remove("is-vehicle");state.inventory=false;phoneDrawn=false;vehicle.occupied=false;activeFoe=foe;activeEnemyMesh=enemyMesh;activeEnemyCollider=enemyCollider;foe.hp=foe.maxHp;foe.defeated=false;foe.busy=false;secondFoe.hp=secondFoe.maxHp;secondFoe.defeated=false;secondFoe.busy=false;enemyCollider.enabled=true;courierCollider.enabled=false;enemyInteractable.enabled=true;courierInteractable.enabled=false;relayInteractable.enabled=false;mechanicInteractable.enabled=false;towerInteractable.enabled=false;
  stats.hp=74;stats.maxHp=74;stats.energy=32;stats.maxEnergy=32;stats.xp=0;stats.level=1;stats.credits=120;stats.medkits=2;stats.weaponLevel=0;stats.armorLevel=0;stats.guard=false;totalPlaySeconds=0;
  scene.add(enemyMesh);scene.add(courierGuard);scene.add(courier);courierGuard.visible=false;courier.visible=false;courierBeacon.visible=false;miraBeacon.visible=false;markerRing.visible=false;towerBeacon.visible=false;endingPanel.hidden=true;dialoguePanel.hidden=true;
  for(const supply of supplies){supply.collected=false;supply.group.visible=true;supply.interactable.enabled=true;}
  pauseScreen.hidden=true;renderer.domElement.classList.remove("is-paused");combatPanel.hidden=true;$("vehicleHud").hidden=true;camera.fov=74;camera.updateProjectionMatrix();
  phoneDrawn=false;state.inventory=false;$("inventoryPanel").hidden=true;phoneGroup.visible=false;vehicle.x=2.5;vehicle.z=10.5;vehicle.yaw=0;vehicle.yawRate=0;vehicle.speed=0;vehicle.vx=0;vehicle.vz=0;vehicle.horizontalSpeed=0;vehicle.altitude=0;vehicle.verticalSpeed=0;vehicle.battery=100;vehicleCollider.enabled=true;syncVehicleCollider();stateCar.position.set(vehicle.x,0,vehicle.z);stateCar.rotation.set(0,0,0);vehicle.firstPerson=false;vehicle.cameraSnap=false;$("crosshair").hidden=false;$("vehicleViewLabel").textContent="THIRD PERSON · V";for(const flame of thrusters)flame.visible=false;for(const pod of hoverPods)pod.visible=false;for(const light of hoverPodLights)light.visible=false;for(const wheel of [...wheels,...wheelHubs,...importedWheelParts])wheel.visible=true;$("touchUI").querySelector('[data-touch-action="jump"]').textContent="SKOK";$("touchUI").querySelector('[data-touch-action="run"]').textContent="BĚH";
  controller.setSpawn({x:0,z:8,yaw:0});updateMission();updateStats();saveGame();closeMenu();showToast("MÍR 12 · PODZIM 1975");
}
function activateMenuItem(item=currentMenuItems()[menuSelection]){
  if(!item)return;
  try{
  const actionName=item.dataset.menu;
  gameAudio.confirm();
  if(menuPage==="main"){
    if(actionName==="continue"){
      if(resolvePrimaryMenuAction(saveAvailable)==="start-new")startNewGame();
      else closeMenu();
    }
    if(actionName==="new")setMenuPage("newconfirm");
    if(actionName==="settings")setMenuPage("settings");
    if(actionName==="controls")setMenuPage("controls");
    return;
  }
  if(actionName==="confirm-new"){startNewGame();return;}
  if(actionName==="back"){setMenuPage("main");return;}
  if(item.dataset.setting==="sensitivity")userSettings.sensitivity=(userSettings.sensitivity%10)+1;
  if(item.dataset.setting==="crt")userSettings.crt=!userSettings.crt;
  if(item.dataset.setting==="sound")userSettings.sound=!userSettings.sound;
  renderSettings();
  }catch(error){showStartupError(error);}
}
const continueOption=$("continueOption");
const saveAvailable=Boolean(saved.player||saved.missionStage||saved.playSeconds);
continueOption.disabled=false;
continueOption.textContent=saveAvailable?"POKRAČOVAT":"ZAČÍT HRU";
continueOption.title=saveAvailable?"Obnovit poslední uloženou pozici.":"Spustit novou hru. Uložený postup nebyl nalezen.";
menuSelection=0;
menuScreen.querySelectorAll("button").forEach(button=>{
  button.addEventListener("click",()=>{const items=currentMenuItems();const index=items.indexOf(button);if(index>=0)menuSelection=index;activateMenuItem(button);});
});
renderSettings();selectMenuItem();
window.addEventListener("keydown",event=>{
  if(!state.started&&!menuScreen.hidden){
    if(event.code==="ArrowDown"||event.code==="KeyS"){event.preventDefault();menuSelection=(menuSelection+1)%currentMenuItems().length;selectMenuItem();}
    else if(event.code==="ArrowUp"||event.code==="KeyW"){event.preventDefault();menuSelection=(menuSelection+currentMenuItems().length-1)%currentMenuItems().length;selectMenuItem();}
    else if(event.code==="Enter"||event.code==="Space"){event.preventDefault();activateMenuItem();}
    else if(event.code==="ArrowLeft"||event.code==="ArrowRight"){
      const item=currentMenuItems()[menuSelection];if(item?.dataset.setting==="sensitivity"){userSettings.sensitivity=((userSettings.sensitivity-1+(event.code==="ArrowRight"?1:9))%10)+1;renderSettings();}
      else if(item?.dataset.setting==="crt"){userSettings.crt=!userSettings.crt;renderSettings();}
      else if(item?.dataset.setting==="sound"){userSettings.sound=!userSettings.sound;renderSettings();}
    }
    else if(event.code==="Escape"&&menuPage!=="main"){setMenuPage("main");}
    return;
  }
  if(event.code==="Escape"&&state.paused&&!pauseScreen.hidden){
    // The input adapter has just released pointer lock; pause overlay stays available.
  }
},{capture:true});
$("pauseMenuButton").addEventListener("click",()=>{
  saveGame();
  input.resume();state.started=false;pauseScreen.hidden=true;document.exitPointerLock?.();menuScreen.hidden=false;setMenuPage("main");
});

function startCombat(){
  if(activeFoe.defeated||state.combat)return;
  input.clear();state.combat=true;state.paused=false;activeFoe.busy=false;combatSelection=0;combatPanel.hidden=false;document.exitPointerLock?.();
  $("combatLog").textContent=activeFoe===foe?"Příslušník VB ti zatarasil cestu. Vyber akci.":"Muž v civilu se otočil proti tobě. Vyber akci.";
  $("turnState").textContent="TVŮJ TAH";updateStats();selectCombat();
}
function selectCombat(){[...combatPanel.querySelectorAll("[data-action]")].forEach((button,i)=>button.classList.toggle("selected",i===combatSelection));gameAudio.ui();}
function endCombat(){
  input.clear();state.combat=false;activeFoe.busy=false;combatPanel.hidden=true;
  if(activeFoe.hp<=0&&activeFoe===foe){
    gameAudio.reward();foe.defeated=true;scene.remove(enemyMesh);enemyCollider.enabled=false;enemyInteractable.enabled=false;relayInteractable.enabled=true;markerRing.visible=true;mission.stage=1;
    awardXP(65);stats.credits+=90;stats.energy=Math.min(stats.maxEnergy,stats.energy+8);updateMission();updateStats();saveGame();showToast("HLÍDKA ZASTAVENA · +65 XP · +90 KČS");
  } else if(activeFoe.hp<=0&&activeFoe===secondFoe){
    gameAudio.reward();secondFoe.defeated=true;scene.remove(courierGuard);courierCollider.enabled=false;courierInteractable.enabled=false;towerInteractable.enabled=true;towerBeacon.visible=true;mission.stage=4;mission.complete=false;
    awardXP(110);stats.credits+=180;stats.energy=stats.maxEnergy;courierBeacon.visible=false;updateMission();updateStats();saveGame();
    showToast("KURÝR ZACHRÁNĚN · +110 XP · +180 KČS · NOVÝ CÍL: VYSÍLAČ");
  } else {
    activeFoe.hp=activeFoe.maxHp;stats.hp=Math.max(38,stats.hp);stats.energy=Math.max(10,stats.energy);
    if(!controller.setSpawn({x:3.4,z:-7.2,yaw:0}))controller.setSpawn({x:0,z:8,yaw:0});
    updateStats();saveGame();showToast("PORÁŽKA · MIRA TĚ STÁHLA DO BEZPEČÍ · SOUPEŘ SE VRÁTIL");
  }
}
function scheduleCombatStep(delay,callback){
  setTimeout(()=>{
    if(!state.combat)return;
    if(state.paused||!state.started){scheduleCombatStep(100,callback);return;}
    callback();
  },delay);
}
function enemyTurn(){
  activeFoe.busy=true;$("turnState").textContent="NEPŘÁTELSKÝ TAH";
  const rawDamage=stats.guard?4+Math.floor(Math.random()*4):(activeFoe===foe?8:10)+Math.floor(Math.random()*7);
  const damage=Math.max(2,rawDamage-stats.armorLevel*2);stats.guard=false;
  scheduleCombatStep(650,()=>{
    stats.hp=Math.max(0,stats.hp-damage);gameAudio.impact();$("combatLog").textContent=`Nepřítel tě zasáhl za ${damage} bodů poškození.`;updateStats();
    if(stats.hp===0){$("combatLog").textContent="Padl jsi. Mira tě po ošetření posílá zpátky do boje.";scheduleCombatStep(750,endCombat);return;}
    activeFoe.busy=false;$("turnState").textContent="TVŮJ TAH";
  });
}
function action(name){
  if(!state.combat||state.paused||activeFoe.busy)return;
  if(name==="attack"){const n=14+Math.floor(Math.random()*7)+stats.weaponLevel*3;activeFoe.hp=Math.max(0,activeFoe.hp-n);$("combatLog").textContent="Krátká dávka zasáhla cíl za "+n+" poškození.";}
  if(name==="aim"){
    if(stats.energy<8){$("combatLog").textContent="Na přesnou ránu nemáš dost energie.";return;}
    stats.energy-=8;const n=24+Math.floor(Math.random()*9)+stats.weaponLevel*5;activeFoe.hp=Math.max(0,activeFoe.hp-n);$("combatLog").textContent="Pečlivý výstřel! Cíl utržil "+n+" poškození.";
  }
  if(name==="guard"){stats.guard=true;stats.energy=Math.min(stats.maxEnergy,stats.energy+5);$("combatLog").textContent="Zaujal jsi kryt. Příští zásah bude slabší. +5 EN.";}
  if(name==="heal"){
    if(stats.medkits<1){$("combatLog").textContent="Nemáš žádné obvazy.";return;}
    if(stats.hp===stats.maxHp){$("combatLog").textContent="Vitalita je už plná.";return;}
    stats.medkits--;const old=stats.hp;stats.hp=Math.min(stats.maxHp,stats.hp+28);$("combatLog").textContent="Obvazy obnovily "+(stats.hp-old)+" HP.";
  }
  if(name==="attack"||name==="aim")gameAudio.impact();
  updateStats();
  if(activeFoe.hp<=0){activeFoe.busy=true;$("turnState").textContent="CÍL ELIMINOVÁN";scheduleCombatStep(550,endCombat);}else enemyTurn();
}
combatPanel.querySelectorAll("[data-action]").forEach((button,index)=>{button.addEventListener("mouseenter",()=>{combatSelection=index;selectCombat();});button.addEventListener("click",()=>action(button.dataset.action));});
window.addEventListener("keydown",e=>{
  if(!state.combat||state.paused)return;
  if(["Digit1","Digit2","Digit3","Digit4"].includes(e.code)){e.preventDefault();action(["attack","aim","guard","heal"][Number(e.code.slice(-1))-1]);}
  if(e.code==="ArrowDown"||e.code==="KeyS"){combatSelection=(combatSelection+1)%4;selectCombat();}
  if(e.code==="ArrowUp"||e.code==="KeyW"){combatSelection=(combatSelection+3)%4;selectCombat();}
  if(e.code==="Enter"){e.preventDefault();action(["attack","aim","guard","heal"][combatSelection]);}
},{capture:true});
function resize(){const w=Math.max(1,mount.clientWidth),h=Math.max(1,mount.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(mount);resize();
let previousTime=0,gameTime=0,nextAutosave=6,nextFootstep=0,nextVehicleImpact=0;
renderer.setAnimationLoop(time=>{
  const dt=previousTime?Math.min((time-previousTime)/1000,.05):0;previousTime=time;gameTime+=dt;
  let playerMoved=false;
  if(state.started&&!state.paused&&!state.combat)totalPlaySeconds+=dt;
  const clockSeconds=Math.floor(totalPlaySeconds),clockHours=String(Math.floor(clockSeconds/3600)).padStart(2,"0"),clockMinutes=String(Math.floor(clockSeconds/60)%60).padStart(2,"0"),clockRemainder=String(clockSeconds%60).padStart(2,"0");
  $("menuClock").textContent=`${clockHours}:${clockMinutes}:${clockRemainder}`;
  if(state.started&&!state.paused&&!state.combat&&!state.dialogue){
    if(vehicle.occupied){
      const keys=controller.keysDown,analog=controller.getAnalogMove();
      const throttle=THREE.MathUtils.clamp(Number(Boolean(keys.KeyW||keys.ArrowUp))-Number(Boolean(keys.KeyS||keys.ArrowDown))+analog.y,-1,1);
      const keyboardSteer=Number(Boolean(keys.KeyD||keys.ArrowRight))-Number(Boolean(keys.KeyA||keys.ArrowLeft));
      if(gameTime>vehicle.lookSteerUntil)vehicle.lookSteer*=Math.exp(-8.5*dt);
      const steer=THREE.MathUtils.clamp(keyboardSteer+analog.x+vehicle.lookSteer,-1,1);
      const climb=Number(Boolean(keys.ShiftLeft||keys.ShiftRight))-Number(Boolean(keys.ControlLeft||keys.ControlRight));
      const dynamics=stepVehicleDynamics(vehicle,{throttle,steer,lift:climb},dt);
      if(dynamics.batteryLow)showToast("BATERIE SLÁBNE · ZAČNI KLESAT");
      if(dynamics.batteryEmpty)showToast("BATERIE VYBITÁ · NOUZOVÉ KLESÁNÍ");
      if(dynamics.landed)showToast("NOUZOVÉ PŘISTÁNÍ · POHON SE DOBÍJÍ");
      const nx=vehicle.x+vehicle.vx*dt,nz=vehicle.z+vehicle.vz*dt;
      const flightX=vehicle.altitude>.8,sideLimit=flightX?22.2:7.2;
      const collision=moveVehicleWithCollisions(vehicle,nx,nz,colliders,{selfCollider:vehicleCollider,bounds:{minX:-sideLimit,maxX:sideLimit,minZ:flightX?-99:-96,maxZ:flightX?31:29}});
      if((collision.blockedX||collision.blockedZ)&&gameTime>=nextVehicleImpact){gameAudio.impact();nextVehicleImpact=gameTime+.22;}
      const inAir=vehicle.altitude>.8,horizontalSpeed=Math.hypot(vehicle.vx,vehicle.vz);
      stateCar.position.set(vehicle.x,vehicle.altitude,vehicle.z);syncVehicleCollider();
      const bodyPitch=THREE.MathUtils.clamp((inAir?throttle*.045:throttle*.018)+vehicle.verticalSpeed*.012,-.14,.16);
      const bodyRoll=THREE.MathUtils.clamp(-steer*(inAir?.12:.035),-.12,.12);
      stateCar.rotation.set(bodyPitch,vehicle.yaw,bodyRoll);
      wheels.forEach(w=>w.rotation.x+=vehicle.speed*dt/.34);
      frontWheelPivots.forEach(pivot=>pivot.rotation.y=-steer*(inAir?.38:.5));
      if(typeof importedWheelBones!=="undefined")importedWheelBones.forEach(bone=>bone.rotation.x+=vehicle.speed*dt/.33);
      if(typeof importedFrontAxle!=="undefined"&&importedFrontAxle)importedFrontAxle.rotation.y=-steer*(inAir?.22:.42);
      for(const wheel of [...wheels,...wheelHubs,...importedWheelParts])wheel.visible=!inAir;
      hoverPods.forEach((pod,index)=>{pod.visible=inAir;pod.position.y=.19+.035*Math.sin(gameTime*5+index*.6);});
      hoverPodLights.forEach((light,index)=>{light.visible=inAir;light.intensity=.25+.12*Math.sin(gameTime*7+index);});
      thrusters.forEach((flame,index)=>{flame.visible=inAir;flame.scale.setScalar(.78+.22*Math.sin(gameTime*13+index));});
      const cameraPose=vehicleCameraRig.update(vehicle,dt,vehicle.cameraSnap);
      vehicleCameraPosition.set(cameraPose.position.x,cameraPose.position.y,cameraPose.position.z);
      vehicleLookTarget.set(cameraPose.target.x,cameraPose.target.y,cameraPose.target.z);
      camera.position.copy(vehicleCameraPosition);
      camera.rotation.order="YXZ";
      camera.lookAt(vehicleLookTarget);
      vehicle.cameraSnap=false;
      const targetFov=vehicle.firstPerson?76:78+Math.min(horizontalSpeed/18.5,1)*5;
      const fovBlend=1-Math.exp(-5.5*dt);
      if(Math.abs(camera.fov-targetFov)>.01){
        camera.fov+=(targetFov-camera.fov)*fovBlend;
        camera.updateProjectionMatrix();
      }
      $("speedValue").textContent=String(Math.round(horizontalSpeed*3.6)).padStart(3,"0");
      $("altitudeValue").textContent=String(Math.round(vehicle.altitude)).padStart(2,"0");
      $("batteryValue").textContent=String(Math.round(vehicle.battery)).padStart(2,"0");
    }else{
      const previousX=controller.player.x,previousZ=controller.player.z;
      const ridingElevator=updateBuildingElevators(dt);
      if(!ridingElevator)controller.update(dt);
      playerMoved=!ridingElevator&&Math.hypot(controller.player.x-previousX,controller.player.z-previousZ)>.012;
    }
  }
  if(state.started&&!state.combat&&gameTime>=nextAutosave){saveGame();nextAutosave=gameTime+6;}
  tram.position.x=Math.sin(gameTime*.075)*13;tramCollider.minX=tram.position.x-5.75;tramCollider.maxX=tram.position.x+5.75;
  supplies.forEach((supply,index)=>{if(!supply.collected){supply.group.position.y=.035+Math.sin(gameTime*1.5+index*1.8)*.055;supply.group.rotation.y=Math.sin(gameTime*.7+index)*.08;}});
  residents.forEach(resident=>{
    const person=resident.group;
    let walking=false;
    if(resident.waitTimer>0){
      resident.waitTimer=Math.max(0,resident.waitTimer-dt);
    }else{
      const stop=resident.route[resident.routeIndex],dx=stop.x-person.position.x,dz=stop.z-person.position.z,distance=Math.hypot(dx,dz);
      if(distance<.055){
        person.position.set(stop.x,0,stop.z);resident.waitTimer=stop.wait;resident.idleYaw=stop.face??resident.heading;resident.routeIndex=(resident.routeIndex+1)%resident.route.length;
      }else{
        const step=Math.min(distance,resident.speed*dt);person.position.x+=dx/distance*step;person.position.z+=dz/distance*step;
        resident.heading=Math.atan2(dx,-dz);walking=true;
      }
    }
    const desiredYaw=walking?resident.heading:resident.idleYaw;
    let yawDelta=Math.atan2(Math.sin(desiredYaw-person.rotation.y),Math.cos(desiredYaw-person.rotation.y));
    person.rotation.y+=yawDelta*Math.min(1,dt*(walking?8:2.2));
    const swing=walking?Math.sin(gameTime*8+resident.phase):Math.sin(gameTime*1.3+resident.phase)*.08;
    resident.arms[0].rotation.x=swing*(walking ? .36 : .09);resident.arms[1].rotation.x=-swing*(walking ? .36 : .09);
    resident.legs[0].rotation.x=walking ? -swing*.3 : 0;resident.legs[1].rotation.x=walking ? swing*.3 : 0;
    resident.collider.minX=person.position.x-.32;resident.collider.maxX=person.position.x+.32;
    resident.collider.minZ=person.position.z-.24;resident.collider.maxZ=person.position.z+.24;
    resident.interactable.x=person.position.x;resident.interactable.z=person.position.z;
  });
  relay.rotation.y=0;markerRing.rotation.z=gameTime*.25;
  if(!state.inVehicle&&!state.combat){
    const p=controller.player;
    const nearCar=Math.hypot(p.x-vehicle.x,p.z-vehicle.z)<3.8;
    const nearBuildingDoor=buildingEntries.find(entry=>p.elevation<1.1&&Math.hypot(p.x-entry.interactX,p.z-entry.z)<2.1);
    const nearApartmentDoor=buildingEntries.some(entry=>entry.apartmentDoors.some(door=>Math.abs(p.elevation-door.floorLevel)<.55&&Math.hypot(p.x-door.x,p.z-door.z)<1.45));
    const nearElevatorCall=elevatorCallInteractables.find(item=>Math.abs(p.elevation-item.levelY)<item.verticalRange&&Math.hypot(p.x-item.x,p.z-item.z)<item.range);
    const nearElevatorControl=elevatorControlInteractables.find(item=>item.enabled&&Math.hypot(p.x-item.x,p.z-item.z)<item.range);
    const nearRoofDoor=roofDoorInteractables.find(item=>Math.abs(p.elevation-item.levelY)<item.verticalRange&&Math.hypot(p.x-item.x,p.z-item.z)<item.range);
    const nearEnemy=!foe.defeated&&Math.hypot(p.x-avatarTarget.x,p.z-avatarTarget.z)<2.8;
    const nearRelay=mission.stage===1&&Math.hypot(p.x,p.z+43)<2.6;
    const nearMira=mission.stage===2&&Math.hypot(p.x-4.8,p.z+4.8)<2.5;
    const nearCourier=mission.stage===3&&Math.hypot(p.x+1.8,p.z+68)<3.1;
    const nearTower=mission.stage===4&&Math.hypot(p.x+2,p.z+85)<3;
    const nearSupply=supplies.find(supply=>!supply.collected&&Math.hypot(p.x-supply.x,p.z-supply.z)<1.8);
    const nearResident=residents.find(resident=>Math.hypot(p.x-resident.group.position.x,p.z-resident.group.position.z)<1.55);
    const nearPattern=neighborQuestStep===1&&Math.hypot(p.x-patternInteractable.x,p.z-patternInteractable.z)<patternInteractable.range;
    const nearIvanaDelivery=neighborQuestStep===2&&nearResident?.id==="ivana";
    hint.textContent=nearCar?"E NASTOUPIT · WASD JÍZDA · MYŠ ŘÍZENÍ":nearElevatorControl?"E VÝTAH · O PATRO VÝŠ / NÍŽ":nearElevatorCall?"E PŘIVOLAT VÝTAH":nearRoofDoor?"E OTEVŘÍT / ZAVŘÍT VSTUP NA STŘECHU":nearSupply?"E SEBRAT "+nearSupply.label:nearPattern?"E VZÍT SEŠIT STŘIHŮ":nearBuildingDoor?"E OTEVŘÍT / ZAVŘÍT VSTUP · "+nearBuildingDoor.id:nearApartmentDoor?"E OTEVŘÍT / ZAVŘÍT BYTOVÉ DVEŘE":nearEnemy?"E ZAHÁJIT TAHOVÝ SOUBOJ":nearRelay?"E ZAPNOUT TELEFONNÍ ROZVODNU":nearMira?"E PROMLOUVAT S MECHANIČKOU MIROU":nearCourier?"E ZAHÁJIT SOUBOJ · ZACHRAŇ KURÝRA":nearTower?"E ZAHÁJIT ROZHOVOR U VYSÍLAČE":nearIvanaDelivery?"E PŘEDAT SEŠIT · IVANA":nearResident?"E PROMLOUVAT · "+nearResident.name:"WASD POHYB · SHIFT BĚH · SPACE SKOK · MYŠ ROZHLED · E INTERAKCE";
    }else if(state.inVehicle)hint.textContent=`W / S POHON · A / D SMĚR · SHIFT STOUPAT · CTRL KLESAT · V POHLED · ${vehicle.altitude>.7?"E VYSTOUPIT ZAMČENO":"E VYSTOUPIT"}`;
  const p=controller.player;
  const currentBuilding=buildingEntries.find(entry=>p.elevation>entry.floorOffset+.04&&Math.abs(p.x-entry.x)<entry.width/2&&Math.abs(p.z-entry.z)<entry.depth/2);
  const buildingFloor=currentBuilding?" · "+currentBuilding.id+" · "+(p.elevation>=currentBuilding.roofY-.12?"STŘECHA":Math.min(currentBuilding.storyCount,Math.max(1,Math.floor((p.elevation-currentBuilding.floorOffset)/currentBuilding.storyHeight)+1))+". PATRO"):"";
  coordinates.textContent=state.inVehicle?`ALT ${Math.round(vehicle.altitude)} M · ${Math.round(Math.hypot(vehicle.vx,vehicle.vz)*3.6)} KM/H`:`X ${p.x.toFixed(1)} · Z ${p.z.toFixed(1)}${buildingFloor}`;
  updateObjectivePointer();
  const walking=playerMoved;
  if(walking&&state.started&&!state.paused&&!state.combat&&!state.inVehicle&&gameTime>=nextFootstep){gameAudio.step();nextFootstep=gameTime+((controller.keysDown.ShiftLeft||controller.keysDown.ShiftRight)?0.34:0.5);}
  gameAudio.updateVehicle(vehicle.horizontalSpeed??Math.hypot(vehicle.vx,vehicle.vz),state.inVehicle&&state.started&&!state.paused);
  phoneGroup.visible=phoneDrawn&&state.started&&!state.paused&&!state.inVehicle&&!state.dialogue&&!state.combat&&!state.inventory;
  phoneGroup.position.y=-.22+(walking?Math.sin(gameTime*10)*.008:Math.sin(gameTime*1.4)*.002);
  phoneGroup.rotation.x=-.08+Math.sin(gameTime*1.2)*.008;
  renderer.render(scene,camera);
});
updateMission();updateStats();
window.addEventListener("beforeunload",()=>{saveGame();input.destroy();resizeObserver.disconnect();renderer.setAnimationLoop(null);renderer.dispose();});

}catch(error){
  try{renderer?.dispose();}catch{}
  showStartupError(error);
}
}
bootGame();
