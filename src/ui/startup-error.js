/** Convert a fatal startup error into concise, actionable Czech UI copy. */
export function describeStartupError(error){
 const detail=String(error?.message??error??"Neznámá chyba").slice(0,420);
 const webgl=/webgl|renderer|context|graphics/i.test(detail);
 return {
  title:webgl?"3D GRAFIKA SE NENAČETLA":"HRA SE ZASTAVILA PŘI STARTU",
  message:webgl
   ?"Prohlížeč nedokázal vytvořit grafický kontext WebGL 2. Bez něj nelze vykreslit 3D svět."
   :"Při inicializaci hry nastala chyba. Menu zůstalo neaktivní, aby se chyba nezamaskovala.",
  steps:webgl
   ?"Zapni hardwarovou akceleraci v nastavení prohlížeče, aktualizuj ovladač grafiky a otevři hru znovu. Vzdálená plocha nebo úsporný režim mohou WebGL vypnout."
   :"Obnov stránku. Jestli se chyba opakuje, zkopíruj technický údaj níže.",
  detail
 };
}
export const WEBGL_RENDERER_OPTIONS=Object.freeze([
 Object.freeze({antialias:false,alpha:false,powerPreference:"low-power",failIfMajorPerformanceCaveat:false}),
 Object.freeze({antialias:false,alpha:false,powerPreference:"default",failIfMajorPerformanceCaveat:false})
]);
