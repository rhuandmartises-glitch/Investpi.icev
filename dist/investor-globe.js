// A malha mundial existente usa coordenadas equiretangulares (2 px por grau).
const radians = Math.PI / 180;
const fullTurn = 2 * Math.PI;
const radius = 0.465;
const brazil = [-53, -13];
const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

function countryCoordinates(path) {
  const groups = path.split("M").slice(1).map(ring =>
    [...ring.matchAll(/([-\d.]+),([-\d.]+)/g)].map(([, x, y]) => [Number(x), Number(y)]));
  const mainland = groups.reduce((largest, ring) => ring.length > largest.length ? ring : largest, []);
  if (!mainland.length) return brazil;
  const xs = mainland.map(point => point[0]);
  const ys = mainland.map(point => point[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 4 - 180, 90 - (Math.min(...ys) + Math.max(...ys)) / 4];
}

export function mountGlobe(canvas, map, {counts, selected, target, camera, onSelect, onUnavailable}) {
  const surface = canvas.getContext("2d");
  if (!surface) throw new Error("Canvas indisponível");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let resizeObserver;
  let disposed = false;
  const events = new AbortController();
  const listen = (name, handler) => canvas.addEventListener(name, handler, {signal: events.signal});
  function dispose() {
    if (disposed) return;
    disposed = true;
    events.abort();
    resizeObserver?.disconnect();
    cancelAnimationFrame(frame);
  }

  try {
    const atlas = document.createElement("canvas");
    const index = document.createElement("canvas");
    for (const image of [atlas, index]) { image.width = 1440; image.height = 720; }
    const paint = atlas.getContext("2d", {willReadFrequently: true});
    const regions = index.getContext("2d", {willReadFrequently: true});
    if (!paint || !regions) throw new Error("Malha indisponível");
    paint.fillStyle = "#122c49";
    paint.fillRect(0, 0, atlas.width, atlas.height);
    paint.scale(2, 2);
    paint.strokeStyle = "#26425f";
    paint.lineWidth = .32;
    paint.beginPath();
    for (let x = 0; x < 720; x += 60) { paint.moveTo(x, 0); paint.lineTo(x, 360); }
    for (let y = 0; y < 360; y += 60) { paint.moveTo(0, y); paint.lineTo(720, y); }
    paint.stroke();
    regions.scale(2, 2);
    const active = [];
    for (const {code, path} of map.countries) {
      const shape = new Path2D(path);
      const hasInvestors = counts.has(code);
      paint.fillStyle = code === selected ? "#9ee4ff" : hasInvestors ? "#4f9add" : "#527392";
      paint.fill(shape);
      paint.strokeStyle = hasInvestors ? "#d3efff" : "#345674";
      paint.lineWidth = hasInvestors ? .65 : .38;
      paint.stroke(shape);
      if (hasInvestors) {
        active.push(code);
        regions.fillStyle = `rgb(${active.length}, 0, 0)`;
        regions.fill(shape);
      }
    }
    const texture = paint.getImageData(0, 0, atlas.width, atlas.height).data;
    let frameImage;
    let grid = [];
    const pointOnSphere = (x, y) => {
      const distance = x * x + y * y;
      return distance < 1 ? Math.sqrt(1 - distance) : -1;
    };

    function draw() {
      // Limit raster resolution on high-DPI screens and redraw only when the view changes.
      const scale = Math.min(1, 360 / Math.min(canvas.clientWidth, canvas.clientHeight));
      const width = Math.round(canvas.clientWidth * scale), height = Math.round(canvas.clientHeight * scale);
      if (!width || !height) return;
      if (canvas.width !== width || canvas.height !== height || !frameImage) {
        canvas.width = width;
        canvas.height = height;
        frameImage = surface.createImageData(width, height);
        grid = [];
        const scale = Math.min(width, height) * radius;
        for (let row = 0; row < height; row++) {
          const y = (height / 2 - row - .5) / scale;
          for (let col = 0; col < width; col++) {
            const x = (col + .5 - width / 2) / scale;
            const depth = pointOnSphere(x, y);
            if (depth < 0) continue;
            const rim = (1 - depth) ** 4 * .58;
            const light = (.84 + .16 * depth + .06 * (-.65 * x + .75 * y)) * (1 - rim);
            const alpha = Math.min(255, Math.round(depth * depth * scale * 160));
            grid.push((row * width + col) * 4, x, y, depth, light, rim, alpha);
          }
        }
      }
      const cos = Math.cos(camera.latitude), sin = Math.sin(camera.latitude);
      const longitudeOffset = .5 + camera.longitude / fullTurn;
      const pixels = frameImage.data;
      for (let i = 0; i < grid.length; i += 7) {
        const pixel = grid[i], x = grid[i + 1], y = grid[i + 2], depth = grid[i + 3];
        const lat = Math.asin(clamp(y * cos + depth * sin, 1));
        const lon = Math.atan2(x, depth * cos - y * sin);
        const u = longitudeOffset + lon / fullTurn;
        const tx = Math.floor((u - Math.floor(u)) * atlas.width);
        const ty = Math.min(atlas.height - 1, Math.floor((.5 - lat / Math.PI) * atlas.height));
        const sample = (ty * atlas.width + tx) * 4;
        const light = grid[i + 4], rim = grid[i + 5];
        pixels[pixel] = texture[sample] * light + 97 * rim;
        pixels[pixel + 1] = texture[sample + 1] * light + 166 * rim;
        pixels[pixel + 2] = texture[sample + 2] * light + 230 * rim;
        pixels[pixel + 3] = grid[i + 6];
      }
      surface.putImageData(frameImage, 0, 0);
    }

    function centerOn(coordinates) {
      const [longitude, latitude] = coordinates.map(value => value * radians);
      if (reducedMotion.matches) {
        Object.assign(camera, {longitude, latitude});
        draw();
        return;
      }
      const start = performance.now();
      const from = {...camera};
      const delta = ((longitude - from.longitude) % fullTurn + 3 * Math.PI) % fullTurn - Math.PI;
      function animate(now) {
        if (disposed) return;
        const progress = Math.min((now - start) / 630, 1);
        const eased = 1 - (1 - progress) ** 3;
        camera.longitude = from.longitude + delta * eased;
        camera.latitude = from.latitude + (latitude - from.latitude) * eased;
        draw();
        if (progress < 1) frame = requestAnimationFrame(animate);
      }
      frame = requestAnimationFrame(animate);
    }

    function pick(event) {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width, rect.height) * radius;
      const x = (event.clientX - rect.left - rect.width / 2) / scale;
      const y = (rect.top + rect.height / 2 - event.clientY) / scale;
      const depth = pointOnSphere(x, y);
      if (depth < 0) return;
      const sin = Math.sin(camera.latitude), cos = Math.cos(camera.latitude);
      const latitude = Math.asin(clamp(y * cos + depth * sin, 1));
      const longitude = camera.longitude + Math.atan2(x, depth * cos - y * sin);
      const u = ((.5 + longitude / fullTurn) % 1 + 1) % 1;
      const v = Math.max(0, Math.min(index.height - 1, Math.floor((.5 - latitude / Math.PI) * index.height)));
      const [red, , , alpha] = regions.getImageData(Math.floor(u * index.width), v, 1, 1).data;
      if (alpha === 255 && active[red - 1]) onSelect(active[red - 1]);
    }

    let gesture;
    listen("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;
      cancelAnimationFrame(frame);
      gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false};
      canvas.setPointerCapture(event.pointerId);
    });
    listen("pointermove", event => {
      if (gesture?.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (!gesture.dragging && Math.hypot(dx, dy) < 5) return;
      if (!gesture.dragging && event.pointerType === "touch" && Math.abs(dy) > Math.abs(dx)) return;
      Object.assign(gesture, {x: event.clientX, y: event.clientY, dragging: true});
      const speed = 3 / Math.min(canvas.clientWidth, canvas.clientHeight);
      camera.longitude = (camera.longitude - dx * speed) % fullTurn;
      camera.latitude = clamp(camera.latitude + dy * speed, 80 * radians);
      draw();
    });
    listen("pointerup", event => {
      if (gesture?.id !== event.pointerId) return;
      if (!gesture.dragging) pick(event);
      gesture = null;
    });
    listen("lostpointercapture", () => { gesture = null; });
    listen("pointercancel", () => { gesture = null; });
    listen("contextlost", event => { event.preventDefault(); onUnavailable(); });
    resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    draw();
    if (target) {
      const path = map.countries.find(shape => shape.code === target)?.path;
      const coordinates = Array.isArray(target) ? target : path && countryCoordinates(path);
      if (coordinates) centerOn(coordinates);
    }
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
