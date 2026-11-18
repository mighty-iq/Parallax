# G1: The game layer (mechanics, harms, current apps, game feel)

Phase 1 research notes for Parallax v1.2. Started 2026-11-18 (UTC). Status: in progress.

Builds on docs/research/v1.0/D-motivation.md (cited below as "D"), which is not repeated here; where this file adds to or corrects a D finding it says so.

Labels used throughout:
- **[Found]**: what a study or source reported (design, sample, population, effect size where given).
- **[Inference]**: my reading of what that means for Parallax.
- **[Proposal]**: a design proposal for the lead to accept, change or drop.

How much of each source was read is marked *full text*, *abstract only*, or *secondary (named)*. App descriptions are from public pages, help centres and press; none were installed or played here.

## 0. Starting point in the repository

(to fill)

## 1. Evidence by mechanic (Q1)

### 1.1 Gamified cognitive training specifically (the closest evidence)

[Found]
- **Vermeir et al. 2020** (JMIR Serious Games; systematic review of 49 studies, N = 4,003, ages 9–83, 67 % in clinical or at-risk groups; meta-analysis of the 9 RCTs; *full text*, first ~70 % read). Gamified vs non-gamified versions of the same cognitive training: motivation/engagement g = 0.72 [0.26, 1.19] (k = 8, N = 514); performance in the trained domain g = 0.27 (k = 9, N = 530, p = .14, n.s.); clinical outcomes g = 0.07 (k = 4, n.s.); gamified tasks were rated more demanding (g = −0.52, k = 3). Studies used 2–9 elements each (mode 5); no study isolated one element, so no element-level effects could be estimated. Number of elements did not moderate (p = .09 and .08). Authors: gamification neither enhanced nor harmed cognitive performance overall. Elements counted across the 49 studies: rewards 40, feedback loops 39, story/theme 38, difficulty adjustment 34, levels 26, progress 25, sound 19, avatar 16, competition 3, social interaction 2.
- **Lumsden et al. 2016** (JMIR Serious Games; 33 studies, 31 gamified tasks, 2007–2015; *full text*). Every study that measured intrinsic motivation found the gamelike version more motivating; no evidence that gamification improves data quality and some signs it worsens it; training efficacy "tentatively" helped. Cases of harm it reports:
  - Katz et al. 2014 (below): the fullest game version had one of the shallowest learning slopes.
  - Miranda & Palmer 2013 (*secondary, via Lumsden*): sound effects slowed reaction times (likely attentional capture) without raising engagement; points left the data unchanged and raised self-reported engagement.
  - Hawkins et al. 2013 (*secondary, via Lumsden*; combined N = 200): gamelike versions rated more interesting and enjoyable, data no different; both versions equally "boring and repetitive".
  - Delisle & Braun 2011 (*secondary*): a game version of an attention test masked the deficit the plain test detected.
  Positive cases: Prins et al. 2011 (*secondary, via Lumsden*; children with ADHD): game version gave more training trials (M 199 vs 134) and higher accuracy (69 % vs 51 %); Dörrenbächer 2014 and Ninaus 2015 (below).
- **Katz, Jaeggi, Buschkuehl, Stegman & Shah 2014** (Frontiers Hum Neurosci; *full text*). Spatial n-back, children 6–14 in summer camps, 3 days × 10 rounds, 7 versions removing one feature at a time (camp-level assignment, not a true RCT; N = 107 analysed). Hiding the persistent on-screen score gave steeper n-level slopes than the full version (0.35 vs 0.10, p = .010, partial η² = .15); removing the lives/levels display also helped (0.29, p = .042). Theme changes and prizes (both outside play) made no difference. Pooled, players without visible points improved more (F(1,103) = 7.94, p = .006, partial η² = .072). Condition did not change self-rated enjoyment, excitement or effort. Authors' reading: elements that sit in the play space during the task compete for attention with it; elements outside play distract less. Uncorrected comparisons, small groups.
- **Dörrenbächer, Müller, Tröger & Kray 2014** (Frontiers Psychol; *full text*, first half). 2 × 2: task-switching vs single-task training × game setting (story, creatures that grow, experience points per right answer, tournament status, a collection, choice of creature) vs neutral setting with identical adaptive feedback. N = 54 children aged 8–11, 4 sessions. The game setting raised the number of optional blocks chosen voluntarily (F(1,49) = 21.8, partial η² = .31) regardless of task demand, and switch costs fell more (173 → 52 ms vs 244 → 179 ms), but errors rose more in the game groups (a speed shift). Gains generalised to another switching task; far transfer only in speed. Authors: motivation and cognition are dissociable; game setting raises willingness to train but does not guarantee broad transfer.
- **Mohammed et al. 2017** (J Cognitive Enhancement; *full text*, eScholarship copy). N = 115 young adults, 20 lab sessions over 4 weeks of n-back: a 3D space game with multisensory stimuli, rewarding audio-visual feedback and player choice of ship speed vs a plain 2D n-back with right/wrong tones. The game group gained more on the trained task (n-level +1.32 vs +0.65, group difference d = 0.76, appearing after session 4) and reported more enjoyment and effort; adherence did not differ (18.8 vs 18.9 sessions, lab setting). No near- or far-transfer advantage; the far-transfer effect sizes were nominally smaller in the game group (reasoning 0.09 vs 0.18). Authors: features "neither substantially benefited nor hurt broader learning".
- **2024 research topic on gamified neuropsychological rehabilitation** (Frontiers editorial; *full text of the editorial only*): Gallen et al. (N = 94 adults) found a gamified continuous-performance task with a storyline, avatar opponents and comparison with previous scores tracked the plain task closely but impaired some measures (speed and accuracy); younger players and those with high reward responsiveness benefited most. The other studies did not isolate game elements.

[Inference]
- The pull is real and fairly large in this literature (g ≈ 0.7 on motivation), while effects on learning in the trained domain are small and uncertain, and on transfer none. So the game layer's job in Parallax is to raise *how much and how often* people practise, not to make each trial teach more. The engine already holds difficulty at the edge; game elements must not disturb that.
- The one consistent harm signal is **attention during the task**: score counters, lives bars and sound effects present while the task runs (Katz 2014; Miranda & Palmer via Lumsden). This matches the owner's rule (nothing decorative during a timed stimulus) and extends it: a running score or meter must not sit in view during *any* item, timed or not.
- Game settings can shift the speed–accuracy balance (Dörrenbächer: faster, more errors). Anything that rewards speed in untimed Train would distort the item model, which assumes untimed answers.

### 1.2 Meta-analyses of gamification in learning (adds to D §2)

[Found]
- D already holds Sailer & Homner 2020 (cognitive g = 0.49; only the cognitive effect survived in rigorous studies; competition plus collaboration best for behaviour; fiction helped behaviour only) and Bai, Hew & Huang 2020 (g = 0.50; type and number of elements not moderators; learners disliked anxiety and jealousy).
- **Li, Hew & Du 2024** (ETR&D; 35 interventions, ~2,500 students, 2011–2022; *abstract via the HKU repository*): intrinsic motivation g = 0.257 [0.043, 0.471]; autonomy g = 0.638; relatedness g = 1.776; competence g = 0.277 [0.001, 0.553] (barely significant). The systematic part names lack of perceived competence and lack of perceived autonomy as the two main reasons the motivation effect stays small.
- **Li, Ma & Shi 2023** (Frontiers Psychol; 41 studies, 49 samples; *full text*): learning outcomes g = 0.822 with I² = 94 %, internal inconsistencies between text and tables, and higher-education studies near zero (g = 0.014, k = 8). Weak evidence; recorded only so the lead does not cite its large g.
- **Rodrigues et al. 2022** (Int J Educ Technol High Educ; quasi-experiment, N = 756 programming students, 14 weeks; *full text*): effects of a gamified environment (narrative, avatars, badges, card-draw rewards, leaderboard, a class-wide cooperative boss) on behaviour were largest in weeks 1–4, fell from week 4 (attempts not significant by week 6), and partly recovered from weeks 6–10 without redesign; never negative. Authors: expect about four "safe" weeks, then a dip and partial recovery. Non-random cohorts; curve read from intervals.

[Inference]
- Expect the new layer's pull to fade after about a month. The layer needs content that renews on its own (seeded challenges, new settings reached, Path stages), not a one-off novelty.
- Competence is where gamification helps least on average, and competence is the need Parallax can serve best (honest levels with real settings). Elements should make competence visible, not just add rewards.

### 1.3 Self-determination theory and the undermining effect (adds to D §1)

[Found]
- **Lehtivuori 2023** (doctoral dissertation, University of Turku; 142 randomised experiments from 125 articles, plus 42 organisational samples; *abstract only*). Free-choice behaviour after rewards stop: all rewards d = −0.28, tangible −0.39, expected −0.41; engagement-contingent −0.42, completion-contingent −0.48, performance-contingent −0.24; unexpected −0.04 (n.s.); positive feedback +0.33 (moderated by age). Self-reported interest: positive feedback +0.26, performance-contingent rewards +0.11, engagement-contingent −0.16. In workplaces, performance pay perceived as controlling correlated slightly negatively (r = −0.10). This updates and broadly replicates Deci, Koestner & Ryan 1999 (D §1).
- **Cerasoli, Nicklin & Ford 2014** (Psychol Bull; 183 samples, N = 212,468; *full text, first half*): intrinsic motivation predicted performance (ρ = .26 overall; quality ρ = .35, quantity ρ = .26). When incentives were directly tied to performance, intrinsic motivation predicted performance less (ρ = .30) than when they were indirectly tied (ρ = .45): a crowding-out pattern. In the abstract (*abstract*), intrinsic motivation predicted more unique variance in the *quality* of performance and incentives more in its *quantity*.
- **Kao, Ballou, Gerling, Breitsohl & Deterding 2024** (CHI; preregistered online experiment, n = 1,699, an action RPG; *abstract only*): juicy feedback that depended on success raised effectance, competence, curiosity and enjoyment; amplified feedback for every action *lowered* them (possibly by blurring agency). Curiosity was the strongest predictor of enjoyment and the only predictor of free-choice play time; uncertain success feeds curiosity. Authors: juice works when the link between action and outcome is clear and success is graded.

[Inference]
- The ranking of risks from D holds with newer data: rewards for showing up or finishing are the worst (−0.42 to −0.48 on later free choice); rewards for performance are milder (−0.24) and turn positive when experienced as information; informational positive feedback helps (+0.33). So every number or badge in Parallax should be *about* skill and read as information ("you handled 4 folds"), and nothing should be paid for logging in, finishing a session or time spent.
- Kao 2024 is the most useful recent result for game feel: feedback must scale with how good the answer was, not fire on every tap. In Parallax terms, the verdict animation should differ for a right answer at a stretch item vs an easy one, and nothing should celebrate pressing a button.

### 1.4 Goals, progress and returning (adds to D §2)

[Found]
- **Harkin et al. 2016** (Psychol Bull; 138 RCTs, N = 19,951; *abstract*): prompting people to monitor goal progress raised monitoring (d = 1.98) and goal attainment (d = 0.40 [0.32, 0.48]); effects were larger when progress was physically recorded and when it was reported or made public.
- **Koo & Fishbach 2012** (J Consumer Research; 4 studies; *abstract via RePEc*): the "small-area" effect. Early in a goal, attention to what is done motivates more; near the end, attention to what remains motivates more (the smaller number feels like faster progress).
- **Villar, Callegaro & Yang 2013** (meta-analysis of 32 randomised web-survey experiments; *abstract*): a constant-speed progress bar did not reduce drop-out overall (and raised it when a small incentive was promised); bars that ran fast early and slow late reduced drop-out; slow-early bars increased it.
- **Landers, Bauer & Callan 2017** (CHB; brainstorming task; *abstract and the first author's summary*): a leaderboard produced effort similar to difficult or near-impossible assigned goals; it worked through goal commitment, and people who did not believe in it did worse than the hard-goal group. So leaderboards act as implied goals.
- **Personal-best (PB) goals.** Ginns, Martin, Durksen, Burns & Pope 2018 (Aust Educ Res; true experiment, N = 68 children aged ~10–12, arithmetic fluency; *abstract*): setting a goal relative to one's own previous best gave a "small but reliable" advantage over no goal. Martin et al. 2016 (Br J Educ Psychol; N = 450 high-school students; *abstract*): PB goals were associated with engagement and, through engagement, achievement (path model, cross-sectional).
- **Choice.** Patall, Cooper & Robinson 2008 (Psychol Bull; 41 studies, 46 samples; *full text, first half*): providing choice raised intrinsic motivation (d = 0.30 fixed, 0.36 random), effort (0.22), task performance (0.32) and perceived competence (0.59); the effect was stronger with 2–4 successive choices than with more, stronger without a reward afterwards, and stronger for children than adults.
- **Fresh starts.** Dai, Milkman & Riis 2014 (Management Science; 3 field datasets; *full text*): temporal landmarks raised aspirational behaviour. University gym visits rose 33.4 % at the start of a week, 14.4 % at the start of a month and 47.1 % at the start of a semester; goal-commitment contracts rose 62.9 % at the start of a week. Authors' account: a landmark opens a new "mental accounting period" and separates the person from past lapses.
- **Rewarding return, not punishing absence.** Milkman et al. 2021 (Nature megastudy; 61,293 gym members, 53 four-week programmes; *full text*): the best programme gave a small bonus for coming back after a missed workout (+27 % weekly visits vs placebo); 45 % of programmes worked during the 4 weeks, only 8 % left a measurable effect afterwards; experts' predictions did not correlate with results (r = 0.02) and were 9.1 times too optimistic.
- **Gaming the system.** Baker, Corbett, Koedinger & Wagner 2004 (CHI; 70 middle-school students using a cognitive tutor; *full text*): students who exploited the tutor's mechanics (fast guessing, hint abuse) learned less (post-test r = −0.38; partial r = −0.34 controlling pre-test and achievement); it was the off-task behaviour most strongly tied to poor learning, more than idling or chatting.

[Inference]
- Goals work best when they are self-referenced, specific and challenging (PB goals), when progress is recorded and visible (Harkin), and when the player chooses among a few (Patall: 2–4).
- The start of a week is a natural fresh start. A weekly challenge and the weekly goal both reset on Monday, which suits the fresh-start finding and needs no daily chain.
- Milkman's result is the cleanest evidence that a reason to return can *reward coming back* instead of punishing absence. Parallax cannot pay cash, but it can make the first session after a gap informative and welcoming (a recheck of what lasted, a fresh-start framing), which fits the no-streak rule.
- Any points that can be earned faster by guessing, skipping hard items or repeating easy ones invite gaming the system, which in Baker's data was the behaviour most tied to poor learning. Points must be impossible to farm.
- Progress bars should be honest and front-loaded where honesty allows: show what is done early in a goal and what is left near the end (Koo & Fishbach); never fake a head start (D).

### 1.5 Attention costs of reward cues

[Found]
- **Anderson, Laurent & Yantis 2011** (PNAS; N = 26, 10, 24; *full text*): colours that had predicted money captured attention later as irrelevant distractors (about 15–16 ms slower search), persisting 4–21 days later without further reward.
- Katz 2014 and Miranda & Palmer (above): on-screen scores and sound effects during the task slowed or flattened learning.

[Inference]
- Colours and sounds used for rewards or celebration should not be reused as stimulus features. Parallax's stimuli are neutral grey on purpose; the signal accent and any reward hue must never appear on objects that must be judged. The effect is small, but it is free to avoid.

## 2. Designs for Parallax (Q2)

(to fill)

## 3. Current apps (Q3)

(to fill)

## 4. How much game: three options (Q4)

(to fill)

## 5. Game feel inside a lab-instrument look (Q5)

(to fill)

## 6. Sketches the owner should play first (Q6)

(to fill)

## Sources

(to fill)

## Could not open

(to fill)
