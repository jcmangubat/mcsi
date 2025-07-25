const displacementSlider = function (opts) {
  let vertex = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `;

  let fragment = `
  varying vec2 vUv;

  uniform sampler2D currentImage;
  uniform sampler2D nextImage;
  uniform float dispFactor;
  uniform vec2 direction;

  const float smoothness = 0.5;
  const vec2 center = vec2(0.5, 0.5);

  vec4 getFromColor(vec2 uv) {
    return texture2D(currentImage, uv);
  }

  vec4 getToColor(vec2 uv) {
    return texture2D(nextImage, uv);
  }

  vec4 transition(vec2 uv) {
    vec2 v = normalize(direction);
    v /= abs(v.x) + abs(v.y);
    float d = v.x * center.x + v.y * center.y;
    float m = 1.0 - smoothstep(
      -smoothness,
      0.0,
      v.x * uv.x + v.y * uv.y - (d - 0.5 + dispFactor * (1.0 + smoothness))
    );
    return mix(
      getFromColor((uv - 0.5) * (1.0 - m) + 0.5),
      getToColor((uv - 0.5) * m + 0.5),
      m
    );
  }

  void main() {
    gl_FragColor = transition(vUv);
  }
`;

  let images = opts.images,
    image,
    sliderImages = [];
  let canvasWidth = images[0].clientWidth;
  let canvasHeight = images[0].clientHeight;
  let parent = opts.parent;
  let renderWidth = Math.max(
    document.documentElement.clientWidth,
    window.innerWidth || 0
  );
  let renderHeight = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight || 0
  );

  let renderW, renderH;

  if (renderWidth > canvasWidth) {
    renderW = renderWidth;
  } else {
    renderW = canvasWidth;
  }

  renderH = canvasHeight;

  let renderer = new THREE.WebGLRenderer({
    antialias: false,
  });

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x23272a, 1.0);
  renderer.setSize(renderW, renderH);
  parent.appendChild(renderer.domElement);

  let loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";

  images.forEach((img) => {
    image = loader.load(img.getAttribute("src") + "?v=" + Date.now());
    image.magFilter = image.minFilter = THREE.LinearFilter;
    image.anisotropy = renderer.capabilities.getMaxAnisotropy();
    sliderImages.push(image);
  });

  let scene = new THREE.Scene();
  scene.background = new THREE.Color(0x23272a);
  let camera = new THREE.OrthographicCamera(
    renderWidth / -2,
    renderWidth / 2,
    renderHeight / 2,
    renderHeight / -2,
    1,
    1000
  );

  camera.position.z = 1;

  let mat = new THREE.ShaderMaterial({
    uniforms: {
      dispFactor: { type: "f", value: 0.0 },
      currentImage: { type: "t", value: sliderImages[0] },
      nextImage: { type: "t", value: sliderImages[1] },
      direction: { type: "v2", value: new THREE.Vector2(1.0, 1.0) },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    opacity: 1.0,
  });

  let geometry = new THREE.PlaneBufferGeometry(
    parent.offsetWidth,
    parent.offsetHeight,
    1
  );
  let object = new THREE.Mesh(geometry, mat);
  object.position.set(0, 0, 0);
  scene.add(object);

  let addEvents = function () {
    let pagButtons = Array.from(
      document.getElementById("pagination").querySelectorAll("button")
    );

    pagButtons.forEach((el) => {
      el.addEventListener("click", function () {
        if (!isAnimating) {
          isAnimating = true;

          document
            .getElementById("pagination")
            .querySelectorAll(".active")[0].className = "";
          this.className = "active";

          let slideId = parseInt(this.dataset.slide, 10);

          mat.uniforms.nextImage.value = sliderImages[slideId];
          mat.uniforms.nextImage.needsUpdate = true;

          TweenLite.to(mat.uniforms.dispFactor, 3.5, {
            value: 1,
            ease: "Expo.easeInOut",
            onComplete: function () {
              mat.uniforms.currentImage.value = sliderImages[slideId];
              mat.uniforms.currentImage.needsUpdate = true;
              mat.uniforms.dispFactor.value = 0.0;
              isAnimating = false;
            },
          });

          let slideTitleEl = document.getElementById("slide-title");
          let slideStatusEl = document.getElementById("slide-status");
          let nextSlideTitle = document.querySelectorAll(
            `[data-slide-title="${slideId}"]`
          )[0].innerHTML;
          let nextSlideStatus = document.querySelectorAll(
            `[data-slide-status="${slideId}"]`
          )[0].innerHTML;

          TweenLite.fromTo(
            slideTitleEl,
            2,
            {
              autoAlpha: 1,
              y: 0,
            },
            {
              autoAlpha: 0,
              y: 20,
              ease: "Expo.easeIn",
              onComplete: function () {
                slideTitleEl.innerHTML = nextSlideTitle;

                TweenLite.to(slideTitleEl, 0.5, {
                  autoAlpha: 1,
                  y: 0,
                });
              },
            }
          );

          TweenLite.fromTo(
            slideStatusEl,
            2,
            {
              autoAlpha: 1,
              y: 0,
            },
            {
              autoAlpha: 0,
              y: 20,
              ease: "Expo.easeIn",
              onComplete: function () {
                slideStatusEl.innerHTML = nextSlideStatus;

                TweenLite.to(slideStatusEl, 0.5, {
                  autoAlpha: 1,
                  y: 0,
                  delay: 0.1,
                });
              },
            }
          );
        }
      });
    });
  };

  addEvents();

  let currentIndex = 0;
  const totalSlides = sliderImages.length;
  const pagContainer = document.getElementById("pagination");
  let autoplayInterval;
  let isHovering = false;
  let isAnimating = false; // You can move this here from the previous declaration

  const goToSlide = (index) => {
    if (!isAnimating && index !== currentIndex) {
      isAnimating = true;

      let buttons = Array.from(pagContainer.querySelectorAll("button"));
      buttons.forEach((btn) => btn.classList.remove("active"));
      buttons[index].classList.add("active");

      mat.uniforms.nextImage.value = sliderImages[index];
      mat.uniforms.nextImage.needsUpdate = true;

      TweenLite.to(mat.uniforms.dispFactor, 7, {
        value: 1,
        ease: "Expo.easeInOut",
        onComplete: function () {
          mat.uniforms.currentImage.value = sliderImages[index];
          mat.uniforms.currentImage.needsUpdate = true;
          mat.uniforms.dispFactor.value = 0.0;
          isAnimating = false;
          currentIndex = index;
        },
      });

      let slideTitleEl = document.getElementById("slide-title");
      let slideStatusEl = document.getElementById("slide-status");
      let nextSlideTitle = document.querySelectorAll(
        `[data-slide-title="${index}"]`
      )[0].innerHTML;
      let nextSlideStatus = document.querySelectorAll(
        `[data-slide-status="${index}"]`
      )[0].innerHTML;

      TweenLite.fromTo(
        slideTitleEl,
        2.5,
        { autoAlpha: 1, y: 0 },
        {
          autoAlpha: 0,
          y: 20,
          ease: "Expo.easeIn",
          onComplete: function () {
            slideTitleEl.innerHTML = nextSlideTitle;
            TweenLite.to(slideTitleEl, 0.5, { autoAlpha: 1, y: 0 });
          },
        }
      );

      TweenLite.fromTo(
        slideStatusEl,
        2.5,
        { autoAlpha: 1, y: 0 },
        {
          autoAlpha: 0,
          y: 20,
          ease: "Expo.easeIn",
          onComplete: function () {
            slideStatusEl.innerHTML = nextSlideStatus;
            TweenLite.to(slideStatusEl, 0.5, {
              autoAlpha: 1,
              y: 0,
              delay: 0.1,
            });
          },
        }
      );
    }
  };

  const startAutoplay = () => {
    autoplayInterval = setInterval(() => {
      if (!isHovering && !isAnimating) {
        const nextIndex = (currentIndex + 1) % totalSlides;
        goToSlide(nextIndex);
      }
    }, 5000);
  };

  const stopAutoplay = () => clearInterval(autoplayInterval);

  pagContainer.addEventListener("mouseenter", () => {
    isHovering = true;
    stopAutoplay();
  });

  pagContainer.addEventListener("mouseleave", () => {
    isHovering = false;
    startAutoplay();
  });

  startAutoplay();

  window.addEventListener("resize", function (e) {
    renderer.setSize(renderW, renderH);
  });

  window.addEventListener("resize", function (e) {
    renderer.setSize(renderW, renderH);
  });

  let animate = function () {
    requestAnimationFrame(animate);

    renderer.render(scene, camera);
  };
  animate();
};

// imagesLoaded(document.querySelectorAll("img"), () => {
//   document.body.classList.remove("loading");

//   const el = document.getElementById("slider");
//   const imgs = Array.from(el.querySelectorAll("img"));
//   new displacementSlider({
//     parent: el,
//     images: imgs,
//   });
// });
