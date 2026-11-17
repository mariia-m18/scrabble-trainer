// scoring, move finder, random boards, but no blank tiles (yet) (they score 0 points anyway lol)
const N = 15;
// NYT Crossplay tile values and counts - https://www.thewordfinder.com/crossplay-letter-point-values.php
// a bit different from classic scrabble, maybe change later
const VALS = { A: 1, B: 4, C: 3, D: 2, E: 1, F: 4, G: 4, H: 3, I: 1, J: 10, K: 6, L: 2, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 2, V: 6, W: 5, X: 8, Y: 4, Z: 10 };
const BAG = 'AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHHIIIIIIIIJKLLLLMMNNNNNOOOOOOOOPPQRRRRRRSSSSSTTTTTTUUUVVWWXYYZ';
// NYT Crossplay layout. T/D = triple/double word, t/d = triple/double letter
// the bottom mirrors the top half
const HALF = [
  't..T...d...T..t',
  '.D....t.t....D.',
  '....d.....d....',
  'T..d...D...d..T',
  '..d..t...t..d..',
  '....t..d..t....',
  '.t...........t.',
  'd..D.d...d.D..d',
];
const PREM = [...HALF, ...HALF.slice(0, 7).reverse()].join('');

const rnd = n => Math.floor(Math.random() * n);
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// cell index of position i on a line; 
// d = 0 across (line is a row), 1 down (line is a column)
const at = (d, line, i) => d ? i * N + line : line * N + i;

// tries to play a word from `rack`.
// returns the move with its score, or a string it's not playable.
function play(board, dict, rack, word, d, line, start) {
  const end = start + word.length;
  if (word.length < 2 || start < 0 || end > N) return 'it does not fit on the board';
  if ((start > 0 && board[at(d, line, start - 1)]) || (end < N && board[at(d, line, end)]))
    return 'it must include the letters right before and after it';
  const left = rack.split(''), tiles = [];
  let main = 0, mult = 1, cross = 0, linked = false;
  for (let i = 0; i < word.length; i++) {
    const pos = start + i, c = at(d, line, pos), ch = word[i], v = VALS[ch];
    if (board[c]) {
      if (board[c] !== ch) return 'it clashes with a letter on the board';
      main += v; linked = true; continue;
    }
    const r = left.indexOf(ch);
    if (r < 0) return 'it needs a letter that is not in the rack';
    left.splice(r, 1); tiles.push([c, ch]);
    const p = PREM[c], lm = p === 'd' ? 2 : p === 't' ? 3 : 1, wm = p === 'D' ? 2 : p === 'T' ? 3 : 1;
    main += v * lm; mult *= wm;
    if (c === 112) linked = true;
    // the word this new tile forms in the other direction
    let a = line, b = line, sum = v * lm;
    while (a > 0 && board[at(1 - d, pos, a - 1)]) sum += VALS[board[at(1 - d, pos, --a)]];
    while (b < N - 1 && board[at(1 - d, pos, b + 1)]) sum += VALS[board[at(1 - d, pos, ++b)]];
    if (b > a) {
      let w = '';
      for (let j = a; j <= b; j++) w += j === line ? ch : board[at(1 - d, pos, j)];
      if (!dict.has(w)) return 'it makes the invalid word ' + w;
      cross += sum * wm; linked = true;
    }
  }
  if (!tiles.length) return 'it uses no tiles from the rack';
  if (!linked) return board[112] ? 'it must connect to tiles on the board' : 'the first word must cover the centre square';
  if (!dict.has(word)) return word + ' is not in the dictionary';
  return { word, d, line, start, tiles, score: main * mult + cross + (tiles.length === 7 ? 40 : 0) };
}

// words from the list of all words that can be spelled with letters
function fits(list, letters) {
  const n = new Int8Array(26);
  for (let i = 0; i < letters.length; i++) n[letters.charCodeAt(i) - 65]++;
  return list.filter(w => {
    if (w.length > letters.length) return false;
    let i = 0, ok = true;
    for (; i < w.length; i++) if (--n[w.charCodeAt(i) - 65] < 0) { ok = false; i++; break; }
    while (i--) n[w.charCodeAt(i) - 65]++;
    return ok;
  });
}

// every legal move for `rack` ordered by best score first
function findMoves(board, list, dict, rack) {
  const empty = !board[112], cache = {}, seen = {}, out = [];
  for (let d = 0; d < (empty ? 1 : 2); d++) for (let line = 0; line < N; line++) {
    let on = '', near = false;
    for (let i = 0; i < N; i++) {
      on += board[at(d, line, i)];
      near = near || (line > 0 && board[at(d, line - 1, i)]) || (line < N - 1 && board[at(d, line + 1, i)]);
    }
    if (empty ? line !== 7 : !on && !near) continue;
    const pool = rack + on, key = [...pool].sort().join('');
    for (const w of cache[key] ||= fits(list, pool)) for (let s = 0; s + w.length <= N; s++) {
      const m = play(board, dict, rack, w, d, line, s);
      if (typeof m === 'string') continue;
      const k = m.tiles + ''; // a single tile can be found once across and once down
      if (!seen[k]) { seen[k] = 1; out.push(m); }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

// a random mid-game position plus a rack and all its moves
function randomBoard(list, dict) {
  const bag = shuffle(BAG.split('')), board = Array(N * N).fill('');
  const draw = () => bag.splice(0, 7).join('');
  for (let t = 4 + rnd(6); t > 0; t--) {
    const rack = draw(), ms = findMoves(board, list, dict, rack);
    if (!ms.length) continue;
    let left = rack;
    for (const [c, ch] of ms[rnd(Math.min(5, ms.length))].tiles) { board[c] = ch; left = left.replace(ch, ''); }
    bag.push(...left); shuffle(bag);
  }
  const rack = draw(), moves = findMoves(board, list, dict, rack);
  return moves.length ? { board, rack, moves } : randomBoard(list, dict);
}

// the letters of a random word of the given length
function scramble(list, len) {
  const pool = list.filter(w => w.length === len);
  return shuffle(pool[rnd(pool.length)].split('')).join('');
}

if (typeof module !== 'undefined') module.exports = { PREM, VALS, BAG,play, fits, findMoves, randomBoard, scramble };
