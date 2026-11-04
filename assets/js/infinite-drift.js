/**
 * Infinite Drift 2 — porte em JS puro do componente da Lightswind UI.
 * WebGL 1 + shader de domo invertido (lente), atlas de texturas dinâmico
 * (suporta qualquer quantidade de fotos), pan automático, arraste com inércia.
 *
 * Uso:
 *   const dome = createInfiniteDrift2(container, { images, autoScrollX: 0.3, ... });
 *   dome.setPaused(true);
 */
(function (global) {
  "use strict";

  const VS_SOURCE = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const FS_SOURCE = `
    precision highp float;
    varying vec2 vUv;

    uniform vec2 uResolution;
    uniform vec2 uOffset;
    uniform vec2 uTileSize;
    uniform float uGap;
    uniform float uBorderRadius;
    uniform float uCurve;
    uniform float uCurveRadius;
    uniform float uZoom;
    uniform float uTileRotation;
    uniform float uGrayscale;
    uniform float uVignette;
    uniform sampler2D uAtlas;
    uniform vec2 uAtlasGrid;
    uniform float uAtlasCount;

    float sdRoundedBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
      float r = length(p);

      float maxDist = max(0.001, uCurveRadius);
      float normR = clamp(r / maxDist, 0.0, 1.0);
      float distortion = 1.0 + uCurve * pow(normR, 2.0) - uZoom;
      vec2 distortedCoord = p * distortion;

      vec2 worldPos = distortedCoord * min(uResolution.x, uResolution.y) + uOffset;

      vec2 stepSize = uTileSize + vec2(uGap);
      vec2 cell = floor(worldPos / stepSize);
      vec2 localPos = mod(worldPos, stepSize) - 0.5 * stepSize;

      float angle = radians(uTileRotation);
      mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
      vec2 rotatedLocal = rot * localPos;

      float d = sdRoundedBox(rotatedLocal, uTileSize * 0.5, uBorderRadius);
      float alpha = 1.0 - smoothstep(-0.8, 0.8, d);

      if (alpha <= 0.0) {
        discard;
      }

      vec2 tileUv = clamp((rotatedLocal / uTileSize) + 0.5, 0.0, 1.0);

      // Espalhamento: cada tile salta 7 colunas e 11 linhas no atlas, em vez de
      // varrer o bloco em ordem. Assim a grade mostra fotos diferentes o tempo
      // todo (o mod 8x8 antigo repetia a mesma sequência em cada linha).
      float idx = mod(cell.x * 7.0 + cell.y * 11.0, uAtlasCount);
      vec2 atlasCell = vec2(mod(idx, uAtlasGrid.x), floor(idx / uAtlasGrid.x));
      float atlasRow = uAtlasGrid.y - 1.0 - atlasCell.y;
      vec2 uv = (vec2(atlasCell.x, atlasRow) + tileUv) / uAtlasGrid;

      vec4 texColor = texture2D(uAtlas, uv);

      float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
      vec3 color = mix(texColor.rgb, vec3(gray), clamp(uGrayscale, 0.0, 1.0));

      float vigFactor = smoothstep(0.35, 1.15, r * (1.0 + uVignette * 0.5));
      color = mix(color, color * (1.0 - uVignette * vigFactor), clamp(uVignette, 0.0, 1.0));

      gl_FragColor = vec4(color, texColor.a * alpha);
    }
  `;

  const PALETTE = [
    ["#3b2f1c", "#0b0b0d"],
    ["#241a2b", "#0b0b0d"],
    ["#132a2c", "#0b0b0d"],
    ["#2c1b22", "#0b0b0d"],
    ["#1d2233", "#0b0b0d"],
    ["#2a2418", "#0b0b0d"],
  ];

  function createInfiniteDrift2(host, options) {
    const opts = Object.assign(
      {
        images: [],
        tileWidth: 220,
        tileHeight: 280,
        gap: 16,
        borderRadius: 18,
        curve: 0.35,
        curveRadius: 1.5,
        zoom: 0.08,
        tileRotation: 0,
        grayscale: 0,
        vignette: 0.3,
        autoScrollX: 0.3,
        autoScrollY: 0.12,
        enableDrag: true,
        dpr: 1.75,
      },
      options || {}
    );

    const container = host;
    const canvas = document.createElement("canvas");
    canvas.className = "drift-canvas";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    let gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) gl = canvas.getContext("experimental-webgl");

    if (!gl) {
      container.classList.add("is-fallback");
      return { setPaused: function () {}, isFallback: true };
    }

    function compile(source, type) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compile(VS_SOURCE, gl.VERTEX_SHADER);
    const fs = compile(FS_SOURCE, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return { setPaused: function () {}, isFallback: true };

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return { setPaused: function () {}, isFallback: true };
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    /* ---------------------------------------------------------------- atlas */
    const count = Math.max(1, opts.images.length);
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    // atlas 8x8 de 320px ~ 2560px: abaixo do limite de textura e com zoom nítido
    const baseCell = count > 40 ? 320 : count > 16 ? 384 : 448;
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    const cell = Math.max(128, Math.min(baseCell, Math.floor(maxTex / cols)));
    const atlasDim = cols * cell;
    const atlasCanvas = document.createElement("canvas");
    atlasCanvas.width = atlasDim;
    atlasCanvas.height = atlasDim;
    const ctx = atlasCanvas.getContext("2d", { willReadFrequently: true });

    // fallback imediato: gradientes
    for (let i = 0; i < cols * rows; i += 1) {
      const gx = (i % cols) * cell;
      const gy = Math.floor(i / cols) * cell;
      const pair = PALETTE[i % PALETTE.length];
      const grad = ctx.createLinearGradient(gx, gy, gx + cell, gy + cell);
      grad.addColorStop(0, pair[0]);
      grad.addColorStop(1, pair[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(gx, gy, cell, cell);
    }

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    function uploadAtlas() {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    }
    uploadAtlas();

    let loaded = 0;
    let disposed = false;
    let uploadQueued = false;

    function scheduleUpload() {
      if (uploadQueued || disposed) return;
      uploadQueued = true;
      requestAnimationFrame(function () {
        uploadQueued = false;
        uploadAtlas();
      });
    }

    // preenche as células sobrando no atlas repetindo fotos (evita tiles vazios)
    const cellTotal = cols * rows;
    const urls = opts.images.slice();
    while (urls.length < cellTotal && opts.images.length) {
      urls.push(opts.images[urls.length % opts.images.length]);
    }

    urls.forEach(function (url, i) {
      const img = new Image();
      img.decoding = "async";
      img.onload = function () {
        if (disposed) return;
        const gx = (i % cols) * cell;
        const gy = Math.floor(i / cols) * cell;
        const aspect = img.naturalWidth / (img.naturalHeight || 1);
        let sx = 0;
        let sy = 0;
        let sw = img.naturalWidth;
        let sh = img.naturalHeight;
        if (aspect > 1) {
          sw = sh = img.naturalHeight;
          sx = (img.naturalWidth - sw) / 2;
        } else {
          sw = sh = img.naturalWidth;
          sy = (img.naturalHeight - sh) / 2;
        }
        try {
          ctx.drawImage(img, sx, sy, sw, sh, gx, gy, cell, cell);
        } catch (err) {
          /* imagem quebrada mantém o gradiente */
        }
        loaded += 1;
        // atualiza a textura em lotes, sem travar a animação
        if (loaded % 8 === 0 || loaded === urls.length) scheduleUpload();
      };
      img.src = url;
    });

    /* ------------------------------------------------------------ uniforms */
    const uRes = gl.getUniformLocation(program, "uResolution");
    const uOff = gl.getUniformLocation(program, "uOffset");
    const uTile = gl.getUniformLocation(program, "uTileSize");
    const uGap = gl.getUniformLocation(program, "uGap");
    const uRad = gl.getUniformLocation(program, "uBorderRadius");
    const uCurv = gl.getUniformLocation(program, "uCurve");
    const uCurvRad = gl.getUniformLocation(program, "uCurveRadius");
    const uZoom = gl.getUniformLocation(program, "uZoom");
    const uRot = gl.getUniformLocation(program, "uTileRotation");
    const uGray = gl.getUniformLocation(program, "uGrayscale");
    const uVig = gl.getUniformLocation(program, "uVignette");
    const uAtlas = gl.getUniformLocation(program, "uAtlas");
    const uAtlasGrid = gl.getUniformLocation(program, "uAtlasGrid");
    const uAtlasCount = gl.getUniformLocation(program, "uAtlasCount");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    /* ---------------------------------------------------------- interaction */
    const offset = { x: 0, y: 0 };
    const velocity = { x: 0, y: 0 };
    let dragging = false;
    let lastPointer = { x: 0, y: 0 };
    let paused = false;
    let raf = 0;
    let lastTime = performance.now();

    const reduceQuery =
      global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceQuery && reduceQuery.matches) paused = true;

    function onPointerDown(event) {
      if (!opts.enableDrag) return;
      dragging = true;
      lastPointer = { x: event.clientX, y: event.clientY };
      velocity.x = 0;
      velocity.y = 0;
      container.classList.add("is-dragging");
      if (container.setPointerCapture) {
        try {
          container.setPointerCapture(event.pointerId);
        } catch (err) {
          /* noop */
        }
      }
    }

    function onPointerMove(event) {
      if (!dragging) return;
      const dx = event.clientX - lastPointer.x;
      const dy = event.clientY - lastPointer.y;
      offset.x -= dx * (global.devicePixelRatio || 1);
      offset.y += dy * (global.devicePixelRatio || 1);
      velocity.x = -dx * 22;
      velocity.y = dy * 22;
      lastPointer = { x: event.clientX, y: event.clientY };
    }

    function onPointerUp(event) {
      dragging = false;
      container.classList.remove("is-dragging");
      if (container.releasePointerCapture) {
        try {
          container.releasePointerCapture(event.pointerId);
        } catch (err) {
          /* noop */
        }
      }
    }

    if (opts.enableDrag) {
      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerup", onPointerUp);
      container.addEventListener("pointercancel", onPointerUp);
    }

    /* -------------------------------------------------------------- render */
    function render(time) {
      const dt = Math.min(0.1, (time - lastTime) / 1000) || 0.016;
      lastTime = time;
      const dpr = Math.min(global.devicePixelRatio || 1, opts.dpr);

      if (!paused) {
        if (!dragging) {
          offset.x += (velocity.x + opts.autoScrollX * 60) * dt * dpr;
          offset.y += (velocity.y + opts.autoScrollY * 60) * dt * dpr;
        }
        const decay = Math.pow(0.92, dt * 60);
        velocity.x *= decay;
        velocity.y *= decay;
      }

      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uAtlas, 0);

      gl.uniform2f(uRes, w, h);
      gl.uniform2f(uOff, offset.x, offset.y);
      gl.uniform2f(uTile, opts.tileWidth * dpr, opts.tileHeight * dpr);
      gl.uniform1f(uGap, opts.gap * dpr);
      gl.uniform1f(uRad, opts.borderRadius * dpr);
      gl.uniform1f(uCurv, opts.curve);
      gl.uniform1f(uCurvRad, opts.curveRadius);
      gl.uniform1f(uZoom, opts.zoom);
      gl.uniform1f(uRot, opts.tileRotation);
      gl.uniform1f(uGray, opts.grayscale);
      gl.uniform1f(uVig, opts.vignette);
      gl.uniform2f(uAtlasGrid, cols, rows);
      gl.uniform1f(uAtlasCount, count);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(render);
    }

    raf = requestAnimationFrame(render);

    return {
      isFallback: false,
      setPaused: function (value) {
        paused = !!value;
      },
      isPaused: function () {
        return paused;
      },
      resetOffset: function () {
        offset.x = 0;
        offset.y = 0;
        velocity.x = 0;
        velocity.y = 0;
      },
      destroy: function () {
        disposed = true;
        cancelAnimationFrame(raf);
        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerup", onPointerUp);
        container.removeEventListener("pointercancel", onPointerUp);
      },
    };
  }

  global.createInfiniteDrift2 = createInfiniteDrift2;
})(window);
