let tracker;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      importScripts('/mediapipe/vision_bundle.js');
      const files = await Vision.FilesetResolver.forVisionTasks('/mediapipe/wasm');
      tracker = await Vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate: 'CPU' }, runningMode: 'VIDEO', numFaces: 2, outputFaceBlendshapes: true });
      self.postMessage({ type: 'ready' });
    } else if (data.bitmap) {
      try {
        const result = tracker.detectForVideo(data.bitmap, data.time);
        self.postMessage({ type: 'result', landmarks: result.faceLandmarks, blendshapes: result.faceBlendshapes });
      } finally { data.bitmap.close(); }
    }
  } catch { self.postMessage({ type: 'error' }); }
};
