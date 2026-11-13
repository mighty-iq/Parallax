# ACCESS: sources the v1.1 research could not open

Collected from the ACCESS section of each note (13 Nov 2026). The full context is in each note.


## From R1-path-integration.md
### Sources that could not be opened (or only partly)
| Source | What happened |
|---|---|
| Direct downloads from www.sfu.ca, rcastoragev2.blob.core.windows.net, escholarship.org, www.cmu.edu | The egress proxy refused the CONNECT (403, policy); the papers were read through WebFetch instead where possible (Riecke 2002, Harootonian 2020, Stangl 2020). Philbeck et al. 2001 (CMU) was not read. |
| Stavropoulos et al. 2022, eLife | elifesciences.org returned a client challenge (HTML and PDF); PMC8856658 a reCAPTCHA; Europe PMC rate-limited twice. Not read. |
| Lakshminarasimhan et al. 2018, Neuron (PMC6190923) | reCAPTCHA. The bioRxiv preprint was read instead, without Methods. |
| PMC9270913 (an Angelaki-lab paper from the search results) | reCAPTCHA; not identified. |
| Bos, de Vries, van Emmerik & Groen 2010 (internal and external fields of view and sickness) | The bohrium.com page served a firewall challenge. Not read. |
| Cao, Jerald & Kopper 2018 | The lab page had the title only; a Duke thesis on rest frames was behind a bot check. |
| Segen et al. 2022 (TICS) | Restricted PDF; abstract only. |
| Wiener 2011, Lappe 2007, Du 2020 (Springer) | Paywalled; abstract (and Lappe's appendix) only. |
| Wiener & Mallot 2006 | Abstract only (staff-profile page). |
| Klatzky et al. 1998 | No accessible copy found; secondary reports only. |
| Kearns et al. 2002 (Perception 31:349–374, https://doi.org/10.1068/p3311); Cherep et al. 2020 (teleporting and spatial updating); Bonato et al. 2008 (vection change and sickness); Keshavarz et al. 2015 (vection and sickness) | Not opened: found or remembered, but no accessible copy reached before the search budget ran out. Nothing in these notes rests on them. |
| MDN: ScreenOrientation.lock() and DeviceOrientationEvent.requestPermission() | Blocked ("provenance required"). The orientation-lock and gyroscope statements in §7.4–§7.5 are general knowledge, unverified in this pass. |
| Web search | The shared budget of 200 searches per turn ran out mid-task, so no further searches were possible: a randomised path-integration training study with transfer, an app-store survey, the player's earlier tool, published mobile WebGL performance budgets. |

### Flagged: core design decisions resting on papers not read in full
1. **Klatzky et al. 1998**, *Psychological Science* 9:293–298, https://doi.org/10.1111/1467-9280.00058. Rests on it: the "heading not updated" shortcut check, the heading-item rung, and the weight given to heading feedback. Needed: the set-up of the visual-turn condition (display, field of view, what the optic flow showed), how large the heading-update failure was (complete or partial, and against turn angle), and whether any visual-only condition updated heading. (Riecke & Wiener 2007, read in full, supports the general point.)
2. **Stavropoulos et al. 2022**, *eLife* 11:e63405, https://elifesciences.org/articles/63405. Rests on it: the control law for walking back and for the steering rung (velocity versus acceleration control). Needed: whether people adapt to the control time constant, the biases by control dynamics and by sensory modality, and the authors' view of which control best measures integration.
3. **Lakshminarasimhan et al. 2018**, *Neuron*, https://pmc.ncbi.nlm.nih.gov/articles/PMC6190923 (preprint read, without Methods). Rests on it: the levels of the `flow` dim. Needed: the ground-plane densities (elements per m²) of the sparse and dense conditions, element size and lifetime, field of view and joystick limits, to set the flow levels and their step size.
4. **Wiener & Mallot 2006**, *Spatial Cognition and Computation* 6:333–346, https://doi.org/10.1207/s15427633scc0604_3. Rests on it: the cost per extra leg in the `route` dim when total length and turning are held constant. Needed: segment counts, path lengths and the error and response-time data.
5. **Wiener, Berthoz & Wolbers 2011**, *Experimental Brain Research* 208:61–71, https://doi.org/10.1007/s00221-010-2460-7. Rests on it: the strategy cards (continuous versus configural) and the egocentric emphasis of 8.1(b). Needed: path geometry, the exact instructions, and the error sizes per strategy and path length.
6. **Fernandes & Feiner 2016**, IEEE 3DUI (press release read). Rests on it: the optional comfort vignette. Needed: restriction amounts and timing, effect sizes on sickness, and any effect on spatial performance.
7. **Cao, Jerald & Kopper 2018**, IEEE VR, https://doi.org/10.1109/VR.2018.8446210. Rests on it: the rest-frame recommendation. Needed: the rest-frame designs and their effect sizes.


## From R2-knots.md
- pmc.ncbi.nlm.nih.gov/articles/PMC11495958 (Croom & Firestone): reCAPTCHA. I read the author
  manuscript on PhilArchive instead.
- cmej.ca full text of Kalun et al. (2020): the permission request was not answered. Abstract read
  via DOAJ.
- link.springer.com/article/10.3758/BF03198373 (Jolicoeur, Ullman & MacKay 1986, by the DOI I
  expected): the permission request was not answered.
- link.springer.com/article/10.1007/s11251-009-9119-4 (an *Instructional Science* article from the
  knot-tying search; not identified): site error.
- elifesciences.org/articles/14320: needs JavaScript. Read the PDF instead.
- dblp.org record of Santos et al.: blocked by an anti-bot page, so the venue is unverified.
- cognitiveresearchjournal.springeropen.com (Bennett-Pierre et al.): the permission request was
  not answered. Read the PDF mirror at rcastoragev2.blob.core.windows.net instead.
- apps.apple.com, "Unknot: Trivialize the Loop": site error.
- Europe PMC REST API via curl: blocked by the session's proxy (403).
- Not attempted, for budget: the full texts of Ayres et al. (2009), Schwan & Riempp (2004),
  Pooresmaeili & Roelfsema (2014), Eliahou, Kauffman & Thistlethwaite (2003), Thistlethwaite
  (2001), Cantarella et al. (2016); pyknotid's licence file on GitHub; KnotTheory`'s licence; the
  KRT materials on OSF (https://osf.io/x9uqe/); Patil et al.'s supplement.


## From R3-dat-pat.md
- **ada.org PDFs by direct download.** The proxy denied them (HTTP 403, policy). They were read through the
  fetch tool's digest instead, so **their figures and example items were not seen**.
- **Student Doctor Network attachments.** "dat-test-2007-pdf" (the ADA 2007 sample test) came back as binary
  data, and direct download was denied (403). "2018_dat_guide-pdf" and "2022-dat-guide-pdf" were not tried.
- **PubMed and PMC** (reCAPTCHA):
  - PMC9726233 and PMC7068633 (spatial ability in health-professions education);
  - PubMed 12117093 (Gray & Deem 2002).
  - Not tried: PubMed 24192409 (haptic exercise as a predictor) and PMC12712560 (video games and technical
    skills in dental students, 2025).
  - PMC6820805 was read through a mirror.
- **Europe PMC REST full texts** for PMC9726233 and PMC7068633: the permission request timed out.
- **Wiley Online Library** (site errors):
  - Coy et al. 2003 (10.1002/j.0022-0337.2003.67.1.tb03616.x);
  - Novack et al. 2020, "Investigating Dental Aptitude Test results as predictors for preclinical and
    clinical scores" (10.1002/jdd.12331);
  - Ranney et al. 2005 review (10.1002/j.0022-0337.2005.69.10.tb04010.x);
  - Gansky et al. 2004 (10.1002/j.0022-0337.2004.68.9.tb03848.x).
- **zendy.io records** (empty pages): 10.21815/jde.018.043 and 10.1002/jdd.12331.
- **ResearchGate** (Hegarty et al. 2009): error. **peeref.com** work 78352254: login wall.
- **katalog.lib.cas.cz** records: bot block. **HAL** copy of Dillon et al.: bot block (the normalesup.org
  copy was read).
- **Other documents:**
  - Scribd "2019 DAT Guide": wrapper only.
  - Deep Blue (umich) J Dent Educ 2013 PDF: script page, no text.
  - JMIR PDF e68538: empty (the HTML version was read).
  - Canadian DAT Candidate Guide (media.cda-adc.ca): the permission request timed out.
- **Not searched, because the shared search budget ran out:**
  - published PAT retest or score-gain data;
  - studies relating prep practice-test scores to real PAT scores;
  - the USPTO record of the ADA's DAT mark;
  - the Novack 2020 abstract;
  - the Prometric DAT tutorial.


## From R4-test-overlap.md
| Source | What happened | Consequence |
|---|---|---|
| cognitivemetrics.com, every page (/, /test/CORE, /test/CORE/structure, /test/CORE/SA, /test/VISA, /test/VISA/AG, /test/1926-SAT/AG, /test/APT, /test/CAIT, /test/army-alpha, /updates, /forum, shared score reports) | WebFetch: client_error; curl through the agent proxy: 403, connect_rejected (host not allowed for this session); gifted.cognitivemetrics.com: robots_disallowed; web.archive.org copy: SITE_BLOCKED | CORE, VISA, APT, CAIT and ATAT are known only from one secondary review and page titles; "ATAT" stays unexpanded |
| reddit.com search of r/cognitiveTesting | SITE_BLOCKED | one thread read through a public mirror; no wider search of posts about an "analogical" test |
| miyaguchi.4sigma.org (Chimera Analogies Test, Bultas index, answer page) | WebFetch HTTPS → HTTP redirect loop; curl: host not resolved | the test's format and date unconfirmed |
| en.wikipedia.org/wiki/Mega_Test | permission request timed out (PROVENANCE_REQUIRED) | Mega Test composition taken from the Ultra and Power Test pages only |
| disboard.org (IQ tag listing) | client_error | — |
| doi.org/10.1177/17470218251327076 (Corral & Burte 2025, full text) | client_error | abstract only, from a catalogue record |
| academia.edu (Klauer & Phye 2008) | client_error | the 2008 numbers come from the update's abstract |
| researchgate.net, "Does reasoning training improve fluid reasoning and academic achievement for children and adolescents? A systematic review" (2021) | client_error | not used |
| nature.com/articles/s41562-022-01384-w (Pahor, Seitz & Jaeggi 2022, n-back → matrix reasoning) | client_error | not used |
| pmc.ncbi.nlm.nih.gov/articles/PMC11277614 (a figural-analogies latent trait model paper) | reCAPTCHA page | not used |
| Waschl, Nettelbeck & Burns 2017; Whitely & Dawis 1974; Schneider & Sparfeldt 2021a, 2021b | not opened (search titles or citations only) | not relied on |
| Further searches (bibliographic checks for te Nijenhuis 2007, DAT PAT repeat-taker data) | the session's shared web-search budget ran out | issue and page numbers marked "unconfirmed" above |


## I1-timing-bugs.md
(no ACCESS section)


## I2-mobile-audit.md
(no ACCESS section)
