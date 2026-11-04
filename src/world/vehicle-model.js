/** Fit the imported Favorit mesh to its real-world target envelope after a 180° Y rotation. */
export function calculateVehicleModelFit(bounds,target={width:1.62,height:1.415,length:3.815}){
 const min=bounds.min,max=bounds.max;
 const size={x:max.x-min.x,y:max.y-min.y,z:max.z-min.z};
 if(![size.x,size.y,size.z].every(value=>Number.isFinite(value)&&value>.001)){
  throw new RangeError("Vehicle model bounds must be finite and non-zero.");
 }
 const scale={x:target.width/size.x,y:target.height/size.y,z:target.length/size.z};
 const center={x:(min.x+max.x)/2,z:(min.z+max.z)/2};
 return {
  scale,
  position:{x:center.x*scale.x,y:-min.y*scale.y,z:center.z*scale.z},
  dimensions:{width:target.width,height:target.height,length:target.length}
 };
}

/** Mesh names from this GLTF export are generic, so wheels are identified by material names. */
export function isFavoritWheelMesh(materialNames=[],objectName=""){
 const names=[objectName,...materialNames].map(value=>String(value??"").trim().toUpperCase());
 return names.some(name=>/^(KOLO|PNEU|DISK)/.test(name));
}
