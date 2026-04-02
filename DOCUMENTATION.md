# Code Convention Checker – Documentatie

## 1. ANALYSE

In het begin van het project merkten we al vrij snel dat de codekwaliteit niet op een vaste en duidelijke manier werd bewaakt. We deden nog geen echte code reviews in dit project, maar we zagen wel problemen ontstaan die we herkenden uit eerdere Unity-projecten op school. Iedereen in de groep had al ervaring met samenwerken aan code, en juist daardoor werd duidelijk waar het vaak misgaat.

Wat vooral opviel, is dat iedereen net een andere manier van schrijven heeft. De ene gebruikt bijvoorbeeld PascalCase voor classes, terwijl de ander dat ook voor variabelen gebruikt. Sommige mensen schrijven korte namen, anderen juist hele beschrijvende. Ook in de structuur van scripts zat verschil. Dit lijkt klein, maar als je samenwerkt in één project wordt het al snel rommelig en minder overzichtelijk.

Omdat we nog geen vaste code review structuur hadden, werd dit soort verschil ook niet actief gecorrigeerd. Daardoor bleef iedereen een beetje in zijn eigen stijl werken. Op korte termijn lijkt dat geen groot probleem, maar naarmate het project groeit wordt de code lastiger te lezen en moeilijker om over te nemen van elkaar.

We hebben daarom eerst binnen de groep besproken waar we tegenaan liepen. Daaruit bleek dat iedereen dit probleem herkende uit eerdere projecten. Vaak werd daar pas laat iets van gezegd, bijvoorbeeld vlak voor een deadline. Dan moesten er ineens veel kleine dingen aangepast worden, wat onnodig tijd kostte.

Als klein onderzoek hebben we gekeken naar hoe dit normaal wordt aangepakt in professionele projecten. Daar zie je dat teams bijna altijd gebruikmaken van automatische tools om code conventies te controleren.

Voorbeelden hiervan zijn:

- JavaScript - ESLint  
- C# - StyleCop / Visual Studio analyzers / Roslyn 
- C / C++ → clang-format / cppcheck  

Deze tools zorgen ervoor dat code automatisch wordt gecontroleerd op afspraken zoals naamgeving, structuur en formatting.

![Voorbeeld lint tools](images/eslint.png)

Wat hier belangrijk aan is, is dat deze tools niet alleen fouten aangeven, maar ook zorgen voor consistentie tussen developers. Iedereen krijgt dezelfde feedback, ongeacht wie de code schrijft.

Uit onze eigen ervaringen en dit kleine onderzoek konden we een duidelijke conclusie trekken. Het probleem zat niet in de kennis of inzet van de teamleden, maar in het ontbreken van een gezamenlijke standaard en een manier om die automatisch te controleren. Zonder die controle blijft iedereen zijn eigen stijl gebruiken, wat uiteindelijk zorgt voor inconsistente en minder onderhoudbare code.

---

## 2. ADVIES 

Op basis van deze analyse hebben we eerst gekeken naar wat we als groep belangrijk vinden in code. Omdat iedereen al ervaring had met Unity en C#, konden we vrij snel een lijst maken van conventies die we logisch vonden, zoals naamgeving, structuur en leesbaarheid.

Ik heb daarin het voortouw genomen door een aantal standaard C# conventies voor te stellen en die met de groep te bespreken. Daarbij heb ik ook bewust gevraagd naar ieders voorkeur en ervaring, zodat het niet alleen mijn idee werd maar echt een gezamenlijke afspraak.

### Afgesproken Conventions

Hier komen de afspraken die we hebben gemaakt. Denk aan:

- PascalCase voor classes  
- camelCase voor variabelen  
- duidelijke methodenamen  
- consistente structuur in scripts  

![Code conventions voorbeeld](images/convention1.png)
![Code conventions voorbeeld](images/convention2.png)
![Code conventions voorbeeld](images/convention3.png)
![Code conventions voorbeeld](images/convention4.png)

Uit dat gesprek kwam duidelijk naar voren dat het probleem niet opgelost zou worden door simpelweg later in het proces code te controleren. Als je pas aan het einde ziet dat alles anders is geschreven, ben je eigenlijk al te laat. Dan kost het alleen maar extra tijd om alles nog aan te passen.

Daarom hebben we als advies gekozen om de controle naar voren te halen in het proces. In plaats van achteraf corrigeren, wilden we vooraf automatisch controleren met een tool.

Daarnaast hebben we ervoor gekozen om deze controle centraal via GitHub te laten lopen.

Wanneer iemand code pusht naar een merge request, start automatisch een GitHub Action. Deze action roept onze checker aan vanuit een los Git-project. Hierdoor is de tool herbruikbaar en niet gekoppeld aan één specifieke codebase.

![GitHub Actions flow](images/pipeline1.png)
![GitHub Actions flow](images/pipeline2.png)
![GitHub Actions flow](images/pipeline3.png)

Dit sluit aan op hoe het in de praktijk gebeurt, waar CI/CD pipelines automatisch checks uitvoeren.

Het advies is dus: maak afspraken, automatiseer de controle en koppel dit aan het merge proces.

Dit heeft meerdere voordelen. Iedereen krijgt dezelfde feedback. Fouten worden eerder ontdekt. En code reviews kunnen zich focussen op inhoud in plaats van stijl.

---

## 3. ONTWERPEN

De tool is gebouwd in JavaScript en analyseert C# bestanden uit een Unity project.

De flow van de tool:

1. Bestanden ophalen  
2. Code analyseren  
3. Regels uitvoeren  
4. Feedback geven  

De tool draait automatisch via een GitHub Action bij elke merge request.

### yml

```yaml
cqe-lint:
  image: node:20
  tags:
    - hva
  script:
    - git clone https://github.com/VinnyGamess/codeconventionschecker /tmp/linter
    - if [ -d "AgileAmsterdam/Assets/Scripts" ]; then node /tmp/linter/cli.js AgileAmsterdam/Assets/Scripts --verbose; else echo "Scripts folder not found, skipping lint."; fi
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

```

Daardoor ontstaat er een vaste flow. Code wordt gepusht, de action draait automatisch, en de checker geeft feedback terug.

Een belangrijk onderdeel van het ontwerp is dat de regels los van elkaar staan. Elke regel controleert één specifiek onderdeel van de code. Hierdoor is de tool flexibel en makkelijk uitbreidbaar.

Ook is de tool bewust in een apart project geplaatst. Hierdoor kan dezelfde checker gebruikt worden in meerdere projecten zonder afhankelijk te zijn van één codebase.

---

## 4. UITBREIDING / DOORONTWIKKELING

Op dit moment werkt de tool als een checker. Dat betekent dat de tool alleen aangeeft wat er niet klopt in de code.

Een volgende stap is om de tool uit te breiden zodat deze ook automatisch code kan aanpassen. In plaats van alleen feedback te geven, zou de tool bijvoorbeeld namen kunnen aanpassen naar de juiste casing of formatting kunnen corrigeren.

Dit principe zie je ook terug in bestaande tools zoals formatters. Die passen automatisch code aan naar een vaste stijl zonder dat de developer dit handmatig hoeft te doen.

Het voordeel hiervan is dat developers minder tijd kwijt zijn aan kleine aanpassingen en dat de codebase nog consistenter wordt.

Voor deze uitbreiding moet de tool niet alleen analyseren, maar ook de code kunnen herschrijven en opslaan. Dit betekent dat er extra logica nodig is die veilige aanpassingen kan doen zonder functionaliteit te breken.

Een mogelijke implementatie hiervan is dat de tool een extra stap krijgt na de analyse, waarbij correcties automatisch worden toegepast voordat de resultaten worden teruggegeven.

Dit is een logische volgende stap in de doorontwikkeling van de tool.

## 5. FEEDBACK

Ik had het al met mede studenten over om inderdaad te vragen of suggereren voor het daadwerkelijk aan te passen ipv suggesties geven. Hieruit hoorde ik al gauw dingen waar ik zou tegenaan lopen, als je 1 variabele zou aanpassen moet dit natuurlijk voor alles gedaan worden. Mocht je dit aanpassen moet je opnieuw refferences slepen in de inspector.