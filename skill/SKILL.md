---
name: gesture-exorcism
description: Build browser apps controlled by webcam hand gestures and air-drawn shapes, using MediaPipe landmarks, the $1 recognizer and Gemma 4 snapshot reactions.
---

# Gesture and shape input for browser apps

Use this when you want a web page controlled by hand gestures from a webcam, with no server. It covers pointer mapping, pinch detection, gesture debouncing, air-drawn shape recognition and using a multimodal model on snapshots. The reference implementation is the Haunted Files repo (`js/input.js`, `js/shapes.js`, `js/gemma.js`).

## Tracking setup

- Load `@mediapipe/tasks-vision@0.10.14` from jsDelivr as an ES module. Create a `GestureRecognizer` (`numHands: 1`, `runningMode: "VIDEO"`) and optionally a `FaceLandmarker` (`outputFaceBlendshapes: true`).
- Try `delegate: "GPU"` first and retry with `"CPU"` if creation throws.
- Run detection in its own `requestAnimationFrame` loop, and only when `video.currentTime` changes. Run the face task every second frame.
- Mirror coordinates once (`x = 1 - x`) and mirror the preview `<video>` with CSS, so on-screen motion matches the user's hand.

## Pointer

- The pointer is the midpoint of the thumb tip (4) and the index tip (8). It stays steady both while pointing and while pinching.
- Map the central 70% of the frame to the screen: `sx = clamp((x - 0.15) / 0.7, 0, 1) * innerWidth`.
- Smooth every render frame: `p += (target - p) * (1 - exp(-dt * 18))`.
- Velocity: exponential smoothing with tau of about 80 ms.

## Gestures

| Gesture | Rule |
|---|---|
| Pinch | `ratio = dist(4, 8) / dist(0, 9)`. On below 0.25, off above 0.40 (hysteresis). Overrides every other label. |
| Pointing | Index extended (`d(8, wrist) > 1.1 * d(6, wrist)`) and middle, ring and pinky curled (`d(tip, wrist) < 1.05 * d(pip, wrist)`). This is more reliable than the model's `Pointing_Up` when the finger points sideways. |
| Model labels | Use `Open_Palm`, `Closed_Fist` and `Thumb_Up` when the score is above 0.6. |
| Debounce | A label must hold for 3 consecutive detections before it counts. |
| Hand lost | No hand for 400 ms switches to mouse fallback. |
| Mouth open | Face blendshape `jawOpen > 0.5`. |

Use dwell for "click-like" actions: fire once when the same gesture stays on the same target for 600 ms, and reset the timer when the target changes. Always ship a mouse fallback (left button = pinch, right button = draw, keys for the other gestures) for testing and demos.

## Air-drawn shapes

- Capture the index fingertip (landmark 8) while the gesture is "pointing". End the stroke when the gesture changes or after 3 s. Discard strokes under 15 points or 80 px.
- Recognize with the $1 Unistroke Recognizer: resample to 64 points, rotate to the indicative angle, scale to a 250 px box, translate to the origin, then golden-section search over ±45°. The score is `1 - d / (0.5 * sqrt(2 * 250²))`.
- Scale 1D strokes (min/max side under 0.3) uniformly, or lines break the recognizer.
- Register reversed and mirrored variants of each template so either drawing direction works. Add a 3-stroke and a 4-stroke zigzag as alternates.
- A match threshold of 0.78 separates real shapes from scribbles well. Add a debug view that prints the scores before you tune it.

## Multimodal model on snapshots

- Never call the model per frame. Call it at events, with a mirrored 384x288 JPEG at quality 0.7.
- Gemini API: `POST /v1beta/models/{model}:generateContent?key=KEY` with `contents[0].parts = [{text}, {inline_data: {mime_type: "image/jpeg", data}}]`. Put every instruction in the user text, because Gemma models may reject `system_instruction`.
- Skip response parts where `thought === true`. Ask for a fixed format (`NAME: ...` / `TAUNT: ...`) and parse it with a regex, falling back per field.
- Find model IDs with `GET /v1beta/models` instead of hardcoding them.
- Run one request at a time with a queue of 3 and a 10 s timeout. Keep canned fallback lines, and never block the game on the model.
