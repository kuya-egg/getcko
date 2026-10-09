# Voice and copy

Spec: `docs/getcko-design-system.md` §11.

## Show, don't tell

| Element | Limit | Longer than that becomes |
|---|---|---|
| Headline | ≤ 6 words | Cut. Move the rest into the visual |
| Body, app | ≤ 1 line (~60 ch) | `Kw` chips (max 3 per block), `Steps` (1→2→3), a diagram, or motion |
| Body, marketing | ≤ 2 lines | Same |
| Explainer or pitch UI | No paragraphs | A worked example: question → gecko → halo → source |

Why: users are new to computers and hackathon judges glance for seconds. If it needs a paragraph, the screen is not showing it yet. Test: cover the text; does the visual still say what happens?

**Who is talking:** a patient officemate who already knows the system. Friendly, short, specific. Never cute at the user's expense.

- **Tagline:** "Gets mo na." ("Now you get it.") **Product line:** "Help that sits right next to your cursor."
- **Answer order:** action → reason → source. "Ilagay mo sa cell D7. Doon kinukuha ang final grade. (Manual, p. 4)"
- Sentence case everywhere. No emoji. No exclamation marks except once at onboarding finish ("Ready ka na!").
- Say where it runs: "on this Mac", "Offline", "Nothing leaves this Mac." (Windows: "this PC").
- Unsure → "Hindi ko alam. Wala ito sa mga document mo." Never invent a source.
- Name the element in words too ("the **Save** button"), so the halo is never the only signal.
- UI chrome is English by default; answers and GetcKo's own lines follow the agent language (English, Filipino, Taglish).

## Taglish table

English nouns for software things (cell, button, file, settings, Wi-Fi), Filipino for the glue and warmth. Standard verb forms: `i-click`, `i-save`, `i-add`, `in-add`.

| Situation | English | Taglish |
|---|---|---|
| Pointing | Click **Save** at the top right. | I-click mo ang **Save** sa taas, kanan. |
| Grounded | Put Juan's grade in cell D7. It's the average of the three quarters. | Ilagay mo sa cell D7 ang grade ni Juan. Average ito ng tatlong quarter. |
| Thinking | Looking at your screen... | Tinitingnan ko ang screen mo... |
| No source | I don't know. It's not in your documents. | Hindi ko alam. Wala ito sa mga document mo. |
| Empty | No documents yet. Add your office manual. | Wala pang document. I-add mo ang office manual ninyo. |
| Error | I can't read this PDF. It looks like a scanned image. | Hindi ko mabasa ang PDF na ito. Mukhang scanned image siya. |
| Next step | Next, open the Grades tab. | Sunod, buksan mo ang Grades tab. |
| Offline proof | Works with Wi-Fi off. | Gumagana kahit naka-off ang Wi-Fi. |
| Permission | macOS asks once. Nothing leaves this Mac. | Isang beses lang magtatanong ang macOS. Walang lalabas sa Mac na ito. |
| Close | Now you get it. | Gets mo na. |

Avoid: deep formal Filipino ("Pindutin ang pindutang Itago"), dated slang ("lodi", "petmalu"), English with random Filipino sprinkled for flavor.

## Microcopy patterns

- Buttons: verb + object. "Add documents", "Start" (the card names the agent), "Try this agent", "Open System Settings" (no keycap). Not "Submit", "OK", "Let's go".
- Status: Processing, Ready, Failed: {reason}, Offline.
- Latency line: `0.9 s · on this Mac` (mono, measured only).
- Citations: `{Doc short name} · p. {n}` or `{Doc} · {Heading}`.

## Banned words

AI-powered, magic, magical, supercharge, unleash, seamless, revolutionize, game-changer, cutting-edge, your AI assistant, smart (as a selling word), Oops!, Something went wrong, Let's dive in, Welcome aboard.
