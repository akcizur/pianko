/** Shared vertical navigation for all enterable buildings. */
export function createBuildingElevationResolver(entries = []) {
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  return (x,z,elevation=0)=>{
    for(const entry of entries){
      const {z:centerZ,frontX,inward,doorWidth=1.34,floorOffset=0,entryStepLength=0,
        stairX,landingX,flightLength,storyHeight,storyCount}=entry;
      const lift=entry.elevator;
      if(lift){
        const cabinDepth=(z-lift.doorPlaneZ)*(lift.elevatorSideZ||1);
        if(Math.abs(x-lift.x)<=.32&&cabinDepth>=-.24&&cabinDepth<=1.5)return lift.motion.y;
      }
      const doorAxis=(x-frontX)*inward;
      if(Math.abs(z-centerZ)<doorWidth/2+.18&&doorAxis>=0&&doorAxis<=entryStepLength)
        return floorOffset*clamp(1-doorAxis/Math.max(entryStepLength,.01),0,1);
      const clampStory=i=>clamp(i,0,storyCount-1),progress=v=>clamp(v,0,1);
      const firstProgress=(stairX-x)*inward/flightLength;
      if(Math.abs(z-(centerZ-.72))<.5&&firstProgress>=-.12&&firstProgress<=1.12){
        const story=clampStory(Math.floor((elevation-floorOffset)/storyHeight+.25));
        return floorOffset+story*storyHeight+progress(firstProgress)*storyHeight/2;
      }
      const secondProgress=(x-landingX)*inward/flightLength;
      if(Math.abs(z-(centerZ+.72))<.5&&secondProgress>=-.12&&secondProgress<=1.12){
        const story=clampStory(Math.floor((elevation-floorOffset)/storyHeight-.5+1e-4));
        return floorOffset+story*storyHeight+storyHeight/2+progress(secondProgress)*storyHeight/2;
      }
      if(Math.abs(x-landingX)<.62&&Math.abs(z-centerZ)<.62){
        const storyIndex=(elevation-floorOffset-storyHeight/2)/storyHeight,story=Math.round(storyIndex);
        if(Math.abs(storyIndex-story)>.08)return false;
        return floorOffset+clampStory(story)*storyHeight+storyHeight/2;
      }
    }
    return elevation;
  };
}
