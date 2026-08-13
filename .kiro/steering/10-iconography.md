# 10 — Iconografia applicativa

## Autorità

Le superfici operative usano esclusivamente Lucide React tramite l'adapter centrale `apps/next/src/features/dashboard/PlatformIcon.tsx`. La mappa e le regole di stroke sono definite in `13-app-design-system.md`; questo documento chiarisce le convenzioni per i controlli della shell.

## Convenzioni shell

- Sidebar, account e workspace usano icone da 18px, stroke `1.75`, cap e join round.
- L'apertura di un dropdown o popover usa `ChevronDown` tramite `PlatformIcon`.
- Il workspace usa icona semantica del contesto (`Stethoscope` per studio/professionista, `Building2` per organizzazione) e `Check` solo sul contesto attivo.
- Le SVG restano decorative quando il controllo ha testo e devono seguire il reset Safari-safe dello shell.
- Non usare caratteri Unicode, SVG inline locali o una seconda libreria per sostituire queste affordance.

## Workspace e account

Il trigger workspace mostra nome, tipo, ruolo opzionale e affordance di apertura; l'account mostra avatar, nome e descrittore user-facing. La scelta dell'icona non può dipendere dal nome visualizzato del workspace. I badge ruolo sono contenuti di metadata, non contenitori di icone o input.

Ogni nuova icona deve essere aggiunta alla mappa `PlatformIcon`, documentata in `13-app-design-system.md` e verificata su desktop, mobile, hover, focus-visible, reduced motion e stato disabilitato.