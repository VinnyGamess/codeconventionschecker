# Code Convention Checker — Guild Meeting Onderzoek

**Auteur:** Vincent Goelema 
**Project:** AgileAmsterdam (Unity teamproject)  
**Datum:** 7 April 2026

## Aanleiding

In ons Unity-teamproject schreef iedereen code op zijn eigen manier. Iedereen had eerder zelfstandig Unity-projecten gemaakt en bracht zijn eigen schrijfstijl mee. Pas vlak voor een deadline viel op dat klassenamen met kleine letters begonnen, velden ten onrechte public werden gemaakt puur voor de Inspector, en `Awake()` en `Start()` door elkaar werden gebruikt. Die problemen moesten handmatig worden gecorrigeerd, terwijl er al code bovenop gebouwd was.

Dit is geen teamspecifiek probleem. Onderzoek toont aan dat inconsistente naamgevingsconventies direct van invloed zijn op de leesbaarheid en onderhoudbaarheid van code [1][2]. Elke keer dat een teamlid code van iemand anders moet begrijpen of aanpassen, kost een wisselende stijl extra cognitieve moeite. Dit verhoogt de kans op fouten.

## Hoofdvraag

> **Hoe kan een Unity-team codekwaliteitsconventies automatisch controleren, zodat foute code wordt onderschept vóór ze de hoofdbranch bereiken?**

## Deelvragen

Om die vraag te beantwoorden zijn vier deelvragen opgesteld.<br> 1: welke naamgevingsconventies zijn het meest kritisch voor een Unity C# project? <br> 2: hoe kunnen die conventies automatisch worden gecontroleerd? <br>3: op welk moment in het ontwikkelproces moet die controle plaatsvinden?<br> 4: welke technische keuzes zijn het meest geschikt voor de implementatie van de tool?

## Aanpak

Het onderzoek is uitgevoerd via manieren. Er is literatuuronderzoek gedaan naar bestaande tools zoals ESLint, StyleCop en clang-format, de officiële Microsoft C# Coding Conventions, de Unity Manual en vakliteratuur over Clean Code en Refactoring. Zelf zijn eigen bevindingen uit het teamproject als feedback gebruikt om te bepalen welke soorten fouten het vaakst voorkwamen en waar je snel overheen zou kijken.

## Bevindingen

### Deelvraag 1 — Welke conventies zijn het meest kritisch?

Op basis van de Microsoft C# Coding Conventions [4] en Unity-specifieke best practices [6][7] zijn zes regels als meest kritisch aangemerkt:

| Code | Ernst | Conventie |
|------|-------|-----------|
| CQE001 | error | Geen publieke velden, gebruik `[SerializeField] private` |
| CQE002 | error | Elke declaratie moet een access modifier hebben |
| CQE003 | error | Klasse-, struct- en interfacenamen zijn PascalCase |
| CQE004 | error | Methodenamen zijn PascalCase |
| CQE005 | error | Lokale variabelen zijn camelCase |
| CQE006 | error | Private velden beginnen met `_` gevolgd door camelCase |

Aanvullend zijn twee Unity-specifieke waarschuwingen opgesteld. `[SerializeField]` mag alleen op private velden worden geplaatst (CQE009), en `Awake()` en `Start()` mogen niet allebei als initialisatieplek worden gebruikt, omdat de volgorde van uitvoering over objecten heen niet gegarandeerd is (CQE010) [7].

De zes errors zijn als FOUT waardoor de pipeline failed; warnings zijn zichtbaar maar blokkeren de merge niet. Deze indeling is gebaseerd op het onderscheid tussen fouten die leesbaarheid moeilijk maken en suggesties vervolgens geven ter verbetering [3].

### Deelvraag 2 — Hoe kunnen die conventies automatisch worden gecontroleerd?

Analyse bleek de standaardaanpak te zijn in de industrie. Tools als ESLint, StyleCop en clang-format voeren allemaal automatische controles uit op broncode zonder die code uit te voeren [3]. Het gemeenschappelijke principe is dat de controle loskoppelt van de individuele ontwikkelaar en in het grote project gooit in een gedeeld systeem, zodat feedback voor iedereen identiek is.

Voor de implementatie bestond de keuze tussen twee technische benaderingen. Roslyn, de officiële C# compiler-API, begrijpt code semantisch volledig en herkent elk construct foutloos [5]. Het nadeel is de complexiteit: Roslyn vereist het opzetten van een workspace, het laden van projectbestanden en het navigeren door een syntaxboom. Voor het doel van deze tool is dat meer dan nodig. Reguliere expressies zijn veel eenvoudiger te implementeren en te begrijpen. De informatie die de tool nodig heeft, namelijk hoe iets heet, of het public of private is, en of het een klasse of methode is, is direct leesbaar in de tekst van de code [9]. Regex is daarvoor een proportioneel middel en de keuze viel dan ook daarop.

Aanvullend wordt een lokaal taalmodel via Ollama gebruikt voor één specifieke controle die regex niet kan uitvoeren: of de inhoud van een naam logisch en beschrijvend is. Een gehardcode lijst van verboden namen is nooit volledig dit heb ik ook gemerkt in de eerdere versie want ik moest al snel extra namen toevoegen, een taalmodel begrijpt inhoud dus dit vereist geen handmatige input meer[11].

### Deelvraag 3 — Op welk moment moet de controle plaatsvinden?

Het principe van *shift-left testing* zegt dat hoe eerder een fout wordt gevonden, hoe goedkoper het is om hem op te lossen [3]. Wachten tot aan het einde van een sprint voor een code review kost meer tijd dan het direct afvangen bij een merge request, op het moment dat de developer nog volledig in de context zit.

De meest logische plek is een CI/CD pipeline op GitLab [8]. Elke keer dat een merge request wordt geopend, start automatisch een job die de checker uitvoert op de scripts. Als er errors worden gevonden mislukt de pipeline en wordt de merge geblokkeerd. De exitcode van de tool wordt direct door GitLab geïnterpreteerd: exitcode `1` bij errors, exitcode `0` als alles in orde is. Er is geen extra configuratie nodig om de merge te blokkeren.

### Deelvraag 4 — Welke technische keuzes zijn het meest geschikt?

De eerste versie van de tool was een JavaScript-prototype, volledig door AI gegenereerd. Het draaide, maar de code was niet zelf geschreven en daarmee moeilijk te begrijpen, uitleggen of uitbreiden. De tool is daarna volledig herschreven in C#. De reden daarvoor is. C# is de taal die het hele team dagelijks gebruikt, waardoor de drempel om de tool te begrijpen of aan te passen laag is. Daarnaast zijn officiële .NET SDK Docker-images direct beschikbaar voor gebruik in CI/CD (`mcr.microsoft.com/dotnet/sdk:10.0`), wat voor Node.js niet standaard het geval is. Tot slot deelt een C# tool die C# analyseert conceptuele kennis met de doelcode: access modifiers, attributen en lifecycle methods zijn begrippen die een C# developer direct herkent.

Voor de AI-component is gekozen voor Ollama als lokale inference engine in plaats van een cloud-API. Cloud-APIs brengen kosten per verzoek met zich mee en sturen broncode naar een externe server [11]. Voor een pipeline die bij elke merge request draait lopen die kosten snel op. Ollama draait lokaal in de pipeline-container, zonder externe afhankelijkheid en zonder kosten. Resultaten worden bovendien gecached zodat bekende namen bij volgende pipeline-runs niet opnieuw worden beoordeeld.

## Conclusie

De centrale vraag was hoe een team codekwaliteitsconventies automatisch kan controleren zodat code fouten worden onderschept vóór ze de main/dev branch bereiken. Het antwoord blijkt uit drie samenhangende onderdelen te bestaan: een afgesproken set conventies op basis van de Microsoft C# Coding Conventions en Unity best practices, een automatische checker gebouwd in C# op basis van regex en aangevuld met een lokale LLM voor semantische naamkwaliteit, en een CI/CD integratie die de checker bij elke merge request uitvoert en de merge automatisch blokkeert bij errors.

De tool is volledig losgekoppeld van de repo en is herbruikbaar in andere projecten via een eenvoudige `.gitlab-ci.yml` configuratie. De waarde zit in vroege detectie en consistente feedback voor elk teamlid, ongeacht wie de code review zou doen.

Een beperking is dat de tool uitsluitend rapporteert en niets zelf aanpast. Een auto-fix mogelijkheid is technisch complex vanwege de vereiste van volledige symboolresolutie en het risico op het verlies van Unity Referenties bij het hernoemen van velden maar dit is nog iets waar ik verder onderzoek naar wil doen.[5][6].

## Aanbevelingen

Op korte termijn is het aan te raden de tool te adopteren in andere gamedev-projecten via de bestaande configuratie. Op middellange termijn wil ik een `--fix` vlag toevoegen, die enkelvoudige en veilige casing-correcties doorvoert op velden en variabelen die op precies één plek worden gedeclareerd. 

## Bronnen

[1] R. C. Martin, *Clean Code: A Handbook of Agile Software Craftsmanship*. Prentice Hall, 2008.

[2] M. Fowler, *Refactoring: Improving the Design of Existing Code*, 2nd ed. Addison-Wesley, 2018.

[3] T. Hunt and A. Thomas, *The Pragmatic Programmer*, 20th Anniversary Ed. Addison-Wesley, 2019.

[4] Microsoft, "C# Coding Conventions," *Microsoft Learn*, 2024. [Online]. Available: https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions

[5] Microsoft, "Use the .NET Compiler Platform SDK," *Microsoft Learn*, 2024. [Online]. Available: https://learn.microsoft.com/en-us/dotnet/csharp/roslyn-sdk/

[6] Unity Technologies, "Script Serialization," *Unity Manual*, 2024. [Online]. Available: https://docs.unity3d.com/Manual/script-Serialization.html

[7] Unity Technologies, "Order of execution for event functions," *Unity Manual*, 2024. [Online]. Available: https://docs.unity3d.com/Manual/ExecutionOrder.html

[8] GitLab, "CI/CD pipelines," *GitLab Documentation*, 2024. [Online]. Available: https://docs.gitlab.com/ee/ci/pipelines/

[9] J. E. F. Friedl, *Mastering Regular Expressions*, 3rd ed. O'Reilly Media, 2006.

[11] Ollama, "Ollama: Get up and running with large language models locally," 2024. [Online]. Available: https://docs.ollama.com/
