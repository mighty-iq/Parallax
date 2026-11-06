/* PR-0 Word Links (probe, the non-spatial control; pure; ARCHITECTURE.md §5, PLAN.md §4 and §6,
   research/B-tasks.md §14b, research/A-evidence.md §7).

   Verbal analogies "A is to B as C is to ?" with four word options. The control probe estimates the
   gains that are not spatial: familiarity with testing (retest gains are about +0.33 SD at the second
   test and +0.50 by the third, figural and verbal alike; Scharfen et al. 2018) and motivation. Spatial
   probe change is judged against it, never against zero.

   Items come from an original, hand-written table of word relations in plain everyday English
   (TABLE below; nothing is copied from published tests). Each relation lists pairs "A B" (A stands
   in the relation to B), grouped by ';' into families of similar pairs. "B/x/y" lists the other
   answers that are also right for A (they are never used as foils for A). A leading '*' marks a
   pair with a less common word. Opposites are symmetric.

   Difficulty (LLTM, additive): relation tier (concrete → functional → abstract); word familiarity
   (both pairs common → one less common → both less common); foil closeness:
     loose  every foil is a word linked to C (or, failing that, to A or B) by another relation, and
            none is the kind of word the relation produces (only the key fits the pattern);
     mixed  two foils linked to C by other relations + one word of the relation's answer kind from
            another family (e.g. a young animal of a different kind);
     close  two foils linked to C + one answer-kind word from the same family (the nearest miss).
   Shortcut-proofing (checked over the pool by the tests): every item has at least two foils linked
   to C in the table as often as the key, so "the option most associated with C" is a tie; foil
   sets are drawn so that the key is the longest option, or the option most like the others (letter
   bigrams), about as often as any foil.

   Item (JSON): { ex: 'wordlinks', seed, params, key, relation, a, b, c, options: [4 words], kinds }
     key = index of the right option; kinds[i] = 'key' | 'linked' | 'family' | 'near' | 'stem'.
   validate (from the table, not the generator's bookkeeping): A:B and C:key are pairs of the
   relation; no foil stands in the relation to C (alternatives and symmetry included); no option
   repeats A, B or C; the options are distinct; A:B and C:key occur in no other relation; at least
   two foils are linked to C. */
(function (PX) {
  'use strict';

  // [id, label, tier, symmetric, question phrase]
  var RELATIONS = [
    ['young', 'young of', 0, false], ['sound', 'sound of', 0, false], ['part', 'part of', 0, false],
    ['material', 'made of', 0, false], ['home', 'home of', 0, false], ['source', 'comes from', 0, false],
    ['tool', 'tool for', 1, false], ['kind', 'kind of', 1, false], ['action', 'action of', 1, false],
    ['place', 'place of work', 1, false],
    ['opposite', 'opposite of', 2, true], ['degree', 'degree of', 2, false], ['measure', 'measure of', 2, false],
    ['symbol', 'symbol of', 2, false],
    // Links only (tier −1: never the relation of an item): everyday qualities of things. They tie
    // adjectives to things, so abstract items keep foils linked to C from more than one relation.
    ['property', 'quality of', -1, false], ['with', 'goes with', -1, false],
  ];

  var TABLE = {};
  // A is the young of B's adult: "cow calf" = a calf is a young cow (read: cow → its young).
  TABLE.young =
    'cow calf, horse foal/colt/filly, sheep lamb, pig piglet, goat kid, dog puppy/pup, cat kitten; ' +
    'lion cub, bear cub, fox cub/kit, wolf cub/pup, tiger cub, deer fawn/calf, elephant calf, *whale calf, *kangaroo joey, *seal pup; ' +
    'hen chick, duck duckling/chick, *goose gosling/chick, *swan cygnet/chick, *owl owlet/chick, *eagle eaglet/chick; ' +
    'frog tadpole, butterfly caterpillar/larva, *hare leveret, *eel elver';
  // The sound that A makes.
  TABLE.sound =
    'cow moo, dog bark/woof/growl/howl/yelp/whine, cat meow/miaow/purr/hiss, pig grunt/oink/squeal, sheep baa/bleat, ' +
    'horse neigh/whinny/snort, duck quack, hen cluck/cackle, *donkey bray, *goose honk/hiss, *rooster crow, *goat bleat/baa; ' +
    'lion roar/growl, wolf howl/growl, snake hiss/rattle, bee buzz/hum, owl hoot/screech, frog croak/ribbit, mouse squeak, ' +
    '*crow caw, *elephant trumpet, bear growl/roar, *seal bark, *dove coo; ' +
    'bell ring/chime/toll/peal/ding, clock tick/chime, *tyre screech/squeal, drum beat/bang/boom/roll/thump, ' +
    'horn honk/toot/beep/blare/hoot, *thunder rumble/boom/crash/clap/roll, *kettle whistle/hiss';
  // A is a part (or a member) of B.
  TABLE.part =
    'finger hand, thumb hand, palm hand, toe foot, heel foot/shoe/sock, *sole foot/shoe/boot, eyelid eye/face, ' +
    '*pupil eye/face, *iris eye/face, *knuckle finger/hand, nail finger/toe/hand/foot; ' +
    'petal flower/blossom/bloom, bark tree/trunk, twig branch/tree/bush, needle pine/tree/compass, beak bird, feather bird/wing, ' +
    'fin fish/shark/whale/dolphin, gill fish/shark/tadpole, *mane horse/lion, *tusk elephant/walrus/boar, yolk egg; ' +
    'pane window/door/greenhouse, rung ladder, nib pen, bristle brush/broom/toothbrush, key piano/keyboard, ' +
    'tyre wheel/car/bike/bicycle/bus/lorry/truck/van, chapter book/novel/story, *stanza poem/song/verse, scene play/film/movie/opera; ' +
    'sheep flock/herd, cow herd, wolf pack, lion pride, bee swarm/colony/hive, player team/squad/side, singer choir/band/chorus, ' +
    '*goose gaggle/flock, *whale pod/school, grape bunch/cluster/vine, soldier army/regiment/troop/unit, *star constellation/galaxy/cluster';
  // A is made of B.
  TABLE.material =
    'candle wax, tyre rubber, window glass/wood, mirror glass, wallet leather/cotton, brick clay, paper wood/pulp, ' +
    'newspaper paper, book paper, eraser rubber, *hourglass sand/glass, *jeans denim/cotton, pencil wood/graphite/lead, sweater wool/cotton/cashmere, horseshoe iron/steel/metal; ' +
    'bread flour/dough/wheat/grain, cheese milk/cream, butter milk/cream, yoghurt milk, omelette egg/eggs/milk/butter/cheese, ' +
    'chips potato/potatoes/corn, popcorn corn/maize, cider apple/apples, wine grape/grapes, raisin grape, *prune plum, *tofu soy/soya/soybean/soybeans; ' +
    'snowman snow/ice, igloo ice/snow, sandcastle sand, web silk, *honeycomb wax, glass sand, ice water, *steam water/vapour';
  // A lives in B.
  TABLE.home =
    'bee hive, dog kennel, horse stable/barn, pig sty/pigsty, hen coop/henhouse/nest/barn, spider web, rabbit burrow/warren/hutch, ' +
    'mole burrow/tunnel, ant anthill/nest/colony, wasp nest, snail shell, goldfish bowl/tank/pond; ' +
    'fox den/earth/burrow/lair, bear den/cave/lair, lion den/lair, wolf den/lair, bat cave/roost, *beaver lodge/dam, *eagle eyrie/nest, ' +
    '*otter holt, *badger sett/burrow, *squirrel drey/nest; ' +
    'king palace/castle, queen palace/castle, *monk monastery/abbey, *nun convent/abbey, *hermit cave/hut';
  // A comes from B.
  TABLE.source =
    'honey bee, milk cow/goat/sheep/cattle/buffalo, wool sheep/lamb/goat/llama/alpaca, *silk silkworm/caterpillar/moth/worm, ' +
    '*pearl oyster/clam/mussel, bacon pig/hog, ham pig/hog, beef cow/bull/cattle/ox, pork pig/hog, *mutton sheep, *venison deer, *ivory elephant/walrus/tusk; ' +
    '*acorn oak/tree, *conker chestnut/tree, flour wheat/grain/corn, sugar cane/beet/sugarcane, *rubber tree/sap, ' +
    'chocolate cocoa/cacao/bean/beans, coffee bean/beans';
  // A is used to B.
  TABLE.tool =
    'knife cut/slice/chop/carve/peel/spread/stab/trim/split/shave/shape/chip, scissors cut/trim/snip/slice, saw cut/trim, ' +
    'axe chop/cut/split/fell/carve/shape, razor shave/cut/trim, lawnmower mow/cut/trim, *chisel carve/cut/shape/chip; ' +
    'broom sweep/brush/clean/scrub, towel dry/wipe/clean/absorb/soak, soap wash/clean/scrub, *sponge wipe/clean/soak/wash/scrub/absorb, ' +
    '*sieve sift/strain/drain, eraser erase/rub/remove/delete, *iron press/smooth; ' +
    'oven bake/roast/cook/heat, kettle boil/heat/pour, stove cook/heat/fry/boil/roast/simmer, fridge chill/cool/store/keep, ' +
    'freezer freeze/chill/store/keep/cool, *ladle serve/scoop/pour/spoon, *funnel pour/channel/fill; ' +
    'pen write/sign/draw/sketch, pencil write/draw/sketch/sign, needle sew/stitch/knit/mend, spade dig/plant, shovel dig/scoop, ' +
    'key unlock/open/lock/start, ladder climb/reach, net catch/fish/trap, glue stick/join/fix/mend/bond, fan cool/blow, ' +
    '*loom weave, *kiln fire/bake/harden, *quill write/draw/sketch/sign';
  // A is a kind of B (the categories never overlap).
  TABLE.kind =
    'oak tree, pine tree, birch tree, willow tree, maple tree, elm tree, palm tree, *yew tree, *beech tree, *cedar tree, ' +
    'rose flower, tulip flower, daisy flower, lily flower, daffodil flower, poppy flower, *iris flower, *orchid flower, *crocus flower, ' +
    'robin bird, sparrow bird, eagle bird, owl bird, crow bird, dove bird, swan bird, parrot bird, penguin bird, *wren bird, *heron bird, ' +
    'salmon fish, trout fish, cod fish, tuna fish, shark fish, herring fish, *sole fish, *haddock fish, *plaice fish, ' +
    'ant insect, beetle insect, wasp insect, moth insect, bee insect, butterfly insect, fly insect, *gnat insect, *earwig insect; ' +
    'apple fruit/tree, pear fruit/tree, plum fruit/tree, cherry fruit/tree, banana fruit, grape fruit, lemon fruit/tree, peach fruit/tree, ' +
    '*apricot fruit/tree, *mango fruit/tree, carrot vegetable, potato vegetable, onion vegetable, cabbage vegetable, leek vegetable, ' +
    'lettuce vegetable, spinach vegetable, *turnip vegetable, *parsnip vegetable; ' +
    'iron metal, copper metal, tin metal, steel metal, *zinc metal, *nickel metal, *aluminium metal, silk fabric/cloth, ' +
    'cotton fabric/cloth, wool fabric/cloth, denim fabric/cloth, *linen fabric/cloth, *velvet fabric/cloth, *satin fabric/cloth, nylon fabric/cloth; ' +
    'violin instrument, drum instrument, flute instrument, trumpet instrument, piano instrument, harp instrument, guitar instrument, ' +
    'cello instrument, *oboe instrument, *tuba instrument, *clarinet instrument';
  // What A typically does.
  TABLE.action =
    'author write, writer write, painter paint/draw, baker bake/cook, singer sing/perform, dancer dance/perform, actor act/perform, ' +
    'teacher teach, builder build, chef cook/bake, tailor sew/stitch/mend, cleaner clean, waiter serve/wait, gardener dig/plant/weed/grow/harvest, ' +
    'farmer grow/plant/harvest/plough; ' +
    'pilot fly, sailor sail/row, driver drive, rower row, swimmer swim, runner run/race/jog, skater skate, jogger jog/run, player play; ' +
    'thief steal/rob/burgle, liar lie, hunter hunt, guard protect/watch, *spy watch, *burglar burgle/steal/rob; ' +
    'spider spin/weave/climb, *beaver gnaw/build/chew, mole dig, kangaroo hop/jump/bound, eagle soar/fly/swoop, snake slither/coil/bite, ' +
    'horse gallop/trot/canter/run/jump, cow graze/chew, sheep graze, squirrel climb/gather/hoard/bury/jump';
  // Where A works.
  TABLE.place =
    'chef kitchen/restaurant/hotel/bakery/café/cafe, baker bakery/kitchen/restaurant/hotel/café/cafe, waiter restaurant/café/cafe/bar/hotel; ' +
    'teacher school/classroom/college, pupil school/classroom, librarian library/school, *curator museum/gallery, scientist laboratory/lab; ' +
    'judge court/courtroom, priest church/chapel/cathedral, banker bank/office, clerk office/bank/court, pharmacist pharmacy/chemist; ' +
    'miner mine/pit, farmer farm/field/greenhouse, gardener garden/park/greenhouse, mechanic garage/workshop, *blacksmith forge/smithy, ' +
    'zookeeper zoo, lifeguard beach/pool; ' +
    'actor stage/theatre/studio/set, pilot cockpit/plane/aircraft/airport, astronaut space/spacecraft/spaceship/rocket, ' +
    'sailor ship/boat/sea, singer stage/studio/theatre, surgeon theatre/hospital, *hairdresser salon';
  // A is the opposite of B (and B of A).
  TABLE.opposite =
    'hot cold/cool, warm cool/cold, wet dry, hard soft/easy, sweet sour/bitter, loud quiet/soft/silent, light dark/heavy, ' +
    'thick thin, rough smooth, bright dark/dim; ' +
    'big small/little, large small/little, tall short, long short, high low, wide narrow, deep shallow, fat thin/slim; ' +
    'up down, in out, top bottom, front back, left right, over under, inside outside, near far, early late, first last, ' +
    'before after, start finish/end, open closed/shut, full empty, push pull, give take/receive, buy sell, win lose, ' +
    'enter exit/leave, arrive leave/depart, remember forget, rise fall/sink/set, float sink; ' +
    'happy sad/unhappy, love hate, friend enemy/foe, rich poor, old young/new, true false, right wrong/left, good bad/evil, ' +
    'clean dirty, safe dangerous, strong weak, fast slow, cheap expensive, polite rude, kind cruel/unkind/mean, wise foolish/stupid, ' +
    'life death, war peace, day night, black white, question answer, success failure, victory defeat, like dislike; ' +
    '*ancient modern, *vertical horizontal, *maximum minimum, *expand shrink/contract, *permanent temporary, *optimist pessimist, ' +
    '*generous mean/stingy/selfish, *humble proud/arrogant, *abundant scarce/rare, *transparent opaque, *ascend descend, ' +
    '*accept refuse/reject/decline, *include exclude, *fertile barren/infertile, *rigid flexible, *genuine fake/false/counterfeit, ' +
    '*praise criticise/blame, *frugal lavish/extravagant/wasteful, *timid bold/brave/confident, *major minor, *visible invisible/hidden, ' +
    '*innocent guilty, *advance retreat, *external internal, *hero villain/coward, *triumph disaster/defeat/failure';
  // B is a stronger degree of A (no chains: no word is the milder end of one pair and the stronger end of another).
  TABLE.degree =
    'warm hot, cool cold, damp wet/soaked/drenched, big huge/enormous/giant/vast/gigantic, small tiny/minute/miniature, ' +
    'bright dazzling/blinding, quiet silent; ' +
    'happy ecstatic/overjoyed/elated/thrilled/delighted, sad miserable/heartbroken/devastated, like love/adore, dislike hate/loathe/detest, ' +
    'tired exhausted, hungry starving/ravenous/famished, angry furious/livid, scared terrified/petrified, interested fascinated/gripped/enthralled; ' +
    'good excellent/great/superb/perfect/brilliant, bad terrible/awful/dreadful/horrible, pretty beautiful/stunning/gorgeous, tasty delicious; ' +
    'breeze gale/storm/hurricane, drizzle downpour/storm/deluge, *pond lake, *hill mountain, *stream river, *mist fog, *village town/city, *cottage mansion/palace; ' +
    'chuckle laugh/guffaw, *simmer boil, *sip gulp/guzzle, *nibble gobble/devour, *glance stare/gaze, *trot gallop, *jog sprint/run/race, ' +
    '*nudge shove/push, *tap bang/hit/thump';
  // A measures B.
  TABLE.measure =
    'clock time/hours, watch time/hours, stopwatch time, *sundial time/hours, *hourglass time; ' +
    'calendar date/days/months/time, *metronome tempo/beat/rhythm/time; ' +
    'ruler length/distance/width/height, *protractor angle/angles, compass direction/bearing/angle/angles, *odometer distance/mileage/miles, ' +
    '*altimeter altitude/height, *pedometer steps/distance; ' +
    'thermometer temperature/heat, scales weight/mass, speedometer speed, barometer pressure, *anemometer wind/windspeed, ' +
    '*hygrometer humidity, *seismograph earthquakes/earthquake/tremors, *ammeter current, *voltmeter voltage';
  // A is a symbol of B.
  TABLE.symbol =
    'dove peace/love, heart love/romance, rose love/romance/beauty, skull death/danger/poison/pirates, ' +
    'crown royalty/king/queen/monarchy/power, ring marriage/engagement/love, scales justice/law/fairness/balance, flag country/nation, ' +
    'medal victory/win/bravery/courage/honour/achievement, trophy victory/win/success/achievement, *laurel victory/glory/honour, ' +
    'horseshoe luck, *clover luck, sword war/battle/power/fighting; ' +
    'owl wisdom/knowledge, lion courage/bravery/strength/pride/power, fox cunning/cleverness/slyness, tortoise patience/slowness, ' +
    '*snail slowness/patience, *cheetah speed, *peacock pride/vanity/beauty, lamb innocence/gentleness, *mule stubbornness, ' +
    '*poppy remembrance/memory/sleep/peace';
  // Less common words paired with well-linked C words, so that hard items keep foils linked to C.
  TABLE.opposite += '; *happy glum/morose/sad/unhappy, *bright gloomy/murky/dark/dim, *win forfeit/lose, *peace strife/war/conflict, ' +
    '*small colossal/huge/enormous/big/large, *hot frigid, *wet arid, *loud hushed, *quiet raucous, *big diminutive, *happy forlorn, *sweet acrid';
  TABLE.symbol += '; *lion valour/valor, *fox guile/craftiness, *dove serenity/tranquillity, *lamb meekness/purity, ' +
    '*horseshoe fortune, *scales impartiality/equity, *owl erudition/learning';
  TABLE.degree += '; *warm sweltering/scorching, *cool frigid/icy/freezing, *big colossal/immense/titanic, *small minuscule/microscopic, ' +
    '*happy euphoric/jubilant, *good exemplary/sublime, *bright radiant/incandescent';
  TABLE.measure += '; *thermometer fever';
  TABLE.material += '; *glass silica, *paper cellulose, *tyre latex, *sundial stone/bronze/brass/metal, *quill feather';
  TABLE.place += '; *chef galley/bistro/brasserie/patisserie, *baker bakehouse/patisserie, *waiter bistro/brasserie, *gardener allotment/nursery/orchard';
  TABLE.tool += '; *needle embroider/darn, *pencil shade/sketch';
  TABLE.action += '; *cow ruminate, *chef sauté/braise/knead, *baker knead, *farmer reap/sow, *gardener prune/sow, *singer croon/serenade';
  TABLE.kind += '; *eagle raptor, *owl raptor';
  TABLE.part += '; hand clock/watch, month year';
  TABLE.tool += '; compass navigate/steer, scales weigh/balance, calendar plan/schedule';
  // A is (typically) B. Link-only: never asked about (see RELATIONS).
  TABLE.property =
    'ice cold/frozen/slippery, snow cold/white/soft, fire hot/bright, sun hot/bright/warm, oven hot/warm, night dark/black, ' +
    'coal black/hard, feather light/soft, rock hard/heavy, stone hard/heavy/cold, pillow soft, sugar sweet/white, honey sweet/sticky, ' +
    'lemon sour/yellow/bitter, desert dry/hot/sandy, rain wet/cold, breeze cool/fresh/light, sea wet/deep/salty, well deep/dark; ' +
    'snail slow, tortoise slow, cheetah fast, rocket fast/loud, mouse small/tiny/quiet, ant small/tiny, elephant big/huge/heavy/large, ' +
    'whale big/huge/large/heavy, giraffe tall, tower tall/high, mountain high/tall/big, library quiet/silent, thunder loud, ' +
    'clown funny/happy, party happy/fun/loud, funeral sad/quiet, owl wise, fox clever/sly; ' +
    'needle sharp/thin, knife sharp, razor sharp, pencil sharp, iron hot/heavy, ' +
    'velvet soft/smooth, satin smooth/shiny, tuba big/loud/heavy, aluminium light/shiny, apricot sweet/soft';
  // A is used or found with B. Link-only, like property: nouns only, none of them a verb that could
  // pass for an action or a use.
  TABLE.with =
    'needle thimble, pencil sharpener/paper, quill ink/inkwell, velvet curtain/cushion, satin ribbon, tuba band/orchestra, ' +
    'aluminium foil/can, apricot jam, chef apron/knife, baker dough/oven, waiter tray/menu, gardener wheelbarrow/trowel, ' +
    'singer microphone/song, calendar diary';

  /* ---------- index (built once) ---------- */

  var IX = null;
  function key2(u, v) { return u < v ? u + '|' + v : v + '|' + u; }
  function index() {
    if (IX) return IX;
    var rels = {}, link = {}, words = {}, nPairs = 0;
    RELATIONS.forEach(function (r) {
      var rel = { id: r[0], label: r[1], tier: r[2], sym: r[3], pairs: [], valid: {}, answers: {} };
      rels[r[0]] = rel;
      String(TABLE[r[0]] || '').split(';').forEach(function (grp, gi) {
        grp.split(',').forEach(function (raw) {
          var s = raw.trim();
          if (!s) return;
          var rare = s.charAt(0) === '*';
          if (rare) s = s.slice(1).trim();
          var parts = s.split(/\s+/), a = parts[0], alts = parts[1].split('/');
          rel.pairs.push({ a: a, b: alts[0], alts: alts, rare: rare, group: gi });
          nPairs++;
          alts.forEach(function (x) {
            addValid(rel, a, x);
            if (rel.sym) addValid(rel, x, a);
            rel.answers[x] = true;
            if (rel.sym) rel.answers[a] = true;
            var k = key2(a, x);
            (link[k] || (link[k] = {}))[rel.id] = true;
            (words[a] || (words[a] = {}))[x] = true;
            (words[x] || (words[x] = {}))[a] = true;
          });
        });
      });
    });
    IX = { rels: rels, link: link, words: words, nPairs: nPairs };
    return IX;
  }
  function addValid(rel, a, x) { (rel.valid[a] || (rel.valid[a] = {}))[x] = true; }

  // Number of relations in which u and v are paired (either direction, alternatives included).
  function assoc(u, v) { var l = index().link[key2(u, v)]; return l ? Object.keys(l).length : 0; }
  function inRel(relId, a, x) { var v = index().rels[relId].valid[a]; return !!(v && v[x]); }
  function partners(w) { return Object.keys(index().words[w] || {}).sort(); }

  // Interchangeable words: one relation pairs both with the same word, on the same side (den and
  // lair, both the home of a bear; bark and growl, both a dog's sounds; oak and pine, both a kind
  // of tree; alternatives of one pair). Two of them in one item could be ruled out together (or
  // one could stand for the other), so no item shows two interchangeable options.
  var SLOTS = null;
  function slotsOf(w) {
    if (!SLOTS) {
      SLOTS = {};
      var add = function (word, slot) { (SLOTS[word] || (SLOTS[word] = {}))[slot] = true; };
      var rels = index().rels;
      Object.keys(rels).forEach(function (id) {
        var valid = rels[id].valid;
        Object.keys(valid).forEach(function (a) {
          Object.keys(valid[a]).forEach(function (x) { add(x, id + '>' + a); add(a, id + '<' + x); });
        });
      });
    }
    return SLOTS[w] || {};
  }
  function interchangeable(x, y) {
    if (x === y) return true;
    var sx = slotsOf(x), sy = slotsOf(y);
    for (var k in sx) if (sy[k]) return true;
    return false;
  }
  function show(w) { return w.replace(/_/g, ' '); }

  /* ---------- shortcut solvers (credit for ties is shared: 1 / number tied) ---------- */

  function credit(scores, key) {
    var best = Math.max.apply(null, scores), n = 0;
    for (var i = 0; i < scores.length; i++) if (scores[i] === best) n++;
    return scores[key] === best ? 1 / n : 0;
  }
  var BG = {};
  function bigrams(w) {
    if (BG[w]) return BG[w];
    var set = {}, list = [];
    for (var i = 0; i < w.length - 1; i++) { var g = w.substr(i, 2); if (!set[g]) { set[g] = true; list.push(g); } }
    return (BG[w] = { set: set, list: list });
  }
  function dice(u, v) {
    var a = bigrams(u), b = bigrams(v), m = 0;
    for (var i = 0; i < a.list.length; i++) if (b.set[a.list[i]]) m++;
    return a.list.length + b.list.length ? 2 * m / (a.list.length + b.list.length) : 0;
  }
  function alikeScores(opts) {
    return opts.map(function (o, i) {
      var s = 0;
      for (var j = 0; j < opts.length; j++) if (j !== i) s += dice(o, opts[j]);
      return Math.round(s * 1e9);
    });
  }
  var shortcuts = {
    assoc: function (item) { return credit(item.options.map(function (o) { return assoc(item.c, o); }), item.key); },
    longest: function (item) { return credit(item.options.map(function (o) { return o.length; }), item.key); },
    shortest: function (item) { return credit(item.options.map(function (o) { return -o.length; }), item.key); },
    alike: function (item) { return credit(alikeScores(item.options), item.key); },
  };

  /* ---------- generator ---------- */

  var TIERS = ['concrete', 'functional', 'abstract'];
  var WORDS = ['common', 'one less common', 'less common'];
  var FOILS = ['loose', 'mixed', 'close'];
  var DIRS = {};

  // C:D candidates of a relation (both directions for opposites), with the words linked to C by the
  // table that are not right answers for C here.
  function directed(rel) {
    if (DIRS[rel.id]) return DIRS[rel.id];
    var out = [];
    rel.pairs.forEach(function (p) {
      out.push({ c: p.a, d: p.b, rare: p.rare, group: p.group });
      if (rel.sym) out.push({ c: p.b, d: p.a, rare: p.rare, group: p.group });
    });
    out.forEach(function (x) {
      x.linked = partners(x.c).filter(function (w) { return w !== x.c && !inRel(rel.id, x.c, w); });
      // Usable: the pair is linked only by this relation, and C has two linked words that are not
      // interchangeable (the foils may not be).
      x.ok = assoc(x.c, x.d) === 1 && kinds(x.linked) >= 2;
      // For the extreme length targets (key shortest or longest), C needs two such linked words
      // at least as long as the key, or at most as long.
      x.kLong = kinds(x.linked.filter(function (w) { return w.length >= x.d.length; }));
      x.kShort = kinds(x.linked.filter(function (w) { return w.length <= x.d.length; }));
    });
    DIRS[rel.id] = out;
    return out;
  }
  // How many mutually non-interchangeable words the list holds (greedy, in order).
  function kinds(ws) {
    var reps = [];
    ws.forEach(function (w) { if (!reps.some(function (r) { return interchangeable(r, w); })) reps.push(w); });
    return reps.length;
  }
  function relsOfTier(t) {
    return RELATIONS.filter(function (r) { return r[2] === t; }).map(function (r) { return index().rels[r[0]]; });
  }
  // Answer-kind words of the relation's families: near = in the C pair's family, far = only in others.
  var FAM = {};
  function family(rel, group) {
    var fk = rel.id + ':' + group;
    if (FAM[fk]) return FAM[fk];
    var near = {}, far = {};
    rel.pairs.forEach(function (p) {
      var ws = rel.sym ? p.alts.concat([p.a]) : p.alts;
      ws.forEach(function (w) { (p.group === group ? near : far)[w] = true; });
    });
    for (var w in near) delete far[w];
    return (FAM[fk] = { near: Object.keys(near).sort(), far: Object.keys(far).sort() });
  }
  function rareOf(rel, a, b) {
    for (var i = 0; i < rel.pairs.length; i++) {
      var p = rel.pairs[i];
      if ((p.a === a && p.alts.indexOf(b) >= 0) || (rel.sym && p.a === b && p.alts.indexOf(a) >= 0)) return p.rare;
    }
    return null;
  }
  function lenRank(opts, key) {
    var r = 0;
    for (var i = 0; i < opts.length; i++) {
      if (i === key) continue;
      r += opts[i].length < opts[key].length ? 1 : opts[i].length === opts[key].length ? 0.5 : 0;
    }
    return r;
  }
  function isAlike(opts, key) {
    var s = alikeScores(opts);
    for (var i = 0; i < s.length; i++) if (i !== key && s[i] >= s[key]) return false;
    return true;
  }

  function attempt(rng, params, targets) {
    var rels = relsOfTier(params.relation);
    var rel = rng.pick(rels);
    var wl = params.words, rareC = wl === 2 || (wl === 1 && rng.chance(0.5)), rareA = wl === 2 || (wl === 1 && !rareC);
    // Targets drawn per item: the key's length rank among the options (0 shortest … 3 longest) and
    // whether it is the option most like the others; foil sets are drawn until both are met.
    var tRank = targets ? targets.rank : rng.int(0, 3), tAlike = targets ? targets.alike : rng.chance(0.25);
    var cands = directed(rel).filter(function (x) {
      return x.ok && x.rare === rareC && (tRank === 0 ? x.kLong >= 2 : tRank === 3 ? x.kShort >= 2 : true);
    });
    if (!cands.length) return null;
    var C = rng.pick(cands), used = [C.c, C.d];
    var stems = directed(rel).filter(function (x) {
      return x.rare === rareA && assoc(x.c, x.d) === 1 && used.indexOf(x.c) < 0 && used.indexOf(x.d) < 0 &&
        !inRel(rel.id, C.c, x.c) && !inRel(rel.id, C.c, x.d);
    });
    if (!stems.length) return null;
    var S = rng.pick(stems), stem = [S.c, S.d, C.c, C.d];
    var fam = family(rel, C.group);
    function free(w) { return stem.indexOf(w) < 0 && !inRel(rel.id, C.c, w); }
    var linked = C.linked.filter(free), kindWord = rel.answers;
    var pools;
    if (params.foils === 0) {
      var plain = linked.filter(function (w) { return !kindWord[w]; });
      if (plain.length < 2) return null;
      // The third foil: another word linked to C, or one linked to A or B (whichever is free of
      // clashes with the first two).
      var extra = partners(S.c).concat(partners(S.d)).filter(function (w, i, all) {
        return free(w) && !kindWord[w] && plain.indexOf(w) < 0 && all.indexOf(w) === i;
      });
      if (plain.length < 3 && !extra.length) return null;
      pools = [plain, plain, plain.concat(extra)];
    } else {
      var fw = (params.foils === 2 ? fam.near : fam.far).filter(function (w) { return free(w) && linked.indexOf(w) < 0; });
      // Mixed items keep the same-family words out of the linked foils too.
      var lk = params.foils === 1 ? linked.filter(function (w) { return fam.near.indexOf(w) < 0; }) : linked;
      if (!fw.length || lk.length < 2) return null;
      pools = [lk, lk, fw];
    }
    var best = null, bestScore = Infinity, kl = C.d.length;
    function cls(w) { return w.length < kl ? 0 : w.length > kl ? 2 : 1; } // shorter, equal, longer than the key
    // A foil may not be interchangeable with a foil already chosen.
    function clash(w, f) {
      for (var q = 0; q < f.length; q++) if (interchangeable(w, f[q])) return true;
      return false;
    }
    function avail(j, f, c) {
      return pools[j].filter(function (w) { return f.indexOf(w) < 0 && (c < 0 || cls(w) === c) && !clash(w, f); });
    }
    for (var k = 0; k < 8; k++) {
      // tRank foils shorter than the key, the others longer (equal lengths count half), in random slots.
      var want = rng.shuffle([0, 1, 2].map(function (j) { return j < tRank ? 0 : 2; }));
      var f = [], kinds = [];
      for (var j = 0; j < 3; j++) {
        var pool = avail(j, f, want[j]);
        if (!pool.length) pool = avail(j, f, 1);
        if (!pool.length) pool = avail(j, f, -1);
        if (!pool.length) return null;
        var w = rng.pick(pool);
        f.push(w);
        kinds.push(j < 2 ? 'linked' : params.foils === 0 ? (C.linked.indexOf(w) >= 0 ? 'linked' : 'stem') : params.foils === 2 ? 'near' : 'family');
      }
      var order = rng.shuffle([0, 1, 2, 3]), opts = [], kd = [], key = -1;
      order.forEach(function (o, i) {
        opts.push(o === 0 ? C.d : f[o - 1]);
        kd.push(o === 0 ? 'key' : kinds[o - 1]);
        if (o === 0) key = i;
      });
      var sc = 2 * Math.abs(lenRank(opts, key) - tRank) + (isAlike(opts, key) === tAlike ? 0 : 1);
      if (sc < bestScore) { best = { opts: opts, kinds: kd, key: key }; bestScore = sc; }
      if (sc === 0) break;
    }
    if (bestScore > 1.5) return null; // the length target cannot be met with this C: try another
    return {
      ex: 'wordlinks', seed: rng.seed, params: { relation: params.relation, words: params.words, foils: params.foils },
      key: best.key, relation: rel.id, a: S.c, b: S.d, c: C.c, options: best.opts, kinds: best.kinds,
    };
  }

  function validate(item) {
    if (!item || item.ex !== 'wordlinks') return 'not a wordlinks item';
    var rel = index().rels[item.relation], p = item.params || {};
    if (!rel) return 'unknown relation ' + item.relation;
    if (rel.tier !== p.relation) return 'relation tier does not match the level';
    var o = item.options;
    if (!Array.isArray(o) || o.length !== 4) return 'needs four options';
    if (!(Number.isInteger(item.key) && item.key >= 0 && item.key < 4)) return 'bad key';
    var low = o.map(function (w) { return String(w).toLowerCase(); }), stem = [item.a, item.b, item.c];
    for (var i = 0; i < 4; i++) {
      if (low.indexOf(low[i]) !== i) return 'options repeat';
      if (stem.indexOf(o[i]) >= 0) return 'an option repeats a stem word';
    }
    if (!inRel(rel.id, item.a, item.b)) return 'A:B is not a ' + rel.id + ' pair';
    if (!inRel(rel.id, item.c, o[item.key])) return 'the key does not stand in the relation to C';
    var linked = 0, fam = family(rel, groupOf(rel, item.c, o[item.key])), near = 0, far = 0;
    for (i = 0; i < 4; i++) {
      if (i === item.key) continue;
      if (inRel(rel.id, item.c, o[i])) return 'foil "' + o[i] + '" also stands in the relation to C';
      if (assoc(item.c, o[i]) >= 1) linked++;
      if (fam.near.indexOf(o[i]) >= 0) near++;
      else if (fam.far.indexOf(o[i]) >= 0) far++;
    }
    if (assoc(item.a, item.b) !== 1 || assoc(item.c, o[item.key]) !== 1) return 'a stem pair also occurs in another relation';
    if (linked < 2) return 'fewer than two foils are linked to C';
    for (i = 0; i < 4; i++) {
      for (var j = i + 1; j < 4; j++) {
        if (i !== item.key && j !== item.key && interchangeable(o[i], o[j])) return 'foils "' + o[i] + '" and "' + o[j] + '" are interchangeable';
      }
    }
    var ra = rareOf(rel, item.a, item.b), rc = rareOf(rel, item.c, o[item.key]);
    var nRare = (ra ? 1 : 0) + (rc ? 1 : 0);
    if (nRare !== p.words) return 'word familiarity does not match the level';
    if (p.foils === 0 && near + far > 0) return 'a loose item has a foil of the answer kind';
    if (p.foils === 1 && (far < 1 || near > 0)) return 'a mixed item needs a foil from another family and none from the same';
    if (p.foils === 2 && near < 1) return 'a close item needs a foil from the same family';
    return true;
  }
  function groupOf(rel, c, d) {
    for (var i = 0; i < rel.pairs.length; i++) {
      var p = rel.pairs[i];
      if ((p.a === c && p.alts.indexOf(d) >= 0) || (rel.sym && p.a === d && p.alts.indexOf(c) >= 0)) return p.group;
    }
    return -1;
  }

  // Fallback: the first valid item from fixed seeds that do not depend on the item seed (the tests
  // check that one exists for every level).
  function fallback(seed, params) {
    var item = null;
    for (var i = 0; i < 3000; i++) {
      item = attempt(PX.rng(PX.rng.hash('wordlinks-fallback', params.relation, params.words, params.foils, i)), params);
      if (item && validate(item) === true) { item.seed = seed; item.fallback = true; return item; }
    }
    if (item) item.fallback = true;
    return item;
  }

  function generate(rng, params) {
    // The shortcut targets are drawn once per item and kept through the retries, so that the
    // accepted items meet them in the drawn proportions.
    var tr = rng.fork('targets'), targets = { rank: tr.int(0, 3), alike: tr.chance(0.25) };
    for (var i = 0; i < 150; i++) {
      var item = attempt(i ? rng.fork('retry' + i) : rng, params, targets);
      if (item) {
        item.seed = rng.seed;
        if (validate(item) === true) return item;
      }
    }
    return fallback(rng.seed, params);
  }

  // The shared model for the view and the tests (def.lib; def.helpers is the same object).
  var LIB = {
    index: index, assoc: assoc, inRel: inRel, partners: partners, directed: directed, family: family,
    shortcuts: shortcuts, show: show, fallback: fallback, RELATIONS: RELATIONS, interchangeable: interchangeable,
  };

  PX.ex.define({
    id: 'wordlinks', version: 1, code: 'PR-0', name: 'Word Links', short: 'Words',
    abilities: ['VB'], cell: null, role: 'probe', answer: 'choice', nOptions: 4,
    dims: [
      { key: 'relation', label: 'Relation', levels: TIERS, step: 0.8 },
      { key: 'words', label: 'Words', levels: WORDS, step: 0.6 },
      { key: 'foils', label: 'Foils', levels: FOILS, step: 0.75 },
    ],
    base: -2.0,
    chance: 0.25,
    timeLimit: function () { return 25000; }, // a calm countdown in the view
    generate: generate,
    validate: validate,
    score: function (item, response) { return { correct: response === item.key }; },
    lib: LIB,
    helpers: LIB,
  });
})(window.PX);
