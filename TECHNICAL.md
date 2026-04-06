# Code Convention Checker – Technische Referentie

Dit document beschrijft elke klasse, elk veld en elke functie in de codebase. Het doel is dat je op elk moment precies kunt opzoeken wat een stuk code doet, waarom het zo is geschreven en wat er in en uitgaat.

---

## Program.cs

`Program.cs` is het entry point van de applicatie. Het bevat geen klassen of methoden; de code draait direct als top-level statements, een functionaliteit van C# 10 waarbij de `Main`-methode impliciet aanwezig is. De code leest argumenten, verzamelt bestanden, en stuurt elk bestand door de analysepijplijn.

### Variabelen

**`path`** `string` — Het pad naar het bestand of de map die geanalyseerd moet worden. Wordt gevuld door het eerste commandoregelargument dat niet begint met `--`. Blijft `null` als er geen pad is opgegeven.

**`verbose`** `bool` — Wanneer `true` wordt de suggestie per violation getoond naast het bericht. Wordt `true` als `--verbose` als argument is meegegeven. Standaard `false`.

**`useLlm`** `bool` — Wanneer `false` wordt de AI-naamgevingscheck overgeslagen. Wordt `false` als `--no-llm` is meegegeven. Standaard `true`.

**`files`** `string[]` — De lijst van `.cs` bestanden die geanalyseerd worden. Als `path` een bestaand bestand is, bevat deze array alleen dat bestand. Als het een map is, worden alle `.cs` bestanden daarin recursief opgehaald en alfabetisch gesorteerd.

**`errorCount`** `int` — Teller voor het aantal violations met severity `"error"`. Na het verwerken van alle bestanden bepaalt deze waarde de exitcode: bij `> 0` geeft het programma exitcode `1` terug, anders `0`.

### Stroom van uitvoering

Het programma parseert eerst de argumenten. Als `path` daarna nog `null` is, wordt de gebruiksinstructie geprint en stopt het programma met exitcode `0`. Als er geen `.cs` bestanden zijn gevonden op het opgegeven pad, stopt het programma ook met `0`.

Voor elk gevonden bestand wordt de volledige analysepijplijn uitgevoerd: de broncode wordt ingelezen, commentaar wordt verwijderd via `Parser.StripComments`, de declaraties worden geëxtraheerd via `Parser.Extract`, de regels worden uitgevoerd via `Rules.Run`, en elke violation wordt geprint via `Reporter.Print`. Violations met severity `"error"` verhogen de `errorCount`.

---

## Parser.cs

`Parser.cs` bevat twee klassen: `Declaration`, die één gevonden declaratie in de broncode representeert, en `Parser`, die de statische analysemethoden bevat.

### Klasse: `Declaration`

Een datacontainer die één geparseerde declaratie uit de broncode vastlegt.

**`Kind`** `string` — Het soort declaratie. Mogelijke waarden zijn `"class"`, `"struct"`, `"interface"`, `"enum"`, `"record"`, `"method"`, `"field"` en `"variable"`.

**`Name`** `string` — De identifier zoals die in de broncode staat, bijvoorbeeld `PlayerController` of `_jumpHeight`.

**`Modifiers`** `List<string>` — De access modifiers en andere kwalificerende sleutelwoorden die voor de declaratie staan, zoals `public`, `private`, `static`, `readonly` of `const`. Leeg voor lokale variabelen.

**`Attributes`** `List<string>` — De namen van C# attributen die op de direct voorafgaande regel stonden, zoals `SerializeField` of `Header`. Leeg als er geen attributen waren.

**`Line`** `int` — Het regelnummer in het originele bronbestand, 1-gebaseerd.

**`Parent`** `string` — De naam van de klasse waarbinnen deze declaratie is gevonden. Is `null` voor type-declaraties op het hoogste niveau. Wordt gebruikt om te weten of een methode bij `PlayerController` of bij `Enemy` hoort.

**`Declaration(string kind, string name, List<string> modifiers, List<string> attributes, int line, string parent = null)`** — Constructor die alle velden initialiseert. `parent` is optioneel en standaard `null`.

---

### Klasse: `Parser` (statisch)

Bevat alle logica voor het lezen en analyseren van C# broncode.

#### Constante data

**`ControlFlow`** `string[]` — Een array van sleutelwoorden die het begin vormen van control flow statements: `if`, `else`, `for`, `foreach`, `while`, `do`, `switch`, `case`, `return`, `break`, `continue`, `try`, `catch`, `finally`, `throw`, `lock`, `using`, `yield`, `await`. Wordt gebruikt om regels die beginnen met deze woorden te herkennen als statements in plaats van declaraties.

**`ReservedWords`** `string[]` — Een uitgebreide array die alle woorden bevat die nooit als een identifier-naam kunnen verschijnen. Omvat alle woorden van `ControlFlow` plus access modifiers, OOP-sleutelwoorden en type-declaratiesleutelwoorden. Wordt gebruikt om valse positieven te filteren nadat een regex een match heeft gevonden.

**`CommentRe`** `Regex` — Een reguliere expressie die verbatim strings (`@"..."`), gewone strings (`"..."`), karakterliterals (`'...'`), regelcommentaar (`// ...`) en blokcommentaar (`/* ... */`) matcht. Gebruikt de `Singleline`-vlag zodat `.` ook newlines matcht voor blokcommentaar. Wordt toegepast in `StripComments`.

**`TypeRe`** `Regex` — Een reguliere expressie die type-declaraties herkent. Groep 1 vangt de modifiers op, groep 2 het sleutelwoord (`class`, `struct`, `interface`, `enum` of `record`), groep 3 de naam. Voorbeeld: `public abstract class PlayerController` → modifiers=`"public abstract "`, kind=`"class"`, name=`"PlayerController"`.

**`MethodRe`** `Regex` — Een reguliere expressie die methode-declaraties herkent. Groep 1 vangt de modifiers, groep 2 de naam direct voor de openingshaakjes. Herkent ook methoden met generieke return types en arrays. Voorbeeld: `private async Task<bool> LoadDataAsync(` → modifiers=`"private async "`, name=`"LoadDataAsync"`.

**`FieldRe`** `Regex` — Een reguliere expressie die veld-declaraties herkent. Groep 1 vangt de modifiers, groep 2 de naam direct voor `;` of `=`. Kan omgaan met generieke types en array-types als het type van het veld. Voorbeeld: `private List<int> _scores = ` → modifiers=`"private "`, name=`"_scores"`.

**`VarRe`** `Regex` — Een reguliere expressie die lokale variabele-declaraties herkent. Groep 1 vangt de naam. Matcht zowel expliciet getypeerde declaraties als `var`. Voorbeeld: `int score = 0;` → name=`"score"`.

---

#### Methoden

**`Contains(string[] arr, string val) → bool`**

Doorloopt de array `arr` lineair en geeft `true` terug als `val` er in voor komt. Functioneel equivalent aan `arr.Contains(val)` maar zonder LINQ-allocatie. Wordt intern veelvuldig gebruikt om te checken of een woord in `ControlFlow` of `ReservedWords` zit.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `arr` | `string[]` | De array om in te zoeken |
| `val` | `string` | De waarde om te zoeken |

Geeft `true` terug als `val` in `arr` zit, anders `false`.

---

**`CountChar(string text, char ch) → int`**

Telt hoe vaak het karakter `ch` voorkomt in de string `text`. Wordt gebruikt om het aantal `{` en `}` op een regel te tellen voor het bijhouden van de scope-stack.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `text` | `string` | De tekst om in te tellen |
| `ch` | `char` | Het te tellen karakter |

Geeft het aantal voorkomens terug als `int`.

---

**`ReplaceComment(Match m) → string`**

Wordt aangeroepen door `CommentRe.Replace` voor elke match. Als de match begint met `/` is het commentaar en wordt het vervangen door een equivalente reeks newlines zodat regelnummers intact blijven. Als de match niet begint met `/` is het een string- of karakterliteral en wordt de originele tekst ongewijzigd teruggegeven.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `m` | `Match` | De regex-match van `CommentRe` |

Geeft commentaar terug als `"\n"` × aantal newlines in de match, of de originele matchwaarde voor strings.

---

**`StripComments(string source) → string`** *(publiek)*

Verwijdert alle commentaar uit de broncode terwijl de regelnummers intact blijven. Roept `CommentRe.Replace` aan met `ReplaceComment` als callback. Het resultaat is broncode waarbij alle `//`- en `/* */`-commentaar is vervangen door whitespace met hetzelfde aantal newlines.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `source` | `string` | De ruwe broncode van een `.cs` bestand |

Geeft de gestripte broncode terug als `string`.

---

**`FirstWord(string line) → string`**

Extraheert het eerste woord (reeks `\w`-karakters) van de string `line`. Wordt gebruikt om snel te controleren of een regel begint met een control flow sleutelwoord, zonder de regel volledig te hoeven parsen.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `line` | `string` | Een getrimde regel broncode |

Geeft het eerste woord terug, of een lege string als er geen woord gevonden is.

---

**`SplitMods(string s) → List<string>`**

Splitst een string van aaneengesloten modifiers op spaties en filtert lege onderdelen. Input is de eerste regex-groep van `TypeRe`, `MethodRe` of `FieldRe`, die een string oplevert als `"public static "`. Output is een lijst als `["public", "static"]`.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `s` | `string` | Een string van spatie-gescheiden modifiers |

Geeft een `List<string>` terug met de individuele modifiers.

---

**`MatchType(string line, List<string> attrs, int ln) → Declaration?`**

Probeert op de gegeven regel een type-declaratie te herkennen via `TypeRe`. Geeft `null` terug als de regex niet matcht. Anders wordt een `Declaration` aangemaakt waarbij `Kind` de waarde van groep 2 is (`"class"`, `"struct"` enzovoort), `Name` de waarde van groep 3, en `Modifiers` het gesplitste resultaat van groep 1.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `line` | `string` | De getrimde broncoderegel |
| `attrs` | `List<string>` | De attributen die verzameld zijn voor deze regel |
| `ln` | `int` | Het regelnummer |

Geeft een `Declaration` terug of `null`.

---

**`MatchMethod(string line, List<string> attrs, int ln) → Declaration?`**

Probeert op de gegeven regel een methode-declaratie te herkennen. Geeft direct `null` terug als de eerste woordes in de `ControlFlow`-array zit. Daarna wordt `MethodRe` toegepast. Als de gevonden naam in `ReservedWords` zit, wordt `null` teruggegeven om valse positieven te voorkomen. Anders wordt een `Declaration` met `Kind = "method"` teruggegeven.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `line` | `string` | De getrimde broncoderegel |
| `attrs` | `List<string>` | De attributen die verzameld zijn voor deze regel |
| `ln` | `int` | Het regelnummer |

Geeft een `Declaration` terug of `null`.

---

**`MatchField(string line, List<string> attrs, int ln) → Declaration?`**

Probeert op de gegeven regel een veld-declaratie te herkennen. Dezelfde filtering op `ControlFlow` en `ReservedWords` als `MatchMethod`. Gebruikt `FieldRe` die velden herkent op het patroon van modifiers gevolgd door een type gevolgd door een naam en daarna `;` of `=`.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `line` | `string` | De getrimde broncoderegel |
| `attrs` | `List<string>` | De attributen die verzameld zijn voor deze regel |
| `ln` | `int` | Het regelnummer |

Geeft een `Declaration` terug of `null`.

---

**`MatchVariable(string line, int ln) → Declaration?`**

Probeert op de gegeven regel een lokale variabele te herkennen via `VarRe`. Filtering op `ControlFlow` en `ReservedWords` is ook hier aanwezig. Lokale variabelen krijgen lege `Modifiers` en `Attributes` lijsten.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `line` | `string` | De getrimde broncoderegel |
| `ln` | `int` | Het regelnummer |

Geeft een `Declaration` terug of `null`.

---

**`Extract(string[] lines) → List<Declaration>`** *(publiek)*

Het hoofdalgoritme van de parser. Doorloopt alle regels van de broncode en bouwt een lijst van `Declaration` objecten op. Houdt de huidige scope bij via twee stacks.

`scopeStack` bevat de scopes als strings. Elke `{` voegt een scope toe, elke `}` haalt de bovenste scope weg. De scope-naam bepaalt wat er op de volgende regels verwacht wordt. Mogelijke waarden zijn `"namespace"`, `"type"`, `"method"` en `"block"`.

`classStack` bevat de namen van de klassen waarvan de body actief is. Dit laat toe om aan elke gevonden methode of veld de naam van de omsluitende klasse mee te geven als `Parent`.

`pendingAttrs` verzamelt attribuutnamen die op regels staan die beginnen met `[`. Zodra de volgende niet-attribuut-regel is verwerkt, worden de verzamelde attributen aan de gevonden declaratie gehangen en wordt de lijst geleegd.

Per regel wordt het volgende gedaan: lege regels worden overgeslagen. Regels die beginnen met `[` worden als attribuut geparseerd en de naam ervan wordt in `pendingAttrs` gezet. Daarna wordt op basis van de huidige scope via een switch bepaald welke matcher wordt aangeroepen. In scope `"global"` of `"namespace"` wordt `MatchType` gebruikt. In scope `"type"` wordt eerst `MatchMethod` geprobeerd en bij `null` daarna `MatchField`. In scope `"method"` of `"block"` wordt `MatchVariable` gebruikt.

Constructors worden gefilterd door te controleren of de gevonden methodenaam gelijk is aan de naam van de omsluitende klasse. Als dat het geval is, wordt de declaratie weggegooid.

Na het verwerken van de declaratie worden de `{` en `}` op de regel geteld om de stacks bij te werken.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `lines` | `string[]` | De broncode gesplitst op newlines, na `StripComments` |

Geeft een `List<Declaration>` terug met alle gevonden declaraties in volgorde van voorkomen.

---

## Rules.cs

`Rules.cs` bevat twee klassen: `Violation`, die één gevonden regelovertreding representeert, en `Rules`, die alle controle-methoden bevat.

### Klasse: `Violation`

Een datacontainer die één geconstateerde overtreding vastlegt.

**`Rule`** `string` — De identificatiecode van de regel die is overtreden, zoals `"CQE001"`.

**`Severity`** `string` — De ernst. Mogelijke waarden zijn `"error"` (blokkeert de pipeline) en `"warning"` (informatief).

**`Message`** `string` — Een leesbaar bericht dat beschrijft wat er mis is, voor weergave in de terminal.

**`Suggestion`** `string` — Een concreet voorstel voor hoe het probleem opgelost kan worden. Wordt alleen getoond bij `--verbose`.

**`Line`** `int` — Het regelnummer in het bronbestand waarop de overtreding werd gevonden.

**`Violation(string rule, string severity, string message, string suggestion, int line)`** — Constructor die alle velden initialiseert.

---

### Klasse: `Rules` (statisch)

Bevat alle controleregels als individuele methoden, plus helpers voor naamconventies.

#### Constante data

**`AccessMods`** `string[]` — De vier access modifier sleutelwoorden: `"public"`, `"private"`, `"protected"`, `"internal"`. Wordt gebruikt om te controleren of een declaratie een expliciete access modifier heeft.

**`UnityLifecycle`** `string[]` — De namen van Unity lifecycle callback methoden: `Update`, `FixedUpdate`, `LateUpdate`, `OnEnable`, `OnDisable`, `OnDestroy`, en de collision- en trigger-callbacks. Wordt gebruikt in `CheckAwakeVsStart` om te bepalen of een klasse Unity-specifieke methoden heeft.

**`NumberRe`** `Regex` — Een reguliere expressie die numerieke literals matcht in broncode, inclusief optionele decimalen en type-suffixen (`f`, `d`, `m`, `u`, `l`). Gebruikt in `CheckMagicNumbers`.

**`EnumRe`** `Regex` — Een reguliere expressie die herkent of een regel een enum-waarde-definitie is (een identifier optioneel gevolgd door `= waarde` en optioneel een komma). Regels die hierop matchen worden overgeslagen in `CheckMagicNumbers` omdat numerieke waarden in enum-definities niet als magic numbers gelden.

**`SafeNums`** `double[]` — De getallen `0`, `1` en `2`. Numerieke literals met deze waarden worden niet als magic numbers beschouwd.

**`DeclWords`** `string[]` — Sleutelwoorden die alleen op declaratieregels staan: `public`, `private`, `protected`, `internal`, `readonly`, `static`, `const`. Als een regel een van deze woorden bevat, is het waarschijnlijk een declaratieregel en worden gevonden getallen niet als magic numbers gemeld.

---

#### Helper-methoden

**`V(string rule, string sev, string msg, string hint, int line) → Violation`**

Verkort het aanmaken van een `Violation` tot één compacte aanroep. Geeft direct een nieuw `Violation`-object terug.

---

**`IsPascal(string n) → bool`**

Geeft `true` als `n` voldoet aan PascalCase: niet leeg, begint met een hoofdletter, en bevat geen underscore.

---

**`IsCamel(string n) → bool`**

Geeft `true` als `n` voldoet aan camelCase: niet leeg, begint met een kleine letter, en bevat geen underscore.

---

**`IsValidField(string n) → bool`**

Geeft `true` als `n` voldoet aan het `_camelCase` patroon voor private velden: begint met `_`, heeft minstens twee karakters, het tweede karakter is een kleine letter, en het deel na de eerste underscore bevat geen verdere underscores.

---

**`ToPascal(string n) → string`**

Maakt het eerste karakter van `n` een hoofdletter. Geeft een lege string terug als `n` leeg is. Wordt gebruikt voor suggesties in violation-berichten.

---

**`ToCamel(string n) → string`**

Verwijdert leading underscores van `n` en maakt daarna het eerste karakter een kleine letter. Wordt gebruikt voor suggesties bij veld- en variabelenaamviolations.

---

**`HasAccessMod(List<string> mods) → bool`**

Geeft `true` als de lijst `mods` minstens één van de vier waarden in `AccessMods` bevat. Wordt gebruikt om te bepalen of een declaratie een expliciete access modifier heeft.

---

#### Hoofdmethode

**`Run(List<Declaration> decls, string source, bool useLlm) → List<Violation>`** *(publiek)*

Voert alle checks uit op de gegeven declaraties en de broncode. Roept elke afzonderlijke check-methode aan, verzamelt alle teruggegeven violations, en sorteert die op regelnummer. Als `useLlm` `false` is, wordt `CheckNamesWithLlm` overgeslagen.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `decls` | `List<Declaration>` | De lijst van declaraties van `Parser.Extract` |
| `source` | `string` | De gestripte broncode voor de magic numbers check |
| `useLlm` | `bool` | Of de AI-naamgevingscheck uitgevoerd moet worden |

Geeft een `List<Violation>` terug, gesorteerd op `Line`.

---

#### Check-methoden

**`CheckNoPublicFields(List<Declaration> decls) → List<Violation>`** — CQE001

Doorloopt alle declaraties en meldt elk veld dat `public` is als violation, tenzij het `const` is of de combinatie `static readonly` heeft. Constanten en static readonly velden zijn altijd publiek bedoeld en vallen buiten deze regel.

---

**`CheckAccessModifiers(List<Declaration> decls) → List<Violation>`** — CQE002

Meldt elke declaratie die geen access modifier heeft, met uitzondering van lokale variabelen. Gebruikt `HasAccessMod` om te controleren of een van de vier modifiers aanwezig is in de `Modifiers` lijst.

---

**`CheckTypeNames(List<Declaration> decls) → List<Violation>`** — CQE003

Meldt elk type (class, struct, interface, enum, record) waarvan de naam niet voldoet aan `IsPascal`. Gebruikt C# pattern matching om het `Kind` veld te filteren.

---

**`CheckMethodNames(List<Declaration> decls) → List<Violation>`** — CQE004

Meldt elke methode waarvan de naam niet voldoet aan `IsPascal`.

---

**`CheckVariableNames(List<Declaration> decls) → List<Violation>`** — CQE005

Meldt elke lokale variabele waarvan de naam niet voldoet aan `IsCamel`.

---

**`CheckPrivateFieldNames(List<Declaration> decls) → List<Violation>`** — CQE006

Meldt elk private instantieveld waarvan de naam niet voldoet aan `IsValidField`. `const`- en `static`-velden worden overgeslagen. Een veld wordt als private beschouwd als het expliciet `private` heeft, of als het helemaal geen access modifier heeft (impliciet private).

---

**`CheckMagicNumbers(string source) → List<Violation>`** — CQE008

Doorloopt de broncode regel voor regel. Slaat regels over die een declaratiewoord bevatten (want dat zijn declaraties, geen statements) en regels die op `EnumRe` matchen. Op de overige regels worden alle numerieke literals gezocht via `NumberRe`. Literals waarvan de numerieke waarde in `SafeNums` zit worden niet gemeld. Alle andere worden gemeld als magic number.

---

**`CheckSerializeField(List<Declaration> decls) → List<Violation>`** — CQE009

Meldt elk publiek, niet-const, niet-static veld dat niet het `SerializeField` attribuut heeft. Dit zijn velden die waarschijnlijk public zijn gemaakt puur om ze in de Unity Inspector zichtbaar te maken, terwijl `[SerializeField] private` de correcte aanpak is.

---

**`CheckAwakeVsStart(List<Declaration> decls) → List<Violation>`** — CQE010

Groepeert alle methoden per klasse via een dictionary. Voor elke klasse worden drie booleans bepaald: heeft de klasse `Awake()`, heeft ze `Start()`, en heeft ze andere lifecycle methods. Een tuple switch bepaalt daarna welk geval van toepassing is. Als zowel `Awake` als `Start` aanwezig zijn, wordt een violation gemeld op de regel van `Awake`. Als er lifecycle callbacks aanwezig zijn maar geen `Awake` of `Start`, wordt een violation gemeld op de eerste lifecycle methode.

---

**`CheckNamesWithLlm(List<Declaration> decls) → List<Violation>`** — CQE011

Verzamelt alle niet-variabele declaraties als `NameKind` objecten en stuurt die naar `Llm.FindBadNames`. Bouwt een dictionary van naam naar regelnummer zodat elke teruggegeven `NameResult` aan een regelnummer gekoppeld kan worden. Meldt elke teruggegeven naam als CQE011 warning met de reden die het model heeft opgegeven.

---

## Llm.cs

`Llm.cs` bevat drie klassen: `NameKind` en `NameResult` als datacontainers, en `Llm` met de logica voor de AI-communicatie.

### Klasse: `NameKind`

Representeert één naam die ter beoordeling naar het model wordt gestuurd.

**`Name`** `string` — De identifier zoals die in de code staat.

**`Kind`** `string` — Het soort declaratie, identiek aan `Declaration.Kind`.

**`NameKind(string name, string kind)`** — Constructor.

---

### Klasse: `NameResult`

Representeert één naam die door het model als problematisch is beoordeeld.

**`Name`** `string` — De identifier die is afgekeurd.

**`Reason`** `string` — De reden waarom het model de naam problematisch vindt, in het Engels.

**`NameResult(string name, string reason)`** — Constructor.

---

### Klasse: `Llm` (statisch)

**`CacheFile`** `const string` — Het bestandspad van het cache-bestand: `".llm_cache.json"`. Dit bestand staat in de werkdirectory.

**`Http`** `HttpClient` — Een statische `HttpClient` instantie met een timeout van 60 seconden voor alle verzoeken naar de Ollama API. Statisch zodat de verbinding hergebruikt wordt en er geen socket-uitputting optreedt bij meerdere verzoeken.

---

**`LoadCache() → Dictionary<string, string>`**

Laadt het cache-bestand van schijf en deserialiseert het als een `Dictionary<string, string>`. Als het bestand niet bestaat, wordt een lege dictionary teruggegeven. Als het bestand corrupte JSON bevat, wordt de exception gevangen en een lege dictionary teruggegeven zodat de tool niet vastloopt.

Geeft een `Dictionary<string, string>` terug met alle gecachte naam-resultaten.

---

**`SaveCache(Dictionary<string, string> cache)`**

Serialiseert de dictionary als ingesprongen JSON en schrijft die naar `CacheFile`. Gebruikt `WriteIndented = true` zodat het bestand leesbaar is als je het handmatig wilt inspecteren of aanpassen.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `cache` | `Dictionary<string, string>` | De volledige gecachte resultaten om op te slaan |

---

**`FindBadNames(List<NameKind> names) → List<NameResult>`** *(publiek)*

Het hoofdalgoritme van de LLM-integratie. Werkt in vier fasen.

Fase 1: de omgevingsvariabele `OLLAMA_MODEL` wordt gelezen. Als die leeg of afwezig is, geeft de methode direct een lege lijst terug. Dit is het mechanisme waarmee de tool graceful werkt zonder Ollama.

Fase 2: de cache wordt geladen. Alle namen waarvan de cache-sleutel (`"naam:soort"`) al bestaat worden gefilterd. Alleen de namen die nog niet in de cache zitten worden naar het model gestuurd.

Fase 3: als er ongecachte namen zijn, wordt een prompt opgebouwd en als JSON naar `http://localhost:11434/api/generate` gestuurd. De namen worden als een JSON-array van twee-element-arrays meegegeven. De `format: "json"` parameter forceert dat de respons parseerbare JSON is. Het antwoord wordt geparsed als een object met het veld `bad_names`, een array van objecten met `name` en `reason`. Alle gevonden namen worden in een tijdelijke dictionary gezet. Daarna worden alle ongecachte namen in de cache opgeslagen: namen die het model heeft gemarkeerd krijgen de reden als waarde, namen die het model niet heeft gemarkeerd krijgen een lege string. Als de HTTP-aanroep of het parsen mislukt, wordt de exception gevangen en verdergegaan met een lege flagged-set, waarna de namen met een lege string gecached worden.

Fase 4: de uiteindelijke resultatenlijst wordt opgebouwd door de volledige inputlijst langs de cache te lopen. Namen waarvan de cache-waarde niet leeg is worden teruggegeven als `NameResult`. Namen met een lege cache-waarde (goedgekeurd of gefaald) worden genegeerd.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `names` | `List<NameKind>` | De namen die beoordeeld moeten worden |

Geeft een `List<NameResult>` terug met alleen de namen die als problematisch zijn beoordeeld.

---

## Reporter.cs

### Klasse: `Reporter` (statisch)

Verantwoordelijk voor het formatteren en printen van violations naar de standaarduitvoer.

#### Constanten

De klasse definieert ANSI escape codes als string-constanten voor kleuruitvoer in de terminal. `Cyan` voor het bestandspad, `Red` voor errors, `Yellow` voor warnings, `Magenta` voor de regelcode, `Green` voor de suggestie, `Bold` voor nadruk op de severity, en `Reset` om alle opmaak te beëindigen.

---

**`Print(string filepath, Violation v, bool verbose)`** *(publiek)*

Formatteert en print één violation naar de standaarduitvoer. De eerste regel bevat altijd het bestandspad in cyaan gevolgd door een dubbele punt en het regelnummer, een tweevoudige spatie als scheiding, de severity in vetgedrukte rode of gele tekst, de regelcode in magenta tussen blokhaken, en het violation-bericht in standaardkleur.

Als `verbose` `true` is en de violation een niet-lege `Suggestion` heeft, wordt op de volgende regel de suggestie geprint met een groene pijl-prefix.

| Parameter | Type | Beschrijving |
|-----------|------|-------------|
| `filepath` | `string` | Het pad naar het geanalyseerde bestand, zoals meegegeven vanuit `Program.cs` |
| `v` | `Violation` | De te printen violation |
| `verbose` | `bool` | Of de suggestie ook geprint moet worden |
