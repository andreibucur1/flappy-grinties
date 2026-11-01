# Flappy Grințieș: cum se pornește la stand

## Pornire

1. Deschide **Chrome**.
2. Dublu-click pe `index.html`, **mereu din același folder**.
3. `F11` pentru ecran complet. Jocul se scalează singur la fereastră (cu factor întreg când se poate, ca pixelii să rămână egali).
4. Lasă fereastra deschisă tot evenimentul. După fiecare tură jocul revine singur la ecranul de start.

> **Important:** scorurile sunt salvate în `localStorage`, legat de originea paginii. Dacă deschizi jocul din alt folder, alt browser sau printr-un server local (Live Server etc.), scorurile vechi nu se pierd, dar nu apar în acea instanță.

## Cum se joacă

`Space` la start → username + `Enter` → `Space` ca să începi → `Space` = săritură. Marginea de sus nu omoară: personajul doar nu poate urca mai sus. Obstacolele și solul omoară.

## Scurtături de organizator (nu apar pe ecran)

| Scurtătură | Ce face |
|---|---|
| `Ctrl+Shift+R` | Ecranul cu toți jucătorii (din ecranul de start sau de game over). Încă o dată = ieșire. Același ecran se deschide și din butonul **Rezultate** (colțul din dreapta jos al ecranului de start); **Înapoi** sau `Esc` revin. |
| Derulare în rezultate | Roata mouse-ului, bara aurie din dreapta (click sau tragere), `Sus`/`Jos`, `PageUp`/`PageDown`, `Home`/`End`. |
| `Esc` | Ieșire din rezultate; anulează introducerea numelui |
| `Ctrl+Shift+E` | Export **CSV** cu clasamentul complet (loc, jucător, record, hartă, ture, ultima tură, data recordului). Se deschide direct în Excel, cu diacritice corecte. **Fă-l periodic și la final.** |
| `Ctrl+Shift+J` | Backup JSON cu toate turele jucate, una câte una. Nu schimbă stocarea. |
| `Ctrl+Shift+Delete` | Șterge toate scorurile, doar după confirmare. Nu merge în timpul unei ture. |
| `Ctrl+Shift+M` | Oprește / pornește muzica. Nu se salvează. |
| `Ctrl+Shift+H` | Arată / ascunde hitbox-urile (contur roșu) și linia plafonului. Nu se salvează; la pornire e mereu oprit. |

## Muzica

Melodia din `music/fundal.mp3` rulează în buclă, pe tot parcursul jocului. Chrome nu pornește sunetul până nu apeși o tastă sau dai un click în pagină, deci **după ce deschizi jocul apasă o dată orice tastă** (de exemplu `Shift`). Volumul se reglează în `js/config.js` (`music.volume`, între 0 și 1). `Ctrl+Shift+M` oprește / pornește sunetul.

Ca muzica să pornească singură, fără nicio apăsare, deschide Chrome cu opțiunea `--autoplay-policy=no-user-gesture-required` (din proprietățile comenzii rapide Chrome, la „Țintă").

## Calibrare

Totul e în `js/config.js`: gravitație, săritură, `gap`/`speed`/`spacing` per hartă, `ceilingY` etc. Câteva valori pe care le vei ajusta probabil:

- `pillarsPerMap` (11): după câte obstacole se schimbă harta și fundalul (la 11, 22, 33, 44). Pe Grințieșu Mare, ultima hartă, rămâne până la final.
- `bgTransitionMs` (1500): cât durează tranziția (dither) între două fundaluri.
- `minGapShift` (80) și `maxGapShift` (220): cât de mult diferă, în px, centrele a două spații consecutive. Poziția e aleatorie, dar mereu în acest interval față de cea anterioară.
- `endless` (`speedStep`, `speedMax`): cât crește viteza pe Grințieșu Mare după scorul 44. Valorile sunt de pornire, nu testate. `Ctrl+Shift+H` ajută la verificarea hitbox-urilor.

## Personajele

Personajul fiecărei ture e poza unuia dintre cei 6 membri, aleasă aleatoriu (`characters/<nume>.png`, fundal transparent). Pozele sunt singurele imagini din joc și nu sunt în paleta 8-bit. Dacă o poză nu se încarcă, jocul desenează un personaj pixel art în locul ei.

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
