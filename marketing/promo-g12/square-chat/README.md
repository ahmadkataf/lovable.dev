# Emar 12 square promo: "the chat" concept

`../Emar12-promo-square-chat.mp4`: 1080×1080, 23.5 s, same visual style as `square-v2`.

Concept: two students chat. Sara asks how to study Baccalaureate English, Majd recommends
Emar 12 and sends the app card, a tap opens a quick tour of the real app, Sara subscribes,
and the call to action arrives as chat bubbles: "ابعته لصاحبك اللي عم يسأل".
Sara and Majd are fictional names.

Sound: Mixkit effects only (free commercial license, not redistributed here) plus the app's own
voice saying «misguide». Download the effects as in `../square-v2/README.md`, adding these ids:
2356 2358 2535 2925.

1. `python3 mix.py` writes `sfx4.wav`.
2. `H=1080 node render2.mjs $PWD/chat.html <framesDir> 30 0-705`
3. Encode the frames with `sfx4.wav` (libx264, yuv420p, AAC).
