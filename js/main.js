// Video Optimization
function initIntroVideo() {
    const video = document.getElementById('intro-video');
    if (video) {
        // Configuración inicial del video
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.setAttribute('loop', 'true');
        video.setAttribute('autoplay', 'true');
        video.setAttribute('muted', 'true');
        video.setAttribute('playsinline', 'true');

        // Deshabilitar controles completamente (reforzar)
        video.controls = false;
        video.removeAttribute('controls');
        video.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback');
        video.disablePictureInPicture = true;
        video.disableRemotePlayback = true;

        // Forzar ocultamiento de controles en Safari (reforzar)
        video.style.setProperty('-webkit-appearance', 'none', 'important');
        video.style.setProperty('appearance', 'none', 'important');

        // Función para forzar reproducción
        const forcePlay = () => {
            if (video.paused || video.ended) {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        // Reintentar si falla
                        setTimeout(() => {
                            video.play().catch(() => { });
                        }, 100);
                    });
                }
            }
        };

        // Intentar reproducir inmediatamente
        forcePlay();

        // Asegurar que el video esté reproduciéndose cuando esté listo
        video.addEventListener('loadedmetadata', forcePlay, { once: true });
        video.addEventListener('loadeddata', forcePlay, { once: true });
        video.addEventListener('canplay', forcePlay, { once: true });
        video.addEventListener('canplaythrough', forcePlay, { once: true });

        // Bloquear todos los eventos de interacción
        const blockInteraction = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        };

        const events = ['click', 'dblclick', 'contextmenu', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 'keydown', 'keyup', 'selectstart', 'dragstart', 'wheel', 'scroll'];
        events.forEach(event => {
            video.addEventListener(event, blockInteraction, { capture: true, passive: false });
        });

        // Bloquear eventos de teclado específicos del video
        video.addEventListener('keydown', (e) => {
            // Bloquear teclas de espacio, flechas, etc.
            if ([32, 37, 38, 39, 40, 70, 77].includes(e.keyCode)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }, { capture: true, passive: false });

        // Prevenir pantalla completa
        video.addEventListener('webkitbeginfullscreen', (e) => {
            e.preventDefault();
            return false;
        }, { capture: true, passive: false });

        video.addEventListener('webkitendfullscreen', (e) => {
            e.preventDefault();
            forcePlay(); // Reanudar después de salir de pantalla completa
            return false;
        }, { capture: true, passive: false });

        // Prevenir pausa - reanudar automáticamente si se pausa
        video.addEventListener('pause', function () {
            // Solo reanudar si no es un loop natural
            if (!video.ended) {
                setTimeout(() => {
                    forcePlay();
                }, 50);
            }
        }, false);

        // Manejar cuando el video termina - asegurar loop
        video.addEventListener('ended', function () {
            video.currentTime = 0;
            forcePlay();
        }, false);

        // Detectar cuando está cerca del final y asegurar loop
        video.addEventListener('timeupdate', function () {
            // Si está muy cerca del final (último 0.2 segundos), asegurar loop
            if (video.duration && video.currentTime >= video.duration - 0.2) {
                // Asegurar que loop esté activo
                if (!video.loop) {
                    video.loop = true;
                }
            }
        }, false);

        // Monitor periódico optimizado - verificar menos frecuentemente
        let monitorInterval = setInterval(() => {
            // Verificar que el video esté reproduciéndose
            if (video.paused && !video.ended) {
                forcePlay();
            }

            // Asegurar que loop esté activo
            if (!video.loop) {
                video.loop = true;
            }

            // Si el video terminó pero no se reinició, forzar reinicio
            if (video.ended) {
                video.currentTime = 0;
                forcePlay();
            }
        }, 1000); // Verificar cada 1s (reducido de 500ms para mejor performance)

        // Prevenir cambios en currentTime (adelantar/regresar) - pero permitir loop
        let lastCurrentTime = 0;
        let allowSeek = false;

        video.addEventListener('seeking', (e) => {
            // Permitir si es un reset a 0 (loop) o si el cambio es muy pequeño (normal playback)
            const timeDiff = Math.abs(video.currentTime - lastCurrentTime);
            if (!allowSeek && timeDiff > 0.5 && video.currentTime !== 0) {
                e.preventDefault();
                video.currentTime = lastCurrentTime;
                return false;
            }
        }, { capture: true, passive: false });

        video.addEventListener('seeked', (e) => {
            // Si es un reset a 0, permitirlo (es el loop)
            if (video.currentTime === 0) {
                lastCurrentTime = 0;
                allowSeek = false;
            } else {
                lastCurrentTime = video.currentTime;
            }
        }, { capture: true, passive: false });

        // Actualizar lastCurrentTime periódicamente (optimizado)
        let timeUpdateInterval = setInterval(() => {
            if (video.currentTime > 0) {
                lastCurrentTime = video.currentTime;
            }
        }, 500); // Reducido de 200ms a 500ms para mejor performance
    }
}

// Glass Pill WebGL Class
class GlassPillWebGL {
    constructor(canvasId, pillElement, baseColor = [50, 50, 50]) {
        this.canvas = document.getElementById(canvasId);
        this.pillElement = pillElement;
        this.baseColor = baseColor;
        this.gl = null;
        this.program = null;
        this.texture = null;
        this.frameCount = 0;
        this.isActive = false; // Control para activar solo cuando se arrastra

        // Parámetros específicos solicitados - ligeramente más agresivos
        this.physics = {
            refraction: 1.12,   // IOR (ligeramente aumentado)
            spread: 0.70,       // Refraction Spread (ligeramente más dispersión)
            distortion: 0.115,  // Distortion (ligeramente más deformación)
            chromatic: 0.100,   // Chromatic Aberration (ligeramente más aberración)
            edge: 0.88          // Edge Intensity (ligeramente más intensidad)
        };

        if (this.canvas) {
            this.init();
        } else {
            console.error('Canvas no encontrado para:', canvasId);
        }
    }

    activate() {
        this.isActive = true;
    }

    deactivate() {
        this.isActive = false;
    }

    init() {
        this.initWebGL();
        this.setupCanvas();
        this.startRender();
    }

    initWebGL() {
        this.gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) ||
            this.canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
        if (!this.gl) {
            console.error('WebGL no disponible para:', this.canvas.id);
            return;
        }

        const gl = this.gl;

        const vertexShaderSource = `
        attribute vec4 aVertexPosition;
        attribute vec2 aTextureCoord;
        varying vec2 vTextureCoord;
        void main() {
            gl_Position = aVertexPosition;
            vTextureCoord = aTextureCoord;
        }
    `;

        const fragmentShaderSource = `
        precision highp float;
        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
        uniform float uTime;
        uniform float uIOR;
        uniform float uSpread;
        uniform float uDistortion;
        uniform float uChromatic;
        uniform float uEdge;
        uniform vec2 uResolution;
        uniform vec3 uBaseColor;
        
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        
        float roundedRectSDF(vec2 p, vec2 size, float radius) {
            vec2 d = abs(p) - size + radius;
            return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
        }
        
        void main() {
            vec2 uv = vTextureCoord;
            vec2 center = vec2(0.5);
            vec2 pos = (uv - center) * 2.0;
            
            float aspect = uResolution.x / uResolution.y;
            vec2 adjustedPos = pos;
            adjustedPos.x *= aspect;
            
            // Forma de píldora perfecta
            float normalizedRadius = 1.0;
            vec2 pillSize = vec2(aspect, 1.0);
            float dist = roundedRectSDF(adjustedPos, pillSize, normalizedRadius);
            
            // Máscara alpha suave
            float alpha = 1.0 - smoothstep(-0.02, 0.02, dist);
            if (alpha < 0.01) discard;
            
            // Máscara de refracción gradual desde el centro
            float centerDistance = length(pos);
            float gradualPower = mix(1.5, 4.0, uSpread);
            float refractionMask = pow(centerDistance, gradualPower);
            float edgeDistance = 1.0 - smoothstep(-0.1, 0.1, dist);
            refractionMask *= edgeDistance;
            refractionMask = smoothstep(0.0, 1.0, refractionMask);
            
            // Ondas ligeramente más agresivas
            float time = uTime * 0.85;
            float waveX = sin(pos.x * 12.5 + time) * sin(pos.y * 8.5 + time * 0.7) * uDistortion * 1.08;
            float waveY = cos(pos.y * 12.5 + time * 0.9) * cos(pos.x * 8.5 + time * 0.6) * uDistortion * 1.08;
            float noiseValue = noise(uv * 8.5 + time * 0.11) * 0.022;
            waveX += noiseValue;
            waveY += noiseValue;
            
            // Normal de la superficie ligeramente más pronunciada
            vec3 normal;
            if (dist < 0.0) {
                float surfaceHeight = 0.22 + refractionMask * 0.65;
                normal = normalize(vec3(
                    adjustedPos.x + waveX * 0.55,
                    pos.y + waveY * 0.55,
                    surfaceHeight
                ));
            } else {
                normal = vec3(0.0, 0.0, 1.0);
            }
            
            // Refracción
            float eta = 1.0 / uIOR;
            vec3 incident = vec3(0.0, 0.0, -1.0);
            vec3 refracted = refract(incident, normal, eta);
            
            float baseStrength = refractionMask * uEdge;
            vec2 offset = refracted.xy * baseStrength * 1.6;
            vec2 newUV = uv + offset;
            
            // Aberración cromática ligeramente más agresiva
            float aberration = uChromatic * refractionMask * (uIOR - 1.0) * baseStrength * 1.1;
            vec4 colorR = texture2D(uSampler, newUV + vec2(aberration, 0.0));
            vec4 colorG = texture2D(uSampler, newUV);
            vec4 colorB = texture2D(uSampler, newUV - vec2(aberration, 0.0));
            vec4 color = vec4(colorR.r, colorG.g, colorB.b, 1.0);
            
            // Fondo uniforme del color base
            vec3 glassColor = uBaseColor / 255.0;
            
            // Detectar si es el menú de filtros (color base gris [50,50,50])
            bool isFilterMenu = (uBaseColor.r < 60.0 && uBaseColor.g < 60.0 && uBaseColor.b < 60.0);
            
            if (isFilterMenu) {
                // Para el menú de filtros: mantener el contenido refractado sin fondo
                // No mezclar con color base, dejar el contenido puro
                // El fondo CSS ya es transparente
            } else {
                // Para otros menús: usar lógica normal
                float contentBrightness = (color.r + color.g + color.b) / 3.0;
                if (contentBrightness < 0.1) {
                    color.rgb = glassColor;
                } else {
                    color.rgb = mix(color.rgb, glassColor, 0.6);
                }
            }
            
            gl_FragColor = vec4(color.rgb, alpha);
        }
    `;

        const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        const positions = [-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0];
        const textureCoords = [0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0];

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);

        gl.useProgram(this.program);

        const positionLocation = gl.getAttribLocation(this.program, 'aVertexPosition');
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        const texCoordLocation = gl.getAttribLocation(this.program, 'aTextureCoord');
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        const pixel = new Uint8Array([255, 255, 255, 255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    }

    setupCanvas() {
        if (!this.pillElement || !this.canvas) return;
        const rect = this.pillElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        if (this.gl) {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    updateTexture() {
        if (!this.gl || !this.texture || !this.pillElement) return;

        const rect = this.pillElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = rect.width * dpr;
        captureCanvas.height = rect.height * dpr;
        const ctx = captureCanvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // Fondo del contenedor
        const container = this.pillElement.parentElement;
        const containerStyle = window.getComputedStyle(container);
        ctx.fillStyle = containerStyle.backgroundColor || 'rgba(26, 26, 26, 0.6)';
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Capturar el contenido detrás de la píldora
        const buttons = container.querySelectorAll('button');

        buttons.forEach(btn => {
            const btnRect = btn.getBoundingClientRect();
            const relX = btnRect.left - rect.left;
            const relY = btnRect.top - rect.top;

            // Solo dibujar si el botón está dentro del área de la píldora
            if (relX < rect.width && relX + btnRect.width > 0 &&
                relY < rect.height && relY + btnRect.height > 0) {

                // Dibujar imagen del botón si existe
                const img = btn.querySelector('img');
                if (img && img.complete && img.naturalWidth > 0) {
                    const imgRect = img.getBoundingClientRect();
                    const imgX = imgRect.left - rect.left;
                    const imgY = imgRect.top - rect.top;
                    try {
                        ctx.drawImage(img, imgX, imgY, imgRect.width, imgRect.height);
                    } catch (e) {
                        // Ignorar errores de CORS
                    }
                }

                // Dibujar texto del botón
                const span = btn.querySelector('span');
                if (span) {
                    const spanRect = span.getBoundingClientRect();
                    const spanX = spanRect.left - rect.left;
                    const spanY = spanRect.top - rect.top;

                    const style = window.getComputedStyle(span);
                    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
                    ctx.fillStyle = style.color;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(span.textContent, spanX + spanRect.width / 2, spanY + spanRect.height / 2);
                }
            }
        });

        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, captureCanvas);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    }

    render() {
        if (!this.gl || !this.program) {
            if (this.frameCount === 0) {
                console.error('No se puede renderizar - GL o Program no disponible para:', this.canvas ? this.canvas.id : 'unknown');
            }
            return;
        }

        // Solo renderizar el efecto cuando está activo (arrastrando)
        if (!this.isActive) {
            this.gl.clearColor(0, 0, 0, 0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.frameCount++;
            return;
        }

        // Actualizar textura cada frame para mejor efecto
        this.updateTexture();

        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'uTime'), Date.now() * 0.001);
        this.gl.uniform2f(this.gl.getUniformLocation(this.program, 'uResolution'), this.canvas.width, this.canvas.height);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'uIOR'), this.physics.refraction);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'uSpread'), this.physics.spread);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'uDistortion'), this.physics.distortion);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'uChromatic'), this.physics.chromatic);
        this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'uEdge'), this.physics.edge);
        this.gl.uniform3f(this.gl.getUniformLocation(this.program, 'uBaseColor'),
            this.baseColor[0], this.baseColor[1], this.baseColor[2]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'uSampler'), 0);

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.frameCount++;
    }

    startRender() {
        const renderFrame = () => {
            this.render();
            requestAnimationFrame(renderFrame);
        };
        renderFrame();
    }

    updateSize() {
        this.setupCanvas();
    }
}

// Filters and WebGL Initialization
function initFiltersAndWebGL() {
    // Script para el menú de filtros
    const filtersContainer = document.getElementById('filters');
    const pill = document.getElementById('filter-pill');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const productCards = document.querySelectorAll('.product-card');
    let activeButton = document.querySelector('.filter-btn.active');
    let isDragging = false;
    let startX, currentX;
    // Función para actualizar la posición y ancho de la pill
    let updatePill = (button, animate = true) => {
        const setStyles = () => {
            pill.style.width = `${button.offsetWidth}px`;
            pill.style.left = `${button.offsetLeft}px`;
        };
        if (!animate) {
            pill.style.transition = 'none';
            setStyles();
            requestAnimationFrame(() => {
                pill.style.transition = 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease';
            });
        } else {
            requestAnimationFrame(setStyles);
        }
    };
    // Inicializar pill en el botón activo
    updatePill(activeButton, false);
    // Manejar clics en botones
    filterButtons.forEach(button => {
        const handlePress = (e) => {
            e.preventDefault();
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activeButton = button;
            updatePill(button);
            applyFilter(button.getAttribute('data-filter'));
        };
        button.addEventListener('mousedown', handlePress);
        button.addEventListener('touchstart', handlePress, { passive: false });
    });
    // Función para aplicar filtro
    const applyFilter = (filter) => {
        productCards.forEach(card => {
            const category = card.getAttribute('data-category');
            card.style.display = (filter === 'all' || filter === category) ? 'block' : 'none';
        });
        const comingSoonPen = document.getElementById('coming-soon-pen');
        comingSoonPen.style.display = (filter === 'pen') ? 'block' : 'none';
    };
    // Manejar inicio de drag
    const startDrag = (e) => {
        const clientX = (e.type === 'touchstart' ? e.touches[0].clientX : e.clientX);
        const rect = filtersContainer.getBoundingClientRect();
        const clickX = clientX - rect.left;
        const pillLeft = parseFloat(pill.style.left || 0);
        const pillWidth = pill.offsetWidth;
        if (clickX >= pillLeft && clickX <= pillLeft + pillWidth) {
            initiateDrag(clientX);
            e.preventDefault();
        }
    };
    // Función para iniciar el drag inmediatamente
    const initiateDrag = (clientX) => {
        isDragging = true;
        filtersContainer.classList.add('dragging-mode');
        pill.classList.add('dragging');
        pill.style.transition = 'transform 0.2s ease'; // Transición solo para transform (scale)
        startX = clientX - parseFloat(pill.style.left || 0);

        // Activar efecto WebGL
        if (filterPillGL) filterPillGL.activate();

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    };
    // Manejar movimiento
    const onDrag = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = (e.type === 'touchmove' ? e.touches[0].clientX : e.clientX);
        currentX = clientX - startX;
        const minLeft = 0;
        const maxLeft = filtersContainer.offsetWidth - pill.offsetWidth;
        pill.style.left = `${Math.max(minLeft, Math.min(currentX, maxLeft))}px`;
    };
    // Manejar fin de drag
    const endDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        filtersContainer.classList.remove('dragging-mode');
        pill.classList.remove('dragging');
        pill.style.transition = 'left 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), width 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55)'; // Transición con rebote para todo

        // Desactivar efecto WebGL
        if (filterPillGL) filterPillGL.deactivate();

        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchend', endDrag);
        // Encontrar el botón en cuya área cae el centro de la pill
        let targetButton = null;
        const pillCenter = parseFloat(pill.style.left) + pill.offsetWidth / 2;
        filterButtons.forEach(button => {
            if (pillCenter >= button.offsetLeft && pillCenter < button.offsetLeft + button.offsetWidth) {
                targetButton = button;
            }
        });
        // Actualizar al botón target con animación de rebote
        if (targetButton) {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            targetButton.classList.add('active');
            activeButton = targetButton;
            updatePill(targetButton, true);
            applyFilter(targetButton.getAttribute('data-filter'));
        } else {
            // Si no se encuentra, snap back
            updatePill(activeButton, true);
        }
        // Restaurar transición original después de la animación
        setTimeout(() => {
            pill.style.transition = 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease';
        }, 300);
    };
    // Habilitar drag en el contenedor
    filtersContainer.addEventListener('mousedown', startDrag);
    filtersContainer.addEventListener('touchstart', startDrag, { passive: false });
    // Script para el mini menú de cantidad para flor
    const quantityContainerFlor = document.getElementById('quantity-selector-flor');
    const qPillFlor = document.getElementById('quantity-pill-flor');
    const quantityButtonsFlor = quantityContainerFlor.querySelectorAll('.quantity-btn');
    let activeQButtonFlor = quantityContainerFlor.querySelector('.quantity-btn.active');
    let isQDraggingFlor = false;
    let qStartXFlor, qCurrentXFlor;
    let updateQPillFlor = (button, animate = true) => {
        const setStyles = () => {
            qPillFlor.style.width = `${button.offsetWidth}px`;
            qPillFlor.style.left = `${button.offsetLeft}px`;
        };
        if (!animate) {
            qPillFlor.style.transition = 'none';
            setStyles();
            requestAnimationFrame(() => {
                qPillFlor.style.transition = 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease';
            });
        } else {
            requestAnimationFrame(setStyles);
        }
    };
    updateQPillFlor(activeQButtonFlor, false);
    quantityButtonsFlor.forEach(button => {
        const handlePress = (e) => {
            e.preventDefault();
            quantityButtonsFlor.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activeQButtonFlor = button;
            updateQPillFlor(button);
            applyQuantityFlor(button.getAttribute('data-quantity'));
        };
        button.addEventListener('mousedown', handlePress);
        button.addEventListener('touchstart', handlePress, { passive: false });
    });
    const applyQuantityFlor = (quantity) => {
        const prices = {
            '3.5g': 250,
            '7g': 450,
            '1/2 oz': 820,
            '1 oz': 1200  // Precio con descuento (antes $1370)
        };

        const discountBadge = document.getElementById('flor-discount-badge');
        const priceContainer = document.getElementById('flor-price-container');
        const priceOriginal = document.getElementById('flor-price-original');

        // Mostrar etiqueta de descuento y precios solo para "1 oz"
        if (quantity === '1 oz') {
            const originalPrice = 1370;
            const discountedPrice = 1200;
            const discountPercent = Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
            discountBadge.textContent = `${discountPercent}% OFF`;
            discountBadge.style.display = 'inline-flex';

            // Mostrar precio tachado en la línea de "Híbrida"
            priceOriginal.textContent = `$${originalPrice}`;
            priceOriginal.style.display = 'inline';

            // Mostrar solo nuevo precio
            priceContainer.innerHTML = `
            <span id="flor-price" class="text-xs sm:text-sm font-semibold price-discounted">$${discountedPrice}</span>
        `;
        } else {
            discountBadge.style.display = 'none';
            priceOriginal.style.display = 'none';

            // Mostrar solo precio normal
            priceContainer.innerHTML = `
            <span id="flor-price" class="text-xs sm:text-base font-semibold" style="color: #e5e5e5;">$${prices[quantity]}</span>
        `;
        }
    };
    applyQuantityFlor(activeQButtonFlor.getAttribute('data-quantity'));
    const startQDragFlor = (e) => {
        const clientX = (e.type === 'touchstart' ? e.touches[0].clientX : e.clientX);
        const rect = quantityContainerFlor.getBoundingClientRect();
        const clickX = clientX - rect.left;
        const pillLeft = parseFloat(qPillFlor.style.left || 0);
        const pillWidth = qPillFlor.offsetWidth;
        if (clickX >= pillLeft && clickX <= pillLeft + pillWidth) {
            initiateQDragFlor(clientX);
            e.preventDefault();
        }
    };
    const initiateQDragFlor = (clientX) => {
        isQDraggingFlor = true;
        quantityContainerFlor.classList.add('dragging-mode');
        qPillFlor.classList.add('dragging');
        qPillFlor.style.transition = 'transform 0.2s ease';

        // Activar efecto WebGL
        if (qPillFlorGL) qPillFlorGL.activate();

        qStartXFlor = clientX - parseFloat(qPillFlor.style.left || 0);
        document.addEventListener('mousemove', onQDragFlor);
        document.addEventListener('touchmove', onQDragFlor, { passive: false });
        document.addEventListener('mouseup', endQDragFlor);
        document.addEventListener('touchend', endQDragFlor);
    };
    const onQDragFlor = (e) => {
        if (!isQDraggingFlor) return;
        e.preventDefault();
        const clientX = (e.type === 'touchmove' ? e.touches[0].clientX : e.clientX);
        qCurrentXFlor = clientX - qStartXFlor;
        const minLeft = 0;
        const maxLeft = quantityContainerFlor.offsetWidth - qPillFlor.offsetWidth;
        qPillFlor.style.left = `${Math.max(minLeft, Math.min(qCurrentXFlor, maxLeft))}px`;
    };
    const endQDragFlor = (e) => {
        if (!isQDraggingFlor) return;
        isQDraggingFlor = false;
        quantityContainerFlor.classList.remove('dragging-mode');
        qPillFlor.classList.remove('dragging');
        qPillFlor.style.transition = 'left 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), width 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55)';

        // Desactivar efecto WebGL
        if (qPillFlorGL) qPillFlorGL.deactivate();

        document.removeEventListener('mousemove', onQDragFlor);
        document.removeEventListener('touchmove', onQDragFlor);
        document.removeEventListener('mouseup', endQDragFlor);
        document.removeEventListener('touchend', endQDragFlor);
        let targetButton = null;
        const pillCenter = parseFloat(qPillFlor.style.left) + qPillFlor.offsetWidth / 2;
        quantityButtonsFlor.forEach(button => {
            if (pillCenter >= button.offsetLeft && pillCenter < button.offsetLeft + button.offsetWidth) {
                targetButton = button;
            }
        });
        if (targetButton) {
            quantityButtonsFlor.forEach(btn => btn.classList.remove('active'));
            targetButton.classList.add('active');
            activeQButtonFlor = targetButton;
            updateQPillFlor(targetButton, true);
            applyQuantityFlor(targetButton.getAttribute('data-quantity'));
        } else {
            updateQPillFlor(activeQButtonFlor, true);
        }
        setTimeout(() => {
            qPillFlor.style.transition = 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease';
        }, 300);
    };
    quantityContainerFlor.addEventListener('mousedown', startQDragFlor);
    quantityContainerFlor.addEventListener('touchstart', startQDragFlor, { passive: false });
    // Script para el mini menú de cantidad para joint
    const quantityContainerJoint = document.getElementById('quantity-selector-joint');
    const qPillJoint = document.getElementById('quantity-pill-joint');
    const quantityButtonsJoint = quantityContainerJoint.querySelectorAll('.quantity-btn');
    let activeQButtonJoint = quantityContainerJoint.querySelector('.quantity-btn.active');
    let isQDraggingJoint = false;
    let qStartXJoint, qCurrentXJoint;
    let updateQPillJoint = (button, animate = true) => {
        const setStyles = () => {
            qPillJoint.style.width = `${button.offsetWidth}px`;
            qPillJoint.style.left = `${button.offsetLeft}px`;
        };
        if (!animate) {
            qPillJoint.style.transition = 'none';
            setStyles();
            requestAnimationFrame(() => {
                qPillJoint.style.transition = 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease';
            });
        } else {
            requestAnimationFrame(setStyles);
        }
    };
    updateQPillJoint(activeQButtonJoint, false);
    quantityButtonsJoint.forEach(button => {
        const handlePress = (e) => {
            e.preventDefault();
            quantityButtonsJoint.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activeQButtonJoint = button;
            updateQPillJoint(button);
            applyQuantityJoint(button.getAttribute('data-quantity'));
        };
        button.addEventListener('mousedown', handlePress);
        button.addEventListener('touchstart', handlePress, { passive: false });
    });
    const applyQuantityJoint = (quantity) => {
        const prices = {
            '1': 150,
            '2': 280,
            '3': 380,
            '5': 500
        };
        const images = {
            '1': 'https://i.ibb.co/jPpr7YCr/1pre.png',
            '2': 'https://i.ibb.co/k6MSZg39/2pre.png',
            '3': 'https://i.ibb.co/TBsZ8r3c/3pre.png',
            '5': 'https://i.ibb.co/0Rj8KMmJ/5pre.png'
        };
        document.getElementById('pre-roll-price').textContent = `$${prices[quantity]}`;
        document.getElementById('preroll-image').src = images[quantity];
    };
    applyQuantityJoint(activeQButtonJoint.getAttribute('data-quantity'));
    const startQDragJoint = (e) => {
        const clientX = (e.type === 'touchstart' ? e.touches[0].clientX : e.clientX);
        const rect = quantityContainerJoint.getBoundingClientRect();
        const clickX = clientX - rect.left;
        const pillLeft = parseFloat(qPillJoint.style.left || 0);
        const pillWidth = qPillJoint.offsetWidth;
        if (clickX >= pillLeft && clickX <= pillLeft + pillWidth) {
            initiateQDragJoint(clientX);
            e.preventDefault();
        }
    };
    const initiateQDragJoint = (clientX) => {
        isQDraggingJoint = true;
        quantityContainerJoint.classList.add('dragging-mode');
        qPillJoint.classList.add('dragging');
        qPillJoint.style.transition = 'transform 0.2s ease';

        // Activar efecto WebGL
        if (qPillJointGL) qPillJointGL.activate();

        qStartXJoint = clientX - parseFloat(qPillJoint.style.left || 0);
        document.addEventListener('mousemove', onQDragJoint);
        document.addEventListener('touchmove', onQDragJoint, { passive: false });
        document.addEventListener('mouseup', endQDragJoint);
        document.addEventListener('touchend', endQDragJoint);
    };
    const onQDragJoint = (e) => {
        if (!isQDraggingJoint) return;
        e.preventDefault();
        const clientX = (e.type === 'touchmove' ? e.touches[0].clientX : e.clientX);
        qCurrentXJoint = clientX - qStartXJoint;
        const minLeft = 0;
        const maxLeft = quantityContainerJoint.offsetWidth - qPillJoint.offsetWidth;
        qPillJoint.style.left = `${Math.max(minLeft, Math.min(qCurrentXJoint, maxLeft))}px`;
    };
    const endQDragJoint = (e) => {
        if (!isQDraggingJoint) return;
        isQDraggingJoint = false;
        quantityContainerJoint.classList.remove('dragging-mode');
        qPillJoint.classList.remove('dragging');
        qPillJoint.style.transition = 'left 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), width 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), transform 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55)';

        // Desactivar efecto WebGL
        if (qPillJointGL) qPillJointGL.deactivate();

        document.removeEventListener('mousemove', onQDragJoint);
        document.removeEventListener('touchmove', onQDragJoint);
        document.removeEventListener('mouseup', endQDragJoint);
        document.removeEventListener('touchend', endQDragJoint);
        let targetButton = null;
        const pillCenter = parseFloat(qPillJoint.style.left) + qPillJoint.offsetWidth / 2;
        quantityButtonsJoint.forEach(button => {
            if (pillCenter >= button.offsetLeft && pillCenter < button.offsetLeft + button.offsetWidth) {
                targetButton = button;
            }
        });
        if (targetButton) {
            quantityButtonsJoint.forEach(btn => btn.classList.remove('active'));
            targetButton.classList.add('active');
            activeQButtonJoint = targetButton;
            updateQPillJoint(targetButton, true);
            applyQuantityJoint(targetButton.getAttribute('data-quantity'));
        } else {
            updateQPillJoint(activeQButtonJoint, true);
        }
        setTimeout(() => {
            qPillJoint.style.transition = 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s ease';
        }, 300);
    };
    quantityContainerJoint.addEventListener('mousedown', startQDragJoint);
    quantityContainerJoint.addEventListener('touchstart', startQDragJoint, { passive: false });

    // Inicializar píldoras WebGL después de que los elementos estén listos
    let filterPillGL, qPillFlorGL, qPillJointGL;

    setTimeout(() => {
        const filterPillElement = document.getElementById('filter-pill');
        const filterPillCanvas = document.getElementById('filter-pill-canvas');
        if (filterPillElement && filterPillCanvas) {
            filterPillGL = new GlassPillWebGL('filter-pill-canvas', filterPillElement, [35, 35, 35]);
        }

        const qPillFlorElement = document.getElementById('quantity-pill-flor');
        const qPillFlorCanvas = document.getElementById('quantity-pill-flor-canvas');
        if (qPillFlorElement && qPillFlorCanvas) {
            qPillFlorGL = new GlassPillWebGL('quantity-pill-flor-canvas', qPillFlorElement, [220, 38, 38]);
        }

        const qPillJointElement = document.getElementById('quantity-pill-joint');
        const qPillJointCanvas = document.getElementById('quantity-pill-joint-canvas');
        if (qPillJointElement && qPillJointCanvas) {
            qPillJointGL = new GlassPillWebGL('quantity-pill-joint-canvas', qPillJointElement, [220, 38, 38]);
        }
    }, 100);

    // Actualizar tamaño de canvas cuando cambie el tamaño de las píldoras
    const originalUpdatePill = updatePill;
    updatePill = (button, animate = true) => {
        originalUpdatePill(button, animate);
        setTimeout(() => {
            if (filterPillGL) filterPillGL.updateSize();
        }, 50);
    };

    const originalUpdateQPillFlor = updateQPillFlor;
    updateQPillFlor = (button, animate = true) => {
        originalUpdateQPillFlor(button, animate);
        setTimeout(() => {
            if (qPillFlorGL) qPillFlorGL.updateSize();
        }, 50);
    };

    const originalUpdateQPillJoint = updateQPillJoint;
    updateQPillJoint = (button, animate = true) => {
        originalUpdateQPillJoint(button, animate);
        setTimeout(() => {
            if (qPillJointGL) qPillJointGL.updateSize();
        }, 50);
    };
}

// Logo Drag Interaction
function initLogoDrag() {
    const logo = document.getElementById('logo-interactivo');
    if (!logo) {
        setTimeout(initLogoDrag, 100);
        return;
    }

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let animationId = null;

    // Constantes de física
    const FRICTION = 0.94; // Fricción (desaceleración) - aumentada para menos recorrido
    const GRAVITY = 0.022; // Gravedad hacia la posición original - aumentada para regreso más rápido
    const MAX_VELOCITY = 30; // Velocidad máxima - reducida para menos recorrido
    const RETURN_SPEED = 0.012; // Velocidad de regreso a posición original - solo afecta fase final
    const VELOCITY_MULTIPLIER = 1.3; // Multiplicador de velocidad al soltar - reducido para menos recorrido

    // Prevenir arrastre nativo
    logo.setAttribute('draggable', 'false');
    logo.ondragstart = () => false;
    logo.onselectstart = () => false;
    logo.oncontextmenu = () => false;

    // Obtener coordenadas del evento
    function getCoords(e) {
        if (e.touches && e.touches[0]) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    // Obtener posición actual del logo
    function getCurrentPosition() {
        const header = logo.parentElement;
        const headerRect = header.getBoundingClientRect();
        const rect = logo.getBoundingClientRect();
        const headerCenterX = headerRect.left + headerRect.width / 2;
        const headerCenterY = headerRect.top + headerRect.height / 2;

        return {
            x: rect.left + rect.width / 2 - headerCenterX,
            y: rect.top + rect.height / 2 - headerCenterY
        };
    }

    // Aplicar transformación
    function applyTransform(x, y) {
        logo.style.transform = `translateX(calc(-50% + ${x}px)) translateY(calc(-0.5rem + ${y}px))`;
    }

    // Animación de física
    function animate() {
        // Calcular distancia desde el origen
        const distance = Math.sqrt(currentX * currentX + currentY * currentY);

        // Aplicar fricción
        velocityX *= FRICTION;
        velocityY *= FRICTION;

        // Aplicar amortiguación adicional cuando está cerca del origen para evitar rebotes
        if (distance < 12) {
            // Amortiguación más agresiva cuando está más cerca para eliminar rebote gravitacional
            const dampingFactor = 0.80 + (distance / 12) * 0.12; // Más amortiguación cuando está más cerca
            velocityX *= dampingFactor;
            velocityY *= dampingFactor;
        }

        // Aplicar gravedad hacia la posición original (0, 0)
        // Reducir gravedad cuando está cerca para evitar rebotes gravitacionales
        let effectiveGravity = GRAVITY;
        if (distance < 20) {
            // Gravedad cuadrática suave que se reduce mucho cuando está cerca
            const factor = Math.pow(distance / 20, 1.5);
            effectiveGravity = GRAVITY * factor;
        }

        // Solo aplicar gravedad si se está moviendo hacia el origen o está casi quieto
        // Esto previene rebote gravitacional
        const directionToOriginX = -currentX;
        const directionToOriginY = -currentY;
        const dotProduct = velocityX * directionToOriginX + velocityY * directionToOriginY;

        // Si se está moviendo hacia el origen o está casi quieto, aplicar gravedad
        if (dotProduct >= 0 || distance < 8) {
            const gravityX = directionToOriginX * effectiveGravity;
            const gravityY = directionToOriginY * effectiveGravity;

            velocityX += gravityX;
            velocityY += gravityY;
        }

        // Limitar velocidad máxima
        const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        if (speed > MAX_VELOCITY) {
            velocityX = (velocityX / speed) * MAX_VELOCITY;
            velocityY = (velocityY / speed) * MAX_VELOCITY;
        }

        // Actualizar posición
        currentX += velocityX;
        currentY += velocityY;

        // Si está muy cerca del origen y la velocidad es baja, detener completamente sin rebote
        if (distance < 3 && speed < 0.4) {
            currentX = 0;
            currentY = 0;
            velocityX = 0;
            velocityY = 0;
            cancelAnimationFrame(animationId);
            animationId = null;
            logo.style.transition = 'transform 0.6s ease-out';
            applyTransform(0, 0);
            return;
        }

        // Si la velocidad es muy baja, regresar suavemente a la posición original
        if (Math.abs(velocityX) < 0.015 && Math.abs(velocityY) < 0.015) {
            if (distance > 0.8) {
                // Regresar gradualmente con suavidad muy lenta, sin rebote
                currentX *= (1 - RETURN_SPEED);
                currentY *= (1 - RETURN_SPEED);
            } else {
                // Ya está muy cerca, detener completamente sin rebote
                currentX = 0;
                currentY = 0;
                velocityX = 0;
                velocityY = 0;
                cancelAnimationFrame(animationId);
                animationId = null;
                logo.style.transition = 'transform 0.6s ease-out';
                applyTransform(0, 0);
                return;
            }
        }

        // Aplicar transformación
        applyTransform(currentX, currentY);

        // Continuar animación
        animationId = requestAnimationFrame(animate);
    }

    // Iniciar arrastre
    function onStart(e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        // Detener animación inicial si está corriendo
        if (initialAnimationId) {
            cancelAnimationFrame(initialAnimationId);
            initialAnimationId = null;
            logo.style.pointerEvents = 'auto'; // Rehabilitar interacción
        }

        // Detener animación física si está corriendo
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        dragging = true;
        logo.style.cursor = 'grabbing';
        logo.style.transition = 'none';

        const coords = getCoords(e);
        const rect = logo.getBoundingClientRect();
        const header = logo.parentElement;
        const headerRect = header.getBoundingClientRect();

        // Obtener posición actual
        const pos = getCurrentPosition();
        currentX = pos.x;
        currentY = pos.y;

        // Resetear velocidad
        velocityX = 0;
        velocityY = 0;
        lastX = coords.x;
        lastY = coords.y;
        lastTime = Date.now();

        // Offset del click/touch desde el centro
        startX = coords.x - (rect.left + rect.width / 2);
        startY = coords.y - (rect.top + rect.height / 2);

        // Agregar listeners
        document.addEventListener('mousemove', onMove, { passive: false, capture: true });
        document.addEventListener('touchmove', onMove, { passive: false, capture: true });
        document.addEventListener('mouseup', onEnd, { capture: true });
        document.addEventListener('touchend', onEnd, { capture: true });
        // No usar mouseleave para evitar que se suelte accidentalmente

        return false;
    }

    // Mover durante arrastre
    function onMove(e) {
        if (!dragging) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const coords = getCoords(e);
        const header = logo.parentElement;
        const headerRect = header.getBoundingClientRect();

        // Calcular nueva posición del centro
        const newCenterX = coords.x - startX;
        const newCenterY = coords.y - startY;

        // Calcular delta desde posición original
        const headerCenterX = headerRect.left + headerRect.width / 2;
        const headerCenterY = headerRect.top + headerRect.height / 2;

        currentX = newCenterX - headerCenterX;
        currentY = newCenterY - headerCenterY;

        // Calcular velocidad basada en el movimiento
        const now = Date.now();
        const deltaTime = Math.max(1, now - lastTime);
        const deltaX = coords.x - lastX;
        const deltaY = coords.y - lastY;

        // Velocidad en píxeles por milisegundo, convertida a píxeles por frame (60fps)
        velocityX = (deltaX / deltaTime) * 16.67;
        velocityY = (deltaY / deltaTime) * 16.67;

        lastX = coords.x;
        lastY = coords.y;
        lastTime = now;

        // Aplicar transform
        applyTransform(currentX, currentY);

        return false;
    }

    // Finalizar arrastre
    function onEnd(e) {
        if (!dragging) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        dragging = false;
        logo.style.cursor = 'grab';
        logo.style.transition = 'none';

        // Aplicar multiplicador de velocidad para más recorrido
        velocityX *= VELOCITY_MULTIPLIER;
        velocityY *= VELOCITY_MULTIPLIER;

        // Remover listeners
        document.removeEventListener('mousemove', onMove, { capture: true });
        document.removeEventListener('touchmove', onMove, { capture: true });
        document.removeEventListener('mouseup', onEnd, { capture: true });
        document.removeEventListener('touchend', onEnd, { capture: true });

        // Iniciar animación de física
        if (!animationId) {
            animationId = requestAnimationFrame(animate);
        }

        return false;
    }

    // Agregar listeners iniciales
    logo.addEventListener('mousedown', onStart, { passive: false, capture: true });
    logo.addEventListener('touchstart', onStart, { passive: false, capture: true });

    // ============================================
    // ANIMACIÓN INICIAL - MOVIMIENTO EN FORMA DE INFINITO
    // ============================================
    let initialAnimationId = null;
    let initialAnimationStartTime = null;
    const INITIAL_ANIMATION_DURATION = 20000; // 20 segundos (15s infinito + 5s desaceleración)
    const INFINITY_AMPLITUDE_X = 80; // Amplitud horizontal del infinito
    const INFINITY_AMPLITUDE_Y = 30; // Amplitud vertical del infinito
    const VERTICAL_AMPLITUDE = 15; // Amplitud del movimiento vertical adicional

    function startInitialAnimation() {
        initialAnimationStartTime = Date.now();
        logo.style.transition = 'none';
        // Mantener interacción habilitada para poder interrumpir la animación

        function animateInfinity() {
            const elapsed = Date.now() - initialAnimationStartTime;
            const progress = elapsed / INITIAL_ANIMATION_DURATION;

            if (progress >= 1) {
                // Animación terminada, regresar a posición original de forma muy suave y elegante
                currentX = 0;
                currentY = 0;
                velocityX = 0;
                velocityY = 0;
                logo.style.transition = 'transform 4.5s cubic-bezier(0.4, 0.0, 0.2, 1)';
                applyTransform(0, 0);
                logo.style.pointerEvents = 'auto'; // Rehabilitar interacción
                initialAnimationId = null;
                return;
            }

            // Desaceleración gradual en los últimos 5 segundos (progress > 0.75)
            let decelerationFactor = 1.0;
            if (progress > 0.75) {
                // Calcular factor de desaceleración de 1.0 a 0.0 en los últimos 5 segundos
                const decelerationProgress = (progress - 0.75) / 0.25; // 0.0 a 1.0 en los últimos 5 segundos
                // Curva suave de desaceleración (ease-out)
                decelerationFactor = 1 - Math.pow(decelerationProgress, 2);
            }

            // Movimiento en forma de infinito (∞)
            // x(t) = sin(t) para el movimiento horizontal
            // y(t) = sin(2*t) / 2 para crear la forma de infinito
            const t = progress * Math.PI * 6; // 3 ciclos completos del infinito en 15 segundos
            const infinityX = Math.sin(t) * INFINITY_AMPLITUDE_X;
            const infinityY = (Math.sin(2 * t) / 2) * INFINITY_AMPLITUDE_Y;

            // Movimiento vertical adicional (ligero)
            const verticalY = Math.sin(t * 1.5) * VERTICAL_AMPLITUDE;

            // Aplicar factor de desaceleración al movimiento
            const finalX = infinityX * decelerationFactor;
            const finalY = (infinityY + verticalY) * decelerationFactor;

            applyTransform(finalX, finalY);

            initialAnimationId = requestAnimationFrame(animateInfinity);
        }

        initialAnimationId = requestAnimationFrame(animateInfinity);
    }

    // Iniciar animación después de un pequeño delay para asegurar que el logo esté visible
    setTimeout(() => {
        startInitialAnimation();
    }, 300);
}

// La Nave Text Effect
function initLaNaveTextEffect() {
    const laNaveText = document.getElementById('la-nave-text');
    const contentOverlay = document.getElementById('content-overlay');

    if (!laNaveText || !contentOverlay) return;

    // Función para ajustar el tamaño del texto para que ocupe TODO el ancho disponible
    const adjustTextSize = () => {
        // Obtener el ancho completo de la ventana
        const computedStyle = getComputedStyle(laNaveText);
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
        const availableWidth = window.innerWidth - paddingLeft - paddingRight;

        // Obtener el letter-spacing en em
        const letterSpacingEm = parseFloat(computedStyle.letterSpacing) || 0;

        // Crear elemento temporal para medir con los mismos estilos exactos
        const measureElement = document.createElement('span');
        measureElement.style.visibility = 'hidden';
        measureElement.style.position = 'absolute';
        measureElement.style.top = '-9999px';
        measureElement.style.left = '-9999px';
        measureElement.style.whiteSpace = 'nowrap';
        measureElement.style.fontFamily = computedStyle.fontFamily;
        measureElement.style.fontWeight = computedStyle.fontWeight;
        measureElement.style.fontSize = '100px'; // Tamaño base para medir
        measureElement.textContent = 'LA NAVE';
        document.body.appendChild(measureElement);

        // Obtener el ancho del texto con tamaño base de 100px
        const baseWidth = measureElement.offsetWidth;
        const baseFontSize = 100;

        // Calcular el tamaño de fuente necesario usando proporción directa
        let fontSize = (availableWidth / baseWidth) * baseFontSize;

        // Aplicar el tamaño calculado y verificar
        measureElement.style.fontSize = fontSize + 'px';
        measureElement.style.letterSpacing = (fontSize * letterSpacingEm) + 'px';

        // Forzar reflow
        void measureElement.offsetWidth;

        let actualWidth = measureElement.offsetWidth;

        // Ajustar finamente usando búsqueda binaria
        let minFontSize = 10;
        let maxFontSize = fontSize * 2; // Empezar con un rango razonable
        let bestFontSize = fontSize;
        const tolerance = 0.01;

        // Si el texto se sale, reducir el rango máximo
        if (actualWidth > availableWidth) {
            maxFontSize = fontSize;
            minFontSize = fontSize * 0.5;
        } else {
            // Si el texto cabe, podemos aumentar
            minFontSize = fontSize;
            maxFontSize = fontSize * 2;
        }

        // Búsqueda binaria iterativa para encontrar el tamaño exacto
        for (let i = 0; i < 200; i++) {
            const testFontSize = (minFontSize + maxFontSize) / 2;
            measureElement.style.fontSize = testFontSize + 'px';
            measureElement.style.letterSpacing = (testFontSize * letterSpacingEm) + 'px';

            // Forzar reflow
            void measureElement.offsetWidth;

            const textWidth = measureElement.offsetWidth;

            if (textWidth <= availableWidth) {
                // El texto cabe, podemos intentar un tamaño mayor
                bestFontSize = testFontSize;
                minFontSize = testFontSize;
            } else {
                // El texto se sale, necesitamos un tamaño menor
                maxFontSize = testFontSize;
            }

            // Si la diferencia es muy pequeña, salir
            if (maxFontSize - minFontSize < tolerance) {
                break;
            }
        }

        // Aplicar el tamaño encontrado - hacer el texto más grande pero siempre dentro de la ventana
        const width = window.innerWidth;
        let safetyMargin;
        if (width <= 768) {
            safetyMargin = 0.90; // Móvil - más grande
        } else if (width <= 1024) {
            safetyMargin = 0.86; // Tabletas
        } else {
            safetyMargin = 0.97; // Escritorio - máximo tamaño para abarcar todo el ancho de la ventana
        }
        laNaveText.style.fontSize = (bestFontSize * safetyMargin) + 'px';

        // Asegurar que el texto nunca se salga usando max-width y overflow
        laNaveText.style.maxWidth = '100vw';
        laNaveText.style.overflow = 'hidden';

        // Limpiar
        document.body.removeChild(measureElement);
    };

    // Ajustar el tamaño inicial
    adjustTextSize();

    // Ajustar el tamaño cuando cambia el tamaño de la ventana (optimizado con RAF)
    let resizeRaf = null;
    window.addEventListener('resize', () => {
        if (resizeRaf) return;
        resizeRaf = requestAnimationFrame(() => {
            resizeRaf = null;
            adjustTextSize();
        });
    });

    let ticking = false;

    const handleScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                // Obtener posición del texto "LA NAVE" (fixed, siempre en la parte superior)
                const laNaveRect = laNaveText.getBoundingClientRect();
                const textTop = laNaveRect.top;
                const textBottom = laNaveRect.bottom;
                const textHeight = textBottom - textTop;

                // Obtener posición de todo el content-overlay
                const overlayRect = contentOverlay.getBoundingClientRect();
                const overlayTop = overlayRect.top; // Parte superior del overlay
                const overlayBottom = overlayRect.bottom; // Parte inferior del overlay

                // Solo aplicar efecto cuando el contenido está realmente pasando por encima del texto
                if (overlayTop < textBottom && overlayBottom > textTop) {
                    // El contenido está pasando por encima del texto
                    const distanceFromBottom = textBottom - overlayTop;
                    const squashFactor = Math.min(1, Math.max(0, distanceFromBottom / textHeight));
                    const clipBottom = squashFactor * 100;

                    // Opacidad
                    let opacity = 1;
                    if (squashFactor > 0.7) {
                        opacity = 1 - ((squashFactor - 0.7) / 0.3); // De 1 a 0 en el último 30%
                    }

                    laNaveText.style.clipPath = `inset(0 0 ${clipBottom}% 0)`;
                    laNaveText.style.transform = 'none';
                    laNaveText.style.opacity = opacity;
                } else {
                    // El contenido no está pasando por encima, mantener estado normal
                    laNaveText.style.clipPath = 'inset(0 0 0% 0)';
                    laNaveText.style.transform = 'none';
                    laNaveText.style.opacity = '1';
                }

                ticking = false;
            });

            ticking = true;
        }
    };

    // Escuchar eventos de scroll
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Ejecutar una vez al cargar para establecer el estado inicial
    handleScroll();
}

// Final Image Effect
function initFinalImageEffect() {
    const finalSection = document.getElementById('final-image-section');
    if (!finalSection) return;

    const finalImage = finalSection.querySelector('img');
    if (!finalImage) return;

    let maxHeight = 0;
    const minHeight = 50; // Altura inicial muy comprimida
    let scrollRaf = null;
    let resizeRaf = null;

    const updateHeight = () => {
        if (!maxHeight) return;

        const rect = finalSection.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        const availableHeight = viewportHeight - rect.top;
        const targetHeight = Math.max(minHeight, Math.min(maxHeight, availableHeight));

        finalSection.style.height = `${targetHeight}px`;
    };

    const updateDimensions = () => {
        if (!finalImage.naturalWidth || !finalImage.naturalHeight) return;
        const width = finalSection.clientWidth || window.innerWidth;

        // Calcular altura natural basada en el aspect ratio
        maxHeight = width * (finalImage.naturalHeight / finalImage.naturalWidth);

        updateHeight();
    };

    const handleScroll = () => {
        if (scrollRaf) return;
        scrollRaf = window.requestAnimationFrame(() => {
            scrollRaf = null;
            updateHeight();
        });
    };

    const handleResize = () => {
        if (resizeRaf) {
            window.cancelAnimationFrame(resizeRaf);
        }
        resizeRaf = window.requestAnimationFrame(() => {
            resizeRaf = null;
            updateDimensions();
        });
    };

    if (finalImage.complete) {
        updateDimensions();
    } else {
        finalImage.addEventListener('load', updateDimensions);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Ajuste inicial
    updateDimensions();
}

// Initialization Logic
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('loaded');
        initIntroVideo();

        if (window.requestIdleCallback) {
            requestIdleCallback(() => {
                initFiltersAndWebGL();
                initLogoDrag();
                initLaNaveTextEffect();
                initFinalImageEffect();
            }, { timeout: 2000 });
        } else {
            setTimeout(() => {
                initFiltersAndWebGL();
                initLogoDrag();
                initLaNaveTextEffect();
                initFinalImageEffect();
            }, 100);
        }
    });
} else {
    document.body.classList.add('loaded');
    initIntroVideo();

    if (window.requestIdleCallback) {
        requestIdleCallback(() => {
            initFiltersAndWebGL();
            initLogoDrag();
            initLaNaveTextEffect();
            initFinalImageEffect();
        }, { timeout: 2000 });
    } else {
        setTimeout(() => {
            initFiltersAndWebGL();
            initLogoDrag();
            initLaNaveTextEffect();
            initFinalImageEffect();
        }, 100);
    }
}

