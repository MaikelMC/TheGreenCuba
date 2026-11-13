const sharp = require("sharp");
(async () => {
  const red = await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
  const img = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: red, top: 30, left: 30 }]).png().toBuffer();
  const meta = await sharp(img).metadata();
  console.log("meta", meta.width, meta.height, meta.channels, meta.hasAlpha);
  // Try trim with background null?
  const m = await sharp(img).trim({ background: "transparent" }).metadata().catch(e=>{console.log("err",e.message);return null;});
  console.log("transparent str", m && m.width, m && m.height);
})();
