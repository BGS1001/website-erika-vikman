# Design direction — Erika Vikman (fan tribute)

Derived with `artist-identity-system`. This file is the contract: every visual
decision on this site should trace back to something written here. If a choice
cannot be traced to this document, it is a default that slipped in.

---

## THESIS

**She never took the crown off.**

Erika Vikman won Tangomarkkinat — Finland's earnest, provincial summer
tango-festival institution — at 23, and then refused to trade it in. She sings
explicitly about sex with the sincerity of a tango singer, in Finnish, and took
that to the Eurovision final on a firework-spitting golden microphone.

The contradiction is not a detail of her biography. It **is** the act, and so
it is the site.

## OWN-WORLD

**The tanssilava under latex light.**

The *tanssilava* is the Finnish wooden summer dance pavilion — varnished pine,
hand-painted signage, string lights, an accordion, a crowd that knows the
steps. It is where the tango crown comes from. It is unglamorous, regional,
and completely sincere.

The site is that pavilion, lit by a fetish club.

**Why not the red curtain and gold.** That was the previous direction, and it
is Eurovision's world, not hers — every act in the contest gets a red curtain
and a gold trophy. It is issued, not earned. Worse, it passes the wrong test:
put another maximalist pop singer's name and photographs on that layout and
nothing breaks. The tanssilava cannot be borrowed by anyone else in pop.

### The mechanism: the site alternates

The pages move between two grounds, and the alternation carries the thesis
without a word of explanation:

| | **Pavilion** (day) | **Club** (night) |
|---|---|---|
| Ground | warm cream, varnished pine | lacquered near-black, violet-shifted |
| Material | painted wood, print, paper | latex, wet light, bloom |
| Carries | the tango, the story, the crown, the archive | Ich Komme, the music, the stage |
| Light | flat daylight | magenta and cyan from the side |

The first viewport is **pavilion**. That is the decision that stops this site
looking like every other pop site, which all open dark.

## STORY

A visitor arriving from the Eurovision broadcast knows one thing: the woman on
the golden microphone. Within five seconds this site has to add the fact that
reframes her — **she is a tango queen, and she meant it.**

Not "provocative pop star" — that is what she already looks like. The turn is
that the provocation grew out of something sincere and deeply Finnish.

## AUDIENCE

Mixed, weighted international. The site is in English, so the Basel viewer is
primary; Tangomarkkinat, UMK and "Cicciolina" must be **introduced as facts,
briefly, never assumed** — but the Finnish reader should find the references
laid in at full depth underneath, as reward rather than as gatekeeping.

## FIRST VIEWPORT

Warm cream ground, not black. Painted-signage type at pavilion scale. One real
photograph. The crown named in words, not drawn as a trophy graphic. A single
line that states the contradiction outright.

Nothing glass. No floating pill over footage. No red curtain.

## FORM

### Colour

```
Pavilion   --paper #F2E9DA   --paper-warm #E7D9C0
           --pine  #8A5A2B   --pine-deep  #3F2916
           --ink   #1C1510   (warm near-black — never a cool grey)

Club       --night #17101F   --night-2 #241830   --latex #0E0912

Light      --magenta #E0338C   --cyan #17B6C4

Crown      --crown #C8A03C   --crown-lit #EBC86A
```

**The crown is an accent, not a theme.** Gold appears on the microphone, the
crown, and the record button — and nowhere else. In type, that means one year:
2016, Tangomarkkinat.

**The two lights have jobs.** Cyan carries labels and metadata; magenta carries
actions and emphasis. On the pavilion both roles re-declare in deep magenta,
because cyan on cream falls to about 2:1. `--gold`/`--gold-bright` remain only
as legacy aliases for those roles — they are not gold. The previous site used gold
as a surface treatment across everything, which is how an award becomes
wallpaper.

Black is gone as a ground. `--ink` is warm, because the pavilion is wood.

### Typography

- **Display — Archivo, expanded (`wdth` 110–125), 700–900.** Painted pavilion
  signage: wide, confident, built for paint on board, with the industrial
  grotesque bones Finnish modernism shares.
- **Text — Instrument Sans.**
- **Anton is banned.** It is *the* free condensed display of loud pop sites,
  and using it was the single clearest tell that the old direction came from
  the genre rather than from her. Inter goes with it.
- One type scale, eight steps (`--t-2xs` … `--t-3xl`), and a ten-step spacing
  scale (`--s-1` … `--s-10`) beside it. The old site used 23 sizes and 30
  spacing values — not scales, just decisions retaken in every component.
  Section rhythm and the hero gutter stay fluid in `clamp()`/`calc()` by design.

### Motion

Tango, not easing-out. Tango is attack and arrest: a phrase crosses fast,
stops hard, and **holds**. Entrances cover their distance quickly and then
settle almost not at all, and pauses are allowed to be long.

No entrance animations. Motion is spent on work (the opening, the pinned
archive rail, the marquee answering scroll velocity, the microphone) and on
**one authored moment: the lights go out in the pavilion.** The Ich Komme stage
pins in pavilion colours captioned *Tangomarkkinat · 2016*, cuts to the club
across ~5% of the pin — *Basel · 2025* — and then holds, still, for two thirds of
it. Attack, arrest, pause. Resting CSS is the arrived club state, so reduced
motion or no GSAP never shows a stuck pavilion. The root does not smooth-scroll
under GSAP, because that corrupts ScrollTrigger refreshes.

### Photography

Real photographs only, which the archive already has — 25 of them. Direction:
flash on warm wood for pavilion material; wet side-light for club material.
No illustrated or stock substitutes, ever: on an artist site the photography
*is* the brand.

## WHAT SURVIVES FROM THE OLD SITE

- **The microphone cursor.** The flying golden microphone is her own signature
  from Basel — it is the one element on the old site that could not belong to
  anybody else. It stays, and it is promoted rather than decorated around.
- The engineering: GSAP choreography, the pinned archive rail, the Spotify
  panel, accessibility work, the fan-site disclaimer.

## WHAT IS RETIRED

- The red curtain hero, black ground, Anton, Inter, gold-as-surface, and the
  red accent as the site's voice.
- Scattered scroll reveals, and counterfeit gradient covers. Releases are
  jukebox title strips banded by era — pine tango, magenta pop, cyan Eurovision.
- The dot-and-glowing-line timeline; the biography is a printed programme.

## STANDING CHECK

Before shipping any page: **swap in a different artist's name and photographs.
If the page still works, the direction has not been applied.**
