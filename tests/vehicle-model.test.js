import test from "node:test";
import assert from "node:assert/strict";
import {calculateVehicleModelFit,isFavoritWheelMesh,isFavoritTireMesh} from "../src/world/vehicle-model.js";

test("Favorit GLTF normalization matches target width, height and length",()=>{
 const bounds={min:{x:-.871485,y:-.00288,z:-.101108},max:{x:.871485,y:1.52269,z:4.645391}};
 const fit=calculateVehicleModelFit(bounds);
 const corners=[];
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  corners.push({
   x:-x*fit.scale.x+fit.position.x,
   y:y*fit.scale.y+fit.position.y,
   z:-z*fit.scale.z+fit.position.z
  });
 }
 const min=axis=>Math.min(...corners.map(p=>p[axis]));
 const max=axis=>Math.max(...corners.map(p=>p[axis]));
 assert.ok(Math.abs((max("x")-min("x"))-1.62)<1e-9);
 assert.ok(Math.abs((max("y")-min("y"))-1.415)<1e-9);
 assert.ok(Math.abs((max("z")-min("z"))-3.815)<1e-9);
 assert.ok(Math.abs(min("y"))<1e-9);
 assert.ok(Math.abs((min("z")+max("z"))/2)<1e-9);
});
test("vehicle model fit rejects zero or invalid bounds",()=>{
 assert.throws(()=>calculateVehicleModelFit({min:{x:0,y:0,z:0},max:{x:0,y:1,z:2}}),RangeError);
});

test("Favorit wheel meshes are detected from their GLTF material names",()=>{
 for(const name of ["PNEUZ","PNEU","DISKY","DISKZ"])assert.equal(isFavoritWheelMesh([name],"Object_7"),true);
 assert.equal(isFavoritWheelMesh(["KAPOTA"],"Object_15"),false);
 assert.equal(isFavoritWheelMesh([],"KOLO"),true);
});

test("Favorit tyre materials are separated from the metal wheel discs",()=>{
 for(const name of ["PNEU","PNEUZ"])assert.equal(isFavoritTireMesh([name],"Object_7"),true);
 for(const name of ["DISKY","DISKZ","KAPOTA"])assert.equal(isFavoritTireMesh([name],"Object_7"),false);
});
