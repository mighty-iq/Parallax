# G1: The game layer (mechanics, harms, current apps, game feel)

Phase 1 research notes for Parallax v1.2. Started 2026-11-18 (UTC). Status: complete (2026-11-18 UTC).

Builds on docs/research/v1.0/D-motivation.md (cited below as "D"), which is not repeated here; where this file adds to or corrects a D finding it says so.

Labels used throughout:
- **[Found]**: what a study or source reported (design, sample, population, effect size where given).
- **[Inference]**: my reading of what that means for Parallax.
- **[Proposal]**: a design proposal for the lead to accept, change or drop.

How much of each source was read is marked *full text*, *abstract only*, or *secondary (named)*. App descriptions are from public pages, help centres and press; none were installed or played here.

## 0. Starting point in the repository

Read: docs/research/v1.0/D-motivation.md, docs/dev/ENGINE.md §3, §8, §9, §12–14, js/engine/achievements.js, js/engine/daily.js and js/engine/streak.js (headers), js/engine/stats.js (bests), js/ui/play.js (summary, sound), js/ui/share.js (header), docs/dev/v1.2/standing-rules-gap.md (F1–F7, P2, C11, LI1–LI4, §6–7), docs/dev/PLAN-v1.2.md (fork 1, milestone 5).

What exists (all honest and quiet by design):
- Levels 1–100 per exercise with a 95 % range and the real settings (ENGINE §3); shown only at block ends.
- Path: 10 stages per exercise, one per tenth of the difficulty range (ENGINE §6). Because the level is placed linearly on the same range, level tenths and Path stages coincide.
- Personal best = the level shown after a whole block of 10 whose success reached the level reference (js/engine/stats.js `bests`, stored at `rec.ex[id].best.block`).
- 21 achievements for skill and good practice; nothing for time; never "mastered" (js/engine/achievements.js). The context already computes the highest value handled per dimension (`maxRight`).
- Weekly goal 2–6 sessions (default 3), one missed week in four forgiven, free repair (js/engine/streak.js). Kept as is by the owner.
- Daily Challenge: 8 items from the date, each at the combination nearest the *middle* of its range, one scored attempt, partial attempts resume; share line `Parallax Daily #N · x/8 · discord.gg/chmr` (js/engine/daily.js).
- Speed mode already reports a proper scoring rule per session, S = (2x − 1)(1 − t/deadline), and a balanced integration score (ENGINE §8).
- Friend-challenge codes for the same items (js/ui/share.js `challenge`); share cards with kinds session, daily, check, level, challenge (check and level unused, gap F4).
- Sounds off by default, never during a stimulus; the guard is the `body.px-stim` class (js/ui/play.js `sound`).
- Settings space per exercise (`PX.engine.model.pool(def)`, counted with a scratch script outside the repository): Slice 18 combinations, Orient 36, Hidden 54, Spin 90, Nets 90, Views 90, Knots 120, Span 144, Fold 180, Rotate 288, Homing 72, Reckon 432, Track 3,312 (46 speed levels). A collection over every combination would be uneven; a two-dimension projection per exercise gives 10–40 cells each.

Gap-doc rows this file answers: F2 (visible growth), F4 (wins worth sharing), F5 (reason to return), F6 (more game, harm-free), F7 (clean stimuli), P2 (first-week gains), C11 (seeded challenge), LI2 (game feel), LI4 (stock patterns), §7 fork 1 (how much game).

Research limits of this session: the shared web-search budget ran out part-way (after about 50 searches by this agent), so a few points rest on one source or on a secondary report, marked as such; no app was installed or played.

## 1. Evidence by mechanic (Q1)

### 1.1 Gamified cognitive training specifically (the closest evidence)

[Found]
- **Vermeir et al. 2020** (JMIR Serious Games; systematic review of 49 studies, N = 4,003, study mean ages 9–83, 67 % in clinical or at-risk groups; meta-analysis of the 9 RCTs; *full text*, first ~70 % read). Gamified vs non-gamified versions of the same cognitive training: motivation/engagement g = 0.72 [0.26, 1.19] (k = 8, N = 514); performance in the trained domain g = 0.27 (k = 9, N = 530, p = .14, n.s.); clinical outcomes g = 0.07 (k = 4, n.s.); gamified tasks were rated more demanding (g = −0.52, k = 3). Studies used 2–9 elements each (mode 5); no study isolated one element, so no element-level effects could be estimated. Number of elements did not moderate (p = .09 and .08). Authors: gamification neither enhanced nor harmed cognitive performance overall. Elements counted across the 49 studies: rewards 40, feedback loops 39, story/theme 38, difficulty adjustment 34, levels 26, progress 25, sound 19, avatar 16, competition 3, social interaction 2.
- **Lumsden et al. 2016** (JMIR Serious Games; 33 studies, 31 gamified tasks, 2007–2015; *full text*). Every study that measured intrinsic motivation found the gamelike version more motivating; no evidence that gamification improves data quality and some signs it worsens it; training efficacy "tentatively" helped. Cases of harm it reports:
  - Katz et al. 2014 (below): the fullest game version had one of the shallowest learning slopes.
  - Miranda & Palmer 2013 (*secondary, via Lumsden*): sound effects slowed reaction times (likely attentional capture) without raising engagement; points left the data unchanged and raised self-reported engagement.
  - Hawkins et al. 2013 (*secondary, via Lumsden*; combined N = 200): gamelike versions rated more interesting and enjoyable, data no different; both versions equally dull and repetitive.
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
- **Choice.** Patall, Cooper & Robinson 2008 (Psychol Bull; 41 studies, 46 samples; *full text, first half*): providing choice raised intrinsic motivation (d = 0.30 fixed, 0.36 random), effort (0.22), task performance (0.32) and perceived competence (0.59); the effect on intrinsic motivation was stronger when people made 2–4 successive choices than more, stronger without a reward afterwards, and stronger for children than adults (moderators from the abstract).
- **Fresh starts.** Dai, Milkman & Riis 2014 (Management Science; 3 field datasets; *full text*): temporal landmarks raised aspirational behaviour. University gym visits rose 33.4 % at the start of a week, 14.4 % at the start of a month and 47.1 % at the start of a semester; goal-commitment contracts rose 62.9 % at the start of a week. Authors' account: a landmark opens a new "mental accounting period" and separates the person from past lapses.
- **Rewarding return, not punishing absence.** Milkman et al. 2021 (Nature megastudy; 61,293 gym members, 53 four-week programmes; *full text*): the best programme gave a small bonus for coming back after a missed workout (+27 % weekly visits vs placebo); 45 % of programmes worked during the 4 weeks, only 8 % left a measurable effect afterwards; experts' predictions did not correlate with results (r = 0.02) and were 9.1 times too optimistic.
- **Gaming the system.** Baker, Corbett, Koedinger & Wagner 2004 (CHI; 70 middle-school students using a cognitive tutor; *full text*): students who exploited the tutor's mechanics (fast guessing, hint abuse) learned less (post-test r = −0.38; partial r = −0.34 controlling pre-test and achievement); it was the off-task behaviour most strongly tied to poor learning, more than idling or chatting.

[Inference]
- Goals work best when they are self-referenced, specific and challenging (PB goals), when progress is recorded and visible (Harkin), and when the player makes a few real choices (Patall: effects strongest with 2–4 successive choices).
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

### 1.6 Mechanic by mechanic: pull, harm, and what it means here

Each entry: [Found] pull · [Found] harm · [Inference]. Sources are in 1.1–1.5, in D, or listed under Sources.

**Points (and what they reward)**
- Pull: points raised the *quantity* of work (Mekler 2017: d = .44 vs plain, N = 273). Experience points per right answer, inside a story bundle, raised voluntary training in children (Dörrenbächer 2014).
- Harm: no effect on quality, intrinsic motivation or competence (Mekler 2017). A persistent on-screen score flattened n-back learning (Katz 2014: slope 0.10 vs 0.35 hidden). Points that can be farmed invite gaming the system, the behaviour most tied to poor learning (Baker 2004, r = −.38). Duolingo users reported farming points by repeating easy lessons, binge sessions and paid cheating tools (qualitative study of 357 forum posts, 30,618 comments and 15 interviews, 2022); Duolingo itself re-weighted its points towards new material (company blog: +1.8 M minutes a day). Engagement-contingent rewards undermine later free choice most (−0.42; Lehtivuori 2023). Incentives tied directly to performance predict quantity, intrinsic motivation predicts quality (Cerasoli 2014).
- Here: Speed mode already reports a proper scoring rule per session (ENGINE §8: S = (2x − 1)(1 − t/deadline)), so Parallax has a skill score where speed is the point. **Inference:** "difficulty-weighted right answers" summed over Train sessions would still be paid for volume, because sessions are time-boxed and success is held near 78 %: points per session ≈ skill × minutes. A lifetime total of that kind is an engagement-contingent reward in disguise. Points stay safe where the number of items is fixed and the same for everyone (a challenge), or as a total that only demonstrated skill can raise.

**Levels, ranks and tiers**
- Pull: levels raised quantity like points (Mekler 2017: d = .35 over points). Tiers act as goals (Landers 2017 for the analogous leaderboard case).
- Harm: a lives/levels display inside the play space flattened learning (Katz 2014, p = .042). Products show the failure modes: a skill score that falls when you play less often and level names up to "Master" (Elevate help centre); scores mapped to a population of self-selected players (Lumosity help centre; BrainHQ stars by percentile). On an absolute ranking the bottom third ended with lower intrinsic motivation (Bai et al. 2021: 4.70 vs 5.71 on a 7-point scale; N = 24, quasi-experiment).
- Inference: Parallax's levels are already honest. Ranks or grades on top are safe if they never decay with absence, never compare with other people, never say "master", and are shown between blocks, not during items.

**Badges and achievements**
- Pull: badges raised activity in a one-year field experiment (Hamari 2017, D) and voluntary practice in a small course study (Dicheva et al. 2020, N = 14). In SQL-Tutor (N = 77, 4 weeks) badges raised time on task, which raised the level reached (indirect effect β = 0.32; 52 % of the effect mediated), with no direct difference in learning. PeerWise badges: +4.5 % on the exam (Denny et al. 2018, *secondary, via the SQL-Tutor paper*).
- Harm: participation badges (time, number answered) went with *rising* performance-avoidance in low performers (r = .46), while skill badges went with rising expectancy in high performers (r = .49) (Abramovich, Schunn & Higashi 2013, N = 51). Badges did not change intrinsic motivation (Kyewski & Krämer 2018, *secondary, via Dicheva 2020*).
- Inference: keep badges for skill and for evidence-based practice habits (spacing, checks), as Parallax does. Unexpected, informational "firsts" carry no undermining risk (unexpected rewards d = −0.04, Lehtivuori 2023).

**Progress bars**
- Pull: recorded, visible progress raises goal attainment (Harkin 2016, d = 0.40). Effort rises as a goal nears (goal gradient, Kivetz 2006, D).
- Harm: constant-speed bars did not reduce drop-out, and bars that start slowly increased it (Villar et al. 2013). Effort dips right after a reward ("post-reward resetting", Kivetz 2006, D).
- Inference: honest bars only; frame early progress as done and late progress as left (Koo & Fishbach 2012); show the next goal as soon as one is met, to soften the reset.

**Seeded daily and weekly challenges**
- Pull: no controlled study of seeded challenges was found (D found none either). Indirect: week starts are fresh starts (Dai et al. 2014: +33 % gym visits, +63 % commitment contracts). Press commentary on Wordle (a psychology professor in Tufts Now, *secondary*): difficulty set so players usually succeed but not always, a short game that fits a daily routine, and a result grid that can be compared without spoilers or head-to-head competition.
- Harm: none measured. The owner's rule names the known one: a daily chain that punishes a missed day.
- Inference: challenges renew themselves, which answers the four-week novelty fade (Rodrigues 2022). The current Daily sits at a fixed medium difficulty, which is hard for beginners and easy for experts; a ramp from easy to hard would let every level usually succeed but not always.

**Personal bests**
- Pull: a true experiment found PB goals gave a small but reliable gain over no goal (Ginns et al. 2018, N = 68 children); PB goals go with engagement (Martin et al. 2016, N = 450, correlational).
- Harm: none found. Comparison aimed at the self as a person, or at others, is the risky kind (Kluger & DeNisi 1996, D).
- Inference: the safest competition is with one's own record. Parallax's block-level best is the right base.

**Leaderboards and social comparison**
- Pull: a leaderboard raised quantity over points (Mekler 2017: d = .39) and worked like a difficult goal, but only for people committed to it (Landers 2017).
- Harm: no gain in intrinsic motivation (Mekler 2017); lower motivation, satisfaction and exam scores in a badge-plus-leaderboard course (Hanus & Fox 2015, *secondary summary only*); lower motivation for the bottom third of an absolute board (Bai et al. 2021). Leagues drew the most complaints in the Duolingo misuse study. Competition helps most when combined with collaboration (Sailer & Homner 2020, D).
- Inference: no board inside Parallax (none is possible without a server). Comparison happens only where a player chooses it, on identical items, and is paired with something cooperative.

**Quests and goals**
- Pull: specific, self-referenced goals and visible progress (above); choice raises intrinsic motivation (d = 0.30–0.36) and perceived competence (d = 0.59), most with 2–4 successive choices (Patall et al. 2008). Duolingo orders its daily quests from an easy starter to forward progress, and moved a monthly challenge from points to quests to stop last-days farming (company blog).
- Harm: goals tied to time or logins become engagement-contingent rewards (Lehtivuori 2023).
- Inference: a small weekly menu of skill and good-practice quests, chosen by the player, expiring quietly.

**Variable rewards**
- Pull: an uncertain reward made more people finish an unpleasant task (Shen, Fishbach & Hsee 2015, *secondary, Chicago Booth Review*). A quiz game with chance-based point doubling, competition and escalating stakes gave more engagement and learning than plain quizzing (Howard-Jones et al. 2016, N = 24, within-subjects; retained gain 1.17 vs 0.75 items), with more stress, and uncertainty was not isolated. Uncertain *success* fed curiosity, the only predictor of play time (Kao et al. 2024).
- Harm: spending on random paid rewards correlates with problem gambling (r = .26; Garea et al. 2023, 15 studies). Reward-associated cues capture attention (Anderson 2011).
- Inference: keep the uncertainty in the task (every item sits at the edge, about 78 % success) and in *when* informational surprises arrive (firsts), never in prizes. No random loot, wheels, chests or multipliers.

**Unlockables and collections**
- Pull: no study isolates collections. A collection of creatures was part of the bundle that raised voluntary training (Dörrenbächer 2014). Sea Hero Quest added creature-photograph levels "for motivation only", stars that unlock boat changes, and levels that unlock in sequence (Coutrot et al. 2018, *full text, Methods*): 2,512,123 players finished level 1, and 24.9 % reached the eight levels needed for analysis.
- Harm: unlocking content by grinding is controlling (D). Steep drop-off along a locked sequence (Sea Hero Quest numbers above).
- Inference: collect what the player has *handled* (a map of settings reached), unlock nothing that is training.

**Narrative and theme**
- Pull: game fiction helped behavioural outcomes (Sailer & Homner 2020, D); story and teammates raised relatedness (Sailer et al. 2017, D); 38 of 49 gamified trainings used one (Vermeir 2020).
- Harm: theme changes outside play did nothing for learning (Katz 2014: slope 0.12 vs 0.10); a game version of an attention test masked the deficit the plain test found (Delisle & Braun 2011, *secondary, via Lumsden*).
- Inference: a light frame in names, the map and the cards; stimuli stay research-standard.

**Juice and game feel (feedback animation, sound, haptics)**
- Pull: success-dependent juice raised competence, curiosity and enjoyment (Kao et al. 2024, n = 1,699, preregistered). Medium and high juice beat none and extreme juice on experience, motivation, play time and performance (Kao 2020, *secondary, via Pichlmair & Johansen 2021*). Vibrotactile embellishments improved player experience over none, with low and high about equal (Waterloo haptics study, N = 38, *project page only*). Embellishments raised visual appeal (Hicks 2020 thesis, *partial text*).
- Harm: blanket amplification lowered competence and curiosity (Kao 2024). A juicy version was rated higher while players performed worse (Juul & Begy 2016, poster). Embellishments made players *feel* they did better without doing better, and did not change session length or return in a field deployment (Hicks 2020). Sound effects during the task slowed responses (Miranda & Palmer, *secondary*). Juice can hide what matters, and feedback that contradicts the rules confuses (Pichlmair & Johansen 2021).
- Inference: graded by how good the answer was, brief, between items, and never in a way that misstates performance. Moderate, not extreme.

**Sharing cards**
- Pull: no study of result cards was found (D found none). Progress monitoring works better when progress is reported publicly (Harkin 2016, moderator). Spoiler-free result grids spread Wordle (press, *secondary*). Duolingo reports that learners who follow friends are 5.6 times as likely to finish a course (company blog; correlational).
- Harm: public comparison pulls attention to the self (Kluger & DeNisi, D).
- Inference: cards are public progress records about the player's own change, opt-in, spoiler-free, with the Chimera link.

## 2. Designs for Parallax (Q2)

All of this section is **[Proposal]**, derived from section 1. Each design names the pull it keeps and the harm it avoids, so the lead can copy one DECISIONS line per mechanic (table 2.13).

### 2.0 Eight rules for the whole layer
1. Every number is about skill, matches the code, and carries a range where it is uncertain.
2. Nothing pays for time, logins, sessions or finishing. Volume is the weekly goal's job alone (it already exists and stays).
3. During an item only the task and the existing item counter are on screen: no score, meter, rank, theme art or effect (Katz 2014; owner's rule).
4. No count of consecutive days anywhere, and nothing missed is lost for good (owner's rule; Silverman & Barasch 2023 in D).
5. Compare with your own past by default; with others only on identical items, by choice, outside the app (cards and codes).
6. Feedback scales with how good the answer was, is brief, and comes between items (Kao 2024).
7. Uncertainty lives in the task (items at the edge) and in when informational surprises arrive, never in prizes.
8. The theme frames the instrument; it never touches stimuli.

### 2.1 Points for skill: challenge points and Reach
Two kinds of points, and no lifetime XP.
- **Challenge points.** Only in the Daily and the weekly Climb, where the items are fixed, identical for everyone and scored once. Daily: item k of the ramp (2.5) is worth k points, so 36 is the maximum; Climb: the height reached (2.6). Untimed, so speed earns nothing.
  - Pull: a score worth comparing in the Discord because everyone answered the same items.
  - Harm avoided: farming and volume pay (one scored attempt, fixed length; Baker 2004; Duolingo misuse study), speed distortion in untimed items (Dörrenbächer 2014).
- **Reach.** The sum of the player's best block levels over the training exercises (the non-PAT set the achievements already use; 13 exercises today, so 0–1,300; an exercise without a whole best block adds 0). It rises only when a whole block at a new best level is shown; it never falls, and absence cannot touch it. The summary shows the change with its cause: "Reach 412 (+6: Fold, best block 41 → 47)".
  - Pull: one growing number, a reason to try every exercise (breadth suits the portfolio bet on variability), a figure for cards.
  - Harm avoided: payment for time (only demonstrated skill moves it), decay for absence (Elevate's score falls with infrequent play), luck (a best needs a whole block at the level reference).
  - Wording: "the sum of your best levels in Parallax". Never an ability score, never compared with norms. It does grow when new exercises arrive; the card names the version.
- Rejected: points per right answer summed over Train. Sessions are time-boxed and success is held near the target, so such points ≈ skill × minutes, an engagement-contingent reward (−0.42 on later free choice, Lehtivuori 2023) that invites farming.

### 2.2 Grades: ranks on top of honest levels
- **Grade 1–10 per exercise** = the tenth of the range that contains the player's best block level (levels 1–10 → grade 1, …, 91–100 → grade 10). Because level tenths are Path stages, "Grade 6 on Fold" means "a whole block in stage 6's band", with that band's typical settings ("3 folds, 2 punches"). Passing the Path stage stays the stronger, separate milestone.
- Display: "Grade 6 · best 57 · now 54 (likely 49–59)". Grade and Reach move only at block ends and on the summary.
- Optional rank titles from Reach (one per 100), named in the theme's vocabulary; never Master, Expert, Elite, Genius or anything that implies a norm or a finished skill.
- Pull: tiers act as goals (Mekler 2017; Landers 2017) and give a moment to celebrate and share.
- Harm avoided: display during play (Katz 2014), decay for absence, mastery claims, population norms (Lumosity, BrainHQ percentiles).

### 2.3 Records (personal bests, widened)
- A records table per exercise: best block level (exists), the highest value handled on each dimension (exists as `maxRight`), best Speed rate, best Threshold estimate, best Daily points, best Climb height. Each with its date and Share.
- A PB goal, offered not imposed, at the start of a focus session: "Fold: best block 47. Within reach: 48". On the summary, small-area wording: "2 levels from your best". Nothing is said when a goal is missed.
- Pull: PB goals (Ginns 2018), self-competition, many small records for mixed levels.
- Harm avoided: comparison with others (Kluger & DeNisi), failure framing.

### 2.4 Firsts and the Atlas (the collection)
- **A first** is the first time a player handles a new cell of an exercise's settings map. "Handled" needs k right answers in that cell with g^k ≤ 0.1, so guessing alone explains it less than one time in ten (g = chance rate: open answers k = 1, four options k = 2, yes/no k = 4).
- **The Atlas**: per exercise, a grid over two chosen dimensions (a new `def.atlas = [dimA, dimB]`, defaulting to the two with most levels), 10–40 cells, each unseen, tried or handled, with the band of the player's current level overlaid. Cells fill from Train, Path, Speed, Free play, the Daily and the Climb; never from the Spatial Check.
- Firsts appear at block ends and on the summary ("First: 4 folds with 3 punches"), never during items.
- Pull: collection and visible growth that a beginner feels in session one; variety (it rewards covering settings, which the engine's selection already favours); unexpected, informational rewards (no undermining: d = −0.04).
- Harm avoided: grinding (each cell counts once, and the hard corner needs skill), locked content (nothing unlocks), chance-based reward (cause is always skill), attention (shown only between blocks and on its own screen).

### 2.5 Daily Challenge v2: a ramp, points, a calm history
- Items: still 8, still from the date, still no screen-dependent or PAT exercises, but on a **ramp**: item k at the pool entry nearest min + ((k − 0.5)/8)·(max − min) of its exercise's range, instead of all at the middle. Beginners usually clear the first items, experts are tested at the top, and nearly everyone usually succeeds, but not always.
- Points: Σ k over right items (max 36). The mark row keeps ramp order.
- Freeze the pool per epoch so every copy deals the same items (gap C11), or the comparison is not fair.
- History: a histogram of points and a count of Dailies played. No days-in-a-row count, no calendar of gaps.
- A missed day loses nothing: past Dailies stay playable from an archive, scored but marked "archive", outside the day's shared result.
- Share text keeps its shape and adds points and a mark row in Parallax's own symbols (no copied emoji grid).
- Harm avoided: a fixed medium difficulty that discourages beginners, chains, loss.

### 2.6 The weekly Climb (seeded ladder)
- Monday to Sunday (local), seeded by the week: 20 rungs, rung r at quantile (r − 0.5)/20 of its exercise's range, exercises rotating by the seed, untimed, same pool rules as the Daily. A run ends at the second miss (one spare). Height = rungs cleared.
- Three attempts a week, each on its own fixed seed set (A, B, C) that is the same for everyone; the best counts. A run left part-way resumes, as the Daily does.
- Card: the ladder drawn as a ruled scale with the height marked, the week, the Chimera link.
- Pull: a clear, renewable goal; tension at the edge (uncertain success feeds curiosity, Kao 2024); a fresh start every Monday (Dai 2014); a fair comparison in the Discord.
- Harm avoided: loss framing (the summary says "Height 13, your best this week"), timers, chains (a missed week costs nothing), farming (three attempts).
- Uncertain: one-life tension may stress some players; sketch 6.1 tests it.

### 2.7 Weekly field notes (quests)
- Each Monday the app offers three, the player keeps up to two: a small, real choice (Patall 2008: choice raised intrinsic motivation most with 2–4 successive choices). Templates, filled from the record:
  - a first on a named exercise;
  - beat your best block on any exercise;
  - do the review that is due (names the exercise);
  - try the least-seen variant of an exercise;
  - pass Path stage N on an exercise;
  - climb one rung higher than last week;
  - report a strategy after a session;
  - take the Spatial Check when it is due.
- Never: minutes, sessions, days in a row, logins, numbers of items.
- Completing one adds a line to the log and offers a card; no currency. Unfinished ones disappear on Sunday night without a message.
- Harm avoided: engagement-contingent rewards, controlling goals (the player chooses), warnings.

### 2.8 Reasons to come back that never punish
- Today lists what is waiting: the new Daily, Climb attempts left this week (stated plainly, no countdown), a review that is due, the chosen field notes, and "within reach": the nearest unhandled Atlas cell at the player's level.
- After a gap of 7 days or more, a fresh-start note: levels are where the player left them (ratings never decay; only their range widens), and the first block rechecks them. Never a count of missed days (Milkman 2021 rewarded return; Dai 2014).
- The weekly goal and its forgiving count stay exactly as they are (owner's decision).

### 2.9 Share cards at every high point (F4)
- Kinds: session, Daily (points and marks), Climb (height), grade, record, first or Atlas milestone ("Fold atlas: 12 of 15 cells"), start-versus-now, Spatial Check (the existing unused kind).
- **Start versus now** (F2, P2): after the third session or the first week, per exercise tried: the first settled level and settings, and now. One accurate line beside it: early gains include getting used to the task (Uttal et al. 2013 control groups, D).
- Look: an instrument printout (mono figures, ruled scale, the grade stamp); no ranks or percentiles; nickname only if typed; the Chimera line on every card (exists) and the Discord invitation at these moments (standing rules).

### 2.10 Theme: "the survey"
- A light frame in names only: the Atlas (the chart of handled settings), the Climb, Grades, Reach, field notes. The player charts the space of their own spatial skills with an instrument. No characters, mascot or story text; stimuli stay research-standard (Katz 2014: theme outside play neither helped nor hurt; Delisle & Braun: games can change the task).

### 2.11 Game feel
See section 5.

### 2.12 Not to build, and why
- Lifetime XP from right answers or time (volume pay, farming).
- Any leaderboard or league (no server; harms low scorers; most-complained Duolingo feature).
- Random rewards: chests, wheels, multipliers, rare drops (gambling-like; reward cut loose from skill).
- Currencies, gems, hearts, energy, lives (artificial scarcity; lives displays flattened learning in Katz 2014).
- Scores that decay with absence; counts of days in a row anywhere (owner's rule).
- Locked exercises or modes earned by grinding (controlling; D). Speed's readiness gate stays, with its stated reason.
- Population percentiles, brain age, IQ-like composites (Parallax rule; norms from self-selected users are not norms).
- Titles that imply mastery or norms.
- Running scores, meters or theme art during items.

### 2.13 One DECISIONS line per mechanic (for the lead)

| Mechanic | Pull kept | Harm avoided | Main evidence |
|---|---|---|---|
| Challenge points (Daily, Climb) | a comparable score | farming, volume pay, speed pressure | Mekler 2017; Baker 2004; Lehtivuori 2023 |
| Reach (sum of bests) | one growing number, breadth | pay for time, decay, luck | Lehtivuori 2023; Cerasoli 2014 |
| Grades 1–10 | tiers as goals, moments | display in play, decay, mastery words, norms | Mekler 2017; Katz 2014 |
| Records and PB goals | self-competition | social comparison, failure framing | Ginns 2018; Kluger & DeNisi 1996 |
| Firsts and the Atlas | collection, visible growth, variety | grinding, locks, random reward, attention | Lehtivuori 2023; Abramovich 2013 |
| Daily ramp and points | a daily shared puzzle for all levels | chains, loss, beginner discouragement | Dai 2014; Wordle commentary |
| Weekly Climb | renewable goal, tension, fair comparison | loss framing, timers, chains | Kao 2024; Dai 2014 |
| Field notes (quests) | chosen goals | time or login pay, pressure | Patall 2008; Harkin 2016 |
| Return without penalty | a reason to come back | punishing a missed day | Milkman 2021; Dai 2014 |
| Cards everywhere | public record, relatedness | rank comparison, spoilers | Harkin 2016; Sailer & Homner 2020 |
| Graded juice between items | feel, competence | attention costs, misleading feedback | Kao 2024; Juul & Begy 2016; Katz 2014 |

## 3. Current apps (Q3)

[Found] from public help pages, company blogs and press, paraphrased; none installed. Company figures are claims, not studies. Names appear here as research only; none of their names or units may enter the app (standing rules).

| App | Game layer (as described publicly) | What works for them (evidence level) | Problems seen |
|---|---|---|---|
| Duolingo | Points per lesson, weekly leagues (10 tiers, new each Sunday, cohorts matched on study habits and time zone, promotion and demotion, an occasional top-tier tournament), daily quests ordered from an easy starter to forward progress, monthly quests with a collectible badge, streak with freezes, friend streaks, weekly co-op Friends Quests (a random active friend, a shared target, five days), a gem currency, point boosts and timed chests (company blog; 2025 industry analysis). | Leagues: "a little competition" helped (2018 test, no figures). Re-weighting points towards new material: +1.8 M learning minutes a day. Following friends: 5.6× course completion (correlational). Their own quality metric weights new-material minutes double. (Company blog.) | Point farming on easy lessons, binge sessions, paid cheating tools, streak distress; leagues drew the most complaints (qualitative study, 2022). The company had to redesign points and monthly challenges to curb farming. |
| Lumosity | A performance index per game, per area and overall, mapped from a broad group of players' scores; updated each round against recent results; the weakest games drop out of area scores; a separate "how you compare" view (help centre). | — (no public evidence on the layer itself). | Population comparison from self-selected players; history of overclaiming (FTC 2016, D). |
| Elevate | A 0–5,000 proficiency score built from how well, how consistently and how variedly you play; six named levels up to "Master"; per-game rankings and top-10 scores; streak (help centre). | — | The score falls when you play less often (help centre), a penalty for absence; mastery wording. |
| Peak | A daily workout of 3–5 games (~10 min), a map of skill areas, a session score against earlier attempts, a streak; the full library behind a subscription (third-party review). | — | Paywalled variety; streak. |
| BrainHQ | 1–5 stars per exercise level from your percentile among other users at that level; baseline and best score per level; an age-group percentile chart; a map of every exercise and level shaded by how often you used it (product page). | — | Percentiles from self-selected users; the map shows use, not skill. |
| NeuroNation | Initial assessment, a performance profile, a personalised plan, progress graphs (third-party showcase). | — | — |
| Wordle (and daily puzzles) | One puzzle a day, the same for everyone, short, a spoiler-free result grid (press commentary). | Difficulty where players usually succeed but not always; comparison without head-to-head competition; fits a daily routine (a psychology professor in press, *secondary*). | Not checked here: its streak and statistics screens. |
| Lichess puzzles | A Glicko-2 rating for players *and* puzzles; puzzles chosen near your rating; themes; a run until the first mistake; a 3-minute timed run; races of 20 puzzles against others; a daily puzzle at midnight UTC; a dashboard by theme and a list of failed puzzles to retry (third-party documentation of the open-source code). | — | Timed and race modes need a server and reward speed. |
| Sea Hero Quest | A story (memories of a father with dementia), 5 areas × 15 levels unlocked in sequence, wayfinding and flare-shooting (path integration) levels scored with 1–3 stars, creature-photograph levels used only to motivate (no data kept), stars unlocking boat changes (Coutrot et al. 2018, Methods). | 2,512,123 players finished level 1, enough for population-scale navigation science. | 24.9 % reached the 8 levels needed for analysis: a locked sequence loses most players early. |
| CogniFit | Not researched (no source opened). | | |

[Inference] What the field converges on, and where Parallax can go further within its rules:
1. **Composite indices against self-selected populations** (Lumosity, Elevate, BrainHQ). Parallax already shows per-exercise levels with ranges and the real settings handled; grades and Reach (2.1–2.2) add the game number without a population.
2. **Scores that punish absence** (Elevate). Parallax's ratings never decay; only their range widens. Say so on the fresh-start note (2.8).
3. **Fair comparison** exists only where a server runs it (leagues, races). Parallax can offer fair comparison without a server: seeded items that every copy deals identically (Daily, Climb), with the result posted as a card. None of the brain-training apps above do this.
4. **Maps of use** (BrainHQ) vs **maps of skill**: the Atlas fills with settings actually handled, under a rule that excludes lucky guesses (2.4).
5. **A run until the first mistake** (Lichess) is a proven puzzle format; the Climb seeds it so a community can compare, adds a spare, and caps tries at three a week (2.6).
6. **High-information feedback**: Parallax's show-me replays after a miss (high-information feedback, d ≈ 0.99 in Wisniewski et al. 2020, D) go beyond right/wrong feedback; game feel should make them feel like part of play (section 5).
7. **Everything open, offline and free**, no notifications: variety is not a paid tier, and nothing pushes the player back.
8. **Measurement built in**: the Spatial Check gives the game layer something no competitor has, a check on whether the gains carry over. Cards for check results (2.9) make it a shareable event.

## 4. How much game: three options (Q4)

**[Proposal]** Three coherent packages. Each keeps the current honest core (levels with ranges, achievements, weekly goal with its forgiving count, the stimulus guard) and the eight rules of 2.0.

### Option A: Quiet plus (light)
- Contains: the game-feel pass (section 5); firsts listed on the summary (no Atlas screen); the records table and PB goals (2.3); the start-versus-now card; Share at every high point (2.9); Daily v2 with the ramp, points, calm history and archive (2.5); a weekly seeded challenge as a fixed set of 12 items on a ramp (no ladder); "within reach" and the fresh-start note (2.8).
- Leaves out: Reach, grades, the Atlas, the Climb, field notes, the theme.
- Risks: it may not read as "more game" to the owner; little grows over months besides levels; after the first month (Rodrigues 2022) only the Daily and the weekly set renew.
- Size: M.

### Option B: Instrument with a game layer (recommended)
- Contains: everything in A, plus grades 1–10 per exercise and Reach with optional theme titles (2.1–2.2); the Atlas with firsts (2.4); the weekly Climb instead of the fixed weekly set (2.6); field notes (2.7); the survey names (2.10).
- Risks and their controls:
  - More on screen on phones: grades and Reach live on the summary and Progress; the level stays the main number; Today shows at most three "waiting" lines.
  - Three new numbers beside the level (grade, Reach, points) may confuse beginners: the tour adds one line per number when it first appears, never more.
  - Reach shared in the Discord may be read as an ability score: the card says "sum of your best levels in Parallax vX".
  - One-life Climb may stress some players: one spare, three tries a week, untimed; sketch 6.1 decides.
  - Field notes may feel like chores: the player picks them, and they vanish without a message.
  - Build: L. The Atlas needs a `def.atlas` pair for each of the 19 training definitions; the Daily ramp and the Climb change seeded content, so their pools must be frozen per epoch; node tests for every rule in 2.0 that code can check (no score element during `px-stim`, no consecutive-day counts, Reach monotone, k-rule for firsts).
- Size: L.

### Option C: Full game
- Contains: everything in B, plus: a lifetime point total with diminishing returns; monthly seasons (a seeded season Atlas page and season card); cosmetic unlocks earned by grades (instrument themes, card styles); ghost duels (a friend's per-item results travel in the challenge code and are shown after each item); a cooperative weekly survey (each Climb card carries one seeded tile of a shared picture that the Discord assembles); a short text story around the survey; sound on by default.
- Risks: points that grow with time (volume pay, farming; Lehtivuori 2023, Baker 2004); expected rewards for performance (cosmetics; −0.24 to −0.39 on later free choice); more elements competing for attention near items (ghosts after every item; Katz 2014); drift towards the stock look of gamified apps; a longer first two minutes; size L+ to XL.
- Cheap and harmless pieces of C that could join B later if the Discord asks: the cooperative tile on the Climb card, and a ghost comparison shown on the summary only (not after each item).

### Recommendation: B
1. Gamified cognitive training raises motivation (g = 0.72) without changing learning in the trained domain (g = 0.27, n.s.), but elements inside the play space can flatten learning (Katz 2014). B keeps every element between items, so it takes the pull without that harm.
2. The undermining evidence ranks rewards for time, logins and finishing as the most harmful (−0.42 to −0.48) and informational feedback as helpful (+0.33). B has no volume pay; every number in it is information about skill.
3. The pull of a game layer fades after about four weeks (Rodrigues 2022). B adds three renewing sources (Daily, Climb, field notes) and two that grow with skill for months (grades and the Atlas).
4. Competence is where gamification helps least on average (Li, Hew & Du 2024) and where Parallax is strongest: grades, the Atlas and records all show real settings handled.
5. It builds on what exists (Path tenths, block bests, `maxRight`, shared seeds, cards), so most of the cost is interface, not engine.
A is the fallback if v1.2 must shrink; it covers the bar's six points thinly. C's extra pieces carry the harms the evidence warns about, for little gain over B.

## 5. Game feel inside a lab-instrument look (Q5)

### 5.1 What the evidence asks of feedback (from section 1)
- Graded by success, not fired on every action (Kao 2024); moderate, not extreme (Kao 2020, secondary); never so strong that players feel better than they did (Hicks 2020; Juul & Begy 2016).
- Nothing in the play space while the task runs (Katz 2014; Miranda & Palmer on sound, secondary).
- Verdict within about 0.5 s (D §5); steady marks, no flashing faster than 3 Hz, no saturated-red flashes, colour never alone, reduced motion honoured (D §7; Parallax rule 8).
- **Repository fact:** the signal accent (`--signal`) and the stimulus target colour (`--stim-target`) are the same value in both themes, and the accent also marks parts of stimuli in about ten exercises (Track's cue ring, Homing's position dot, marks in Angles, Cubes, Slice, Views, Span, Spin, Knots, Form, Openings; css/base.css, css/ex/*.css). **Inference:** celebrations should not be drawn in the accent, so that it does not become a reward colour inside stimuli (Anderson 2011; a small, lasting effect). Use ink, the right-green and shape for celebrations; keep the accent for focus and stimulus marks as now.
- **Repository fact:** stuttered frames void trials (rule 7). **Inference:** every effect must finish, or be cut, before the next item's first frame, and must use only compositor-friendly properties (transform, opacity, stroke-dashoffset), so it cannot cause the drops that void a trial.

### 5.2 Feedback moments (all between items or after a block) [Proposal]

| Moment | What happens | Time | Sound / haptic (both optional) | Reduced motion |
|---|---|---|---|---|
| Answer pressed | The chosen option sinks slightly and takes a hairline outline (input acknowledgement, not decoration). | < 50 ms, 80 ms long | — | outline only |
| Verdict, right | A tick draws itself like a plotter pen; the word and the response time in mono. | starts < 100 ms after the answer, draws in 160–200 ms | short rising pair (exists) / 10 ms tap | tick appears at once |
| Verdict, right on a stretch item (predicted success at least 0.10 below target) | The same tick plus one expanding hairline ring that fades, once; the time readout gets a small "stretch" tag. | ring 300 ms, single | a third note / 2 × 10 ms | static tag only |
| Verdict, miss | A cross, the word, the right option outlined; the show-me starts as now. No shake, no red flash. | < 100 ms; cross 160 ms | low tone (exists) / none | instant |
| Climb rung cleared | The height marker on a ruled scale steps up one tick (between rungs only); the rung number in the item counter updates. | 200 ms | pitch rises one step per rung | number only |
| Block end | The level needle sweeps from the old to the new value; the range band narrows into place. | 500–700 ms, ease-out | — | final state at once |
| Grade boundary crossed | A rectangular stamp ("GRADE 6 · FOLD") presses in at a slight angle, in ink; the new band's settings print beneath. | 250 ms stamp, 300 ms text | a short dull thud / 20 + 20 ms | stamp shown still |
| New record or first | A line types out in the records or firsts list; Reach rolls like a mechanical counter. | 40–60 ms per row; counter 500 ms | soft click per row (max 3) | static list |
| Atlas update (summary or Atlas screen) | Cells flip from tried to handled, staggered; at most 12 animate, the rest appear. | 200 ms each, 40 ms stagger | — | instant |
| Daily or Climb result | Marks reveal left to right, then the points or height. | 60 ms per mark | — | instant |

Every animation can be skipped with a tap. Sound stays off by default (as now) and haptics follow a separate switch, off by default. Assumption to test on devices: the Vibration API is missing in iOS Safari, so haptics are Android-only (not verified in this session).

### 5.3 Transitions
- Between items: the outgoing item fades in 120–150 ms; the next item paints clean, with the answer clock starting at its painted frame (rule 7). No camera moves or slides across the stimulus area.
- Between screens: a 200 ms slide or fade; none under reduced motion.
- The `body.px-stim` guard stays the single switch: CSS turns off every effect class under it, and the effect scheduler refuses to start, and cancels, while it is set.

### 5.4 Stock patterns the visual concept avoids (for LI4)
- Confetti, particle bursts, fireworks, screen shake, full-screen "LEVEL UP" banners.
- Flames, streak counters, calendars of consecutive days, "don't break the chain".
- Mascots, cartoon brains, pink brain art, light bulbs, puzzle-piece heads.
- Coins, gems, hearts, lives, energy bars, chests, loot boxes, spin wheels, multipliers.
- Trophies with laurels, gold/silver/bronze medals, crowns, podiums, "#1", "Top 5 %".
- Red notification dots, countdowns on the home screen, "only hours left".
- Glossy gradients, neon glow, glassmorphism, purple-to-teal hero gradients, 3D emoji.
- Glowing, pulsing XP bars; progress rings with sparkles.
- Generic praise copy ("Amazing!", "You're a genius!"), stacks of exclamation marks, praise aimed at the person.
- A copied emoji square grid for share text.
- Leaderboard tables.
- "Are you sure you want to quit?" and autoplay of the next session.

### 5.5 The instrument's own vocabulary to use instead
- Needles, dials and ruled scales with tick marks (levels, the Climb, Reach as a counter).
- Plotter strokes that draw themselves (ticks, crosses, the start-versus-now line).
- Ink stamps and specimen labels (grades, records, card headers), registration and crop marks on cards.
- Mechanical counters that roll (Reach, points).
- A hairline grid that the Atlas fills cell by cell, like a survey sheet being completed.
- Mono figures with units everywhere; one quiet accent for focus.

## 6. Sketches the owner should play first (Q6)

**[Proposal]** The three mechanics I am least sure are fun. Each sketch is a self-contained page for the decision board (phone first, 20–30 s, no saves), built with 2D placeholder items (for example a same-or-mirror letter shape) so no exercise code is needed. Each records one tap: "fun / fine / not fun" and a note.

### 6.1 The Climb: tension or stress?
- Play: a vertical ruled scale of 20 rungs beside the item area. Quick same-or-mirror items get harder by rung (bigger angle, then more strokes). Each right answer steps the marker up one tick with a rising note; a miss leaves a notch on the scale; the second miss ends the run, and a printout shows "Height 9 · best this week 9" and a card.
- Toggle: one spare (default) / no spare.
- Decides: ladder or fixed weekly set (Option B vs A), the spare count, whether a mixed-level player enjoys the edge or dreads it.

### 6.2 The grade moment and the juice level
- Play: five quick items with verdict feedback, then a block end: the needle sweeps from 47 to 52, crosses the grade 5/6 boundary, and the stamp presses in with the band's settings.
- Toggle: three juice levels, played in turn: quiet (no motion: marks appear), medium (the proposal in 5.2), strong (medium plus sound and the stretch ring on every right answer).
- Decides: the default juice level, and whether ranks feel earned and instrument-like or cheesy.

### 6.3 The Atlas: is collecting settings fun?
- Play: a 5 × 4 grid (folds × punches). Items come from cells near the edge of the filled area; a cell flips from tried to handled after two right answers, a "First: 4 folds, 3 punches" line types out, and at the end one "within reach" cell is outlined.
- Toggle: k = 1 or k = 2 right answers per cell.
- Decides: whether the Atlas is a main screen or a small panel on Progress, and whether the guessing rule feels fair.

Not sketched, with reasons: the Daily ramp and points (low risk, close to known daily puzzles); field notes (cannot be felt in 30 s; judge from the list in 2.7); Reach (a number, judged better on the summary mock-up).

## Sources

Sources already listed in docs/research/v1.0/D-motivation.md (Sailer & Homner 2020; Bai, Hew & Huang 2020; Sailer et al. 2017; Hamari 2017; Deci, Koestner & Ryan 1999; Kluger & DeNisi 1996; Kivetz, Urminsky & Zheng 2006; Nunes & Dreze 2006; Silverman & Barasch 2023; Uttal et al. 2013; Wisniewski et al. 2020; FTC 2016) are cited as D and not repeated. Reading level is given for each source below.

Gamified cognitive training
- Vermeir, J. F., White, M. J., Johnson, D., Crombez, G., & Van Ryckeghem, D. M. L. (2020). The effects of gamification on computerized cognitive training: Systematic review and meta-analysis. *JMIR Serious Games*, 8(3), e18644. https://games.jmir.org/2020/3/e18644 (DOI 10.2196/18644). Full text, first ~70 %.
- Lumsden, J., Edwards, E. A., Lawrence, N. S., Coyle, D., & Munafò, M. R. (2016). Gamification of cognitive assessment and cognitive training: A systematic review of applications and efficacy. *JMIR Serious Games*, 4(2), e11. https://pmc.ncbi.nlm.nih.gov/articles/PMC4967181. Full text.
- Katz, B., Jaeggi, S., Buschkuehl, M., Stegman, A., & Shah, P. (2014). Differential effect of motivational features on training improvements in school-based cognitive training. *Frontiers in Human Neuroscience*, 8, 242. https://doi.org/10.3389/fnhum.2014.00242. Full text.
- Dörrenbächer, S., Müller, P. M., Tröger, J., & Kray, J. (2014). Dissociable effects of game elements on motivation and cognition in a task-switching training in middle childhood. *Frontiers in Psychology*, 5, 1275. https://doi.org/10.3389/fpsyg.2014.01275. Full text, first half (transfer tables not read).
- Mohammed, S., et al. (2017). The benefits and challenges of implementing motivational features to boost cognitive training outcome. *Journal of Cognitive Enhancement*. https://doi.org/10.1007/s41465-017-0047-y; open copy https://escholarship.org/uc/item/70z8g918. Full text.
- Editorial (2024). Gamification as intervention strategy for neuropsychological rehabilitation. *Frontiers in Psychology*. https://doi.org/10.3389/fpsyg.2024.1499643. Full text of the editorial only (the studies it summarises were not opened).

Gamification meta-analyses and field studies
- Li, L., Hew, K. F., & Du, J. (2024). Gamification enhances student intrinsic motivation, perceptions of autonomy and relatedness, but minimal impact on competency: a meta-analysis and systematic review. *Educational Technology Research and Development*, 72(2), 765–796. https://doi.org/10.1007/s11423-023-10337-7. Abstract (repository record https://repository.hku.hk/handle/10722/348034).
- Li, M., Ma, S., & Shi, Y. (2023). Examining the effectiveness of gamification as a tool promoting teaching and learning in educational settings: a meta-analysis. *Frontiers in Psychology*, 14, 1253549. https://doi.org/10.3389/fpsyg.2023.1253549. Full text.
- Rodrigues, L., et al. (2022). Gamification suffers from the novelty effect but benefits from the familiarization effect: Findings from a longitudinal study. *International Journal of Educational Technology in Higher Education*, 19. https://doi.org/10.1186/s41239-021-00314-6; open copy https://durham-repository.worktribe.com/OutputFile/1203232. Full text.
- Mekler, E. D., Brühlmann, F., Tuch, A. N., & Opwis, K. (2017). Towards understanding the effects of individual gamification elements on intrinsic motivation and performance. *Computers in Human Behavior*, 71, 525–534. https://doi.org/10.1016/j.chb.2015.08.048; copy https://glassmanlab.seas.harvard.edu/annotated_works/mekler17.pdf. Full text.
- Mekler, E. D., Tuch, A. N., Brühlmann, F., & Opwis, K. (2013). Disassembling gamification: The effects of points and meaning on user motivation and performance. CHI 2013 Extended Abstracts. https://research.aalto.fi/en/publications/disassembling-gamification-the-effects-of-points-and-meaning-on-u/. Record only (no results read; not cited above).
- Landers, R. N., Bauer, K. N., & Callan, R. C. (2017). Gamification of task performance with leaderboards: A goal setting experiment. *Computers in Human Behavior*, 71, 508–515. https://doi.org/10.1016/j.chb.2015.08.008. Abstract (paraphrase page https://experts.umn.edu/en/publications/gamification-of-task-performance-with-leaderboards-a-goal-setting/) and the first author's summary https://neoacademic.com/2015/09/30/gamification-works-a-lot-like-goal-setting.
- Bai, S., Hew, K. F., Sailer, M., & Jia, C. (2021). From top to bottom: How positions on different types of leaderboard may affect fully online student learning performance, intrinsic motivation, and course engagement. *Computers & Education*. https://opus.bibliothek.uni-augsburg.de/opus4/files/109038/109038.pdf. Full text.
- Hanus, M. D., & Fox, J. (2015). Assessing the effects of gamification in the classroom. *Computers & Education*, 80, 152–161. https://doi.org/10.1016/j.compedu.2014.08.019. Secondary only (UCLA Center for Mental Health in Schools summary, https://www.smhp.psych.ucla.edu/pdfdocs/gamil.pdf).
- Abramovich, S., Schunn, C., & Higashi, R. M. (2013). Are badges useful in education?: It depends upon the type of badge and expertise of learner. *Educational Technology Research and Development*, 61, 217–232. https://doi.org/10.1007/s11423-013-9289-2; author copy https://www.lrdc.pitt.edu/Schunn/papers/Abramovich-Schunn-Higashi.pdf. Full text.
- Dicheva, D., Caldwell, R., & Guy, B. (2020). Do badges increase student engagement and motivation? SIGITE '20. https://par.nsf.gov/servlets/purl/10290885. Full text.
- Investigating the causal relationships between badges and learning outcomes in SQL-Tutor (2022). *Research and Practice in Technology Enhanced Learning*. https://doi.org/10.1186/s41039-022-00180-4. Full text, first ~80 % (authors not recorded in this session).
- Duolingo misuse study: When gamification spoils your learning: A qualitative case study of gamification misuse in a language-learning app (2022). arXiv:2203.16175. https://arxiv.org/pdf/2203.16175. Full text.

Motivation, goals and returning
- Lehtivuori, A. (2023). *When do extrinsic rewards undermine intrinsic motivation? A meta-analysis.* Doctoral dissertation, University of Turku. https://utupub.fi/handle/10024/173853. Abstract.
- Cerasoli, C. P., Nicklin, J. M., & Ford, M. T. (2014). Intrinsic motivation and extrinsic incentives jointly predict performance: A 40-year meta-analysis. *Psychological Bulletin*, 140(4), 980–1008. Copy https://hillkm.com/EDUC_712/Cerasoli_Nicklin_Ford_2014.pdf; PubMed 24491020. Full text, first half; abstract for the quality/quantity result.
- Kao, D., Ballou, N., Gerling, K., Breitsohl, H., & Deterding, S. (2024). How does juicy game feedback motivate? Testing curiosity, competence, and effectance. CHI '24. https://doi.org/10.1145/3613904.3642656. Abstract (record https://spiral.imperial.ac.uk/entities/publication/253c32f5-d124-4a23-88b5-9aaaf114608d).
- Harkin, B., et al. (2016). Does monitoring goal progress promote goal attainment? A meta-analysis of the experimental evidence. *Psychological Bulletin*, 142(2), 198–229. https://eprints.whiterose.ac.uk/91437/. Abstract.
- Koo, M., & Fishbach, A. (2012). The small-area hypothesis: Effects of progress monitoring on goal adherence. *Journal of Consumer Research*, 39(3), 493–509. https://doi.org/10.1086/663827. Abstract (https://ideas.repec.org/a/oup/jconrs/doi10.1086-663827.html).
- Villar, A., Callegaro, M., & Yang, Y. (2013). Where am I? A meta-analysis of experiments on the effects of progress indicators for web surveys. *Social Science Computer Review*. https://research.google/pubs/where-am-i-a-meta-analysis-of-experiments-on-the-effects-of-progress-indicators-for-web-surveys/. Abstract.
- Ginns, P., Martin, A. J., Durksen, T. L., Burns, E. C., & Pope, A. (2018). Personal Best (PB) goal-setting enhances arithmetical problem-solving. *The Australian Educational Researcher*, 45(4), 533–551. https://doi.org/10.1007/s13384-018-0268-9. Abstract.
- Martin, A. J., Collie, R. J., Mok, M. M. C., & McInerney, D. M. (2016). Personal best (PB) goal structure, individual PB goals, engagement, and achievement. *British Journal of Educational Psychology*, 86(1), 75–91. https://repository.eduhk.hk/en/publications/personal-best-pb-goal-structure-individual-pb-goals-engagement-an-5/. Abstract.
- Patall, E. A., Cooper, H., & Robinson, J. C. (2008). The effects of choice on intrinsic motivation and related outcomes: A meta-analysis of research findings. *Psychological Bulletin*, 134(2), 270–300. https://selfdeterminationtheory.org/wp-content/uploads/2019/10/2008_PatallCooperRobinson_PsychBulletin.pdf. Full text, first half (moderator tables not read; abstract for moderators).
- Dai, H., Milkman, K. L., & Riis, J. (2014). The fresh start effect: Temporal landmarks motivate aspirational behavior. *Management Science*, 60(10), 2563–2582. https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf. Full text, first ~90 %.
- Milkman, K. L., et al. (2021). Megastudies improve the impact of applied behavioural science. *Nature*, 600, 478–483. https://doi.org/10.1038/s41586-021-04128-4. Full text (copy at https://Www.Gwern.net/doc/statistics/prediction/2021-milkman.pdf).
- Baker, R. S., Corbett, A. T., Koedinger, K. R., & Wagner, A. Z. (2004). Off-task behavior in the cognitive tutor classroom: When students "game the system". CHI 2004. https://hci.rwth-aachen.de/materials/conferences/CHI2004/1p383.pdf. Full text. Also Baker's retrospective, https://learninganalytics.upenn.edu/ryanbaker/PSCS-gaming-v6.pdf (full text; no numbers used).
- Anderson, B. A., Laurent, P. A., & Yantis, S. (2011). Value-driven attentional capture. *PNAS*, 108(25), 10367–10371. https://andersonlab.sites.tamu.edu/wp-content/uploads/sites/36/2016/09/PNAS_2011.pdf. Full text.

Variable rewards
- Shen, L., Fishbach, A., & Hsee, C. K. (2015). The motivating-uncertainty effect: Uncertainty increases resource investment in the process of reward pursuit. *Journal of Consumer Research*, 41(5). https://doi.org/10.1086/679418. Secondary only (Chicago Booth Review, https://www.chicagobooth.edu/review/uncertainty-can-improve-motivation).
- Howard-Jones, P. A., Jay, T., Mason, A., & Jones, H. (2016). Gamification of learning deactivates the default mode network. *Frontiers in Psychology*, 6, 1891. https://doi.org/10.3389/fpsyg.2015.01891. Full text, first ~60 %.
- Garea, S. S., Drummond, A., Sauer, J., Hall, L. C., & Williams, M. A. (2023). Meta-analysis of the relationship between problem gambling, excessive gaming and loot box spending. *International Gambling Studies*. https://figshare.utas.edu.au/articles/journal_contribution/Meta-analysis_of_the_relationship_between_problem_gambling_excessive_gaming_and_loot_box_spending/22996898. Abstract.

Game feel
- Pichlmair, M., & Johansen, M. (2021). Designing game feel: A survey. *IEEE Transactions on Games*. https://arxiv.org/abs/2011.09201. Full text (summarised).
- Kao, D. (2020). The effects of juiciness in an action RPG. *Entertainment Computing*. https://dblp.uni-trier.de/rec/journals/entcom/Kao20.html. Secondary only (via Pichlmair & Johansen).
- Juul, J., & Begy, J. (2016). Good feedback for bad players? A preliminary study of 'juicy' interface feedback. Poster, DiGRA/FDG 2016. https://adk.elsevierpure.com/en/publications/good-feedback-for-bad-players-a-preliminary-study-of-juicy-interf. Abstract.
- Hicks, K. (2020). *Juicy game design: Exploring the impact of juiciness on the player experience.* PhD thesis, University of Lincoln. https://core.ac.uk/download/492524999.pdf. Partial text (first ~30 %; result tables not reached).
- University of Waterloo Haptic Experience Lab. Juicy haptic design: Vibrotactile embellishments can improve player experience in games. https://uwaterloo.ca/haptic-experience-lab/projects/juicy-haptic-design-vibrotactile-embellishments-can-improve. Project page only.

Apps (public descriptions; company claims are not studies)
- Duolingo blog: "Time spent learning well", https://blog.duolingo.com/time-spent-learning-well; "Leaderboards", https://blog.duolingo.com/duolingo-leagues-leaderboards/; "Friends Quests", https://blog.duolingo.com/friends-quests/. Full pages.
- Deconstructor of Fun (2025). Duolingo: how the app uses gaming principles to supercharge DAU growth. https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth. Full page (industry analysis; most numbers uncited).
- Lumosity help centre, "How is LPI calculated?", https://help.lumosity.com/hc/articles/202429830. Full page.
- Elevate support, "What is EPQ and how is it calculated", https://support.elevateapp.com/hc/en-us/articles/4402971643803-What-is-EPQ-and-how-is-it-calculated, and "Why am I losing EPQ", https://support.elevateapp.com/hc/en-us/articles/4402979196187-Why-am-I-losing-EPQ. Full pages.
- Peak: third-party review, https://nibble-app.com/blog/peak-app-review. Full page (secondary).
- BrainHQ, "Understand progress", https://www.brainhq.com/why-brainhq/brain-training-your-way/understand-progress. Full page.
- NeuroNation: third-party showcase, https://screensdesign.com/showcase/neuronation-brain-training. Full page (secondary).
- Lichess puzzles: third-party documentation of the open-source code, https://mintlify.com/lichess-org/lila/features/puzzles. Full page.
- Tufts Now (2022). What our brains do when we play Wordle. https://now.tufts.edu/2022/01/27/what-our-brains-do-when-we-play-wordle. Full page (press).
- Coutrot, A., et al. (2018). Global determinants of navigation ability (Sea Hero Quest). *Current Biology*; preprint https://www.biorxiv.org/content/10.1101/188870v7.full.pdf. Methods read.

## Could not open

Each item: what was needed, and the assumption used meanwhile. No core number in the proposals depends on any of them; the sketches (section 6) decide the uncertain feel questions.

1. **Kao (2020)**, The effects of juiciness in an action RPG, *Entertainment Computing* (https://dblp.uni-trier.de/rec/journals/entcom/Kao20.html). Needed: sample, the four juice levels as built, effect sizes on experience, play time and performance. Assumed (via Pichlmair & Johansen): medium and high juice beat none and extreme. Affects the default juice level (5.2), which sketch 6.2 tests.
2. **Kao, Ballou, Gerling, Breitsohl & Deterding (2024)** full text (https://doi.org/10.1145/3613904.3642656). Needed: what "amplification" and "success-dependence" looked like, and effect sizes. Assumed: feedback that scales with success beats feedback amplified for every action.
3. **Hanus & Fox (2015)** full text (https://doi.org/10.1016/j.compedu.2014.08.019). Needed: N, duration, effect sizes, mediation. Used for direction only (secondary).
4. **Kyewski & Krämer (2018)**, *Computers & Education* (https://dblp.uni-trier.de/rec/journals/ce/KyewskiK18.html). Needed: badge effects on intrinsic motivation, activity and performance. Assumed null on intrinsic motivation (secondary, via Dicheva 2020).
5. **Denny et al. (2018)**, Empirical support for a causal relationship between gamification and learning outcomes, CHI 2018 (no link found in this session). Needed: design, sample, effects on practice and exam. Used +4.5 % on the exam (secondary, via the SQL-Tutor paper).
6. **Prins et al. (2011)**, *Cyberpsychology, Behavior, and Social Networking* (PubMed 20649448; the page was blocked). Needed: design and effect sizes. Used Lumsden's numbers (secondary).
7. **Miranda & Palmer (2013)** and **Hawkins et al. (2013)** (cited in Lumsden 2016). Needed: design and effects of sound effects and gamelike features on data. Used Lumsden's summaries.
8. **Shen, Fishbach & Hsee (2015)** (https://doi.org/10.1086/679418). Needed: numbers and boundary conditions. Secondary only; no proposal uses random rewards.
9. **Lehtivuori (2023)** full dissertation (https://utupub.fi/handle/10024/173853). Needed: the age and task-interest moderators. Used the abstract's figures.
10. **The Waterloo juicy-haptics paper** (authors, venue, statistics; project page above). Assumed low and high vibrotactile embellishments both beat none.
11. **Vibration API on iOS Safari.** Not checked. Assumed unsupported, so haptics are Android-only until tested on devices.
12. **Not opened because the shared search budget ran out:** Armstrong & Landers (2017) on narrative in gamified training; Galak, Kruger & Loewenstein (2013) and Nelson & Meyvis (2008) on satiation and breaks (would support one scored Daily per day; the limit rests on fair comparison instead); Hamari, Koivisto & Sarsa (2014); the statistics and streak screens of NYT Games; Chess.com puzzle modes; CogniFit. No proposal depends on them.
