// MediaPipe setup and the raw detection loop. Coordinates are mirrored (x = 1 - x).
const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const GESTURE_MODEL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const HAND_LINKS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

async function createTask(Task, files, options) {
  try {
    return await Task.createFromOptions(files, { ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' } });
  } catch (err) {
    console.warn('GPU delegate failed, retrying on CPU', err);
    return Task.createFromOptions(files, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
  }
}

export class Tracker {
  constructor(video, canvas) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hand = { present: false, ts: 0, landmarks: null, label: 'None', score: 0 };
    this.face = { present: false, ts: 0, jawOpen: 0, browUp: 0, landmarks: null };
    this.running = false;
    this.frame = 0;
    this.lastVideoTime = -1;
    this.fps = 0;
    this._fpsCount = 0;
    this._fpsStart = performance.now();
  }

  async start(onProgress = () => {}) {
    onProgress('Opening the camera...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' }, audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();

    onProgress('Loading hand magic...');
    const vision = await import(`${CDN}/vision_bundle.mjs`);
    const files = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    this.gesture = await createTask(vision.GestureRecognizer, files, {
      baseOptions: { modelAssetPath: GESTURE_MODEL }, runningMode: 'VIDEO', numHands: 1,
    });

    onProgress('Loading face magic...');
    try {
      this.faceTask = await createTask(vision.FaceLandmarker, files, {
        baseOptions: { modelAssetPath: FACE_MODEL }, runningMode: 'VIDEO',
        numFaces: 1, outputFaceBlendshapes: true,
      });
    } catch (err) {
      console.warn('Face landmarker failed to load, continuing without face tracking', err);
    }

    this.running = true;
    requestAnimationFrame(this.loop);
  }

  loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const v = this.video;
    if (v.readyState < 2 || v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;
    const now = performance.now();

    const res = this.gesture.recognizeForVideo(v, now);
    if (res.landmarks?.length) {
      const top = res.gestures?.[0]?.[0];
      this.hand = {
        present: true, ts: now,
        landmarks: res.landmarks[0].map(p => ({ x: 1 - p.x, y: p.y, z: p.z })),
        label: top?.categoryName || 'None', score: top?.score || 0,
      };
    } else {
      this.hand.present = false;
    }

    if (this.faceTask && this.frame++ % 3 === 0) {
      const f = this.faceTask.detectForVideo(v, now);
      const shapes = f.faceBlendshapes?.[0]?.categories;
      if (shapes && f.faceLandmarks?.[0]) {
        const get = name => shapes.find(c => c.categoryName === name)?.score || 0;
        this.face = {
          present: true, ts: now, jawOpen: get('jawOpen'), browUp: get('browInnerUp'),
          landmarks: f.faceLandmarks[0].map(p => ({ x: 1 - p.x, y: p.y })),
        };
      } else {
        this.face.present = false;
      }
    }

    this._fpsCount++;
    if (now - this._fpsStart > 1000) {
      this.fps = this._fpsCount * 1000 / (now - this._fpsStart);
      this._fpsCount = 0;
      this._fpsStart = now;
    }
    this.draw();
  };

  // Landmarks are already mirrored, so they line up with the CSS-mirrored video.
  draw() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (this.face.present && this.face.landmarks) {
      ctx.fillStyle = 'rgba(180, 140, 255, 0.6)';
      const lm = this.face.landmarks;
      for (let i = 0; i < lm.length; i += 9) ctx.fillRect(lm[i].x * W - 1, lm[i].y * H - 1, 2, 2);
      const m = lm[13];
      ctx.strokeStyle = this.face.jawOpen > 0.5 ? '#6dff6d' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x * W, m.y * H, 10 + this.face.jawOpen * 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (this.hand.present) {
      const lm = this.hand.landmarks;
      ctx.strokeStyle = '#ff8a2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (const [a, b] of HAND_LINKS) {
        ctx.moveTo(lm[a].x * W, lm[a].y * H);
        ctx.lineTo(lm[b].x * W, lm[b].y * H);
      }
      ctx.stroke();
      ctx.fillStyle = '#fff';
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
