'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const ANGLE_LOCK = 15;
  const palettes = [
    { name: 'Rose room', group: 'Chroma', colors: ['#332176', '#9268c9', '#f498b7', '#ffd0a4'] },
    { name: 'Ember room', group: 'Chroma', colors: ['#350b65', '#b43d88', '#ff7253', '#ffd8a0'] },
    { name: 'Blue hour', group: 'Chroma', colors: ['#151a79', '#426bc8', '#93d8eb', '#e9e5c6'] },
    { name: 'Violet silence', group: 'Chroma', colors: ['#25114c', '#6b32bc', '#b87eed', '#f2adc8'] },
    { name: 'Celadon', group: 'Chroma', colors: ['#234e60', '#629d99', '#bad0aa', '#f4e4b5'] },
    { name: 'Porcelain', group: 'Chroma', colors: ['#696280', '#b5b0dd', '#f0cbd5', '#ffefd6'] },
    { name: 'Catppuccin', group: 'Omarchy', slug: 'catppuccin', colors: ['#101019', '#89b4fa', '#f5c2e7', '#f9e2af'] },
    { name: 'Catppuccin Latte', group: 'Omarchy', slug: 'catppuccin-latte', colors: ['#d7d8dc', '#1e66f5', '#ea76cb', '#df8e1d'] },
    { name: 'Ethereal', group: 'Omarchy', slug: 'ethereal', colors: ['#030610', '#7d82d9', '#ed5b5a', '#ffcead'] },
    { name: 'Everforest', group: 'Omarchy', slug: 'everforest', colors: ['#181d20', '#7fbbb3', '#d699b6', '#dbbc7f'] },
    { name: 'Flexoki Light', group: 'Omarchy', slug: 'flexoki-light', colors: ['#e5e2d8', '#205ea6', '#ce5d97', '#d0a215'] },
    { name: 'Gruvbox', group: 'Omarchy', slug: 'gruvbox', colors: ['#161616', '#7daea3', '#ea6962', '#d8a657'] },
    { name: 'Hackerman', group: 'Omarchy', slug: 'hackerman', colors: ['#06060c', '#82fb9c', '#7cf8f7', '#ddf7ff'] },
    { name: 'Kanagawa', group: 'Omarchy', slug: 'kanagawa', colors: ['#111116', '#7e9cd8', '#c34043', '#dcd7ba'] },
    { name: 'Last Horizon', group: 'Omarchy', slug: 'last-horizon', colors: ['#060606', '#b59790', '#c38b7b', '#e2dddc'] },
    { name: 'Lumon', group: 'Omarchy', slug: 'lumon', colors: ['#0b1216', '#8bc9eb', '#6fb8e3', '#f2fcff'] },
    { name: 'Lupine', group: 'Omarchy', slug: 'lupine', colors: ['#dedede', '#3264eb', '#8a4ad7', '#f930fb'] },
    { name: 'Matte Black', group: 'Omarchy', slug: 'matte-black', colors: ['#090909', '#e68e0d', '#d35f5f', '#ffc107'] },
    { name: 'Miasma', group: 'Omarchy', slug: 'miasma', colors: ['#121212', '#78824b', '#b36d43', '#c9a554'] },
    { name: 'Nord', group: 'Omarchy', slug: 'nord', colors: ['#191c23', '#81a1c1', '#b48ead', '#ebcb8b'] },
    { name: 'Osaka Jade', group: 'Omarchy', slug: 'osaka-jade', colors: ['#090f0d', '#509475', '#d2689c', '#f7e8b2'] },
    { name: 'Retro 82', group: 'Omarchy', slug: 'retro-82', colors: ['#020c17', '#faa968', '#f85525', '#f6dcac'] },
    { name: 'Ristretto', group: 'Omarchy', slug: 'ristretto', colors: ['#181414', '#f38d70', '#a8a9eb', '#f9cc6c'] },
    { name: 'Rose Pine', group: 'Omarchy', slug: 'rose-pine', colors: ['#e1dbd5', '#56949f', '#b4637a', '#ea9d34'] },
    { name: 'Solitude', group: 'Omarchy', slug: 'solitude', colors: ['#080a0b', '#798186', '#de6145', '#c9c2b4'] },
    { name: 'Tokyo Night', group: 'Omarchy', slug: 'tokyo-night', colors: ['#0e0e14', '#7aa2f7', '#ad8ee6', '#e0af68'] },
    { name: 'Vantablack', group: 'Omarchy', slug: 'vantablack', colors: ['#000000', '#505050', '#8d8d8d', '#ffffff'] },
    { name: 'White', group: 'Omarchy', slug: 'white', colors: ['#e8e8e8', '#6e6e6e', '#2a2a2a', '#000000'] }
  ];
  const lockKeys = ['mode', 'palette', 'color0', 'color1', 'color2', 'color3', 'flow', 'scale', 'rotation', 'glow', 'grain', 'seed'];
  const defaultLocks = Object.fromEntries(lockKeys.map(key => [key, false]));
  const defaults = { mode: 1, palette: 0, colors: [...palettes[0].colors], flow: 60, scale: 55, rotation: 0, glow: 65, grain: 8, seed: 42, resolution: '7680x4320', locks: { ...defaultLocks } };
  let state = structuredClone(defaults), renderer, frame, toastTimer, exporting = false, paletteQuery = '', paintedQuery = null, customName = 'Custom';
  const modes = ['Field', 'Aperture', 'Horizon'];
  const sliders = ['flow', 'scale', 'rotation', 'glow', 'grain'];
  const LOCK_ICON = `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path class="shackle-open" d="M5 7.5V5.2A3 3 0 0 1 10.7 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path class="shackle-shut" d="M5 7.5V5a3 3 0 0 1 6 0v2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><rect x="3.5" y="7.4" width="9" height="6.8" rx="1.6" stroke="currentColor" stroke-width="1.5"/></svg>`;
  const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
  const fragment = `precision highp float;
    uniform vec2 resolution;
    uniform float seed, flow, zoom, rotation, glow, grain, mode;
    uniform vec3 c0,c1,c2,c3;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed*.127)*43758.5453);}
    float box(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return min(max(q.x,q.y),0.)+length(max(q,0.))-r;}
    void main(){
      vec2 uv=gl_FragCoord.xy/resolution;
      vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.);
      p=mat2(cos(rotation),-sin(rotation),sin(rotation),cos(rotation))*p;
      float s=seed*.01371;
      p*=mix(1.45,.7,zoom);
      float diffuse=mix(.035,.23,flow);
      float vertical=clamp(uv.y,0.,1.);
      vec3 col=mix(c0,c1,smoothstep(0.,1.,vertical));
      if(mode<.5){
        float wave=p.y+.23*sin(p.x*1.7+s)+.1*cos(p.x*2.6-s);
        col=mix(c0,c1,smoothstep(-.55,.4,wave));
        float warm=exp(-dot(p*vec2(.72,1.3),p*vec2(.72,1.3))*mix(7.,1.6,flow));
        col=mix(col,c2,warm*.88);
        float core=exp(-dot(p,p)*mix(18.,5.,flow));
        col=mix(col,c3,core*(.35+glow*.5));
        col=mix(col,c1,(1.-smoothstep(-.65,-.1,p.y))*.2);
      }else if(mode<1.5){
        float aspect=resolution.x/resolution.y;
        vec2 bounds=vec2(min(aspect*.30,.58),.29);
        float d=box(p,bounds,.035+flow*.065);
        float halo=exp(-max(d,0.)*mix(16.,5.,flow));
        col=mix(col,mix(c1,c2,.38),halo*.65);
        float aperture=1.-smoothstep(-diffuse*.7,diffuse*.45,d);
        vec3 light=mix(c2,c3,smoothstep(-.35,.32,p.y));
        light=mix(light,c1,(1.-smoothstep(-.4,.07,p.y))*.32);
        float center=exp(-dot(p*vec2(.7,1.2),p*vec2(.7,1.2))*3.5);
        light+=vec3(1.,.82,.68)*center*glow*.1;
        col=mix(col,light,aperture);
        float surround=exp(-abs(d)*mix(28.,10.,flow));
        col+=c2*surround*glow*.055;
      }else{
        float line=p.y;
        float haze=exp(-line*line/mix(.003,.065,flow));
        col=mix(c0,c1,smoothstep(-.55,.45,line));
        col=mix(col,c2,haze*.92);
        float core=exp(-line*line/mix(.0002,.008,flow));
        col=mix(col,c3,core*(.5+glow*.35));
        col+=c2*exp(-line*line/.12)*glow*.06;
      }
      col*=1.-.16*dot(uv-.5,uv-.5);
      float n=hash(gl_FragCoord.xy);
      float n2=hash(gl_FragCoord.xy+19.19);
      col+=(n+n2-1.)*(grain*.022+.0025);
      gl_FragColor=vec4(clamp(col,0.,1.),1.);
    }`;

  function makeRenderer(canvas) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL is unavailable. Enable graphics acceleration in your browser, then reload Chroma.');
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const program = gl.createProgram();
    const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
    shaders.forEach(shader => gl.attachShader(program, shader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(['resolution','seed','flow','zoom','rotation','glow','grain','mode','c0','c1','c2','c3'].map(name => [name, gl.getUniformLocation(program, name)]));
    return {
      draw(width, height, settings = state) {
        if (gl.isContextLost()) throw new Error('Graphics connection lost. Please wait for recovery.');
        const maximum = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
        if (width > maximum[0] || height > maximum[1]) throw new Error('This device cannot render that size. Choose a smaller resolution.');
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        if (gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) throw new Error('The browser could not allocate this image. Choose a smaller resolution.');
        gl.viewport(0,0,width,height); gl.uniform2f(uniforms.resolution,width,height);
        for (const name of ['flow','glow','grain']) gl.uniform1f(uniforms[name],settings[name]/100);
        gl.uniform1f(uniforms.zoom,settings.scale/100); gl.uniform1f(uniforms.rotation,settings.rotation*Math.PI/180);
        gl.uniform1f(uniforms.seed,settings.seed); gl.uniform1f(uniforms.mode,settings.mode);
        settings.colors.forEach((hex,i) => gl.uniform3f(uniforms['c'+i],...hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255)));
        gl.drawArrays(gl.TRIANGLES,0,6);
        if(gl.getError() !== gl.NO_ERROR) throw new Error('Rendering failed. Try a smaller resolution or reload the page.');
      }
    };
  }

  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2800);
  }
  function dimensions() { return state.resolution.split('x').map(Number); }
  function save() { try { localStorage.setItem('chroma-v2', JSON.stringify(state)); } catch { /* Settings still work when storage is unavailable. */ } }
  function snapAngle(value) { return Math.round(value / ANGLE_LOCK) * ANGLE_LOCK; }
  function lockHorizon(value) { return state.mode === 2 ? snapAngle(value) : value; }
  function tap() { try { navigator.vibrate?.(8); } catch { /* No haptic hardware. */ } }
  function paletteName() {
    if (state.palette < 0) return customName;
    return palettes[state.palette]?.name ?? 'Custom';
  }
  function isLocked(key) { return !!state.locks?.[key]; }
  function markLocks() {
    document.querySelectorAll('[data-lock]').forEach(button => {
      const on = isLocked(button.dataset.lock);
      button.setAttribute('aria-pressed', String(on));
      const noun = button.dataset.lock.replace(/^color(\d)$/, (_, n) => COLOR_ROLES[n].toLowerCase());
      button.title = `${on ? 'Unlock' : 'Lock'} ${noun}`;
      button.setAttribute('aria-label', button.title);
    });
  }
  function randInt(min, max) {
    return min + crypto.getRandomValues(new Uint32Array(1))[0] % (max - min + 1);
  }
  const COLOR_ROLES = ['Deep', 'Mid', 'Glow', 'Light'];

  function sliderPercent(name) {
    const input = $(name);
    const min = Number(input.min), max = Number(input.max);
    return (Number(input.value) - min) / (max - min);
  }
  /* The readouts lived inside the old track markup. DialKit prints its own
     value, so this is a no-op there and still correct anywhere the old markup
     survives. */
  function setValueLabel(name) {
    const el = document.getElementById(name + '-value');
    if (el) el.textContent = state[name] + (name === 'rotation' ? '°' : '');
  }

  /* Randomise, Reset and a pasted recipe all move the sliders from in here.
     The panel has no way to notice that on its own, so say so. */
  function announceSync() {
    document.dispatchEvent(new CustomEvent('chroma:sync', {
      detail: {
        flow: state.flow, scale: state.scale, rotation: state.rotation,
        glow: state.glow, grain: state.grain, seed: state.seed,
        mode: state.mode, locks: { ...state.locks }
      }
    }));
  }

  function paintDialSlider(name) {
    const root = document.querySelector(`[data-slider="${name}"]`);
    if (!root) return;
    const pct = sliderPercent(name) * 100;
    const input = $(name);
    root.querySelector('.dk-fill').style.width = `${pct}%`;
    root.querySelector('.dk-handle').style.left = `max(5px, calc(${pct}% - 9px))`;
    const track = root.querySelector('.dk-track');
    track.setAttribute('aria-valuemin', input.min);
    track.setAttribute('aria-valuemax', input.max);
    track.setAttribute('aria-valuenow', input.value);
    track.setAttribute('aria-valuetext', $(name + '-value').textContent);
  }
  function seedHashmarks() {
    document.querySelectorAll('.dk-hashmarks').forEach(el => {
      el.replaceChildren(...Array.from({ length: 9 }, (_, i) => {
        const mark = document.createElement('div');
        mark.className = 'dk-hash';
        mark.style.left = `${(i + 1) * 10}%`;
        return mark;
      }));
    });
  }
  function placeModeThumb() {
    const group = $('modes');
    const thumb = $('mode-thumb');
    const active = group.querySelector('[aria-pressed="true"]');
    if (!active) return;
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.left = `${active.offsetLeft}px`;
    thumb.style.transform = 'none';
  }
  function startSliderEdit(name) {
    const root = document.querySelector(`[data-slider="${name}"]`);
    const valueEl = root.querySelector('.dk-value');
    if (root.querySelector('.dk-value-input')) return;
    const field = document.createElement('input');
    field.className = 'dk-value-input';
    field.value = String(state[name]);
    field.setAttribute('aria-label', `${name} value`);
    valueEl.hidden = true;
    valueEl.after(field);
    field.focus();
    field.select();
    const finish = apply => {
      if (!field.isConnected) return;
      if (apply) {
        const parsed = Number(field.value);
        if (Number.isFinite(parsed)) {
          $(name).value = parsed;
          $(name).dispatchEvent(new Event('input'));
        }
      }
      field.remove();
      valueEl.hidden = false;
      root.querySelector('.dk-track').focus({ preventScroll: true });
    };
    field.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Enter') { event.preventDefault(); finish(true); }
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    });
    field.addEventListener('blur', () => finish(true));
    field.addEventListener('pointerdown', event => event.stopPropagation());
  }
  function bindDialSlider(name) {
    const root = document.querySelector(`[data-slider="${name}"]`);
    // The hand-rolled track is DialKit's job now, so there is nothing to bind.
    // The <input type="range"> behind it stays, and is still what drives state.
    if (!root) return;
    const track = root.querySelector('.dk-track');
    const input = $(name);
    const valueEl = root.querySelector('.dk-value');
    let origin = null, dragging = false, rect = null, hoverTimer = 0;
    const clamp = value => Math.min(Number(input.max), Math.max(Number(input.min), value));
    const stepped = value => {
      const min = Number(input.min), step = Number(input.step) || 1;
      return clamp(min + Math.round((value - min) / step) * step);
    };
    const fromX = x => {
      const min = Number(input.min), max = Number(input.max);
      return min + Math.max(0, Math.min(1, (x - rect.left) / rect.width)) * (max - min);
    };
    const rubber = x => {
      if (x < rect.left) return -8 * Math.sqrt(Math.min(Math.max(0, rect.left - x - 32) / 200, 1));
      if (x > rect.right) return 8 * Math.sqrt(Math.min(Math.max(0, x - rect.right - 32) / 200, 1));
      return 0;
    };
    const commit = (value, snapClick) => {
      const min = Number(input.min), max = Number(input.max), step = Number(input.step) || 1;
      if (snapClick) {
        const discrete = (max - min) / step;
        value = discrete <= 10 ? stepped(value) : min + Math.round((value - min) / ((max - min) / 10)) * ((max - min) / 10);
      }
      value = stepped(value);
      if (name === 'rotation') value = lockHorizon(value);
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    track.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('.dk-value-input')) return;
      event.preventDefault();
      track.setPointerCapture(event.pointerId);
      origin = { x: event.clientX, y: event.clientY };
      dragging = false;
      rect = track.getBoundingClientRect();
      root.classList.add('is-active');
    });
    track.addEventListener('pointermove', event => {
      if (!origin) return;
      if (!dragging && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 3) {
        dragging = true;
        root.classList.add('is-dragging');
      }
      if (!dragging) return;
      const pull = rubber(event.clientX);
      track.style.width = `calc(100% + ${Math.abs(pull)}px)`;
      track.style.transform = pull < 0 ? `translateX(${pull}px)` : '';
      commit(fromX(event.clientX), false);
    });
    const release = event => {
      if (!origin) return;
      if (!dragging) commit(fromX(event.clientX), true);
      origin = null;
      dragging = false;
      root.classList.remove('is-dragging');
      track.style.width = '';
      track.style.transform = '';
    };
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);
    track.addEventListener('pointerenter', () => root.classList.add('is-active'));
    track.addEventListener('pointerleave', () => { if (!origin) root.classList.remove('is-active'); });
    track.addEventListener('keydown', event => {
      const min = Number(input.min), max = Number(input.max), step = Number(input.step) || 1;
      const jump = step * (event.shiftKey || event.key.startsWith('Page') ? 10 : 1);
      let next;
      if (event.key === 'Home') next = min;
      else if (event.key === 'End') next = max;
      else if (['ArrowRight', 'ArrowUp', 'PageUp'].includes(event.key)) next = Number(input.value) + jump;
      else if (['ArrowLeft', 'ArrowDown', 'PageDown'].includes(event.key)) next = Number(input.value) - jump;
      else if (event.key === 'Enter') { event.preventDefault(); startSliderEdit(name); return; }
      else return;
      event.preventDefault();
      input.value = clamp(next);
      input.dispatchEvent(new Event('input'));
    });
    valueEl.addEventListener('pointerenter', () => {
      hoverTimer = setTimeout(() => valueEl.classList.add('is-edit'), 800);
    });
    valueEl.addEventListener('pointerleave', () => {
      clearTimeout(hoverTimer);
      valueEl.classList.remove('is-edit');
    });
    valueEl.addEventListener('click', event => {
      if (!valueEl.classList.contains('is-edit')) return;
      event.stopPropagation();
      startSliderEdit(name);
    });
  }

  function render() {
    if (!renderer || exporting) return;
    const [w, h] = dimensions();
    const bounds = $('stage').getBoundingClientRect();
    const ratio = Math.min(Math.min(bounds.width / w, bounds.height / h) * Math.min(devicePixelRatio || 1, 2), 1920 / w, 1920 / h);
    try { renderer.draw(Math.max(1, Math.round(w * ratio)), Math.max(1, Math.round(h * ratio))); }
    catch (error) { toast(error.message); }
  }
  function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(render); save(); }

  function applyChrome() {
    const accent = state.colors[1] || '#3c3c36';
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--thumb', accent);
  }

  function paintPalettes() {
    const query = paletteQuery.trim().toLowerCase();
    const root = $('palettes');
    root.replaceChildren();
    const groups = ['Chroma', 'Omarchy'];
    let shown = 0;
    for (const group of groups) {
      const items = palettes
        .map((palette, index) => ({ palette, index }))
        .filter(({ palette }) => palette.group === group && (!query || palette.name.toLowerCase().includes(query)));
      if (!items.length) continue;
      const heading = document.createElement('div');
      heading.className = 'palette-group';
      heading.textContent = group;
      root.append(heading);
      for (const { palette, index } of items) {
        const button = document.createElement('button');
        button.className = 'palette';
        button.dataset.palette = index;
        button.title = palette.name;
        button.setAttribute('role', 'option');
        button.setAttribute('aria-label', palette.name);
        button.setAttribute('aria-pressed', String(index === state.palette));
        const dots = document.createElement('span');
        dots.className = 'palette-dots';
        dots.innerHTML = palette.colors.map(color => `<i style="background:${color}"></i>`).join('');
        const label = document.createElement('span');
        label.className = 'palette-label';
        label.textContent = palette.name;
        button.append(dots, label);
        button.addEventListener('click', () => {
          state.palette = index;
          state.colors = [...palette.colors];
          tap();
          sync();
          button.scrollIntoView({ block: 'nearest' });
        });
        root.append(button);
        shown++;
      }
    }
    if (!shown) {
      const empty = document.createElement('div');
      empty.className = 'palettes-empty';
      empty.textContent = 'No palettes';
      root.append(empty);
    }
    paintedQuery = query;
    document.querySelector(`[data-palette="${state.palette}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  function markPalette() {
    document.querySelectorAll('[data-palette]').forEach(button => {
      button.setAttribute('aria-pressed', String(+button.dataset.palette === state.palette));
    });
  }

  function sync() {
    if (state.mode === 2) state.rotation = snapAngle(state.rotation);
    document.querySelectorAll('[data-mode]').forEach(button => {
      const on = +button.dataset.mode === state.mode;
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    });
    placeModeThumb();
    if (paintedQuery !== paletteQuery.trim().toLowerCase() || !$('palettes').childElementCount) paintPalettes();
    else markPalette();
    for (const name of sliders) {
      const input = $(name);
      if (name === 'rotation') input.step = state.mode === 2 ? String(ANGLE_LOCK) : '1';
      input.value = state[name];
      setValueLabel(name);
      setValueLabel(name);
      paintDialSlider(name);
    }
    $('seed').value = state.seed;
    $('resolution').value = state.resolution;
    announceSync();
    // The size now uses the family's <select>, which draws its own label.
    const resLabel = document.getElementById('resolution-label');
    if (resLabel) resLabel.textContent = $('resolution').selectedOptions[0]?.textContent ?? state.resolution;
    $('palette-name').textContent = paletteName();
    $('swatches').replaceChildren(...state.colors.map((color, i) => {
      const row = document.createElement('label');
      row.className = 'dk-color';
      const name = document.createElement('span');
      name.textContent = COLOR_ROLES[i];
      const right = document.createElement('span');
      right.className = 'dk-color-right';
      const hex = document.createElement('input');
      hex.type = 'text';
      hex.className = 'dk-hex';
      hex.value = color;
      hex.spellcheck = false;
      hex.setAttribute('aria-label', `${COLOR_ROLES[i]} hex`);
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.value = color;
      picker.setAttribute('aria-label', `${COLOR_ROLES[i]} colour`);
      const apply = value => {
        if (!/^#[a-f\d]{6}$/i.test(value)) return;
        state.colors[i] = value.toLowerCase();
        state.palette = -1;
        customName = 'Custom';
        hex.value = state.colors[i];
        picker.value = state.colors[i];
        $('palette-name').textContent = 'Custom';
        document.querySelectorAll('[data-palette]').forEach(b => b.setAttribute('aria-pressed', 'false'));
        applyChrome();
        schedule();
      };
      hex.addEventListener('change', () => apply(hex.value.trim()));
      hex.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Enter') { event.preventDefault(); apply(hex.value.trim()); hex.blur(); }
      });
      picker.addEventListener('input', () => apply(picker.value));
      right.append(hex, picker);
      row.append(name, right);
      const wrap = document.createElement('div');
      wrap.className = 'lock-row';
      const lock = document.createElement('button');
      lock.type = 'button';
      lock.className = 'prop-lock';
      lock.dataset.lock = 'color' + i;
      lock.title = `Lock ${COLOR_ROLES[i].toLowerCase()}`;
      lock.innerHTML = LOCK_ICON;
      wrap.append(row, lock);
      return wrap;
    }));
    markLocks();
    const locks = $('angle-locks');
    locks.hidden = state.mode !== 2;
    locks.querySelectorAll('[data-angle]').forEach(button => {
      button.setAttribute('aria-pressed', String(+button.dataset.angle === state.rotation));
    });
    const [w, h] = dimensions(), gcd = (a, b) => b ? gcd(b, a % b) : a, divisor = gcd(w, h);
    document.documentElement.style.setProperty('--preview-aspect', `${w} / ${h}`);
    $('size-label').textContent = `${w} × ${h} · ${w / divisor}:${h / divisor}`;
    $('composition-label').textContent = `${modes[state.mode]} · ${String(state.seed).padStart(4, '0')}`;
    applyChrome();
    schedule();
  }

  function validate(input) {
    if (!input || typeof input !== 'object') return structuredClone(defaults);
    const valid = structuredClone(defaults);
    for (const key of [...sliders, 'seed', 'mode', 'palette']) {
      const min = key === 'rotation' ? -180 : key === 'palette' ? -1 : 0;
      const max = key === 'rotation' ? 180 : key === 'seed' ? 999999 : key === 'mode' ? 2 : key === 'palette' ? palettes.length - 1 : 100;
      if (Number.isFinite(input[key])) valid[key] = Math.round(Math.min(max, Math.max(min, input[key])));
    }
    if (valid.mode === 2) valid.rotation = snapAngle(valid.rotation);
    if (Array.isArray(input.colors) && input.colors.length === 4 && input.colors.every(c => /^#[a-f\d]{6}$/i.test(c))) valid.colors = [...input.colors];
    else if (valid.palette >= 0) valid.colors = [...palettes[valid.palette].colors];
    if ([...$('resolution').options].some(o => o.value === input.resolution)) valid.resolution = input.resolution;
    valid.locks = { ...defaultLocks };
    if (input.locks && typeof input.locks === 'object') {
      for (const key of lockKeys) if (typeof input.locks[key] === 'boolean') valid.locks[key] = input.locks[key];
    }
    return valid;
  }

  function grabToml(text, key) {
    const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*"?(#[0-9a-fA-F]{6})"`, 'mi'));
    return match ? match[1].toLowerCase() : null;
  }
  function paletteFromToml(text) {
    const c0 = grabToml(text, 'darker_background') || grabToml(text, 'darker_bg') || grabToml(text, 'background') || grabToml(text, 'bg');
    const c1 = grabToml(text, 'accent') || grabToml(text, 'blue') || grabToml(text, 'color4');
    const c2 = grabToml(text, 'magenta') || grabToml(text, 'orange') || grabToml(text, 'red') || grabToml(text, 'color5');
    const c3 = grabToml(text, 'yellow') || grabToml(text, 'bright_foreground') || grabToml(text, 'foreground') || grabToml(text, 'color7');
    if (![c0, c1, c2, c3].every(Boolean)) return null;
    return [c0, c1, c2, c3];
  }
  function applyImported(colors, label) {
    state.colors = colors;
    state.palette = -1;
    customName = label || 'Custom';
    sync();
    toast('Palette imported.');
  }
  async function importTomlFile(file) {
    if (!file) return;
    try {
      const colors = paletteFromToml(await file.text());
      if (!colors) { toast('No palette found in that file.'); return; }
      applyImported(colors, file.name.replace(/\.toml$/i, ''));
    } catch {
      toast('Could not read that file.');
    }
  }

  try {
    const recipe = location.hash.slice(1);
    const saved = recipe ? decodeURIComponent(recipe) : localStorage.getItem('chroma-v2');
    if (saved) state = validate(JSON.parse(saved));
  } catch { toast('Could not load saved settings. Starting with Rose room.'); }
  try { renderer = makeRenderer($('art')); }
  catch (error) {
    $('render-error').hidden = false;
    $('render-error').textContent = error.message;
    $('download').disabled = true;
  }
  $('art').addEventListener('webglcontextlost', event => {
    event.preventDefault();
    renderer = null;
    $('download').disabled = true;
    $('render-error').hidden = false;
    $('render-error').textContent = 'Graphics connection lost. Waiting for recovery…';
  });
  $('art').addEventListener('webglcontextrestored', () => {
    try {
      renderer = makeRenderer($('art'));
      $('render-error').hidden = true;
      $('download').disabled = exporting;
      schedule();
      toast('Preview restored.');
    } catch (error) { $('render-error').textContent = error.message; }
  });

  for (const name of sliders) {
    $(name).addEventListener('input', () => {
      let value = Number($(name).value);
      if (name === 'rotation') {
        value = lockHorizon(value);
        $(name).value = value;
        if (state.mode === 2 && value !== state.rotation) tap();
      }
      state[name] = value;
      setValueLabel(name);
      paintDialSlider(name);
      // Horizon snaps to 15-degree steps, so what the panel sent is not always
      // what it gets. Tell it, or its dial and the wallpaper disagree.
      if (name === 'rotation') announceSync();
      if (name === 'rotation') {
        $('angle-locks').querySelectorAll('[data-angle]').forEach(button => {
          button.setAttribute('aria-pressed', String(+button.dataset.angle === state.rotation));
        });
      }
      schedule();
    });
  }
  $('angle-locks').addEventListener('click', event => {
    const button = event.target.closest('[data-angle]');
    if (!button) return;
    state.rotation = Number(button.dataset.angle);
    tap();
    sync();
  });
  $('seed').addEventListener('change', () => {
    state.seed = Math.max(0, Math.min(999999, Math.round(Number($('seed').value) || 0)));
    sync();
  });
  $('resolution').addEventListener('change', () => { state.resolution = $('resolution').value; sync(); });
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    state.mode = Number(button.dataset.mode);
    if (state.mode === 2) state.rotation = snapAngle(state.rotation);
    tap();
    sync();
  }));
  $('shuffle').addEventListener('click', () => {
    if (lockKeys.every(isLocked)) { toast('Everything is locked.'); return; }
    if (!isLocked('mode')) state.mode = randInt(0, 2);
    if (!isLocked('palette') && palettes.length) {
      let next = randInt(0, palettes.length - 1);
      if (palettes.length > 1 && next === state.palette) next = (next + 1) % palettes.length;
      state.palette = next;
      customName = 'Custom';
      const picked = palettes[next].colors;
      state.colors = state.colors.map((color, i) => isLocked('color' + i) ? color : picked[i]);
    } else {
      for (let i = 0; i < 4; i++) {
        if (isLocked('color' + i)) continue;
        state.colors[i] = palettes[randInt(0, palettes.length - 1)].colors[i];
        state.palette = -1;
        customName = 'Custom';
      }
    }
    for (const name of sliders) {
      if (isLocked(name)) continue;
      const input = $(name);
      const min = Number(input.min), max = Number(input.max), step = Number(input.step) || 1;
      state[name] = min + Math.round(Math.random() * (max - min) / step) * step;
    }
    if (!isLocked('seed')) state.seed = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    if (state.mode === 2) state.rotation = snapAngle(state.rotation);
    tap();
    sync();
  });
  $('reset').addEventListener('click', () => {
    state = structuredClone(defaults);
    paletteQuery = '';
    paintedQuery = null;
    customName = 'Custom';
    $('palette-search').value = '';
    history.replaceState(null, '', location.pathname + location.search);
    sync();
    toast('Reset.');
  });
  $('copy-link').addEventListener('click', async () => {
    const url = new URL(location.href);
    url.hash = encodeURIComponent(JSON.stringify(state));
    try { await navigator.clipboard.writeText(url.href); toast('Copied.'); }
    catch { history.replaceState(null, '', url); toast('Recipe saved in the address bar.'); }
  });
  $('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $('stage').requestFullscreen();
    } catch { toast('Fullscreen is unavailable in this browser.'); }
  });
  document.addEventListener('fullscreenchange', schedule);
  document.addEventListener('keydown', event => {
    const tag = document.activeElement?.tagName;
    const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag);
    if (event.code === 'Space' && !typing && tag !== 'BUTTON' && document.activeElement?.getAttribute('role') !== 'slider') {
      event.preventDefault();
      $('shuffle').click();
      return;
    }
    if (event.key === '/' && !typing) {
      event.preventDefault();
      $('palette-search').focus();
      $('palette-search').select();
      return;
    }
    if (typing) return;
    if (event.key === '1' || event.key === '2' || event.key === '3') {
      state.mode = Number(event.key) - 1;
      if (state.mode === 2) state.rotation = snapAngle(state.rotation);
      sync();
    }
  });
  $('palette-search').addEventListener('input', () => {
    paletteQuery = $('palette-search').value;
    paintPalettes();
  });
  $('palette-search').addEventListener('keydown', event => {
    if (event.key === 'Escape') { $('palette-search').blur(); event.stopPropagation(); }
  });
  $('import-palette').addEventListener('click', () => $('toml-file').click());
  $('toml-file').addEventListener('change', event => {
    importTomlFile(event.target.files[0]);
    event.target.value = '';
  });
  document.addEventListener('dragover', event => {
    if ([...event.dataTransfer.items].some(item => item.kind === 'file')) event.preventDefault();
  });
  document.addEventListener('drop', event => {
    const file = [...event.dataTransfer.files].find(item => /\.toml$/i.test(item.name) || item.type.startsWith('text/'));
    if (!file) return;
    event.preventDefault();
    importTomlFile(file);
  });
  $('download').addEventListener('click', async () => {
    if (!renderer || exporting) return;
    const recipe = structuredClone(state);
    exporting = true;
    const button = $('download');
    button.disabled = true;
    button.textContent = 'Rendering…';
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    try {
      const [w, h] = recipe.resolution.split('x').map(Number);
      if (!renderer) throw new Error('Graphics connection lost. Please try again after recovery.');
      renderer.draw(w, h, recipe);
      const blob = await new Promise((resolve, reject) => $('art').toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed. Try a smaller resolution.')), 'image/png'));
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url;
      link.download = `chroma-${['field', 'aperture', 'horizon'][recipe.mode]}-${recipe.seed}-${w}x${h}.png`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast('Exported.');
    } catch (error) { toast(error.message); }
    finally {
      exporting = false;
      button.disabled = !renderer;
      button.textContent = 'Export';
      render();
    }
  });
  document.querySelectorAll('.dial-folder-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const folder = button.closest('.dial-folder');
      const open = folder.dataset.open !== 'true';
      folder.dataset.open = String(open);
      button.setAttribute('aria-expanded', String(open));
    });
  });
  document.querySelectorAll('.prop-lock').forEach(button => {
    if (!button.innerHTML) button.innerHTML = LOCK_ICON;
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-lock]');
    if (!button) return;
    event.preventDefault();
    const key = button.dataset.lock;
    if (!lockKeys.includes(key)) return;
    state.locks[key] = !isLocked(key);
    markLocks();
    save();
  });
  /* Chroma drew its own dropdown for the export size. The drawer uses the
     family's <select> now — which this same script already listens to for
     change — so the custom menu simply isn't on the page. Kept, and skipped,
     rather than cut: it is the one part of the panel that had no equivalent
     and might want to come back. */
  const resMenu = $('resolution-menu');
  const resTrigger = $('resolution-trigger');
  if (resMenu && resTrigger) {
    function closeResMenu() {
      resMenu.hidden = true;
      resTrigger.setAttribute('aria-expanded', 'false');
    }
    function openResMenu() {
      resMenu.replaceChildren(...[...$('resolution').options].map(option => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'dial-option';
        item.setAttribute('role', 'option');
        item.dataset.value = option.value;
        item.textContent = option.textContent;
        item.setAttribute('aria-selected', String(option.value === $('resolution').value));
        item.addEventListener('click', () => {
          $('resolution').value = option.value;
          $('resolution').dispatchEvent(new Event('change'));
          closeResMenu();
        });
        return item;
      }));
      const box = resTrigger.getBoundingClientRect();
      const below = window.innerHeight - box.bottom;
      resMenu.style.width = `${box.width}px`;
      resMenu.style.left = `${box.left}px`;
      if (below < 180) {
        resMenu.style.top = 'auto';
        resMenu.style.bottom = `${window.innerHeight - box.top + 4}px`;
      } else {
        resMenu.style.bottom = 'auto';
        resMenu.style.top = `${box.bottom + 4}px`;
      }
      resMenu.hidden = false;
      resTrigger.setAttribute('aria-expanded', 'true');
    }
    resTrigger.addEventListener('click', () => { resMenu.hidden ? openResMenu() : closeResMenu(); });
    document.addEventListener('pointerdown', event => {
      if (!event.target.closest('.dial-select')) closeResMenu();
    });
  }

  $('modes').addEventListener('keydown', event => {
    const buttons = [...$('modes').querySelectorAll('[data-mode]')];
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    buttons[(index + delta + buttons.length) % buttons.length].click();
    buttons[(index + delta + buttons.length) % buttons.length].focus();
  });
  seedHashmarks();
  sliders.forEach(bindDialSlider);
  new ResizeObserver(() => { schedule(); placeModeThumb(); }).observe($('stage'));
  new ResizeObserver(placeModeThumb).observe($('modes'));
  sync();

  /* The padlocks live on DialKit's own dial rows now, and React injects them
     there once the panel has rendered. Clicks are already caught by the
     delegated handler above — all it needs from here is the glyph and a way to
     ask for the pressed state to be refreshed once the buttons exist. */
  window.chroma = { lockIcon: LOCK_ICON, markLocks: markLocks };
})();
