# Naujas UI — darbų sąrašas

Atnaujinta: 2026-10-01. Šaka: `sandbox/DS/new_ui` (25 commit'ai, į GitHub **nepush'inta**).

## 1. Kaip paleisti

1. Tunelis į testinį Traccar (jei neveikia):
   `ssh -N -L 8082:localhost:18082 domdom@192.168.0.103`
2. Dev serveris su nauju UI:
   `VITE_NEW_UI=1 npx vite --host --port 3100` (PowerShell: `$env:VITE_NEW_UI=1; npx vite --host --port 3100`)
3. Naršyklėje: http://localhost:3100 (telefone — http://<kompiuterio IP>:3100, per Wi-Fi buvo 192.168.0.106)

Nuolat naują UI galima įjungti failu `.env.local` su eilute `VITE_NEW_UI=1`. Senas UI lieka numatytasis (`.env`: `VITE_NEW_UI=0`).

### Demo paskyros (slaptažodis — `DEMO_PASSWORD` iš `~/traccar-test/seed.env` serveryje)

| Rolė | Paskyra |
|---|---|
| SuperAdmin | superadmin@demo.test (arba jūsų `ADMIN_EMAIL`) |
| Installer | installer@demo.test |
| Admin (įmonė) | admin@acme.test, admin@baltic.test, admin@kaunas.test, admin@nemunas.test, admin@aukstaitija.test |
| User | user1@acme.test … (kiekviena įmonė turi 2–4 vartotojus) |

Montuotojo testui be tikro įrenginio naudokite IMEI **359000000000001–359000000000005** — jiems jau siunčiami duomenys, tik nėra užregistruoti.

## 2. Kas padaryta

- **Pagrindas:** perjungimas `VITE_NEW_UI`, rolės (User / Admin / Installer / SuperAdmin), meniu ir maršrutų apsauga pagal rolę, šviesi/tamsi tema, lietuvių ir anglų kalbos.
- **Prisijungimas:** naujas prisijungimo langas (TOTP, OpenID, kalba, serverio pranešimas).
- **SuperAdmin:** įmonių pasirinkimas → „Atidaryti parką“ (prisijungimas įmonės Admin vardu, juosta „Keisti įmonę“), vartotojai ir rolės, IO mapping, komandų šablonai įmonėms, audito žurnalas, sistema (statistika, pranešimas prisijungimo lange, registracija).
- **Installer:** įmonės pasirinkimas, įrenginio registravimas pagal IMEI, automatinis susiejimas su įmone, gyvas IO testas ir testinės komandos.
- **Admin:** konfigūruojamas skydelis (valdikliai, tempimas, IO reikšmės, rida per dieną), įrangos valdymas, geozonų piešimas, techninė priežiūra, pranešimai, komandų kūrimas, ataskaitos su išsaugotais ataskaitų būdais ir Excel eksportu.
- **User ir Admin:** žemėlapis su transporto sąrašu ir paneliu, transporto lentelė, maršrutų istorija su atkūrimu, komandos, įvykių centras, nustatymai.
- **Greitis:** pagrindinis JS failas sumažintas nuo 1,5 MB iki 0,4 MB (žemėlapio variklis kraunamas atskirai).
- **Testinis serveris:** `tools/test-server/seed.py` per cron kas minutę palaiko 5 įmones, 40 mašinų, komandas, aliarmus, geozonas „Bazė“, pranešimus ir IO susiejimą „Durys“.

## 3. Ką reikia padaryti jums

### Išbandyti naršyklėje (aš UI mačiau tik per kodą ir API)

- [ ] **SuperAdmin:** Įmonės → pasirinkti → „Atidaryti parką“ → juosta „Keisti įmonę“ → grįžti.
- [ ] **SuperAdmin:** Vartotojai ir rolės → sukurti įmonę, vartotoją, pakeisti rolę, pašalinti.
- [ ] **SuperAdmin:** IO mapping → atsidaryti „Durys“, išbandyti su ACME mašina, sukurti savo susiejimą, priskirti įmonei.
- [ ] **Installer:** Instaliacija → įmonė → IMEI `359000000000001` → matyti gyvus IO (`in3` persijungia kas 30 s ir paryškinama).
- [ ] **Installer telefone:** IMEI lauke paspausti skenavimo mygtuką → „Fotografuoti etiketę“ → nufotografuoti tikro Teltonika įrenginio ar dėžutės etiketę (brūkšninis kodas, QR kodas arba atspausdintas IMEI). Gyvas kameros vaizdas atsiras tik per HTTPS.
- [ ] **SuperAdmin:** Komandų šablonai → sukurti, priskirti įmonei, patikrinti, kad įmonės vartotojas jį mato. Audito žurnalas, Sistema.
- [ ] **Admin:** Skydelis → „Tvarkyti skydelį“ (pridėti IO valdiklį, pertempti, pakeisti dydį, išsaugoti), Įrangos valdymas (pridėti / redaguoti / pašalinti / gyvas testas), Geozonos (nubrėžti, pavadinti, pakeisti formą), Techninė priežiūra, Pranešimai, Komandos → „Išsaugotos komandos“, Ataskaitos (sugeneruoti, išsaugoti būdą, eksportuoti į Excel).
- [ ] **Prisijungimo langas:** prisijungti, neteisingas slaptažodis, kalbos keitimas.
- [ ] **User:** Žemėlapis (sąrašas, filtrai, panelis, „Visi IO“, Istorija), Komandos, Įvykiai, Nustatymai.
- [ ] Telefone: žemėlapis, sąrašo mygtukas, panelis, šoninis meniu.
- [ ] Parašyti, kas negražu ar nepatogu — pataisysiu.

### Sprendimai, kurių reikia iš jūsų

- [ ] **Installer = pilnas administratorius backend'e.** Apribojimai galioja tik naujame UI; per API Installer gali viską. Ar tai priimtina, ar vėliau darome backend rolę?
- [ ] **Komandų eilė.** Traccar 6 neturi API eilei peržiūrėti ar atšaukti, todėl naujas UI siunčia be eilės. **Senas UI vis dar deda komandas į eilę pagal nutylėjimą.** Ar keičiame ir tai (pvz. `noQueue` visoms esamoms išsaugotoms komandoms)?
- [ ] **Užduotys / dispečeris.** Traccar neturi užduočių duomenų modelio. Variantai: (a) nedidelis atskiras servisas ar backend plėtinys užduotims saugoti, (b) laikyti užduotis Admin paskyros atributuose (paprasta, bet netinka daug užduočių ir keliems redaguojantiems vienu metu). Kurį renkamės?
- [ ] **Automatiniai testai.** Projekte nėra testų įrankio. Ar sutinkate pridėti `vitest` + `@testing-library/react` (tik dev priklausomybės)?
- [ ] **Pranešimai komanda (kanalas `command`).** Ar reikia, kad įvykis automatiškai siųstų komandą įrenginiui?
- [ ] Registracijos ir slaptažodžio atkūrimo langai kol kas seno UI — ar perdaryti?

### Serveris ir diegimas

- [ ] **HTTPS naujam UI.** Gyvas IMEI skenavimas kamera naršyklėje veikia tik per HTTPS. Per HTTP veikia tik nuotraukos būdas. Testiniam serveriui reikia HTTPS (pvz. nginx / Caddy su sertifikatu prieš 18082).

- [ ] **Naujo UI įdiegimas į testinį konteinerį:** kompiuteryje `VITE_NEW_UI=1 npm run build`, `build/` aplanką nukopijuoti į serverį (`scp -r build domdom@192.168.0.103:~/new-ui-build`), tada serveryje `docker cp ~/new-ui-build/. traccar-new-ui-test:/opt/traccar/web/`. Kitas būdas: perbuildinti `traccar-new-ui-test` paveikslą.
- [ ] **Testinio konteinerio duomenys** saugomi konteinerio viduje, ne tome (volume) — sukūrus konteinerį iš naujo, duomenų bazė dings (skriptas demo duomenis atkurs per minutę, bet jūsų rankiniai pakeitimai dings). Jei reikia, pridėkite volume `/opt/traccar/data`.
- [ ] **Tikri įrenginiai testiniam serveriui:** dabar atidarytas tik 18082 (web). Tikram Teltonika reikia publikuoti jo prievadą (pvz. 5027).
- [ ] **Pagrindiniam (produkciniam) serveriui prieš įjungiant naują UI:**
  - įmonių Admin paskyroms nustatyti `deviceLimit = -1` (kitaip jie negali pridėti įrangos);
  - išsaugotas komandas susieti su įmonės įrenginiais (Traccar rodo komandą tik susietą ir su vartotoju, ir su įrenginiu);
  - norimiems SuperAdmin/Installer nustatyti atributą `role` (`superadmin` / `installer`).
- [ ] `git push` šakai `sandbox/DS/new_ui`, kai būsite patenkinti.

## 4. Žinomi apribojimai

- IMEI teksto atpažinimas (OCR) pirmą kartą parsiunčia atpažinimo modelį (~10 MB) iš interneto (jsDelivr CDN), todėl telefonui reikia interneto ryšio. Brūkšninių ir QR kodų skaitymas veikia be interneto. Jei reikės, modelį galima laikyti savo serveryje.
- Demo (OsmAnd) įrenginiai **negali priimti komandų**, todėl siuntimas jiems baigiasi klaida „Įrenginys neprisijungęs arba nepriima komandų“. Tai tikėtina; su tikru Teltonika turėtų veikti.
- Gyvi įvykiai rodomi tik tiems tipams, kuriems vartotojas turi „web“ pranešimą (demo — aliarmai).
- SuperAdmin raktas grįžimui laikomas naršyklės `sessionStorage` 12 val.; uždarius kortelę tenka prisijungti iš naujo.
- Skydelio tempimas veikia pele; telefone valdiklius perkelkite rodyklėmis (naršyklių drag & drop jutikliniuose ekranuose neveikia).
- Pranešimai, priskirti konkrečioms mašinoms (ne „visoms“), automatiškai neprisiriša prie vėliau pridėtų mašinų — juos reikia papildyti rankiniu būdu.
- Techninės priežiūros planai taip pat priskiriami konkrečioms mašinoms; naujai pridėtą mašiną reikia įtraukti į planą.

## 5. Likę darbai iš pradinio sąrašo

- [x] C: skydelio valdiklių sistema, drag & drop, savi grafikai, IO valdikliai
- [x] F: globali komandų konfigūracija (šablonai), sistemos įrankiai (statistika, serverio nustatymai)
- [x] G: techninė priežiūra, pranešimų valdymas, audito žurnalas
- [x] Naujas prisijungimo langas
- [x] Geozonų kūrimas
- [x] Pagrindinio JS failo sumažinimas
- [ ] G: užduotys / dispečeris — laukia jūsų sprendimo (3 skyrius)
- [ ] Automatiniai testai — laukia jūsų sprendimo (3 skyrius)
