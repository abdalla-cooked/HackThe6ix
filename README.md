# Haunted Files

Demons are possessing the files on your desktop. You grab the possessed files with your bare hands through the webcam and drop them into a bubbling cauldron, which blows the demon out in a burst of green fire. Gemma 4 looks at you through the camera to name each demon, taunt you and judge you at the end of every level.

**Play it live:** https://hammerhead-app-oqblv.ondigitalocean.app (hosted on DigitalOcean App Platform; use Chrome and allow the camera, or click "Use mouse instead")

![Haunted Files boss fight](docs/screenshot.png)

## How to play

| Gesture | What it does |
|---|---|
| Pinch (thumb and index together) | Grab and drag a file or a window title bar. Pinch a button to press it. |
| Release the pinch | Drop into the cauldron, a folder, a window or anywhere on the desktop |
| Open palm, held 0.6 s | Open a folder or file, skip the mage's line |
| Thumbs up, held 1 s | Start the next level (or retry after a loss) |
| Peace sign, held 1.2 s | Pause or resume |
| Fist, Point, Palm, Horns (from level 3) | **Fireball**: burns every demon on screen |
| Horns, Palm, Point, Fist (from level 3) | **Freeze**: every demon stops for 8 s |

The loop:

1. A demon flies in and lands on a file. The file shakes, glows green and cracks as its corruption rises.
2. Pinch the file and drop it into the cauldron before it hits 100% and turns into a tombstone. Past 60% it starts spreading a tendril to the nearest file.
3. The cauldron explodes in green fire, the screen shakes and the demon flies out screaming. **BANISHED!**
4. Clear every demon and the level-up screen appears. Hold a thumbs up for one second to go on.

Levels get harder in three ways: more files and demons, faster corruption, and from level 2 on, possessed files **hop** to a new spot if you leave them alone (hovering over a file holds it still). Level 3 is a **boss fight**: the Mimic King possesses `MIMIC.exe`, jumps back out of the cauldron twice and only goes down on the third drop. If he turns to stone, you lose the level. Every third level after that has a boss.

### Hand-sign spells

From level 3 you can chain hand signs, ninja style. Hold each sign for half a second, and make the next one within 2.5 seconds:

- **Fist, Point, Palm, Horns** (horns = index and pinky up) casts a **Fireball**. The screen darkens, each sign lights up on the spell bar as you lock it in, a fireball charges in your hand, flies to the middle of the screen and explodes. Every possessed file burns clean, demons still in the air burn up, and the boss takes one hit.
- **The same signs backwards** casts **Freeze**. Frost creeps in from the edges, every demon is locked in ice for 8 seconds, and nothing spreads, hops or arrives until it thaws. You can still drag frozen files into the cauldron.

A cast needs a full mana bar. It starts full each level and refills after 4 cauldron banishes, so you get about one spell per wave. A wrong sign in the middle of a chain fizzles it.

Morwen the Mage walks you through a tutorial, calls out what is happening and tracks every monster you meet in her bestiary. The art is Kenney's Tiny Dungeon pixel pack, with lightning, drifting fog, flickering torches and a spark trail behind your hand.

No camera? The whole game works with a mouse: left drag is a pinch, hold P for an open palm, T for a thumbs up and V for the peace sign. For spells, hold F (fist), D (point), P (palm) and H (horns) in order. M mutes the sound.

Add `?level=3` to the URL to jump straight to a level, for example to show off the boss and the spells.

### Scare levels

The Kenney sprites stay exactly as they are. The horror comes from light, sound and glitches layered on top. Pick a level in **Settings**:

| Level | What you get |
|---|---|
| **Nightmare** (default) | The room is nearly black. Your hand carries the light, torches stutter, and the cauldron and possessed files glow. Demons are black shapes with red eyes until your light reaches them. |
| **Creepy** | A dim room with the same red-eyed, red-tinted demons and all the glitches and sound. Easier to read on a projector. |
| **Cute** | The original look, no extra layers. |

On Nightmare and Creepy you also get:

- Film grain, scanlines, a red vignette that throbs with your heartbeat, and RGB-split titles and labels.
- A demon that possesses a file squeezes into it, and the file icon convulses. Possessed sprites glitch and tear.
- Names of possessed files flicker into things like `HELP_ME.txt` or `you_cant_leave.exe`, and start to crawl with corrupted characters when the file is close to lost.
- Lightning lights up the whole room for a moment. On Nightmare, the lights sometimes cut out with an electric buzz, and only the possessed files keep glowing.
- Morwen's lines are darker, and she mutters about things moving in the dark when it gets quiet.

**Sound** is synthesized live with the Web Audio API, so there are no audio files: a low drone and wind, a heartbeat that speeds up and gets louder as corruption climbs, whispers when a demon possesses a file, a distorted scream when one is banished, a cracked bell when a file is lost and thunder after lightning. It starts on your first click. Mute it with the speaker button in the top bar or the M key.

**Jump scare:** when a file dies, a giant red-eyed demon slams onto the screen for about half a second, zooming in and shaking, with a distorted screech and a bass hit, then the screen flashes red. It fires at most once every 20 seconds, so a chain of lost files does not spam it. It is on by default; untick "Jump scare when a file dies" in Settings to turn it off.

## Files app (Crypt Explorer)

The game is a toy desktop. The Files app shows the same gestures working on a real folder from your computer. Pick **Files app** on the start screen, click **Files app** in the top bar, or open the page with `?mode=files`.

| Gesture | What it does in the Files app |
|---|---|
| Pinch and drag | Move a file into a chest (folder), onto a folder name in the path bar, or into the cauldron |
| Quick pinch (tap) | Open a folder or preview a file |
| Open palm, held 0.6 s | Open the chest or file under your hand |
| Thumbs up, held 0.7 s | Close the preview, then go up one folder |

Folders show as chests and files get pixel icons by type. Images show a thumbnail. Opening a file previews it in place: images, text and code, PDFs, audio and video. Drop a file in the cauldron and it goes to the **Graveyard**, where a tap restores it to the folder it came from. Pinch **Ask Morwen** in a preview and Gemma 4 reads the file: it sees the image itself, or the first 1,500 characters of a text file, and Morwen describes it in her spooky voice.

**It never changes your disk.** The folder is opened read-only. Moving files and the Graveyard only change what the app shows. Nothing on your computer is renamed, moved, edited or deleted, and reloading the page brings everything back. File contents never leave your browser, except the single file you ask Morwen about, which goes to the Gemini API.

To open a real folder, click **Open a real folder** with the mouse. Browsers only show the folder picker after a real click, so a pinch cannot open it. Chrome and Edge use the File System Access picker and load subfolders as you open them. Other browsers fall back to a plain folder selection dialog. No folder handy? **Demo crypt** loads a built-in folder with text scrolls, a PDF, pixel portraits, a ghost howl recording and a script.

## How Gemma 4 is used

Gemma 4 runs through the Gemini API, and only on single images (a webcam snapshot, or a file you ask about), never on video frames. Hand tracking needs about 30 updates a second, so a language model is the wrong tool for that. Gemma reacts to moments instead:

- **Possession.** When a demon lands in a file, the app sends Gemma a mirrored 384x288 snapshot and the file name. Gemma replies with a demon name (often a pun on the file) and a creepy threat about one real thing it can see, like "Nice hoodie. It will look good on your corpse." The prompt tells it to stick to objects, clothes and the room, and never to comment on your body or appearance.
- **File readings.** In the Files app, Gemma gets the file you are previewing (an image, or the start of a text file) and describes it as Morwen.
- **Level judgment.** When you clear a level, Gemma gets a snapshot and your stats (banished, lost, how often demons hopped away, spells cast, fastest save, boss beaten) and gives you a witch rank and a verdict, shown on the level-up screen.

The game never waits for Gemma. A demon starts as "???" and its name fills in when the answer arrives. With no key, or if a call fails, the app uses pre-written lines and shows a "backup scrolls" badge.

The prompts live in [`js/gemma.js`](js/gemma.js).

## Open-source stack

- **Gemma 4** (open weights) for demon names, taunts and judgments
- **MediaPipe Tasks Vision** (Apache 2.0) for hand landmarks and gesture labels, running fully in the browser
- **Kenney Tiny Dungeon** (CC0) for the monsters, the mage, chests, graves and the dungeon background
- Plain HTML, CSS and JavaScript modules, with no build step and no dependencies to install

The gesture layer is also packaged as an Agent Skill in [`skills/gesture-exorcism/SKILL.md`](skills/gesture-exorcism/SKILL.md) so other projects can reuse it.

## Run locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 in Chrome. The camera only works on `localhost` or over HTTPS.

To turn on Gemma, click **Settings**, paste a Gemini API key from Google AI Studio, click **Find Gemma models** and save. The key is stored only in your browser's localStorage and is sent only to Google's Gemini API.

## Deploy on DigitalOcean

The live version runs on App Platform at https://hammerhead-app-oqblv.ondigitalocean.app and redeploys on every push to `main`.

**App Platform (easiest):** create an app from this GitHub repo, choose a **Static Site** component, leave the build command empty and set the output directory to `/`. App Platform serves it over HTTPS, so the camera works.

**Droplet:** on an Ubuntu droplet with a domain pointed at it, install Caddy and run:

```bash
caddy file-server --root /var/www/haunted-files --domain yourdomain.com
```

Caddy gets the HTTPS certificate automatically.

## Project layout

```
index.html        app shell, start screen, level-up screen, settings, mage panel
css/style.css     dungeon theme, desktop, infection effects, mage, cursor
assets/kenney/    Tiny Dungeon tiles and the generated dungeon background
js/main.js        boot, main loop, gesture dispatch, lightning, cauldron bubbles
js/tracker.js     MediaPipe hand tracking
js/input.js       hand-or-mouse pointer, pinch math, gesture debounce
js/assets.js      one config for all art, with SVG fallbacks
js/fs.js          in-memory file system
js/desktop.js     files, windows, drag and drop, cauldron
js/infection.js   possession, corruption, spread, hopping, boss, banish blast
js/explorer.js    Files app: real folder browsing, previews, graveyard
js/levels.js      level table, tutorial, boss spawn, level-up screen, mage lines
js/spells.js      hand-sign chains, mana, fireball and freeze
js/mage.js        speech queue, task box, bestiary
js/gemma.js       Gemini API client, snapshots, prompts, fallbacks
js/fx.js          particles, rings, lightning, flashes, screen shake
js/scare.js       scare levels: darkness and hand light, silhouettes, glitching names, blackouts, jump scare
js/sound.js       synthesized drone, heartbeat, whispers, screams, bell, thunder
```

## Credits

See [CREDITS.md](CREDITS.md).

## License

The code is MIT licensed (see [LICENSE](LICENSE)). Third-party assets keep their own licenses, listed in CREDITS.md.
