https://docs.ollama.com/# Presentatie-gids — Code Convention Checker

## Wat is het product? (openingszin)

> "Ik heb een automatische code-checker gebouwd die Unity-scripts controleert op code-conventies, en die automatisch draait in een GitLab-pipeline bij elke merge request."

---

## Grote lijn uitleggen (in volgorde)

### 1. Waarom bestaat het?
In ons Unity-teamproject schreef iedereen code op zijn eigen manier. Klassenamen met kleine letters, publieke velden die via `[SerializeField]` moeten, `Awake` en `Start` door elkaar gebruikt. Dit viel pas op vlak voor de deadline.

De oplossing: een tool die elke keer automatisch controleert voordat code wordt gemerged.

---

### 2. Hoe werkt het? (de pipeline-flow)

```
Developer pusht code
       ↓
GitLab start automatisch een pipeline
       ↓
De checker wordt gecloned + uitgevoerd
       ↓
Alle .cs bestanden worden geanalyseerd
       ↓
Violations? → Pipeline mislukt, merge geblokkeerd
Geen violations? → Pipeline slaagt, merge mag door
```

---

### 3. Wat doet de checker intern? (per bestand)

| Bestand | Verantwoordelijkheid |
|---|---|
| `Program.cs` | Start de tool, verwerkt argumenten, bepaalt welke bestanden worden geanalyseerd |
| `Parser.cs` | Leest C# code regel voor regel, haalt declaraties eruit (klassen, methoden, velden, variabelen) |
| `Rules.cs` | Voert alle controles uit op de gevonden declaraties |
| `Llm.cs` | Stuurt namen naar een lokaal AI-model (Ollama) om vage/slechte namen te herkennen |
| `Reporter.cs` | Print de gevonden fouten in kleur naar de console |

**De flow in één zin:** bestanden ophalen → commentaar strippen → declaraties extraheren → regels controleren → fouten printen.

---

### 4. Welke regels worden er gecheckt?

| Code | Ernst | Wat wordt gecheckt |
|---|---|---|
| CQE001 | error | Geen publieke velden (gebruik `[SerializeField]`) |
| CQE002 | error | Elke declaratie moet een access modifier hebben |
| CQE003 | error | Klasse/struct/interface namen moeten PascalCase zijn |
| CQE004 | error | Methodenamen moeten PascalCase zijn |
| CQE005 | error | Lokale variabelen moeten camelCase zijn |
| CQE006 | error | Private velden moeten `_camelCase` zijn |
| CQE008 | warning | Geen magic numbers (gebruik constanten) |
| CQE009 | warning | `[SerializeField]` alleen op private velden |
| CQE010 | warning | Gebruik `Awake()` of `Start()`, niet allebei door elkaar |
| CQE011 | warning | AI controleert of namen duidelijk zijn (bijv. `Foo`, `Temp`) |

**errors blokkeren de merge, warnings niet.**

---

### 5. Waarom C# en niet JavaScript?

De eerste versie was een JavaScript-prototype, volledig gegenereerd door een AI. Het draaide, maar ik begreep het niet volledig en kon het moeilijk uitbreiden. Ik heb daarom de hele tool herschreven in C# omdat:

- C# is de taal die ik dagelijks gebruik in Unity
- De CI/CD-omgeving heeft officiële .NET Docker-images beschikbaar (`mcr.microsoft.com/dotnet/sdk:10.0`), Node.js niet standaard
- Een C#-tool die C#-code analyseert is makkelijker te begrijpen en onderhouden

---

### 6. Waarom Regex en niet Roslyn?

Roslyn is de officiële C# compiler-API — die begrijpt code semantisch volledig. Maar ik heb alleen nodig: hoe heet iets, wat is de access modifier, is het een klasse/methode/veld. Dat is zichtbaar in de tekst zelf. Regex is daarvoor veel eenvoudiger en leesbaar genoeg.

---

### 7. Waarom een lokaal LLM (Ollama)?

Als feedback heb ik gekregen dat ik een LLM moest toevoegen zodat ik niet alle "slechte namen" zelf hoefde te hardcoden. In plaats van een lijst `["Foo", "Temp", "Test", "Xxx"]` bij te houden, vraag ik een AI: *"Is deze naam beschrijvend genoeg?"*

Ik gebruik **Ollama** (lokaal draaien van een LLM) in plaats van een cloud-API zoals OpenAI omdat:
- Geen kosten per verzoek
- Code verlaat de pipeline-omgeving niet
- `tinyllama` (~600 MB) is klein genoeg om te cachen in de pipeline

---

## Verwachte vragen van de docent

**Q: Wat is het verschil tussen een error en een warning?**
> Errors blokkeren de merge — ze schaden de leesbaarheid of encapsulatie direct. Warnings zijn suggesties. Door `allow_failure: false` in de pipeline-configuratie, geeft exitcode 1 (bij errors) een mislukte pipeline.

**Q: Hoe weet de parser dat iets een klasse is en niet een methode?**
> Via reguliere expressies. Er zijn aparte patronen voor types (`class`, `struct`, `interface`), methoden (naam gevolgd door `()`), velden (type + naam zonder `()`) en lokale variabelen. De parser kijkt ook naar de huidige scope via een stack van `{` en `}`.

**Q: Wat als iemand een regel wil toevoegen of aanpassen?**
> Een nieuwe regel toevoegen is een nieuwe `Check*` methode in `Rules.cs` schrijven en die aanroepen in `Run()`. De structuur is bewust zo opgezet.

**Q: Waarom niet gewoon SonarQube of StyleCop gebruiken?**
> Die bestaan inderdaad. Maar ze zijn generiek — ze kennen Unity-specifieke patterns niet, zoals het verschil tussen `Awake` en `Start` of het gebruik van `[SerializeField]`. Een eigen tool is volledig aanpasbaar aan ons project.

**Q: Hoe wordt de LLM-check misbruik-proof gehouden?**
> De resultaten worden gecached in `.llm_cache.json`. Dezelfde naam wordt nooit twee keer naar het model gestuurd. Als het model niet beschikbaar is (geen `OLLAMA_MODEL` env var), wordt de check eenvoudig overgeslagen.

**Q: Wat als iemand de checker wil gebruiken buiten de pipeline?**
> Lokaal uitvoeren met: `dotnet run -- pad/naar/scripts`. Met `--no-llm` als Ollama niet lokaal draait. Met `--verbose` voor de suggesties per violation.

**Q: Hoe is dit beter dan een handmatige code review?**
> Een menselijke reviewer is niet altijd beschikbaar, controleert niet altijd dezelfde dingen, en geeft feedback pas aan het einde. De checker controleert altijd, controleert alles, en geeft feedback op het moment van indienen — dit is het "shift-left testing" principe.

---

## Demo-flow (als je iets moet laten zien)

1. Laat een C# bestand zien met een fout (bijv. publiek veld, of `MyClass` met kleine m)
2. Run: `dotnet run -- testfiles/test_sample.cs --no-llm`
3. Laat de rode output zien met file:regel, severity, rule code, en boodschap
4. Laat zien dat exitcode 1 is: `echo $LASTEXITCODE` → `1`
5. Optioneel: laat de pipeline-config in `.gitlab-ci.yml` zien en verklaar de `allow_failure: false` regel

---

## Kernterminologie snel uitgelegd

| Term | Uitleg |
|---|---|
| Statische analyse | Code doorlopen zonder hem uit te voeren |
| Violation | Een gevonden overtreding van een regel |
| Declaration | Een gevonden element in de code (klasse, methode, veld, variabele) |
| Scope | Waar je je bevind in de code (`global`, `namespace`, `type`, `method`) |
| Regex | Patroon om tekst te herkennen in code |
| Roslyn | Officiële C# compiler-API, semantisch rijker maar zwaarder |
| Ollama | Tool om AI-modellen lokaal te draaien |
| tinyllama | Het kleine AI-model dat gebruikt wordt (~600 MB) |
| Shift-left | Testen zo vroeg mogelijk in het proces doen |
| CI/CD pipeline | Automatische stappen die draaien bij elke push/merge |
