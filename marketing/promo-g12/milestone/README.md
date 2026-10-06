# Emar 12 milestone video (subscriber count)

`../Emar12-104-subscribers.mp4`: 1080×1080, 17 s, same style as `square-v2`.

The count is one constant at the top of the script in `milestone.html`: `const SUBS=104`.
`mix.py` reads the same constant, so the arrival taps always match the avatars.

Sound: Mixkit effects (free commercial license, not redistributed here). Download them as in
`../square-v2/README.md`, adding these ids: 506 524 530 975.

1. `python3 mix.py` writes `sfx5.wav`.
2. `H=1080 node render2.mjs $PWD/milestone.html <framesDir> 30 0-510`
3. Encode the frames with `sfx5.wav` (libx264, yuv420p, AAC).
