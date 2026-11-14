# Rescue stage — 3D art specification

Zumurud is an original match-3 puzzle game for Android: jewels of a moonlit desert oasis, deep indigo
night skies, warm gold line-work, eight-pointed-star motifs, lanterns, arches. Its board art is glossy,
rounded and bright. The game is getting a new kind of stage, the **Rescue stage**: above the puzzle board
a short scene plays in which a small hero is cornered on a rock ledge and a dragon comes closer step by
step; the player must finish the board before the dragon arrives.

The scene art is **pre-rendered 3D**: characters are modelled, lit and animated in Blender (Cycles), and
rendered to frames with a transparent background that the game plays back as sprites.

## The bar

The owner's words: the graphics must be professional and of high quality, at the level of the best
casual puzzle games on the store; anything below that level would make the whole game look worse and
must not ship. Judge every render against the character art of a top-grossing casual mobile game in
2026: appealing shapes, a clear silhouette, clean smooth surfaces with no artefacts, rich materials
(soft subsurface, glossy highlights, a rim light), expressive eyes, confident colour, and a finish that
looks sculpted by a professional — not a programmer's primitive shapes. Tubes, capsules and spheres
that still read as tubes, capsules and spheres are a failure.

## Originality (hard requirement)

Both characters and the scene are our own designs. Do not imitate the characters, creatures, colours,
poses or staging of any existing game, film or series, and never write another product's name anywhere
(file names, comments, notes). Dragons and foxes are common property; a specific studio's dragon is not.

## The cast

**The dragon — "Jamr" (جَمر, "ember").** A cave dragon that hoards jewels. Chunky, toy-like and
charismatic: menacing in a playful way, never frightening or gory (the game is rated for everyone).
- Proportions: big head (about a third of the body length), short thick neck, round belly, four short
  sturdy legs with three claws, small bat-like wings, a thick tail that ends in a faceted crystal.
- Head: rounded snout with nostrils, a wide mouth that can open to show a row of small blunt teeth and
  a tongue, two curved horns, a row of small spikes from the brow down the spine, expressive large eyes
  with a slit pupil, heavy brow ridges that can frown.
- Colours: body ember red to deep crimson (`#e23b2e` → `#8f1420`), belly plates warm gold-cream
  (`#f5c95a` → `#ffe7a3`), horns, claws and spikes polished brass-gold (`#b8862e`, `#f5c95a`), wing
  membranes dark violet (`#3a2a7a`) with a warm subsurface glow, eyes amber (`#ffa630`) that glow
  slightly, tail crystal amethyst (`#b05cff`).
- Surface: smooth, slightly glossy skin with a subtle scale pattern (bump, not noise), soft subsurface
  scattering, clear specular highlights. It must pop against a dark indigo cave.

**The hero — "Fenn" (فِنّ), a fennec fox cub.** Small, round and endearing; the keeper of the Emerald.
- Proportions: big head, very large upright ears, small body, short legs, a big fluffy-looking tail
  (stylised smooth volumes, no fur strands).
- Colours: sand-cream body (`#f3d9a4`), lighter muzzle, chest and tail tip (`#fff6dc`), inner ears warm
  pink-peach, dark nose, large dark glossy eyes with a bright highlight.
- Costume: a small indigo scarf (`#231f5c`) with a gold eight-pointed-star clasp. In its paws it hugs
  **the Emerald**: a large emerald-cut green gem (`#2fd17c`) that glows softly.

**The place.** A ledge path inside a jewel cave at night: dark indigo and violet rock, clusters of
teal and violet crystals that glow, a few brass lanterns, a strip of moonlight. The dragon enters from
the left; the hero is cornered at the right end, on a slightly raised rock.

## Conventions every file must follow

- Blender 5.3 as a Python module: `/home/user/zw/art3d/venv/bin/python your_script.py` (no GUI, no GPU:
  Cycles on the CPU; four shared cores, so use low samples while iterating and denoising always).
- Units: 1 unit = 1 m. Z is up. The scene runs along +X: the dragon walks toward +X, the hero sits at
  larger X and faces −X. The camera looks along +Y (it stands at negative Y).
- Each character stands on the ground plane Z = 0 with its feet centre at the world origin, facing +X
  (dragon) or −X (hero), turned about 25–35° toward the camera so that it reads in three-quarter view.
- Dragon size: about 2.2 m long (snout to tail tip, tail curled) and 1.5 m tall at the horns.
  Hero size: about 0.75 m tall at the ear tips.
- Camera: orthographic, looking slightly down (10–15°), so that sprites can be moved along the path
  in the game without perspective errors. Film transparent. A shadow-catcher ground gives each sprite
  its own soft contact shadow.
- Lighting rig shared by every render (one file, `studio.py`, owned by the art lead): warm key from
  the upper left front, cool low fill, a strong cool rim from behind for the silhouette, and soft
  ambient; view transform chosen for vivid, clean colour (no grey film look).
- Frames: dragon 384×384 px, hero 256×256 px, RGBA PNG, 16 frames per second, the feet anchor at the
  same pixel in every frame of a character (state it in the manifest).
- Everything is made by script, so every asset can be rebuilt: keep the Python sources, and write
  nothing outside your own folder.

## Free CC0 kit — allowed (added by the lead; this overrides "no downloaded assets" for these files only)

The owner will not pay for any asset or service, so everything must be free. The folder
`/home/user/zw/art3d/cc0/` holds a small kit of **CC0 (public domain)** files from Poly Haven; read its
README. You MAY use them, and for lighting you SHOULD try them:
- **HDRI studio lighting** (`cc0/hdri/studio_small_08_1k.hdr` and the others): light the characters
  with an HDRI as the world environment (hidden from the camera: the film stays transparent) in
  addition to the key and rim lights. Image-based light gives the realistic, rich reflections that make
  a glossy character look expensive. Rotate and tint it to taste, and keep the result vivid.
- **Photoscanned rocks, lanterns and rock textures** (`cc0/models`, `cc0/textures`): for the cave plate
  and for Fenn's rock. Import a `.gltf` with `bpy.ops.import_scene.gltf(filepath=...)`.
The two characters themselves remain entirely our own models: no downloaded mesh may be used for any
part of the dragon or the hero. Nothing else may be downloaded. List every CC0 file that is visible in a
delivery render in your report.

## Animation clips (for the animation stage; design the models so these are possible)

The model must be posable: head, jaw, eyelids/brows, neck, body, four legs, both wings, tail (several
segments). An armature with automatic weights or rigid overlapping parts parented to bones are both
acceptable, as long as the result looks seamless.

| who | clip | frames | what |
|---|---|---:|---|
| dragon | idle | 12, loops | breathing, tail sway, small wing twitch, blink |
| dragon | step | 10 | one prowling step forward with weight, ends in the idle pose |
| dragon | recoil | 10 | dazzled by a flash: flinches back, eyes shut, ends in the idle pose |
| dragon | menace | 14 | rears a little, wings up, mouth open in a roar, back to idle (close to the hero) |
| dragon | snatch | 16 | lunges, grabs the Emerald in its mouth and turns away, triumphant |
| dragon | flee | 16 | startled by bright light, scrambles around and runs off to the left |
| hero | idle | 12, loops | hugging the Emerald, trembling a little, ears flick, looks toward the dragon |
| hero | alarm | 8 | ears flatten, shrinks back, as the dragon gets close |
| hero | cheer | 12 | jumps for joy holding the Emerald up; the Emerald flashes |
| hero | hide | 12 | drops the Emerald and ducks behind the rock, only the ears showing |
