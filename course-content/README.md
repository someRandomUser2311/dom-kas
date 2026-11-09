# Course content (simple HTML)

The full text of every chapter, written as plain HTML. These pages are the **source content** for the real application. They are not the app. Each page opens in a browser as a readable document, and every step, check and lab is marked up so it can be translated into the player's lesson data (`window.LESSON` steps) mechanically.

The plan behind each chapter is in [`../course-plan/chapters/`](../course-plan/chapters/). The format rules are in [`../course-plan/formats.md`](../course-plan/formats.md).

## Layout

```
course-content/
├─ index.html              course contents
├─ content.css             shared styles (readability only)
├─ ch00/
│  ├─ index.html           chapter overview: outcomes, lessons, practice links
│  ├─ 0.1-yaml.html        one file per guided lesson
│  ├─ …
│  └─ practice.html        quiz pool, predict set, labs, "Try it locally" boxes
├─ ch01/ …
└─ ch17/
```

## Markup contract

Every lesson is one `<article class="lesson">`. Every step is one `<section class="step">`, in order.

| Element | Meaning in the player |
|---|---|
| `<section class="step" id="sN">` + `<h2>` | One step and its title |
| `<div class="body">` | The step's left-hand text |
| `<pre class="code" data-file="name">` | The file shown on the right. Lines starting with `+` inside `data-diff` blocks are new in this step |
| `<div class="widget" data-widget="name">` | An interactive panel; the text describes what it does and what the learner can change |
| `<aside class="coming" data-set="A\|B\|C\|TF">` with `<dl>` | "Coming from" tabs. `<dt>` is the persona, `<dd>` the note. "Careful:" marks a false friend |
| `<aside class="more">` | "Read more" drawer content |
| `<div class="check" data-type="…">` | A check. Types below |
| `<section class="step summary">` | The lesson's closing summary |

**Check types**

| `data-type` | Markup |
|---|---|
| `mcq` | `<p class="q">`, `<ol class="options">` with one `<li class="correct">`; wrong options may carry `<span class="why">` |
| `multi` | Same as `mcq`, with several `.correct` |
| `order` | `<ol class="options">` written in the **correct** order (the player shuffles it) |
| `match` | `<table class="pairs">`, one row per correct pair |
| `fill` | Code containing `<span class="blank">`; `<ul class="chips">` with one `.correct` chip |
| `tapline` | `<p class="q">` + `data-match="text on the right line"` |
| `command` | `<p class="answer"><code>` with the canonical answer; `<p class="accept">` lists what else is accepted |
| `write` | `<pre class="start">` starter file, `<ul class="rules">` (`.critical` = ⛔), `<details class="solution">` |
| `predict` | A scenario and the expected outcome |
| `diagnose` | Real output in `<pre class="output">`, options, and the root cause |
| `custom` | A widget task; the text states the goal and the success condition |

Every check ends with `<div class="explain">`, which is shown after the learner answers.

**Practice pages** use the same check markup. Quiz pools list about twice as many questions as one quiz draws. Labs list their rules, with ⛔ on critical ones, and a reference solution.
