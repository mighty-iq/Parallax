# ACCESS: sources the research could not open (v1.0, v1.1, v1.2)

Merged 2026-11-18 (UTC) from the "could not open" lists of every research note, plus the unread items named in the v1.0 notes. Each row is a source the researcher could not read in full (or at all), what was needed from it, and what was assumed meanwhile.

How to use it: the owner can send a PDF of any source, or paste a link into the chat. The notes named in the last column are then re-checked and the assumption replaced by the real figure. Rank order for v1.2 is in the first section.

Conventions:
- Paths in the Note column are relative to `docs/research/`; "§" is the section of that note.
- One row per source within a version. If a source was listed by several notes of the same version, the row names all of them. A source that appears in more than one version has a row in each, with a cross-reference.
- Links are exactly as given in the notes. "From memory" means the note itself says the identifier was not checked. "None given" means the note gave no link.
- A row can group sources that a note listed together (marked "grouped"). Counts at the end of the file count rows.
- Only specific sources are listed. Search topics that were never searched (for example "no study found yet") are not rows.

On 2026-11-18 the owner sent eight of the ranked v1.2 sources and the DAT Candidate Guide; rows marked READ point to the addenda in the notes. Kao (2020) stays unread; the owner's rating of the celebration sketch settled what it was needed for.

## v1.2: ranked by how much the design leans on them

Ranking: tier 1 = a core design decision or a number in the plan depends on it (parameter value, format fact, acceptance threshold); tier 2 = it would change what is built; tier 3 = wording or a citation only. No tier 3 entry made the top 10.

| Rank | Tier | Source | Link | Exactly what is needed | Decision that depends on it | Open copy likely? |
|---|---|---|---|---|---|---|
| 1 | 1 | ADA Perceptual Ability Test section instructions (official sheet) | https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/education/perceptual_ability_test_section_instructions.pdf | Options per part (above all paper folding, now taken as five), the fold-count wording, whether five painted sides is asked, the style of the example figures | The format of the PAT-style exercises and the "test range" tags on their levels (`v1.2/D1-pat-formats.md` §2.4, §6.9 risk 1) | Likely: an official free document; it was only not fetched **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| 2 | 1 | Terlecki, Newcombe & Little (2008), repeated mental-rotation testing | https://doi.org/10.1002/acp.1420 | How much a test-only group gains over many repeated rotation tests across weeks, and whether the gain keeps growing (N, session count, gains per session) | The familiarity curve in the probe simulation, and with it whether the acceptance (a 0.5 SD gain shown as "likely gain" at week 4) can be restated (`v1.2/M1-measurement.md` §5.5; scenarios famTail, famBig) | Unknown **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| 3 | 1 | Wiener & Mallot (2006), route segments and path integration | https://doi.org/10.1207/s15427633scc0604_3 | Segment counts, path lengths, pointing errors and response times at matched total length and turning | The 0.55-logit cost per extra leg in Reckon's `route` dimension, now a hand-set prior (`v1.2/N1-reckon.md` §2.4) | Unknown **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| 4 | 1 | Sliwinski et al. (2018), smartphone bursts, full text | https://doi.org/10.1177/1073191116643164 | Practice curve over the protocol, sessions per person, and the variance components (within-person against between-person) | The occasion-noise and reliability parameters of the Spatial Check simulation and the number of short sessions needed (`v1.2/M1-measurement.md`, Could not open; parameter table) | Unknown **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| 5 | 1 | Morgan & Glennerster (1991), locating centres of dot clusters | None given (DOI from memory, unchecked: 10.1016/0042-6989(91)90165-2) | How many dots observers effectively use, and their thresholds | The tolerance and dot-count levels of Central Point (centroid noise now taken as about 27-29 % of cloud SD from another paper) (`v1.2/C1-central-point.md` §2.1) | Unknown **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| 6 | 1 | Rijmen & De Boeck (2002), random-weights LLTM | https://doi.org/10.1177/0146621602026003003 | Size of person-specific weight variances estimated in real data | The spread f = 0.3-0.5 used to test per-person targeting of difficulty (`v1.2/P1-plateaus-progress.md`, Could not open; targeting acceptance) | Unknown **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| 7 | 2 | Klatzky et al. (1998), visual turns and heading updates | https://doi.org/10.1111/1467-9280.00058 | Display and field of view of the optic-flow condition; whether the heading failure was complete or partial; error against turn angle | Whether the heading-update check and heading rung stay as designed; at present kept either way (`v1.2/N1-reckon.md` §2.1) | Unknown; older journal article, a lab or author copy may exist **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| 8 | 2 | ADA DAT Candidate Guide (current edition) | None given (ada.org; not fetched) | Rules on test-content confidentiality and recalled items; the part instructions and clock | How closely PAT-style exercises may mirror the real test and what they may be called (`v1.2/D1-pat-formats.md`, Could not open) | Likely: an official guide for candidates **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| 9 | 2 | Atkinson, Derry, Renkl & Wortham (2000); Renkl & Atkinson (2003); Atkinson, Renkl & Merrill (2003) | https://doi.org/10.3102/00346543070002181; https://doi.org/10.1207/S15326985EP3801_3; https://doi.org/10.1037/0022-0663.95.4.774 (all from memory, unchecked) | Whether fading worked steps one at a time beats example-then-problem pairs for novices, and the size of the effect; effect of self-explanation prompts | The faded Try 1 and Watch steps of the first band (`v1.2/D2-first-band.md` §3.0) | Unknown **Atkinson et al. 2000 READ in full 2026-11-18** (the owner's copy; note D2 addendum); the 2003 papers are still unread. |
| 10 | 2 | Kao (2020), juiciness in an action RPG | https://dblp.uni-trier.de/rec/journals/entcom/Kao20.html | Sample, the four juice levels as built, effect sizes on experience, play time, performance | The default juice level of the grade moment (sketch §6.2 tests it on devices) (`v1.2/G1-game-layer.md` §5.2, §6.2) | Unknown |

## v1.0 (notes A to D)

Only items the notes say were not checked, not retrieved or not read are listed. Fields tagged unverified in the reference lists (volume, pages, DOI recalled from memory) are not listed: the paper itself was not the problem there.

| Source | Link | What was needed | Assumption used meanwhile | Note |
|---|---|---|---|---|
| Karaçalı Taze (2026), three-level meta-analysis of spatial-thinking interventions (dataset record) | https://doi.org/10.5281/zenodo.22303875 | The results; the linked article was not found | Not used for any effect size | v1.0/A-evidence.md §1.2 table, §9 |
| Hegarty (2010), Components of spatial intelligence | https://doi.org/10.1016/S0079-7421(10)52007-3 | Chapter text | Framing taken from secondary descriptions | v1.0/A-evidence.md §5, §9 |
| Chu & Kita (2011), gestures in spatial problem solving | https://doi.org/10.1037/a0021790 | Text and effects | Gesture claim stated at summary level | v1.0/A-evidence.md §5, §9 |
| Keehner et al. (2008), spatial reasoning with external visualisations | https://doi.org/10.1080/03640210801898177 | Details beyond the title | Mixed evidence on interaction against viewing | v1.0/A-evidence.md §5, §9 |
| Trick, Mutreja & Hunt (2012), spatial and visuospatial WM predict MOT | None given | Coefficients | Direction only | v1.0/A-evidence.md §6, §9 |
| Tullo, Faubert & Bertone (2018), 3D-MOT and fluid reasoning | https://doi.org/10.1016/j.intell.2018.06.001 | r and N | Marked magnitude unverified | v1.0/A-evidence.md §6, §9 |
| te Nijenhuis, van Vianen & van der Flier (2007), score gains on g-loaded tests | https://doi.org/10.1016/j.intell.2006.07.006 | Coefficients | Gains judged not to be on g, from the abstract | v1.0/A-evidence.md §7, §9 |
| Sorby, Veurink & Streiner (2018), spatial instruction and STEM outcomes | https://doi.org/10.1016/j.lindif.2018.09.001 | Effect sizes | Positive, magnitudes unknown | v1.0/A-evidence.md §2.1, §9 |
| Sorby et al. (2013), regression-discontinuity study (primary) | None given | The primary paper | Small effect, as reported by Stieff & Uttal (2015) | v1.0/A-evidence.md §2.1 |
| Stieff et al. (2014), strategy training in chemistry | https://doi.org/10.1037/a0034823 | N, dose, effect size | Qualitative result only | v1.0/A-evidence.md §2.3, §9 |
| Feng, Spence & Pratt (2007), action video game and spatial cognition | https://doi.org/10.1111/j.1467-9280.2007.01990.x | N and follow-up | Not quoted | v1.0/A-evidence.md §3, §9 |
| Terlecki, Newcombe & Little (2008), repeated testing and Tetris | https://doi.org/10.1002/acp.1420 | N | Large gains lasting months, from secondary reports | v1.0/A-evidence.md §3, §9 (see also v1.2/M1) **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| VSI retest gains in the WISC-V and WAIS-5 manuals | None given | The manual tables | Retest gains from other sources | v1.0/A-evidence.md §7, §9 |
| Mekler et al. (2017), individual gamification elements | https://doi.org/10.1016/j.chb.2015.08.048 | The abstract and numbers | Points and levels raise output, not intrinsic motivation (unverified) | v1.0/D-motivation.md §2 |
| Boone & Hegarty (2017), sex differences in mental rotation | None given | The primary paper | Described via Hegarty (2018) | v1.0/B-tasks.md §2 references (see also v1.2/T1) |
| European Journal of Psychological Assessment study on cube construction (authors and year not read) | https://doi.org/10.1027/1015-5759/a000534 | Authors, year and content | Cited by its title statement only | v1.0/C-progression.md References |

## v1.1 (notes R1 to R4; I1 and I2 listed nothing)

| Source | Link | What was needed | Assumption used meanwhile | Note |
|---|---|---|---|---|
| Klatzky et al. (1998), visual turns and heading updates | https://doi.org/10.1111/1467-9280.00058 | Visual-turn set-up, size of the heading failure by turn angle, whether any visual-only condition updated heading | Heading is not updated from vision alone; abstract and Riecke & Wiener (2007) | v1.1/R1-path-integration.md, flag 1 (v1.2 table below) **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| Stavropoulos et al. (2022), control dynamics in path integration | https://elifesciences.org/articles/63405 | Adaptation to control time constant, biases by control and modality | Not read in v1.1 (read in v1.2 through another copy) | v1.1/R1-path-integration.md, flag 2 |
| Lakshminarasimhan et al. (2018), Methods | https://pmc.ncbi.nlm.nih.gov/articles/PMC6190923 | Ground-plane densities, element size and lifetime, field of view | The preprint without Methods (Methods read in v1.2) | v1.1/R1-path-integration.md, flag 3 |
| Wiener & Mallot (2006), route segments | https://doi.org/10.1207/s15427633scc0604_3 | Segment counts, path lengths, errors and response times | Abstract only | v1.1/R1-path-integration.md, flag 4 (v1.2 below) **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| Wiener, Berthoz & Wolbers (2011), continuous against configural strategy | https://doi.org/10.1007/s00221-010-2460-7 | Path geometry, instructions, error sizes per strategy and length | Abstract only | v1.1/R1-path-integration.md, flag 5 (v1.2 below) |
| Fernandes & Feiner (2016), dynamic field-of-view restriction | None given (IEEE 3DUI) | Restriction amounts, timing, effect sizes, spatial-performance effects | Press release only | v1.1/R1-path-integration.md, flag 6 (v1.2 below) |
| Cao, Jerald & Kopper (2018), rest frames | https://doi.org/10.1109/VR.2018.8446210 | Rest-frame designs and effect sizes | Title and a lab page only | v1.1/R1-path-integration.md, flag 7 (v1.2 below) |
| Philbeck et al. (2001) | None given | Whole paper | Not used | v1.1/R1-path-integration.md |
| Bos, de Vries, van Emmerik & Groen (2010), fields of view and sickness | None given | Whole paper | Not used | v1.1/R1-path-integration.md |
| Segen et al. (2022), TICS | None given | Full text | Abstract only | v1.1/R1-path-integration.md |
| Lappe (2007) | None given | Full text and appendix | Abstract and appendix only | v1.1/R1-path-integration.md |
| Du (2020) | None given | Full text | Abstract only | v1.1/R1-path-integration.md |
| Kearns et al. (2002), Perception 31 | https://doi.org/10.1068/p3311 | Whole paper | Nothing rests on it | v1.1/R1-path-integration.md |
| Cherep et al. (2020), teleporting and spatial updating | None given | Whole paper | Nothing rests on it | v1.1/R1-path-integration.md |
| Bonato et al. (2008), vection change and sickness | None given | Whole paper | Nothing rests on it | v1.1/R1-path-integration.md |
| Keshavarz et al. (2015), vection and sickness | None given | Whole paper | Nothing rests on it | v1.1/R1-path-integration.md |
| Unidentified paper at PMC9270913 | PMC9270913 (as named in the note) | Identity and content | None | v1.1/R1-path-integration.md |
| MDN pages for ScreenOrientation.lock() and DeviceOrientationEvent.requestPermission() | None given | Behaviour of orientation lock and gyroscope permission | General knowledge, unverified | v1.1/R1-path-integration.md §7.4-7.5 |
| Kalun et al. (2020), full text | None given (cmej.ca) | Full text | Abstract only | v1.1/R2-knots.md |
| Jolicoeur, Ullman & MacKay (1986) | https://link.springer.com/article/10.3758/BF03198373 | Full text | Not read | v1.1/R2-knots.md |
| Instructional Science article from the knot-tying search (unidentified) | https://link.springer.com/article/10.1007/s11251-009-9119-4 | Identity and content | None | v1.1/R2-knots.md |
| Santos et al. record (venue) | None given (dblp) | Venue | Venue left unverified | v1.1/R2-knots.md |
| App Store page "Unknot: Trivialize the Loop" | None given (App Store) | Current features | None | v1.1/R2-knots.md |
| Ayres et al. (2009) | None given | Full text (not attempted) | None | v1.1/R2-knots.md |
| Schwan & Riempp (2004) | None given | Full text (not attempted) | None | v1.1/R2-knots.md |
| Pooresmaeili & Roelfsema (2014) | None given | Full text (not attempted) | None | v1.1/R2-knots.md |
| Eliahou, Kauffman & Thistlethwaite (2003) | None given | Full text (not attempted) | None | v1.1/R2-knots.md |
| Thistlethwaite (2001) | None given | Full text (not attempted) | None | v1.1/R2-knots.md |
| Cantarella et al. (2016) | None given | Full text (not attempted) | None | v1.1/R2-knots.md |
| Licence files and materials: pyknotid, KnotTheory`, KRT materials on OSF, Patil et al. supplement (grouped) | https://osf.io/x9uqe/ (KRT) | Licence terms and materials (not attempted) | None | v1.1/R2-knots.md |
| ADA PDFs (ada.org), figures and example items | None given | The PDFs themselves | The fetch tool's digest; figures and example items not seen | v1.1/R3-dat-pat.md |
| SDN attachment: ADA 2007 sample test | None given | The test PDF (returned binary data) | None | v1.1/R3-dat-pat.md |
| SDN attachments: 2018 and 2022 DAT guides (grouped; 2022 guide also in v1.2/D1) | https://forums.studentdoctor.net/attachments/2022-dat-guide-pdf.352352/ (2022, as given in v1.2/D1) | Official guide text | None | v1.1/R3-dat-pat.md (v1.2 below) |
| PMC9726233 (spatial ability in health-professions education) | PMC9726233 (PMC id) | Full text | Not read | v1.1/R3-dat-pat.md |
| PMC7068633 (spatial ability in health-professions education) | PMC7068633 (PMC id) | Full text | Not read | v1.1/R3-dat-pat.md |
| Gray & Deem (2002), PubMed 12117093 | PubMed 12117093 | Full text | Not read | v1.1/R3-dat-pat.md |
| PubMed 24192409 (haptic exercise as a predictor) | PubMed 24192409 | Full text (not tried) | None | v1.1/R3-dat-pat.md |
| PMC12712560 (video games and dental students' technical skills, 2025) | PMC12712560 (PMC id) | Full text (not tried) | None | v1.1/R3-dat-pat.md |
| Coy et al. (2003) | https://doi.org/10.1002/j.0022-0337.2003.67.1.tb03616.x | Full text | Not read | v1.1/R3-dat-pat.md |
| Novack et al. (2020), dental aptitude test as predictor | https://doi.org/10.1002/jdd.12331 | Full text and abstract | Not read | v1.1/R3-dat-pat.md |
| Ranney et al. (2005) review | https://doi.org/10.1002/j.0022-0337.2005.69.10.tb04010.x | Full text | Not read | v1.1/R3-dat-pat.md |
| Gansky et al. (2004) | https://doi.org/10.1002/j.0022-0337.2004.68.9.tb03848.x | Full text | Not read | v1.1/R3-dat-pat.md |
| Hegarty et al. (2009) | None given (ResearchGate) | Full text | Not read | v1.1/R3-dat-pat.md |
| peeref work 78352254 | None given | Identity and content | None | v1.1/R3-dat-pat.md |
| Scribd "2019 DAT Guide" | None given | Guide text | None | v1.1/R3-dat-pat.md |
| J Dent Educ 2013 PDF (Deep Blue) | None given | Text | None | v1.1/R3-dat-pat.md |
| Canadian DAT Candidate Guide | None given (media.cda-adc.ca) | Guide text | None | v1.1/R3-dat-pat.md |
| USPTO record of the ADA's DAT mark | None given | Mark status | None (also in v1.2/D1) | v1.1/R3-dat-pat.md (v1.2 below) |
| Prometric DAT tutorial | None given | On-screen look | None (also in v1.2/D1) | v1.1/R3-dat-pat.md (v1.2 below) |
| cognitivemetrics.com (whole site: CORE, VISA, APT, CAIT and related tests) | None given | Test formats, structure, norms | One secondary review and page titles; the tests stay unexplained | v1.1/R4-test-overlap.md (v1.2/C1 below) |
| Chimera Analogies Test pages (miyaguchi.4sigma.org) | None given | Format and date | Unconfirmed | v1.1/R4-test-overlap.md |
| Mega Test page (Wikipedia) | None given | Composition | Taken from the Ultra and Power Test pages | v1.1/R4-test-overlap.md |
| Corral & Burte (2025), full text | https://doi.org/10.1177/17470218251327076 | Full text | Catalogue-record abstract only | v1.1/R4-test-overlap.md |
| Klauer & Phye (2008) update | None given (academia.edu) | Full text | The update's abstract | v1.1/R4-test-overlap.md |
| Reasoning-training systematic review (2021) | None given (ResearchGate) | Full text | Not used | v1.1/R4-test-overlap.md |
| Pahor, Seitz & Jaeggi (2022), n-back and matrix reasoning | https://www.nature.com/articles/s41562-022-01384-w | Full text | Not used | v1.1/R4-test-overlap.md |
| Figural-analogies latent trait paper | https://pmc.ncbi.nlm.nih.gov/articles/PMC11277614 | Full text | Not used | v1.1/R4-test-overlap.md |
| Waschl, Nettelbeck & Burns (2017) | None given | Full text | Not relied on | v1.1/R4-test-overlap.md |
| Whitely & Dawis (1974) | None given | Full text | Not relied on | v1.1/R4-test-overlap.md |
| Schneider & Sparfeldt (2021a, 2021b) (grouped) | None given | Full text | Not relied on | v1.1/R4-test-overlap.md |

## v1.2 (notes C1, D1, D2, G1, M1, N1, P1, T1)

### C1 central point

| Source | Link | What was needed | Assumption used meanwhile | Note |
|---|---|---|---|---|
| cognitivemetrics.com, newest spatial exam | None given | Whether the format comes from one of its tests; grid, timing, scoring, norms | Test unidentified; overlap row describes format only | v1.2/C1-central-point.md §1, §7 (v1.1 above)  |
| Morgan & Glennerster (1991), Vision Research 31(12) | None given (DOI from memory: 10.1016/0042-6989(91)90165-2) | Dots effectively used and thresholds | Adults use the arithmetic mean; centroid noise 27-29 % of cloud SD (Drew et al. 2010) | v1.2/C1-central-point.md §2.1 **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| Vickers, Mayo, Heitmann, Lee & Hughes (2004) | None given | Steiner-tree task format and error distribution | 12 % above benchmark on 15-node problems, as another paper reports | v1.2/C1-central-point.md (Could not open)  |
| Whitney & Yamanashi Leib (2018), Annual Review of Psychology 69 | None given | Review of ensemble coding of position and practice effects | Primary studies that could be read | v1.2/C1-central-point.md §2.1  |
| Szafir, Haroz, Gleicher & Franconeri (2016), J Vis 16(5):11 | None given | Evidence for the chart-reading bridge and mean-interference risk | The risk is stated as a hypothesis | v1.2/C1-central-point.md §6  |
| Lee & Bednarz (2012), Journal of Geography 111(1) | None given | Whether its site-selection items serve as a far probe | Far row claims nothing about the items | v1.2/C1-central-point.md §7  |
| Esri help, "Median Center" | None given | Confirmation that it minimises total distance | Geometric-median reading from GRASS documentation | v1.2/C1-central-point.md (Could not open)  |

### D1 PAT formats

| Source | Link | What was needed | Assumption used meanwhile | Note |
|---|---|---|---|---|
| ADA PAT section instructions | https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/education/perceptual_ability_test_section_instructions.pdf | Option counts, fold-count wording, five painted sides, example figure style | v1.1 R3's digest; paper folding five options (prep source); look unknown | v1.2/D1-pat-formats.md §2.4, §6.9 **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| ADA DAT 2026 Candidate Guide | None given (ada.org) | Confidentiality and recalled-item rules, tutorial, part instructions and clock | v1.1 R3's reading; confidentiality unverified | v1.2/D1-pat-formats.md (Could not open) **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| Prometric DAT tutorial | https://www.prometric.com/exams/ada/ | On-screen look, marking, review, strike-out | Forum reports and prep products | v1.2/D1-pat-formats.md (Could not open) (v1.1 above)  |
| App Store, Crack DAT PAT | None given (id1467139544) | Current features and reviews | v1.1 R3's reading of 2026-11-13 | v1.2/D1-pat-formats.md (Could not open)  |
| SDN attachment "2022 DAT guide" | https://forums.studentdoctor.net/attachments/2022-dat-guide-pdf.352352/ | An official guide's confidentiality and PAT text | None | v1.2/D1-pat-formats.md (Could not open) (v1.1 above)  |
| EUR-Lex, Regulation (EU) 2017/1001, Art. 14 | https://eur-lex.europa.eu/eli/reg/2017/1001/oj/eng | The referential-use exception | Parallel to the UK provision, unverified | v1.2/D1-pat-formats.md (Could not open)  |
| Kaplan, "Understanding top-front-end dotted lines" | https://wpapp.kaptest.com/study/dat/understanding-top-front-end-dotted-lines/ | Dotted-line conventions | Other prep sources | v1.2/D1-pat-formats.md (Could not open)  |
| Justia record "DAT PERFECTER" | https://trademarks.justia.com/889/06/dat-88906775.html | Whether the ADA opposed third-party DAT marks | None | v1.2/D1-pat-formats.md (Could not open)  |
| Court opinions on test items and prep providers: ETS v. Katzman (1986), NCBE v. Multistate Legal Studies (1982), AAMC v. Mikaelian (1983), ISC2 v. Security University (2016) (grouped) | None given | Holdings | Prior knowledge, unverified, not relied on | v1.2/D1-pat-formats.md (Could not open)  |
| USPTO record of the ADA's DAT mark | None given | Mark status | R3's trademark reading | v1.2/D1-pat-formats.md (Could not open) (v1.1 above)  |

### D2 first band

| Source | Link | What was needed | Assumption used meanwhile | Note |
|---|---|---|---|---|
| Atkinson, Derry, Renkl & Wortham (2000), Rev Educ Res 70(2) | https://doi.org/10.3102/00346543070002181 (from memory) | Worked-example effect for novices | Worked examples help novices | v1.2/D2-first-band.md §3.0 C2 **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| Renkl & Atkinson (2003), Educ Psychol 38(1) | https://doi.org/10.1207/S15326985EP3801_3 (from memory) | Fading one step at a time against pairs; effect size | Fading helps near transfer | v1.2/D2-first-band.md, faded Try 1  |
| Atkinson, Renkl & Merrill (2003), J Educ Psychol 95(4) | https://doi.org/10.1037/0022-0663.95.4.774 (from memory) | Effect of self-explanation prompts | Prompts add to fading | v1.2/D2-first-band.md, faded Try 1  |
| Barbieri, Miller-Cotto, Clerjuste & Chawla (2023), Educ Psychol Rev 35, 11 | https://doi.org/10.1007/s10648-023-09745-1 (from memory) | Recent pooled worked-example effect | Moderate positive; no number used | v1.2/D2-first-band.md (Could not open)  |
| Pashler & Mozer (2013), JEP:LMC 39(4) | https://doi.org/10.1037/a0031679 (from memory) | Easy-to-hard fading in perceptual learning | Modest, conditional benefit | v1.2/D2-first-band.md (Could not open)  |
| Clare & Jones (2008), Neuropsychol Rev 18 | https://doi.org/10.1007/s11065-008-9051-4 (from memory) | Who benefits from errorless learning | Clearest benefit in memory impairment | v1.2/D2-first-band.md §2.5  |
| Metcalfe (2017), Annu Rev Psychol 68 | https://doi.org/10.1146/annurev-psych-010416-044022 (from memory) | Errors with feedback in healthy learners | As good as errorless or better | v1.2/D2-first-band.md §2.5  |
| Fyfe, McNeil, Son & Goldstone (2014), concreteness fading (also in T1) | https://doi.org/10.1007/s10648-014-9249-3 (D2, from memory); https://link.springer.com/content/pdf/10.1007/s10648-014-9259-1.pdf (T1); the two notes give different identifiers | Evidence for concreteness fading: study count, transfer comparisons, fading steps | Goldstone & Son (2005) stands in | v1.2/D2-first-band.md; v1.2/T1-transfer-portfolio.md §4.2  |
| Pollock, Chandler & Sweller (2002), Learn Instr 12(1) | https://doi.org/10.1016/S0959-4752(01)00016-0 (from memory) | Teaching elements in isolation first | Helps with many interacting elements | v1.2/D2-first-band.md §3.0 B2  |
| Ben-Chaim, Lappan & Houang (1988), Am Educ Res J 25(1) | https://doi.org/10.3102/00028312025001051 (from memory) | Effect of cube-building instruction | Positive; no number used | v1.2/D2-first-band.md (Could not open)  |
| Duesbury & O'Neil (1996), J Appl Psychol 81(3) | https://doi.org/10.1037/0021-9010.81.3.249 (from memory) | Practice with 3D models beside orthographic views | Yes; supports only | v1.2/D2-first-band.md Missing View scaffold  |
| Hsi, Linn & Bell (1997), J Eng Educ 86(2) | https://doi.org/10.1002/j.2168-9830.1997.tb00278.x (from memory) | Explicit strategy instruction in engineering graphics | Positive; Stieff et al. (2014) carries the claim | v1.2/D2-first-band.md (Could not open)  |
| Sorby (2009), IJSE 31(3), primary | https://doi.org/10.1080/09500690802595839 (from memory) | Module content and pre/post data | v1.0 note's secondary figures | v1.2/D2-first-band.md (Could not open)  |
| Sorby, Veurink & Streiner (2018), full text (also in T1; v1.0) | https://doi.org/10.1016/j.lindif.2018.09.001 | Effect sizes on grades and retention | Positive, magnitudes unknown | v1.2/D2-first-band.md; v1.2/T1-transfer-portfolio.md  |
| Ahissar & Hochstein (1997), full text | None given | Methods and size of the easy-first effect | Abstract only | v1.2/D2-first-band.md (Could not open)  |

### G1 game layer

| Source | Link | What was needed | Assumption used meanwhile | Note |
|---|---|---|---|---|
| Kao (2020), juiciness in an action RPG | https://dblp.uni-trier.de/rec/journals/entcom/Kao20.html | Sample, juice levels, effect sizes | Medium and high juice beat none and extreme (via Pichlmair & Johansen) | v1.2/G1-game-layer.md §5.2, §6.2  |
| Kao, Ballou, Gerling, Breitsohl & Deterding (2024), full text | https://doi.org/10.1145/3613904.3642656 | What amplification and success-dependence looked like; effect sizes | Feedback that scales with success beats uniform amplification | v1.2/G1-game-layer.md (Could not open)  |
| Hanus & Fox (2015), full text | https://doi.org/10.1016/j.compedu.2014.08.019 | N, duration, effect sizes, mediation | Direction only (secondary) | v1.2/G1-game-layer.md (Could not open)  |
| Kyewski & Krämer (2018), Computers & Education | https://dblp.uni-trier.de/rec/journals/ce/KyewskiK18.html | Badge effects | Null on intrinsic motivation (via Dicheva 2020) | v1.2/G1-game-layer.md (Could not open)  |
| Denny et al. (2018), CHI | None given | Design, sample, effects | +4.5 % on the exam (via a secondary paper) | v1.2/G1-game-layer.md (Could not open)  |
| Prins et al. (2011), Cyberpsychol Behav Soc Netw | None given (PubMed 20649448) | Design and effect sizes | Lumsden's numbers | v1.2/G1-game-layer.md (Could not open)  |
| Miranda & Palmer (2013); Hawkins et al. (2013) (grouped) | None given | Effects of sound and gamelike features on data | Lumsden's summaries | v1.2/G1-game-layer.md (Could not open)  |
| Shen, Fishbach & Hsee (2015) | https://doi.org/10.1086/679418 | Numbers and boundary conditions | Secondary only; no proposal uses random rewards | v1.2/G1-game-layer.md (Could not open)  |
| Lehtivuori (2023), dissertation | https://utupub.fi/handle/10024/173853 | Age and task-interest moderators | The abstract's figures | v1.2/G1-game-layer.md (Could not open)  |
| Waterloo juicy-haptics paper | None given (project page only) | Authors, venue, statistics | Vibrotactile embellishments beat none | v1.2/G1-game-layer.md (Could not open)  |
| Vibration API on iOS Safari (support check) | None given | Whether it is supported | Unsupported; haptics Android-only until device-tested | v1.2/G1-game-layer.md §5.2  |
| Armstrong & Landers (2017), narrative in gamified training | None given | Whole paper | No proposal depends on it | v1.2/G1-game-layer.md  |
| Galak, Kruger & Loewenstein (2013); Nelson & Meyvis (2008) (grouped) | None given | Satiation and breaks | One scored Daily rests on fair comparison instead | v1.2/G1-game-layer.md  |
| Hamari, Koivisto & Sarsa (2014) | None given | Whole paper | No proposal depends on it | v1.2/G1-game-layer.md  |
| NYT Games statistics screens; Chess.com puzzle modes; CogniFit (grouped) | None given | Product screens | No proposal depends on them | v1.2/G1-game-layer.md  |

### M1 measurement

| Source | Link | What was needed | Assumption used meanwhile | Note |
|---|---|---|---|---|
| Jacobson & Truax (1991), J Consult Clin Psychol 59(1) | None given (DOI from memory: 10.1037/0022-006X.59.1.12) | Exact reliable change index | Difference over sqrt(2) times SEM against z = 1.645 or 1.96 | v1.2/M1-measurement.md (Could not open)  |
| Chelune et al. (1993), Neuropsychology 7(1) | None given | Practice-adjusted RCI | Mean practice effect subtracted first | v1.2/M1-measurement.md (Could not open)  |
| Duff (2012), Arch Clin Neuropsychol 27(3) | https://pmc.ncbi.nlm.nih.gov/articles/pmid/22382384 | Review of change methods for serial testing | Gavett et al. (2015), Salthouse & Tucker-Drob (2008) | v1.2/M1-measurement.md (Could not open)  |
| Calamia, Markon & Tranel (2012), Clin Neuropsychol 26(4) | https://doi.org/10.1080/13854046.2012.680913 | Practice effects by domain | Bracketed by other meta-analyses | v1.2/M1-measurement.md (Could not open)  |
| Sliwinski et al. (2018), full text | https://doi.org/10.1177/1073191116643164 | Practice curve, sessions, variance components | Burst studies read in full | v1.2/M1-measurement.md (Could not open) **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| Terlecki, Newcombe & Little (2008) (also v1.0) | https://doi.org/10.1002/acp.1420 | Gain of a test-only group over many rotation tests | Familiarity may keep growing (scenarios famTail, famBig) | v1.2/M1-measurement.md (Could not open) **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| Beglinger et al. (2005), Arch Clin Neuropsychol 20 | None given | Alternate forms against practice | As Scharfen et al. (2018): delays but does not prevent | v1.2/M1-measurement.md (Could not open)  |
| Sliwinski (2008), Soc Personal Psychol Compass 2(1) | None given | Rationale and planning rules of burst designs | Salthouse (2007) and ambulatory studies | v1.2/M1-measurement.md (Could not open)  |
| Maris & van der Maas (2012), full text | None given | Information per item under time-limit scoring | Not used for probes | v1.2/M1-measurement.md (Could not open)  |
| Discretised signed-residual-time model paper | https://pmc.ncbi.nlm.nih.gov/articles/PMC8359328 | Same | Same | v1.2/M1-measurement.md (Could not open)  |

### N1 Reckon

| Source | Link | What was needed | Assumption used meanwhile | Note |
|---|---|---|---|---|
| Klatzky et al. (1998), full text | https://doi.org/10.1111/1467-9280.00058 | Optic-flow display and field of view; complete or partial failure; error by turn angle | Overturning by about the turn's size with body-turn responses (abstract) | v1.2/N1-reckon.md §2.1 (v1.1 above) **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| Wiener & Mallot (2006) | https://doi.org/10.1207/s15427633scc0604_3 | Segment counts, lengths, errors, times | Segment count alone adds no difficulty at fixed length and turning | v1.2/N1-reckon.md §2.4 (v1.1 above) **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| Wiener, Berthoz & Wolbers (2011) | https://doi.org/10.1007/s00221-010-2460-7 | Set-up, leg lengths, turn angles, error sizes | Configural more accurate on long paths, continuous faster (abstract) | v1.2/N1-reckon.md §2.5 (v1.1 above)  |
| Fernandes & Feiner (2016) | https://doi.org/10.1109/3DUI.2016.7460053 | Restriction amounts, timing, effects | Helps in headsets, not carried to phone-sized views | v1.2/N1-reckon.md §2.6 (v1.1 above)  |
| Cao, Jerald & Kopper (2018) | https://doi.org/10.1109/VR.2018.8446210 | Rest-frame designs, effect sizes | Fixation evidence used instead | v1.2/N1-reckon.md §2.7 (v1.1 above)  |
| Ishikawa & Zhou (2020), cognitive-mapping training | https://cognitiveresearchjournal.springeropen.com/articles/10.1186/s41235-020-00238-1 | Design, control, transfer tests, effects | None; not cited as evidence | v1.2/N1-reckon.md §1  |
| Tcheang, Bülthoff & Burgess (2011), PNAS | https://www.pnas.org/doi/10.1073/pnas.1011843108 | Whether a visual rotation gain carried over to blind walking | Du et al. (2020) used instead | v1.2/N1-reckon.md §1  |
| Bakker, Werkhoven & Passenier (2001), Presence 10 | None given | Feedback training of visual turn estimates and transfer | None | v1.2/N1-reckon.md §1  |
| Kober et al. (2013), J NeuroEng Rehabil | None given | Design and transfer tests | None | v1.2/N1-reckon.md §1  |
| Field-of-view and display-size studies: Teixeira & Palmisano 2021; Adhanom 2021; Al Zayer 2019; Bos 2010; Lin 2002; Sharples 2008; Stoffregen, Chen & Koslucher 2014 (grouped) | None given | Field-of-view restriction, sickness on small screens | Smaller displays give weaker vection (Keshavarz 2015); no proposal rests on these | v1.2/N1-reckon.md (Could not open)  |
| MDN DeviceOrientationEvent.requestPermission; W3C WCAG 2.3.3 Understanding page (grouped) | None given | iOS permission and secure-context rules; reduced-motion guidance | General knowledge, unverified | v1.2/N1-reckon.md (Could not open)  |

### P1 plateaus and progress

| Source | Link | What was needed | Assumption used meanwhile | Note |
|---|---|---|---|---|
| Gray & Lindstedt (2017), full text | https://doi.org/10.1111/cogs.12412 | How often plateaus preceded leaps; changepoint parameters | Abstract's qualitative claim; no rates quoted | v1.2/P1-plateaus-progress.md (Could not open)  |
| Doughty, Chase & O'Shields (2004), Behav Anal 27(1) | https://doi.org/10.1007/BF03392086 | Rate-building against accuracy practice | Wright et al. (2008), Ball et al. (2002) only | v1.2/P1-plateaus-progress.md (Could not open)  |
| Keller (1958), "The phantom plateau" | https://doi.org/10.1901/jeab.1958.1-1 | Critique of the telegraphy plateaus | Not used | v1.2/P1-plateaus-progress.md (Could not open)  |
| Smith et al. (2004), full text | None given | False-alarm behaviour of their criterion | Detector calibrated by simulation | v1.2/P1-plateaus-progress.md (Could not open)  |
| Steiner et al. (2000), Biostatistics 1(4) | https://doi.org/10.1093/biostatistics/1.4.441 | Exact risk-adjusted CUSUM and thresholds | Windowed slope test instead | v1.2/P1-plateaus-progress.md (Could not open)  |
| Adams & MacKay (2007), full text | None given | Hazard functions, cost per step | Named as a later option | v1.2/P1-plateaus-progress.md (Could not open)  |
| Rijmen & De Boeck (2002), Appl Psychol Meas 26(3) | https://doi.org/10.1177/0146621602026003003 | Size of person-specific weight variances | f = 0.3-0.5, to be estimated from pooled exports | v1.2/P1-plateaus-progress.md (Could not open) **READ in full 2026-11-18** (the owner's copy; see the addendum in the note that lists it). |
| Stieff et al. (2014); Meneghetti et al. (2017); Khooshabeh et al. (2013) (grouped) | None given | Effect sizes of strategy training and flexibility | Direction only | v1.2/P1-plateaus-progress.md (Could not open)  |
| Pan & Rickard (2015), full text | None given | Effect sizes after moderators | The abstract's conclusion | v1.2/P1-plateaus-progress.md (Could not open)  |
| Lomas et al. (2017), full text | None given | Which of novelty, choice, suspense changed engagement | Abstract only | v1.2/P1-plateaus-progress.md (Could not open)  |
| Bönstrup et al. (2019), Curr Biol 29 | https://doi.org/10.1016/j.cub.2019.02.049 | Size of rapid offline gains | Das et al. (2025), Gupta & Rickard (2024) | v1.2/P1-plateaus-progress.md (Could not open)  |
| Harris, Gliksberg & Sagi (2012), Curr Biol 22 | https://doi.org/10.1016/j.cub.2012.07.059 | Whether breaking adaptation unblocks learning | Not used | v1.2/P1-plateaus-progress.md (Could not open)  |
| Carvalho & Goldstone (2014), Mem Cognit 42 | https://doi.org/10.3758/s13421-013-0371-0 | When blocking beats interleaving | Brunmair & Richter's moderators | v1.2/P1-plateaus-progress.md (Could not open)  |
| Doroudi, Aleven & Brunskill (2019), IJAIED 29 | https://doi.org/10.1007/s40593-019-00187-x | How often RL sequencing beat baselines | Not used; rule-based changes kept | v1.2/P1-plateaus-progress.md (Could not open)  |
| Ericsson (2008), Acad Emerg Med 15 | https://doi.org/10.1111/j.1553-2712.2008.00227.x | Arrested-development account of plateaus | Not used | v1.2/P1-plateaus-progress.md (Could not open)  |
| Moè (2016), Intelligence 59 | https://doi.org/10.1016/j.intell.2016.10.004 | Strategy plus motivation instruction and mental rotation | Not used | v1.2/P1-plateaus-progress.md (Could not open)  |
| Pelánek publication list (2017 learner-modelling overview) | https://www.fi.muni.cz/~xpelanek/publications/ | Overview of AFM and PFA | Named as options only | v1.2/P1-plateaus-progress.md (Could not open)  |

### T1 transfer portfolio

| Source | Link | What was needed | Assumption used meanwhile | Note |
|---|---|---|---|---|
| Perkins & Salomon (1988), Educational Leadership 46(1) | https://files.ascd.org/staticfiles/ascd/pdf/journals/ed_lead/el_198809_perkins.pdf | Concrete bridging techniques | v1.0 C's summary (low road, high road) | v1.2/T1-transfer-portfolio.md §4.2  |
| Fyfe et al. (2014) (merged with D2 row above) | https://link.springer.com/content/pdf/10.1007/s10648-014-9259-1.pdf | Study count, transfer comparisons, fading steps | Goldstone & Son (2005) | v1.2/T1-transfer-portfolio.md §4.2  |
| Boone & Hegarty (2017), JEP:LMC 43(7) (also v1.0) | None given | N, effect of global-shape instruction, transfer to untrained items | Instruction improved performance and removed the sex difference (via Hegarty 2018) | v1.2/T1-transfer-portfolio.md, `strategy` grade B-  |
| Sorby, Veurink & Streiner (2018) (merged with D2 row above) | https://doi.org/10.1016/j.lindif.2018.09.001 | Effect sizes on grades and retention | Positive, magnitudes unknown | v1.2/T1-transfer-portfolio.md  |
| Johnson & Mayer (2010), full text | https://doi.org/10.1016/j.chb.2010.03.025 | N and content of the reasons menu | The abstract's effect sizes | v1.2/T1-transfer-portfolio.md §4.1, §4.2  |
| EEF Let's Think Secondary Science report | https://eprints.hud.ac.uk/id/eprint/29811/1/EEF_Project_Report_Lets_Think_Secondary_Science.pdf | Security rating and implementation fidelity | Trial page result, about -1 month of progress | v1.2/T1-transfer-portfolio.md  |
| Gentner, Loewenstein & Thompson (2003), primary | https://doi.org/10.1037/0022-0663.95.2.393 (as given in v1.0 C) | Exact comparison prompts | v1.0 C's summary, Smith & Gentner (2012), SERC workbook | v1.2/T1-transfer-portfolio.md  |
| Kotovsky & Gentner (1996), progressive alignment | None given | Order from close to far pairs | Same | v1.2/T1-transfer-portfolio.md  |
| Uttal & Cohen (2012) | None given | Support for measuring transfer as faster learning of new spatial tasks | Bransford & Schwartz (1999) alone | v1.2/T1-transfer-portfolio.md §5.2  |
| Lövdén et al. (2010), full text | None given | Recommended design features for training studies | The abstract only | v1.2/T1-transfer-portfolio.md  |
