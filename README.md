# Flappy Grințieș

Jocul rulează online, pe un link public Vercel, și are un **Top 10 comun** pentru toți jucătorii, păstrat într-o bază Turso (SQLite găzduit).

```
browser (telefon / laptop) ──https──► Vercel
                                       ├─ index.html, js/, style.css   (jocul, fișiere statice)
                                       ├─ /api/score  (POST)  ─┐
                                       └─ /api/top10  (GET)   ─┴─► Turso, tabelul rounds
```

Secretele Turso (URL și token) stau doar în variabilele de mediu Vercel și în `.env.local` (ignorat de git), niciodată în codul din browser.

## Structura

| Cale | Ce conține |
|---|---|
| `index.html`, `style.css`, `js/` | Jocul (scripturi clasice, fără framework). `js/api.js` vorbește cu serverul și ține coada de ture netrimise. |
| `api/score.js`, `api/top10.js` | Vercel Functions (Node.js). |
| `lib/` | Validare, interogarea Top 10, inserare, clientul libsql. Fără cod de rețea în `validate.js`. |
| `db/schema.sql` | Schema bazei de date. |
| `scripts/migrate.mjs` | Aplică schema (`npm run db:migrate`). |
| `tests/` | Teste automate (`npm test`), pe o bază SQLite locală temporară, fără rețea. |

## Configurare (o singură dată, din terminalul VS Code)

Cerințe: **Node.js ≥ 20.12** (scriptul de migrare citește singur `.env.local` cu `process.loadEnvFile`), un cont Vercel și un cont Turso. Toate comenzile se rulează **din rădăcina repo-ului** (acolo e `package.json` și, după `vercel link`, folderul `.vercel/`).

```bash
# 1. Turso CLI. Pe Windows merge doar prin WSL: în PowerShell rulezi `wsl`, apoi în shellul WSL:
curl -sSfL https://get.tur.so/install.sh | bash      # macOS: brew install tursodatabase/tap/turso
turso auth login
turso db create flappy-grinties
turso db show flappy-grinties --url          # → TURSO_DATABASE_URL (libsql://...)
turso db tokens create flappy-grinties        # → TURSO_AUTH_TOKEN

# 2. Vercel CLI
npm i -g vercel
vercel login
vercel link                                   # leagă folderul de un proiect Vercel
vercel env add TURSO_DATABASE_URL             # lipește DOAR valoarea (libsql://...), o singură dată; fără mediu = toate mediile
vercel env add TURSO_AUTH_TOKEN               # lipește DOAR token-ul, o singură dată
vercel env pull .env.local                    # aduce variabilele mediului Development, pentru migrare

# 3. Dependențe, schema, teste
npm install
npm run db:migrate                            # citește singur .env.local; se poate rula de oricâte ori
npm test

# 4. Rulare locală (joc + API pe același port)
vercel dev                                    # → http://localhost:3000

# 5. Publicare
vercel --prod                                 # → https://<proiect>.vercel.app
```

Note despre comenzi (verificate pe 2 noiembrie 2026 în documentația oficială vercel.com/docs și docs.turso.tech):

- `vercel env add` salvează variabilele ca **Secret** în Production și Preview, și ca **Config** în Development. Valorile Secret nu se mai pot citi după creare, dar `vercel env pull` aduce implicit mediul Development, deci `.env.local` primește valorile reale.
- Dacă `/api/top10` dă `500` în producție, cauza exactă e în `vercel logs --environment production --query "level:error"`. Un `URL_INVALID` înseamnă că în variabila `TURSO_DATABASE_URL` a ajuns altceva decât URL-ul; se șterge cu `vercel env rm`, se adaugă din nou și se face `vercel --prod` (o variabilă schimbată nu se aplică deploy-urilor existente).
- **Fără Turso, local:** `TURSO_DATABASE_URL=file:local.db` (fără token) funcționează cu același cod; `*.db` e ignorat de git.

### Verificare rapidă cu `curl` (cu `vercel dev` pornit)

```bash
curl -s -X POST localhost:3000/api/score -H "Content-Type: application/json" \
  -d '{"roundId":"test-0001","username":"Test","score":5,"map":"Grințieșu Mic"}'
curl -s localhost:3000/api/top10
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/score     # → 405
```

Pe Windows (Git Bash, PowerShell) diacriticele scrise direct în linia de comandă pot ajunge stricate la server (`map_invalid`). Pune corpul într-un fișier salvat UTF-8 și trimite-l cu `--data-binary @corp.json`.

### Moderare

Ștergerea unui username nepotrivit, tot din terminal:

```bash
turso db shell flappy-grinties "DELETE FROM rounds WHERE username_key = 'numele-in-litere-mici';"
```

## Cum funcționează salvarea

- La game over tura (`roundId` unic, username, scor, hartă) intră întâi în coada `localStorage["grinties_flappy_pending_v1"]`, apoi se trimite. Pe ecran apare „Se salvează…", apoi „Scor salvat", „Fără conexiune — scorul se trimite automat mai târziu" sau „Scor respins".
- Coada se golește în ordine la game over, la încărcarea paginii și când revine conexiunea. Serverul e idempotent: aceeași tură trimisă de două ori apare o singură dată în bază.
- Top 10 se încarcă la ecranul de start și după fiecare salvare reușită. Dacă serverul nu răspunde, se afișează ultimul Top 10 primit, cu mențiunea „neactualizat".
- Username: 1–12 caractere, litere (inclusiv ă â î ș ț), cifre, spațiu, `-` și `_`, fără `-` la început. Scor între 0 și 1000 (`MAX_SCORE` în `lib/validate.js`).

## Cum se joacă

- **Desktop:** `Space` sau click la start → ecranul de nume și personaj → `Space` (sau `Enter`, sau butonul **Start**) → `Space` sau click ca să începi → `Space` sau click = săritură.
- **Telefon:** atinge ecranul la start → (atinge câmpul dacă vrei alt nume) → **Start** → atinge ecranul ca să începi și ca să sari.
- **Ecranul de nume și personaj:** câmpul vine completat cu numele de data trecută (`localStorage`, cheia `grinties_flappy_last_name_v1`) și **nu e activ**, deci `Space` pornește direct. Ca să schimbi numele, dai click pe câmp sau începi să scrii; cât scrii, `Space` e spațiu în nume, iar `Enter` pornește. Un click în afara câmpului îl dezactivează din nou.
- **Personajul se alege** pe același ecran, din rândul cu cele 6 poze de sub câmp: click sau atingere pe poză, ori săgețile `←` / `→`. Cel ales are chenar auriu; ultimul ales e preselectat data viitoare (cheia `grinties_flappy_character_v2`). Prima dată e preselectat unul la întâmplare.
- Butonul de muzică apare doar pe ecranul de start, cu Top 10.

Marginea de sus nu omoară: personajul doar nu poate urca mai sus. Obstacolele și solul omoară.

## Pornire la stand, fără internet

Jocul merge și deschis direct din `index.html` (dublu-click, în Chrome, `F11` pentru ecran complet), dar atunci nu are server: Top 10 comun apare „Clasament indisponibil", iar turele jucate așa **nu ajung niciodată în baza de date** (coada lor e legată de pagina deschisă din fișier). Recordul personal, ecranul de rezultate locale (`Ctrl+Shift+R`) și exportul CSV/JSON merg pe datele locale. Pentru clasamentul comun, deschide link-ul Vercel; dacă internetul cade în timpul evenimentului, turele se păstrează în coadă și se trimit singure când revine conexiunea.

> **Important:** datele locale (`localStorage`) sunt legate de originea paginii. Jocul deschis din fișier, de pe `localhost` și de pe link-ul Vercel are trei seturi separate de date locale.

## Scurtături de organizator (nu apar pe ecran)

| Scurtătură | Ce face |
|---|---|
| `Ctrl+Shift+R` | Ecranul cu toți jucătorii **din datele locale ale acestui browser** (clasamentul complet e în baza de date), din ecranul de start sau de game over. Încă o dată = ieșire; **Înapoi** sau `Esc` revin. Pe ecran nu mai există un buton pentru el: clasamentul pentru jucători e Top 10. |
| Derulare în rezultate | Roata mouse-ului, bara aurie din dreapta (click sau tragere), `Sus`/`Jos`, `PageUp`/`PageDown`, `Home`/`End`. |
| `Esc` | Ieșire din rezultate; anulează introducerea numelui |
| `Ctrl+Shift+E` | Export **CSV** cu clasamentul complet (loc, jucător, record, hartă, ture, ultima tură, data recordului). Se deschide direct în Excel, cu diacritice corecte. **Fă-l periodic și la final.** |
| `Ctrl+Shift+J` | Backup JSON cu toate turele jucate, una câte una. Nu schimbă stocarea. |
| `Ctrl+Shift+Delete` | Șterge toate scorurile, doar după confirmare. Nu merge în timpul unei ture. |
| `Ctrl+Shift+M` | Oprește / pornește muzica. Nu se salvează. |
| `Ctrl+Shift+H` | Arată / ascunde hitbox-urile (contur roșu) și linia plafonului. Nu se salvează; la pornire e mereu oprit. |

## Muzica

Melodia din `music/fundal.mp3` rulează în buclă, pe tot parcursul jocului. Chrome nu pornește sunetul până nu apeși o tastă sau dai un click în pagină, deci **după ce deschizi jocul apasă o dată orice tastă** (de exemplu `Shift`). `Ctrl+Shift+M` oprește / pornește sunetul.

**Volumul:** butonul cu difuzor din colțul dreapta-jos al ecranului de start (cel cu Top 10) deschide un slider. Volumul ales se ține minte în browser (`localStorage`, cheia `grinties_flappy_volume_v1`); la 0 sunetul e oprit și iconița apare tăiată. Valoarea de pornire, până alege cineva alta, e `music.volume` din `js/config.js` (între 0 și 1). Pe iPhone, Safari nu lasă pagina să schimbe volumul: acolo sliderul doar oprește sunetul (la 0), restul se reglează din butoanele telefonului.

Ca muzica să pornească singură, fără nicio apăsare, deschide Chrome cu opțiunea `--autoplay-policy=no-user-gesture-required` (din proprietățile comenzii rapide Chrome, la „Țintă").

## Calibrare

Totul e în `js/config.js`: gravitație, săritură, `gap`/`speed`/`spacing` per hartă, `ceilingY` etc. Câteva valori pe care le vei ajusta probabil:

- `pillarsPerMap` (11): după câte obstacole se schimbă harta și fundalul (la 11, 22, 33, 44). Pe Grințieșu Mare, ultima hartă, rămâne până la final.
- `bgTransitionMs` (1500): cât durează tranziția (dither) între două fundaluri.
- `minGapShift` (80) și `maxGapShift` (220): cât de mult diferă, în px, centrele a două spații consecutive. Poziția e aleatorie, dar mereu în acest interval față de cea anterioară.
- `endless` (`speedStep`, `speedMax`): cât crește viteza pe Grințieșu Mare după scorul 44. Valorile sunt de pornire, nu testate. `Ctrl+Shift+H` ajută la verificarea hitbox-urilor.

## Personajele

Personajul fiecărei ture e poza unuia dintre cei 6 membri, aleasă de jucător pe ecranul de nume: Bucur, Bianca, Mădălina, Costi, Andrei, Ovidiu, în această ordine (`characters/<id>.png`, fundal transparent; lista e `characters` din `js/config.js`). Pozele sunt singurele imagini din joc și nu sunt în paleta 8-bit. Dacă o poză nu se încarcă, jocul desenează un personaj pixel art în locul ei.

Dacă înlocuiești o poză: pune noul `characters/<nume>.jpeg` (fundal negru) și rulează `python tools/decupeaza_poze.py` (cere `pip install pillow`), sau pune direct un `characters/<nume>.png` cu fundal transparent. Mărimea personajului și a hitbox-ului: `bird` în `js/config.js`.

## Grafica

Restul jocului e desenat în cod, ca pixel art, fără imagini externe (merge complet offline):

- `js/palette.js`: paleta jocului: 16 culori pentru interfață, plus nuanțele peisajelor (cer, munți, brazi, iarbă, stânci) și ale obstacolelor (ciuperci, cai, mânere de sabie). Nicio altă culoare nu se folosește.
- `js/font.js`: font bitmap 5×7, cu `ă â î ș ț Ă Â Î Ș Ț` (virgulă dedesubt; variantele cu sedilă se afișează la fel).
- `js/sprites.js`: sprite-urile obstacolelor, desenate în cod cu umbrire (lumina din stânga, ca în peisaje), și personajele-rezervă.
- `js/ui.js`: ecranele, panourile (ramă de lemn cu ținte aurii, interior albastru în degrade) și butoanele (scânduri de lemn).
- `js/backgrounds.js`: peisajele procedurale (cer, nori, munți cu zăpadă, vârf stâncos, pădure, dealuri cu brazi și pietre), în 5–7 straturi cu parallax, și solul. Fiecare hartă are atmosfera ei: zi (Grințieșu Mic), amiază cu blocuri în depărtare (Poiana), amurg fără brazi în fundal, ca brazii-obstacol să se distingă (Bradu), dimineață cu gard (Moci), noapte cu lună și stele (Grințieșu Mare).
- `js/obstacles.js`: aranjarea obstacolelor (capăt + corp repetat), hitbox pe formă, desenare.

Temele: Grințieșu Mic = ciuperci, Poiana = blocuri, Bradu = brazi, Moci = cai (stâlp de gard cu cap de cal), Grințieșu Mare = săbii.

## Dacă apare un avertisment

- **„Date corupte!"**: jocul nu a suprascris nimic și nu salvează nimic nou. Fă `Ctrl+Shift+E` (păstrează datele vechi), apoi `Ctrl+Shift+Delete` ca să pornești de la zero.
- **„Scrierea în localStorage a eșuat!"**: probabil modul incognito sau stocarea blocată. Fă un export cât mai des.
