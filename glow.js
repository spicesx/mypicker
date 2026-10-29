// The app's Picker lights, ported from its Metal shader (brandColor in ColorShaders.metal).
// Runs at 30 fps only while the page is visible; Reduce Motion shows one still frame.
// It runs as soon as the script loads (at the end of the page), so the first frame is drawn before the page
// first appears, and it continues from where the previous page left off, so changing pages never changes the light.
(() => {
    const canvas = document.getElementById('glow');
    if (!canvas) return;
    const storageKey = 'mypicker-glow';
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) { canvas.classList.add('fallback'); return; }
    // Wide-gamut screens get the same Display P3 output as the app.
    const p3 = 'drawingBufferColorSpace' in gl && window.matchMedia('(color-gamut: p3)').matches;
    if (p3) gl.drawingBufferColorSpace = 'display-p3';

    const vertex = `#version 300 es
        in vec2 position;
        void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
    const fragment = `#version 300 es
        precision highp float;
        uniform vec2 size;
        uniform float time;
        uniform bool p3;
        out vec4 color;

        vec3 linearSRGB(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
        vec3 encodedSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        vec3 linearRGBToP3(vec3 c) {
            return vec3(dot(c, vec3(0.82246197, 0.17753803, 0.0)),
                        dot(c, vec3(0.03319420, 0.96680580, 0.0)),
                        dot(c, vec3(0.01708263, 0.07239744, 0.91051993)));
        }
        vec3 hsvRGB(float h, float s, float v) {
            vec3 p = abs(fract(vec3(h / 360.0) + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
            return v * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), s);
        }

        const vec3 palette[16] = vec3[16](
            vec3(1.0, 0.42, 0.42), vec3(1.0, 0.64, 0.42), vec3(1.0, 0.82, 0.42), vec3(1.0, 0.82, 0.4),
            vec3(0.7, 0.3, 0.6), vec3(0.8, 0.55, 0.5), vec3(0.9, 0.7, 0.45), vec3(0.5, 0.7, 0.35),
            vec3(0.4, 0.5, 0.7), vec3(0.35, 0.65, 0.65), vec3(0.2, 0.65, 0.55), vec3(0.1, 0.55, 0.7),
            vec3(0.02, 0.84, 0.63), vec3(0.1, 0.7, 0.65), vec3(0.1, 0.6, 0.7), vec3(0.07, 0.54, 0.7));

        void main() {
            vec2 uv = vec2(gl_FragCoord.x / size.x, 1.0 - gl_FragCoord.y / size.y);
            vec3 light = vec3(0.008);
            for (int i = 0; i < 5; i++) {
                float fi = float(i);
                float x = 0.5 + 0.45 * sin(time * (0.24 + fi * 0.017) + fi * 1.65);
                float y = 0.20 + 0.14 * sin(uv.x * 5.5 - time * 0.85 + fi * 1.7) + 0.12 * sin(time * 0.6 + fi * 2.4);
                vec2 d = vec2(uv.x - x, (uv.y - y) * 1.25);
                float halo = exp(-dot(d, d) * 26.0);
                float core = exp(-dot(d, d) * 115.0);
                float phase = time * 0.10 + fi * 3.0;
                int index = int(floor(phase)) % 16;
                vec3 tint = mix(palette[index], palette[(index + 1) % 16], smoothstep(0.0, 1.0, fract(phase)));
                float peak = max(tint.r, max(tint.g, tint.b));
                float floorValue = min(tint.r, min(tint.g, tint.b));
                tint = max(tint - floorValue * 0.86, 0.0);
                tint /= max(max(tint.r, max(tint.g, tint.b)), 0.001);
                tint = linearSRGB(tint * max(peak, 0.92));
                light += tint * halo * 1.85 + mix(tint, vec3(1.0), 0.35) * core * 0.24;
            }
            float wave = 0.17 + 0.09 * sin(uv.x * 7.0 - time * 0.8) + 0.035 * sin(uv.x * 15.0 + time * 1.1);
            float crest = exp(-pow((uv.y - wave) * 25.0, 2.0));
            vec3 waveColor = linearSRGB(hsvRGB(fract(uv.x * 0.7 - time * 0.055) * 360.0, 0.93, 1.0));
            light += waveColor * crest * 0.6;
            vec3 linear = clamp(1.0 - exp(-light * 1.25), 0.0, 1.0);
            color = vec4(encodedSRGB(clamp(p3 ? linearRGBToP3(linear) : linear, 0.0, 1.0)), 1.0);
        }`;

    function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    }
    const program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) { canvas.classList.add('fallback'); return; }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { canvas.classList.add('fallback'); return; }
    gl.useProgram(program);

    // One triangle covering the screen.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const sizeUniform = gl.getUniformLocation(program, 'size');
    const timeUniform = gl.getUniformLocation(program, 'time');
    gl.uniform1i(gl.getUniformLocation(program, 'p3'), p3 ? 1 : 0);

    // The light is diffuse, so like the app it renders below full resolution.
    function resize() {
        const scale = Math.min(window.devicePixelRatio || 1, 1);
        const width = Math.max(1, Math.round(canvas.clientWidth * scale));
        const height = Math.max(1, Math.round(canvas.clientHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
        }
        gl.uniform2f(sizeUniform, width, height);
    }

    function draw(time) {
        resize();
        gl.uniform1f(timeUniform, time);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // A pause keeps the current frame and resumes from it, never jumping ahead through hidden time.
    let elapsed = 0, last = null, frame = null;
    let continuing = false;
    try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        // Within this visit, pick up the light where the last page had it, plus the time spent loading this one.
        if (saved && typeof saved.time === 'number' && Date.now() - saved.at < 30000) {
            elapsed = saved.time + (reduceMotion.matches ? 0 : (Date.now() - saved.at) / 1000);
            continuing = true;
        }
    } catch (error) { /* Storage can be unavailable; the light then starts fresh. */ }
    function save() {
        try { sessionStorage.setItem(storageKey, JSON.stringify({ time: elapsed, at: Date.now() })); } catch (error) { }
    }
    function tick(now) {
        frame = requestAnimationFrame(tick);
        if (last === null) { last = now; draw(elapsed); return; }
        if (now - last < 1000 / 30 - 2) return;
        elapsed += Math.min(now - last, 100) / 1000;
        last = now;
        draw(elapsed);
    }
    function update() {
        const run = !document.hidden && !reduceMotion.matches;
        if (run && frame === null) {
            last = null;
            frame = requestAnimationFrame(tick);
        } else if (!run && frame !== null) {
            cancelAnimationFrame(frame);
            frame = null;
        }
        if (!run) draw(elapsed);
    }
    document.addEventListener('visibilitychange', () => { save(); update(); });
    window.addEventListener('pagehide', save);
    reduceMotion.addEventListener('change', update);
    window.addEventListener('resize', () => draw(elapsed));
    update();
    // On the first page of a visit the light fades in from black; later pages already match the last one.
    if (!continuing) getComputedStyle(canvas).opacity; // Start the fade from the hidden state.
    canvas.classList.add(continuing ? 'is-continuing' : 'is-ready');
})();
