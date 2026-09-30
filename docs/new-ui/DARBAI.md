# Naujas UI — darbų sąrašas

Atnaujinta: 2026-09-30. Šaka: `sandbox/DS/new_ui` (13 commit'ų, į GitHub **nepush'inta**).

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
- **SuperAdmin:** įmonių pasirinkimas → „Atidaryti parką“ (prisijungimas įmonės Admin vardu, juosta „Keisti įmonę“), vartotojai ir rolės, IO mapping.
- **Installer:** įmonės pasirinkimas, įrenginio registravimas pagal IMEI, automatinis susiejimas su įmone, gyvas IO testas ir testinės komandos.
- **Admin:** skydelis, įrangos valdymas, komandų kūrimas, ataskaitos su išsaugotais ataskaitų būdais ir Excel eksportu.
- **User ir Admin:** žemėlapis su transporto sąrašu ir paneliu, transporto lentelė, maršrutų istorija su atkūrimu, komandos, įvykių centras, nustatymai.
- **Testinis serveris:** `tools/test-server/seed.py` per cron kas minutę palaiko 5 įmones, 40 mašinų, komandas, aliarmus, pranešimus ir IO susiejimą „Durys“.

## 3. Ką reikia padaryti jums

### Išbandyti naršyklėje (aš UI mačiau tik per kodą ir API)

- [ ] **SuperAdmin:** Įmonės → pasirinkti → „Atidaryti parką“ → juosta „Keisti įmonę“ → grįžti.
- [ ] **SuperAdmin:** Vartotojai ir rolės → sukurti įmonę, vartotoją, pakeisti rolę, pašalinti.
- [ ] **SuperAdmin:** IO mapping → atsidaryti „Durys“, išbandyti su ACME mašina, sukurti savo susiejimą, priskirti įmonei.
- [ ] **Installer:** Instaliacija → įmonė → IMEI `359000000000001` → matyti gyvus IO (`in3` persijungia kas 30 s ir paryškinama).
- [ ] **Admin:** Skydelis, Įrangos valdymas (pridėti / redaguoti / pašalinti / gyvas testas), Komandos → „Išsaugotos komandos“, Ataskaitos (sugeneruoti, išsaugoti būdą, eksportuoti į Excel).
- [ ] **User:** Žemėlapis (sąrašas, filtrai, panelis, „Visi IO“, Istorija), Komandos, Įvykiai, Nustatymai.
- [ ] Telefone: žemėlapis, sąrašo mygtukas, panelis, šoninis meniu.
- [ ] Parašyti, kas negražu ar nepatogu — pataisysiu.

### Sprendimai, kurių reikia iš jūsų

- [ ] **Installer = pilnas administratorius backend'e.** Apribojimai galioja tik naujame UI; per API Installer gali viską. Ar tai priimtina, ar vėliau darome backend rolę?
- [ ] **Komandų eilė.** Traccar 6 neturi API eilei peržiūrėti ar atšaukti, todėl naujas UI siunčia be eilės. **Senas UI vis dar deda komandas į eilę pagal nutylėjimą.** Ar keičiame ir tai (pvz. `noQueue` visoms esamoms išsaugotoms komandoms)?
- [ ] **Prisijungimo langas.** Kol kas naudojamas seno UI. Ar reikia naujo dizaino?
- [ ] **Skydelio valdiklių tempimas (drag & drop).** Reikės naujos bibliotekos (pvz. `react-grid-layout`) — ar sutinkate?
- [ ] Ką imame toliau iš 5 skyriaus?

### Serveris ir diegimas

- [ ] **Naujo UI įdiegimas į testinį konteinerį:** kompiuteryje `VITE_NEW_UI=1 npm run build`, `build/` aplanką nukopijuoti į serverį (`scp -r build domdom@192.168.0.103:~/new-ui-build`), tada serveryje `docker cp ~/new-ui-build/. traccar-new-ui-test:/opt/traccar/web/`. Kitas būdas: perbuildinti `traccar-new-ui-test` paveikslą.
- [ ] **Testinio konteinerio duomenys** saugomi konteinerio viduje, ne tome (volume) — sukūrus konteinerį iš naujo, duomenų bazė dings (skriptas demo duomenis atkurs per minutę, bet jūsų rankiniai pakeitimai dings). Jei reikia, pridėkite volume `/opt/traccar/data`.
- [ ] **Tikri įrenginiai testiniam serveriui:** dabar atidarytas tik 18082 (web). Tikram Teltonika reikia publikuoti jo prievadą (pvz. 5027).
- [ ] **Pagrindiniam (produkciniam) serveriui prieš įjungiant naują UI:**
  - įmonių Admin paskyroms nustatyti `deviceLimit = -1` (kitaip jie negali pridėti įrangos);
  - išsaugotas komandas susieti su įmonės įrenginiais (Traccar rodo komandą tik susietą ir su vartotoju, ir su įrenginiu);
  - norimiems SuperAdmin/Installer nustatyti atributą `role` (`superadmin` / `installer`).
- [ ] `git push` šakai `sandbox/DS/new_ui`, kai būsite patenkinti.

## 4. Žinomi apribojimai

- Demo (OsmAnd) įrenginiai **negali priimti komandų**, todėl siuntimas jiems baigiasi klaida „Įrenginys neprisijungęs arba nepriima komandų“. Tai tikėtina; su tikru Teltonika turėtų veikti.
- Gyvi įvykiai rodomi tik tiems tipams, kuriems vartotojas turi „web“ pranešimą (demo — aliarmai).
- SuperAdmin raktas grįžimui laikomas naršyklės `sessionStorage` 12 val.; uždarius kortelę tenka prisijungti iš naujo.
- Pagrindinis JS failas ~1,5 MB (toks pat kaip seno UI) — verta optimizuoti.

## 5. Likę darbai iš pradinio sąrašo

- [ ] C: skydelio valdiklių sistema, drag & drop, savi grafikai, IO valdikliai
- [ ] F: globali komandų konfigūracija (šablonai visoms įmonėms), sistemos įrankiai (serverio nustatymai, žurnalai, statistika)
- [ ] G: užduotys / dispečeris, techninė priežiūra, pranešimų valdymas UI, audito žurnalas
- [ ] Naujas prisijungimo langas
- [ ] Geozonų kūrimas naujame UI (dabar tik rodomos žemėlapyje)
- [ ] Automatiniai testai
