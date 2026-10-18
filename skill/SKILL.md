---
name: gesture-exorcism
description: Build browser apps controlled by webcam hand gestures (pinch-drag, palm dwell, held thumbs up), using MediaPipe landmarks and Gemma 4 snapshot reactions.
---

# Gesture input for browser apps

Use this when you want a web page controlled by hand gestures from a webcam, with no server. It covers pointer mapping, pinch detection, gesture debouncing, hold-to-confirm gestures and using a multimodal model on snapshots. The reference implementation is the Haunted Files repo (`js/input.js`, `js/main.js`, `js/gemma.js`).

## Tracking setup

- Load `@mediapipe/tasks-vision@0.10.14` from jsDelivr as an ES module. Create a `GestureRecognizer` (`numHands: 1`, `runningMode: "VIDEO"`) and optionally a `FaceLandmarker` (`outputFaceBlendshapes: true`).
- Try `delegate: "GPU"` first and retry with `"CPU"` if creation throws.
- Run detection in its own `requestAnimationFrame` loop, and only when `video.currentTime` changes. Run the face task every third frame to keep the frame rate up.
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
| Horns | Index and pinky extended, middle and ring curled, or the model's `ILoveYou` label. |
| Pointing | Index extended (`d(8, wrist) > 1.1 * d(6, wrist)`) and middle, ring and pinky curled (`d(tip, wrist) < 1.05 * d(pip, wrist)`). This is more reliable than the model's `Pointing_Up` when the finger points sideways. |
| Model labels | Use `Open_Palm`, `Thumb_Up` and `Victory` when the score is above 0.6. |
| Debounce | A label must hold for 3 consecutive detections before it counts. |
| Hand lost | No hand for 400 ms switches to mouse fallback. |
| Mouth open | Face blendshape `jawOpen > 0.5`. |

Use dwell for "click-like" actions: fire once when the same gesture stays on the same target for 600 ms, and reset the timer when the target changes. Always ship a mouse fallback (left button = pinch, keys for the other gestures) for testing and demos.

## Hold-to-confirm gestures

- Big actions (next level, pause) fire when a model label is held: thumbs up for 1 s, peace sign for 1.2 s. Show the fill as a ring around the cursor and on the prompt itself.
- Measure the hold from whichever is later: when the gesture started, or when the prompt appeared. Otherwise a thumb that was already up skips the screen.
- Fire once per hold. Reset when the label changes.
- Chains of held signs (fist, point, palm, horns) work well as "spells": lock each sign after 400 ms, allow 2.5 s to the next one, and break the chain only when a wrong sign is held for the full lock time. Read the chain backwards for a second spell.
- Block a pinch from starting while the index and middle tips are folded into the palm, or a fist can register as a pinch.
- Free-hand drawing in the air felt laggy and imprecise in testing. Pinch-drag plus held poses was much easier for first-time players.

## Multimodal model on snapshots

- Never call the model per frame. Call it at events, with a mirrored 384x288 JPEG at quality 0.7.
- Gemini API: `POST /v1beta/models/{model}:generateContent?key=KEY` with `contents[0].parts = [{text}, {inline_data: {mime_type: "image/jpeg", data}}]`. Put every instruction in the user text, because Gemma models may reject `system_instruction`.
- Skip response parts where `thought === true`. Ask for a fixed format (`NAME: ...` / `TAUNT: ...`) and parse it with a regex, falling back per field.
- Find model IDs with `GET /v1beta/models` instead of hardcoding them.
- Run one request at a time with a queue of 3 and a 10 s timeout. Keep canned fallback lines, and never block the game on the model.
