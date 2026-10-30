const PORT = 9222;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
});
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = (method, params = {}) => {
  const msgId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
};
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: "http://localhost:3000/home" });
await new Promise((r) => setTimeout(r, 5000));
console.log(JSON.stringify(await evaluate(`(() => {
  const form = document.querySelector('form.home-search-form');
  const btn = form?.querySelector('button[type="submit"]');
  const input = form?.querySelector('input[type="text"]');
  const f = form.getBoundingClientRect();
  const b = btn.getBoundingClientRect();
  const i = input.getBoundingClientRect();
  const cs = getComputedStyle(form);
  return {
    form: { h: f.height, top: f.top, right: f.right, left: f.left, radius: cs.borderRadius, padRight: cs.paddingRight, padTop: cs.paddingTop },
    btn: { w: b.width, h: b.height, top: b.top, bottom: b.bottom, right: b.right, left: b.left },
    input: { h: i.height, top: i.top, bottom: i.bottom, right: i.right },
    gapRight: f.right - b.right,
    gapTop: b.top - f.top,
    gapBottom: f.bottom - b.bottom,
    inputToBtn: b.left - i.right,
    overflowRight: b.right > f.right,
  };
})()`), null, 2));
ws.close();
