import {calculateFloorSegmentsWithOpening} from "./building-geometry.js";
/** Thin finish layers share one walkable floor datum and never overlap. */
export const APARTMENT_FLOOR_LAYERS=Object.freeze({floorBottom:.001,woodThickness:.012,surfaceGap:.001,tileThickness:.012,rugThickness:.008});
export function calculateApartmentFurnitureLayout({unitMinX,unitMaxX,dividerX,bathroomMaxX,z,sideZ,depthOffset=0,depthScale=1}){
 const side=Math.sign(sideZ)||1,at=d=>z+side*(depthOffset+d*depthScale),livingWidth=dividerX-unitMinX;
 const livingX=(bathroomMaxX+dividerX)/2,bedroomX=(dividerX+unitMaxX)/2;
 return {
  livingX,bedroomX,kitchenZ:at(5.78),diningZ:at(4.95),sofaZ:at(4.05),
  sofaBackZ:at(4.35),coffeeTableZ:at(3.35),carpetZ:at(3.72),
  televisionX:livingX,televisionZ:at(2.88),
  fridgeX:livingX-Math.max(1.8,livingWidth-2.05)/2+.31,
  wardrobeZ:at(2.08),bedZ:at(4.05),nightstandZ:at(4.92),
  deskX:unitMaxX-.72,deskZ:at(5.55),radiatorZ:at(6.02)
 };
}
/** Compact 1970s panel-flat dimensions in metres. */
export function calculateApartmentLayout({unitMinX,unitMaxX,roomDepth=4.64}){
 const unitWidth=Math.max(0,unitMaxX-unitMinX),dividerX=(unitMinX+unitMaxX)/2,livingWidth=dividerX-unitMinX,bedroomWidth=unitMaxX-dividerX;
 const bathroomWidth=Math.min(1.9,Math.max(0,livingWidth-.28)),bathroomDepth=1.94;
 return {unitWidth,roomDepth,dividerX,livingWidth,bedroomWidth,bathroomWidth,bathroomDepth,bathroomArea:bathroomWidth*bathroomDepth,livingArea:livingWidth*roomDepth,bedroomArea:bedroomWidth*roomDepth,bathroomDoorWidth:.72,roomDoorWidth:.88};
}
/** Build a genuinely walkable panel flat with living room, bedroom and bathroom. */
export function buildApartmentInterior({THREE,scene,block,material,x,z,base,storyHeight,sideZ,unitMinX,unitMaxX,unitX,tone=0,lighting=true,elevatorOpening=null,inward=1,hallHalf=1.42,depth=13}){
 const side=Math.sign(sideZ)||1,width=unitMaxX-unitMinX;
 const sourceRoomStart=1.56,sourceRoomEnd=6.12;
 const roomStart=hallHalf+.14,roomEnd=depth/2-.38;
 const depthScale=(roomEnd-roomStart)/(sourceRoomEnd-sourceRoomStart);
 const depthOffset=roomStart-sourceRoomStart*depthScale;
 const mapDepth=d=>depthOffset+d*depthScale;
 const plan=calculateApartmentLayout({unitMinX,unitMaxX,roomDepth:roomEnd-roomStart});
 const atZ=d=>z+side*mapDepth(d);
 const floorBottomY=base+APARTMENT_FLOOR_LAYERS.floorBottom;
 const floorTopY=floorBottomY+APARTMENT_FLOOR_LAYERS.woodThickness;
 const {dividerX,livingWidth}=plan,wallY=floorTopY,wallH=storyHeight-.16-(floorTopY-base),wallThickness=.12;
 const bMin=unitMinX+.12,bMax=Math.min(unitMinX+2.02,dividerX-.16),bW=bMax-bMin;
 const furniture=calculateApartmentFurnitureLayout({unitMinX,unitMaxX,dividerX,bathroomMaxX:bMax,z,sideZ,depthOffset,depthScale});
 if(elevatorOpening)furniture.televisionX=x-inward*.1;
 const bathroomFloorX=(bMin+bMax)/2,bathroomFloorZ=atZ(2.58);
 const palette=[
  {floor:0x86765f,wall:0xb7b1a3,accent:0x877a68,textile:0x59636a,wood:0x795c43},
  {floor:0x756c5d,wall:0xb6b3a8,accent:0x8b8375,textile:0x74634f,wood:0x6c5945},
  {floor:0x8a806d,wall:0xbdb6a5,accent:0x777c75,textile:0x6b5f57,wood:0x80684d}
 ][tone%3];
 const add=(n,px,py,pz,w,h,d,color,solid=false)=>block(n,px,py,pz,w,h,d,color,solid);
 const frame=(n,px,py,pz,w,axis="x")=>{
  if(axis==="x"){
   add(n+" — levá zárubeň",px-w/2-.045,py,pz,.07,2.12,.15,0x8d877a);
   add(n+" — pravá zárubeň",px+w/2+.045,py,pz,.07,2.12,.15,0x8d877a);
   add(n+" — nadpraží",px,py+2.12,pz,w+.16,.08,.15,0x8d877a);
   const upperHeight=Math.max(0,base+storyHeight-.16-(py+2.2));
   if(upperHeight>.02)add(n+" — výplň nad průchodem",px,py+2.2,pz,w+.16,upperHeight,.15,palette.wall,true);
  }else{
   add(n+" — levá zárubeň",px,py,pz-w/2-.045,.15,2.12,.07,0x8d877a);
   add(n+" — pravá zárubeň",px,py,pz+w/2+.045,.15,2.12,.07,0x8d877a);
   add(n+" — nadpraží",px,py+2.12,pz,.15,.08,w+.16,0x8d877a);
   const upperHeight=Math.max(0,base+storyHeight-.16-(py+2.2));
   if(upperHeight>.02)add(n+" — výplň nad průchodem",px,py+2.2,pz,.15,upperHeight,w+.16,palette.wall,true);
  }
 };
 const bathroomDepth=Math.abs(mapDepth(3.56)-mapDepth(1.62));
 let woodFloorSegments=calculateFloorSegmentsWithOpening({
  x:(unitMinX+unitMaxX)/2,z:z+side*((roomStart+roomEnd)/2),width:width-.08,depth:roomEnd-roomStart,
  opening:{x:bathroomFloorX,z:bathroomFloorZ,width:1.9,depth:bathroomDepth+.08}
 });
 if(elevatorOpening){
  woodFloorSegments=woodFloorSegments.flatMap(segment=>
   calculateFloorSegmentsWithOpening({...segment,opening:elevatorOpening})
  );
 }
 woodFloorSegments.forEach((segment,index)=>add("byt — parketová podlaha · "+(index+1),segment.x,floorBottomY,segment.z,segment.width,APARTMENT_FLOOR_LAYERS.woodThickness,segment.depth,palette.floor));
 add("byt — koupelnová dlažba",bathroomFloorX,floorBottomY,bathroomFloorZ,1.9,APARTMENT_FLOOR_LAYERS.tileThickness,bathroomDepth,0x777e7a);
 add("byt — sokl",dividerX-.08,floorTopY,atZ(4.35),.025,.08,3.15,0x645d51);
 let cursor=2.5;
 for(const d of [{center:3.02,label:"obytné části"},{center:4.72,label:"ložnice"}]){
  const w=.88,start=d.center-w/2,end=d.center+w/2;
  if(start-cursor>.06)add("byt — příčka mezi pokoji",dividerX,wallY,atZ((cursor+start)/2),wallThickness,wallH,start-cursor,palette.wall,true);
  frame("byt — průchod do "+d.label,dividerX,floorTopY,atZ(d.center),w,"z");cursor=end;
 }
 if(6.16-cursor>.06)add("byt — příčka mezi pokoji",dividerX,wallY,atZ((cursor+6.16)/2),wallThickness,wallH,6.16-cursor,palette.wall,true);
 const bNear=atZ(1.62),bFar=atZ(3.56),bDoor=atZ(2.62),doorW=plan.bathroomDoorWidth;
 const openA=Math.min(bDoor-side*doorW/2,bDoor+side*doorW/2),openB=Math.max(bDoor-side*doorW/2,bDoor+side*doorW/2);
 add("byt — zadní příčka koupelny",(bMin+bMax)/2,wallY,(bNear+bFar)/2,bW,wallH,.12,palette.wall,true);
 const wn=Math.min(bNear,bFar),wf=Math.max(bNear,bFar);
 if(openA-wn>.06)add("byt — příčka koupelny",bMax,wallY,(wn+openA)/2,.12,wallH,openA-wn,palette.wall,true);
 if(wf-openB>.06)add("byt — příčka koupelny",bMax,wallY,(openB+wf)/2,.12,wallH,wf-openB,palette.wall,true);
 frame("byt — koupelnové dveře",bMax,floorTopY,bDoor,doorW,"z");
 const door=new THREE.Group();door.name="byt — pootevřené koupelnové dveře";door.position.set(bMax,floorTopY,openA);
 const leaf=new THREE.Mesh(new THREE.BoxGeometry(.055,2.04,doorW-.035),material(0x74624d));leaf.position.set(0,1.02,(doorW-.035)/2);leaf.castShadow=true;door.add(leaf);door.rotation.y=-1.12;scene.add(door);
 add("byt — vana",bMin+.5,base+.27,atZ(2.34),.76,.52,1.34,0xd7d5ca,true);
 add("byt — vnitřek vany",bMin+.5,base+.5,atZ(2.34),.63,.08,1.18,0x9ba7a3);
 add("byt — umyvadlová skříňka",bMax-.37,base+.39,atZ(1.96),.58,.78,.42,0x8e877a,true);
 add("byt — umyvadlo",bMax-.37,base+.82,atZ(1.96),.64,.12,.48,0xe2e0d7);
 add("byt — splachovací nádrž",bMax-.37,base+.68,atZ(3.18),.44,.58,.2,0xe2e0d7,true);
 add("byt — toaleta",bMax-.37,base+.22,atZ(3.04),.43,.42,.62,0xdedbd1,true);
 add("byt — zrcadlo",bMax-.37,base+1.52,atZ(1.73),.54,.65,.045,0x9ca9a8);
 add("byt — světlo koupelny",bMax-.37,base+2.02,atZ(1.73),.22,.08,.1,0xffdda3);
 const {livingX,bedroomX,kitchenZ,diningZ,sofaZ,sofaBackZ,coffeeTableZ,carpetZ,televisionX,televisionZ,wardrobeZ,bedZ,nightstandZ,deskX,deskZ,radiatorZ}=furniture;
 const kitchenLength=Math.max(1.8,livingWidth-2.05);
 add("byt — kuchyňská linka",livingX,base+.48,kitchenZ,kitchenLength,.88,.58,[0x77796f,0x756b5a,0x81745e][tone],true);
 add("byt — pracovní deska",livingX,base+.94,kitchenZ-side*.02,kitchenLength+.08,.075,.64,0xc4b79d);
 add("byt — horní skříňky",livingX,base+1.62,atZ(5.87),kitchenLength,.62,.28,[0x77796f,0x756b5a,0x81745e][tone],true);
 add("byt — kuchyňský obklad",livingX,base+1.27,atZ(5.9),kitchenLength,.48,.035,0xb7ad9a);
 add("byt — lednice",unitMinX+.92,base+.9,atZ(5.68),.62,1.78,.66,0xc3c5bd,true);
 add("byt — sporák",livingX+Math.min(.42,kitchenLength*.2),base+.99,kitchenZ-side*.02,.48,.06,.48,0x555b5a);
 add("byt — dřez",livingX-Math.min(.43,kitchenLength*.2),base+.99,kitchenZ-side*.02,.4,.05,.32,0x858e8c);
 add("byt — jídelní stůl",livingX,base+.76,diningZ,1.05,.13,.74,palette.wood,true);
 for(const sx of [-.78,.78])add("byt — jídelní židle",livingX+sx,base+.42,diningZ,.36,.78,.38,0x625b4d,true);
 add("byt — pohovka",livingX,base+.42,sofaZ,1.82,.62,.76,palette.textile,true);
 add("byt — opěradlo",livingX,base+.75,sofaBackZ,1.82,.4,.19,palette.accent,true);
 add("byt — konferenční stolek",livingX+.24,base+.44,coffeeTableZ,.65,.12,.42,palette.wood,true);
 add("byt — televizní stolek",televisionX,base+.38,televisionZ,.34,.72,.9,0x62594e,true);
 add("byt — televizor Tesla",televisionX,base+1.2,televisionZ,.13,.58,.78,0x292d2d);
 add("byt — koberec",livingX+.3,floorTopY+APARTMENT_FLOOR_LAYERS.surfaceGap,carpetZ,1.75,APARTMENT_FLOOR_LAYERS.rugThickness,1.55,[0x716455,0x58606a,0x755649][tone]);
 add("byt — postel",bedroomX,base+.31,bedZ,1.62,.42,2.04,0x655d53,true);
 add("byt — přikrývka",bedroomX,base+.56,bedZ,1.5,.11,1.85,[0x505b61,0x75624f,0x68685e][tone]);
 add("byt — polštář",bedroomX,base+.65,nightstandZ,.86,.12,.34,0xc2b9a6);
 for(const sx of [-1.02,1.02])add("byt — noční stolek",bedroomX+sx,base+.32,nightstandZ,.42,.62,.42,0x705a43,true);
 add("byt — šatní skříň",bedroomX,base+.94,wardrobeZ,1.75,1.84,.58,[0x62564a,0x736451,0x514b43][tone],true);
 add("byt — psací stůl",deskX,base+.72,deskZ,1.25,.12,.55,palette.wood,true);
 add("byt — stolní lampa",deskX+.38,base+1.08,deskZ,.16,.58,.16,0xd5b77e);
 add("byt — radiátor",bedroomX,base+.3,radiatorZ,1.1,.5,.14,0x8b918d,true);
 add("byt — stropní svítidlo",x,base+storyHeight-.2,z+side*4.05,.34,.08,.48,0xffd7a2);
 if(lighting){const light=new THREE.PointLight(0xffd1a0,.52,6.5,2);light.position.set(x,base+storyHeight-.52,z+side*4.12);scene.add(light);}
 return {dividerX,roomArea:plan.livingArea+plan.bedroomArea,bathroomArea:plan.bathroomArea};
}
