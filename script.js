// ===== AUDIO =====
const SOUNDS = {
  card:     new Audio('sounds/card.mp3'),
  hand:      new Audio('sounds/hand.mp3'),
  lose:     new Audio('sounds/lose.mp3'),
  click:    new Audio('sounds/click.mp3'),
  error:    new Audio('sounds/error.mp3'),
  clear:    new Audio('sounds/clear.mp3')
};

// エラーが出ないように「playSound」という名前で関数を作成します
function playSound(name) {
  if (SOUNDS[name]) {
    SOUNDS[name].currentTime = 0; // 連続再生できるように巻き戻す
    SOUNDS[name].play().catch(e => console.log("Audio play blocked by browser"));
  } else {
    console.error("Sound not found:", name);
  }
}

// 音量設定（お好みで 0.0 〜 1.0）
Object.values(SOUNDS).forEach(s => s.volume = 0.4);// ===== CHAIN TIERS =====
const TIER_COLORS = [
  { min:1,  max:9,  label:"",         color:"#aaa",    shadow:"#aaa",    cls:"",       fieldCls:"" },
  { min:10, max:19, label:"CHAIN×",   color:"#00e5ff", shadow:"#00aaff", cls:"",       fieldCls:"tier1" },
  { min:20, max:29, label:"CHAIN×",   color:"#FFD700", shadow:"#FFA500", cls:"",       fieldCls:"tier2" },
  { min:30, max:39, label:"CHAIN×",   color:"#00ff64", shadow:"#00cc44", cls:"",       fieldCls:"tier3" },
  { min:40, max:49, label:"CHAIN×",   color:"#ff4444", shadow:"#ff0000", cls:"",       fieldCls:"tier4" },
  { min:50, max:999,label:"🌈CHAIN×", color:"#fff",    shadow:"#fff",    cls:"rainbow",fieldCls:"tier5" },
];
function getTier(c) {
  for (let t of TIER_COLORS) if (c>=t.min && c<=t.max) return t;
  return TIER_COLORS[0];
}

// ===== GAME STATE =====
const suits = ["♠","♣","♦","♥"];
const ranks = [1,2,3,4,5,6,7,8,9,10,11,12,13];
let deck=[], field=null, hand=[], discard=[];
let medals=0, chain=0, maxChain=0, isAnimating=false;

function createDeck() {
  deck=[];
  for (let s of suits) for (let r of ranks) deck.push({suit:s,rank:r});
  deck.push({suit:"JOKER",rank:0});
  deck.sort(()=>Math.random()-0.5);
}
function draw() { return deck.pop(); }
function refillHand() {
  while (hand.length<5 && deck.length>0) hand.push(draw());
}
function isRed(c) { return c.suit==="♦"||c.suit==="♥"; }
function rankText(r) {
  if(r===0) return "🃏";
  if(r===1) return "A"; if(r===11) return "J";
  if(r===12) return "Q"; if(r===13) return "K";
  return String(r);
}
function playable(h,f) {

  if(!f) return true; //場が空なら何でも出せる
  if(h.suit==="JOKER") return true;
  if(f.suit==="JOKER") return true;
  return h.suit===f.suit || h.rank===f.rank;
}
function isStuck() {
  for (let h of hand) if (playable(h,field)) return false;
  return true;
}

// ===== POKER HAND DETECTION =====
// JOKER counts as wild
const POKER_HANDS = [
  { id:"royal",         name:"ROYAL FLUSH",  multi:200 },
  { id:"straight-flush",name:"STR FLUSH",    multi:100 },
  { id:"four",          name:"FOUR OF A KIND",multi:50 },
  { id:"full",          name:"FULL HOUSE",   multi:20  },
  { id:"flush",         name:"FLUSH",        multi:15  },
  { id:"straight",      name:"STRAIGHT",     multi:10  },
  { id:"three",         name:"THREE OF A KIND",multi:5 },
  { id:"two",           name:"TWO PAIR",     multi:3   },
  { id:"one",           name:"ONE PAIR",     multi:2   },
];

// 役に関係するカードインデックスを特定して返す
function getPokerCardIndices(cards, handId) {
  if (!handId || cards.length < 5) return [];
  let jokerIdxs = cards.map((c,i)=>c.suit==="JOKER"?i:-1).filter(i=>i>=0);
  let real = cards.map((c,i)=>({...c,i})).filter(c=>c.suit!=="JOKER");
  let rs = real.map(c=>c.rank);

  if (handId==="royal"||handId==="flush"||handId==="straight-flush") {
    return cards.map((_,i)=>i); // 全部
  }
  if (handId==="straight") {
    return cards.map((_,i)=>i);
  }
  if (handId==="four") {
    let rc={}; rs.forEach(r=>rc[r]=(rc[r]||0)+1);
    let target = Object.keys(rc).find(r=>rc[r]+(jokerIdxs.length)>=4);
    if (!target) return cards.map((_,i)=>i);
    let idxs = real.filter(c=>c.rank==target).map(c=>c.i);
    return [...idxs, ...jokerIdxs].slice(0,4);
  }
  if (handId==="full") return cards.map((_,i)=>i);
  if (handId==="three") {
    let rc={}; rs.forEach(r=>rc[r]=(rc[r]||0)+1);
    let target = Object.keys(rc).sort((a,b)=>rc[b]-rc[a])[0];
    let idxs = real.filter(c=>c.rank==target).map(c=>c.i);
    return [...idxs, ...jokerIdxs];
  }
  if (handId==="two"||handId==="one") {
    let rc={}; rs.forEach(r=>rc[r]=(rc[r]||0)+1);
    let pairs = Object.keys(rc).filter(r=>rc[r]>=2).sort((a,b)=>rc[b]-rc[a]);
    let idxs = [];
    for (let p of pairs) idxs.push(...real.filter(c=>c.rank==p).map(c=>c.i));
    if (jokerIdxs.length && idxs.length) idxs.push(...jokerIdxs);
    return idxs;
  }
  return [];
}

function detectPokerHand(cards) {
  // 5枚揃っていない場合は判定しない
  if (cards.length < 5) return null;

  let jokers = cards.filter(c => c.suit === "JOKER").length;
  let real = cards.filter(c => c.suit !== "JOKER");
  let rs = real.map(c => c.rank);
  let ss = real.map(c => c.suit);

  // ランクごとの枚数をカウント
  let rankCount = {};
  rs.forEach(r => { rankCount[r] = (rankCount[r] || 0) + 1; });
  let counts = Object.values(rankCount).sort((a, b) => b - a);

  // ジョーカーを一番枚数が多いグループに加算
  if (jokers > 0 && counts.length > 0) counts[0] += jokers;
  else if (jokers > 0) counts = [jokers];

  // フラッシュ判定
  let isFlush = (new Set(ss)).size === 1 && jokers === 0;
  if (jokers > 0 && ss.length > 0) isFlush = (new Set(ss)).size === 1;
  if (jokers === 5) isFlush = true;

  // ストレート判定用関数
  function isStraightCheck(r, wilds) {
    if (r.length + wilds < 5) return false;
    let sorted = [...new Set(r)].sort((a, b) => a - b);
    let expanded = [...sorted];
    if (sorted.includes(1)) expanded.push(14); // Aceを14としても扱う
    for (let i = 0; i < expanded.length; i++) {
      let startVal = expanded[i];
      let needed = 0;
      for (let v = startVal; v < startVal + 5; v++) {
        if (!expanded.includes(v)) needed++;
      }
      if (needed <= wilds) return true;
    }
    // A,2,3,4,5のストレート
    let lowNeeded = 0;
    [1, 2, 3, 4, 5].forEach(v => { if (!new Set(rs).has(v)) lowNeeded++; });
    if (lowNeeded <= wilds) return true;
    return false;
  }

  let straight = isStraightCheck(rs, jokers);

  // ロイヤルフラッシュ判定用関数
  function checkRoyal() {
    if (!isFlush) return false;
    let needed = [1, 10, 11, 12, 13];
    let have = new Set(rs);
    let missing = needed.filter(v => !have.has(v)).length;
    return missing <= jokers;
  }

  // --- 役の判定（強い順） ---
  if (checkRoyal()) return POKER_HANDS[0];         // ROYAL FLUSH
  if (isFlush && straight) return POKER_HANDS[1];  // STR FLUSH
  if (counts[0] >= 4) return POKER_HANDS[2];       // FOUR KIND
  if (counts[0] >= 3 && counts[1] >= 2) return POKER_HANDS[3]; // FULL HOUSE
  if (isFlush) return POKER_HANDS[4];              // FLUSH
  if (straight) return POKER_HANDS[5];             // STRAIGHT

  // ★ ここから下の「スリーカード」「ツーペア」「ワンペア」の判定を削除しました。
  // どの役にも当てはまらない場合は null を返します。
  return null;
}

function highlightPayRow(handId) {
  // chainBonusRowは除外してpokerPayRowだけリセット
  document.querySelectorAll('.payRow:not(.chainBonusRow)').forEach(r=>r.classList.remove('active'));
  if (handId) {
    let el = document.getElementById('pay-'+handId);
    if (el) el.classList.add('active');
  }
}

// CHAIN BONUSパネルの該当行を一時強調
function highlightChainBonusRow(label) {
  document.querySelectorAll('.chainBonusRow').forEach(r => r.classList.remove('active'));
  let el = document.querySelector(`.chainBonusRow[data-label="${label}"]`);
  if (el) {
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 2000);
  }
}

// ===== CARD ELEMENT =====
function makeCardEl(c) {
  let d = document.createElement("div");
  d.className = "card";
  if (c.suit==="JOKER") {
    d.classList.add("joker");
    let cs = document.createElement("div"); cs.className="center-suit"; cs.textContent="🃏";
    d.appendChild(cs);
  } else {
    if (isRed(c)) d.classList.add("red-card");
    let rt = rankText(c.rank);
    // top-left corner
    let tl = document.createElement("div"); tl.className="corner-tl";
    let tlr = document.createElement("div"); tlr.className="c-rank"; tlr.textContent=rt;
    let tls = document.createElement("div"); tls.className="c-suit"; tls.textContent=c.suit;
    tl.appendChild(tlr); tl.appendChild(tls); d.appendChild(tl);
    // center suit
    let cs = document.createElement("div"); cs.className="center-suit"; cs.textContent=c.suit;
    d.appendChild(cs);
    // bottom-right corner
    let br = document.createElement("div"); br.className="corner-br";
    let brr = document.createElement("div"); brr.className="c-rank"; brr.textContent=rt;
    let brs = document.createElement("div"); brs.className="c-suit"; brs.textContent=c.suit;
    br.appendChild(brr); br.appendChild(brs); d.appendChild(br);
  }
  return d;
}

// ===== RENDER =====
function render() {
  // field
  let fc = document.getElementById("fieldCards");
  fc.innerHTML="";
  if(field){
    let fd = makeCardEl(field);
    fd.classList.add("card-fly");
    fc.appendChild(fd);
  }

  // hand + poker check
  let hDiv = document.getElementById("hand");
  hDiv.innerHTML="";
  let pokerHand = detectPokerHand(hand);
  let pokerIdxs = pokerHand ? getPokerCardIndices(hand, pokerHand.id) : [];

  hand.forEach((c,i)=>{
    let d = makeCardEl(c);
    if (playable(c,field)) d.classList.add("playable");
    if (pokerHand && pokerIdxs.includes(i)) {
      d.classList.add("poker-card");
      d.classList.add("poker-" + pokerHand.id);
    }
    d.onclick = ()=>tryPlay(i);
    hDiv.appendChild(d);
  });

  // poker hand display（予告表示：dimクラスで暗く表示）
  let pb = document.getElementById("pokerBanner");
  let newText = pokerHand ? "[ " + pokerHand.name + "  ×" + pokerHand.multi + " ]" : "";
  if (pb.textContent !== newText) {
    pb.classList.remove("show", "confirmed");
    pb.textContent = newText;
    if (pokerHand) {
      void pb.offsetWidth;
      pb.classList.add("show", "preview");
    }
  }

  document.getElementById("medal").innerText = medals;
  document.getElementById("chainVal").innerText = chain;
  document.getElementById("deckInfo").innerText = deck.length;

  // field glow
  let fz = document.getElementById("fieldZone");
  fz.className = "";
  if (chain>0) { let t=getTier(chain); if(t.fieldCls) fz.classList.add(t.fieldCls); }

  renderBoard();
}

function renderBoard() {
  let board = document.getElementById("cardBoard");
  board.innerHTML="";
  for (let s of suits) {
    let row = document.createElement("div"); row.className="boardRow";
    let sEl = document.createElement("span");
    sEl.className="boardSuit "+(isRed({suit:s})?"red":"black");
    sEl.textContent=s; row.appendChild(sEl);
    for (let r of ranks) {
      let el = document.createElement("span"); el.className="boardCard";
      el.textContent=rankText(r);
      let used = discard.some(c=>c.suit===s&&c.rank===r);
      let isCurrent = field&&field.suit===s&&field.rank===r;
      if(isCurrent) el.classList.add("current");
      else if(used) el.classList.add("used");
      row.appendChild(el);
    }
    board.appendChild(row);
  }
}

function setMsg(text,cls) {
  let el=document.getElementById("msgBar");
  el.textContent=text; el.className=cls||"";
}

function addMedals(amount) {
  const oldMedal = medals;
  medals += amount;
  
  // 画面の数字を即時更新（render()全体を呼ぶと中間状態で描画されるのでここでは数字だけ更新）
  let medalEl = document.getElementById("medal");
  if (medalEl) medalEl.innerText = medals;

  // 50枚ごとの演出チェック
  if (Math.floor(medals / 50) > Math.floor(oldMedal / 50)) {
    triggerBulkWinEffect();
  }
}

function triggerBulkWinEffect() {
  const msg = document.getElementById("insertCoin");
  if(!msg) return;
  const originalText = "INSERT COIN TO CONTINUE";
  msg.innerText = "⭐ 50+ MEDALS BULK WIN! ⭐";
  msg.style.color = "#FFD700";
  msg.classList.add("glitch"); 
  setTimeout(() => {
    msg.innerText = originalText;
    msg.style.color = ""; 
    msg.classList.remove("glitch");
  }, 2000);
}
// --- ここまで ---
// ===== CHAIN BANNER =====
// マイルストーンのchainセット（tryPlayで更新）
const MILESTONE_CHAINS = new Set([10,14,17,20,23,26,29,32,35,38,41,44,47,50,53]);

function showChainBanner(c, isMilestone) {
  let el=document.getElementById("chainText");
  el.classList.remove("show","rainbow");
  // マイルストーン到達時のみ演出表示
  if (!isMilestone || c < 1) { el.style=""; return; }
  let tier=getTier(c);
  void el.offsetWidth;
  el.textContent = tier.label + c + "!!";
  el.style.color=tier.color;
  el.style.textShadow=`0 0 15px ${tier.shadow}, 0 0 30px ${tier.shadow}`;
  el.classList.add("show");
  if(tier.cls) el.classList.add(tier.cls);
}

// ===== PLAY =====

function tryPlay(i) {

  if(isAnimating) return;

  // 最初の1枚（チェーンはまだ始まっていないのでメダルなし）
  if(field === null){
    field = hand.splice(i,1)[0];
    chain = 0;
    playSound("card");
    setMsg(`カードを出しました`, "");
    showChainBanner(chain, false);
    refillHand();
    render();
    if(hand.length===0 && deck.length===0) { setTimeout(()=>deckClear(),400); return; }
    if(isStuck()) { triggerStuck(); }
    return;
  }
  
  let h=hand[i];
  if(!playable(h,field)) {
    let hDiv=document.getElementById("hand");
    let cards=hDiv.querySelectorAll(".card");
    cards[i].classList.remove("cannot-play");
    void cards[i].offsetWidth;
    cards[i].classList.add("cannot-play");
    playSound("error");
    setMsg("⚠ そのカードは出せません","error");
    // 出せないカードをクリックしただけではチェーンをリセットしない
    document.getElementById("chainVal").innerText=chain;
    showChainBanner(chain, false);
    return;
  }

  isAnimating=true;

  // ★出す前の5枚で役判定
  let pokerHand = detectPokerHand(hand);

  discard.push(field);
  field=hand.splice(i,1)[0];
  chain++;
  if(chain>maxChain) maxChain=chain;

  // チェーンボーナステーブル（マイルストーン到達時のみ加算）
  const CHAIN_MILESTONES = [
    { at: 10, reward: 10,  label: "10-13" },
    { at: 14, reward: 20,  label: "14-16" },
    { at: 17, reward: 30,  label: "17-19" },
    { at: 20, reward: 40,  label: "20-22" },
    { at: 23, reward: 50,  label: "23-25" },
    { at: 26, reward: 60,  label: "26-28" },
    { at: 29, reward: 70,  label: "29-31" },
    { at: 32, reward: 80,  label: "32-34" },
    { at: 35, reward: 90,  label: "35-37" },
    { at: 38, reward: 100, label: "38-40" },
    { at: 41, reward: 110, label: "41-43" },
    { at: 44, reward: 120, label: "44-46" },
    { at: 47, reward: 130, label: "47-49" },
    { at: 50, reward: 140, label: "50-52" },
    { at: 53, reward: 200, label: "CLEAR" },
  ];
  let milestone = CHAIN_MILESTONES.find(m => m.at === chain) || null;
  let chainReward = milestone ? milestone.reward : 0;
  let pokerBonus  = pokerHand ? pokerHand.multi : 0;
  let total       = chainReward + pokerBonus;

  // 加算＆即時表示反映
  medals += total;
  document.getElementById("medal").innerText = medals;

  // メッセージ・演出
  if (pokerHand && milestone) {
    playSound("hand");
    setMsg(`🎰 ${pokerHand.name} + CHAIN BONUS! +${total} メダル！`, "chain-msg");
    highlightPayRow(pokerHand.id);
    highlightChainBonusRow(milestone.label);
    let pbEl = document.getElementById("pokerBanner");
    pbEl.classList.remove("preview");
    pbEl.classList.add("confirmed");
  } else if (pokerHand) {
    playSound("hand");
    setMsg(`🎰 ${pokerHand.name}! +${pokerBonus} メダル！`, "chain-msg");
    highlightPayRow(pokerHand.id);
    // 確定演出：バナーをconfirmedに切り替え
    let pbEl = document.getElementById("pokerBanner");
    pbEl.classList.remove("preview");
    pbEl.classList.add("confirmed");
  } else if (milestone) {
    playSound("hand");
    setMsg(`🔥 ${chain} CHAIN BONUS! +${chainReward} メダル！`, "chain-msg");
    highlightChainBonusRow(milestone.label);
  } else {
    playSound("card");
    if (chain >= 2) setMsg(`🔥 ${chain} CHAIN!`, "chain-msg");
    else setMsg(`カードを出しました`, "");
  }

  // medal flash
  let medalEl = document.getElementById("medal");
  medalEl.classList.remove("medal-anim");
  void medalEl.offsetWidth;
  medalEl.classList.add("medal-anim");
  setTimeout(() => medalEl.classList.remove("medal-anim"), 400);

  showChainBanner(chain, !!milestone);
  refillHand();
  render(); // ← ここで medal.innerText = medals が正しく反映される
  isAnimating = false;

  if(hand.length===0&&deck.length===0) { setTimeout(()=>deckClear(),400); return; }
  if(isStuck()) { triggerStuck(); }
}

// ===== STUCK =====
function triggerStuck() {
  setMsg("手詰まり…！", "error");
  playSound("error");

  // 手札を全部暗くする
  document.querySelectorAll('#hand .card').forEach(c => {
    c.style.filter = "grayscale(1) brightness(0.4)";
    c.style.transition = "filter 0.8s ease";
  });

  // 暗幕をじわっと
  let ov = document.getElementById("stuckOverlay");
  let msg = document.getElementById("stuckMsg");
  msg.innerHTML = "STUCK...<br><span style='font-size:16px;color:#aaa;letter-spacing:2px;'>NO MOVES LEFT</span>";

  setTimeout(() => {
    ov.classList.add("show");
    msg.classList.add("show");
  }, 400);

  // 3秒後にGAME OVER（setTimeoutの前にmedals/maxChainをキャプチャ）
  const capturedMedals = medals;
  const capturedMaxChain = maxChain;
  setTimeout(() => {
    ov.classList.remove("show");
    msg.classList.remove("show");
    gameOver(capturedMedals, capturedMaxChain);
  }, 3200);
}

// ===== END =====
function gameOver(finalMedals, finalMaxChain) {
  // 引数がない場合はグローバル変数を使用
  let m = (finalMedals !== undefined) ? finalMedals : medals;
  let mc = (finalMaxChain !== undefined) ? finalMaxChain : maxChain;
  playSound("lose");
  document.getElementById("gameOverScore").innerHTML=
    `MEDALS: ${m}<br>MAX CHAIN: ${mc}`;
  document.getElementById("gameOverScreen").classList.add("show");
}
function deckClear() {
  playSound("clear");
  document.getElementById("clearScore").innerHTML=
    `MEDALS: ${medals}<br>MAX CHAIN: ${maxChain}`;
  document.getElementById("clearScreen").classList.add("show");
}

// ===== START =====
function start() {

// ブラウザの音声再生制限を解除（ゲーム終了系サウンドは除外）
  const unlockExclude = ["lose", "clear"];
  Object.entries(SOUNDS).forEach(([name, s]) => {
    if (unlockExclude.includes(name)) return;
    s.play().then(() => { s.pause(); s.currentTime = 0; }).catch(() => {});
  });
     
  deck=[];hand=[];discard=[];
  medals=0;chain=0;maxChain=0;isAnimating=false;
  document.getElementById("gameOverScreen").classList.remove("show");
  document.getElementById("clearScreen").classList.remove("show");
  document.getElementById("chainText").classList.remove("show","rainbow");
  document.getElementById("fieldZone").className="";
  document.getElementById("pokerBanner").textContent="";
  document.getElementById("stuckOverlay").classList.remove("show");
  document.getElementById("stuckMsg").classList.remove("show");
  document.querySelectorAll('#hand .card').forEach(c => { c.style.filter=""; });
  highlightPayRow(null);
  while(isStuck()){
    createDeck();
    field=null;
    refillHand();
  }
  setMsg("カードを配っています…","");
  dealHand();
}

// ===== DEAL ANIMATION =====
function dealHand() {
  isAnimating = true;
  let hDiv = document.getElementById("hand");
  hDiv.innerHTML = "";

  // 裏向きカードを5枚並べる
  let wrappers = hand.map((c, i) => {
    let wrapper = document.createElement("div");
    wrapper.className = "card-wrapper";

    let inner = document.createElement("div");
    inner.className = "card-inner"; // 最初は裏向き（回転なし）

    // 裏面
    let back = document.createElement("div");
    back.className = "card-back";
    back.innerHTML = "🂠";

    // 表面
    let face = document.createElement("div");
    face.className = "card-face";
    let faceCard = makeCardEl(c);
    faceCard.style.width = "100%";
    faceCard.style.height = "100%";
    faceCard.style.position = "absolute";
    face.appendChild(faceCard);

    inner.appendChild(back);
    inner.appendChild(face);
    wrapper.appendChild(inner);

    // ディールアニメ: 上からスライドイン
    wrapper.style.opacity = "0";
    wrapper.style.transform = "translateY(-40px)";
    wrapper.style.transition = `opacity 0.25s ease ${i*0.12}s, transform 0.25s ease ${i*0.12}s`;

    hDiv.appendChild(wrapper);
    return { wrapper, inner, card: c, index: i };
  });

  // 少し待ってからスライドイン
  requestAnimationFrame(() => requestAnimationFrame(() => {
    wrappers.forEach(({wrapper}) => {
      wrapper.style.opacity = "1";
      wrapper.style.transform = "translateY(0)";
    });
  }));

  // 1枚ずつフリップ
  wrappers.forEach(({inner, card, index}) => {
    setTimeout(() => {
      playSound("card");
      inner.classList.add("flipped");

      // 最後の1枚がめくれたら通常render
      if (index === hand.length - 1) {
        setTimeout(() => {
          isAnimating = false;
          setMsg("手札をクリックして出す","");
          render();
        }, 600);
      }
    }, 300 + index * 200);
  });
}

start();
