'use client';

import {
  catalogCategoryListResponseSchema,
  catalogTreatmentListResponseSchema,
  createTreatmentOfferingRequestSchema,
  treatmentOfferingListResponseSchema,
  updateTreatmentOfferingRequestSchema,
  type CatalogCategory,
  type CatalogTreatment,
  type TreatmentOffering,
} from '@bbw/interfaces';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  OrganizationEmptyState,
  OrganizationLoadingState,
  OrganizationPageShell,
  OrganizationSectionHeader,
  StatusBadge,
} from '../organizations/OrganizationPagePrimitives';

import styles from './CatalogManager.module.css';

type ApiEnvelope = { success?: boolean; data?: unknown; code?: unknown };
type EditorState = {
  offeringId: string;
  price: string;
  duration: string;
  points: string;
};

function errorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

async function readEnvelope(response: Response): Promise<ApiEnvelope> {
  return response.json() as Promise<ApiEnvelope>;
}

function catalogErrorMessage(code: string | null): string {
  const messages: Record<string, string> = {
    FORBIDDEN: 'Non hai i permessi necessari per gestire il catalogo di questo contesto.',
    OPERATIONAL_CONTEXT_REQUIRED: 'Seleziona uno spazio operativo prima di gestire il catalogo.',
    OPERATIONAL_CONTEXT_FORBIDDEN: 'Questo spazio operativo non è autorizzato per il tuo account.',
    CATALOG_TREATMENT_NOT_FOUND: 'Il trattamento standard non è più disponibile.',
    CATALOG_OFFERING_NOT_FOUND: 'L’offerta non è più disponibile nel listino.',
    CATALOG_OFFERING_INVALID_INPUT: 'Controlla prezzo, durata e punti inseriti.',
  };
  return code ? messages[code] ?? 'Non è stato possibile completare l’operazione.' : 'Non è stato possibile completare l’operazione.';
}

function formatCents(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${whole},${fraction} €`;
}

function parseInteger(value: string, allowZero = true): number | null {
  const normalized = value.trim();
  if (!new RegExp(allowZero ? '^\\d+$' : '^[1-9]\\d*$').test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseEuroCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const wholeValue = Number(whole);
  const centsValue = Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(wholeValue) || !Number.isSafeInteger(centsValue)) return null;
  const cents = wholeValue * 100 + centsValue;
  return Number.isSafeInteger(cents) ? cents : null;
}

function treatmentMatches(treatment: CatalogTreatment, query: string, categoryCode: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase('it');
  return (!categoryCode || treatment.categoryCode === categoryCode)
    && (!normalizedQuery || `${treatment.name} ${treatment.categoryDisplayName} ${treatment.bodyArea ?? ''}`.toLocaleLowerCase('it').includes(normalizedQuery));
}

export default function CatalogManager({
  canCreate,
  canUpdate,
  canRemove,
}: Readonly<{ canCreate: boolean; canUpdate: boolean; canRemove: boolean }>) {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [treatments, setTreatments] = useState<CatalogTreatment[]>([]);
  const [offerings, setOfferings] = useState<TreatmentOffering[]>([]);
  const [query, setQuery] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const responses = await Promise.all([
        fetch('/api/backend/catalog/categories', { cache: 'no-store' }),
        fetch('/api/backend/catalog/treatments', { cache: 'no-store' }),
        fetch('/api/backend/catalog/offerings', { cache: 'no-store' }),
      ]);
      const envelopes = await Promise.all(responses.map(readEnvelope));
      const failed = responses.findIndex((response, index) => !response.ok || !envelopes[index]?.success);
      if (failed >= 0) throw new Error(catalogErrorMessage(errorCode(envelopes[failed])));
      setCategories(catalogCategoryListResponseSchema.parse(envelopes[0]?.data).items);
      setTreatments(catalogTreatmentListResponseSchema.parse(envelopes[1]?.data).items);
      setOfferings(treatmentOfferingListResponseSchema.parse(envelopes[2]?.data).items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Non è stato possibile caricare il catalogo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleTreatments = useMemo(
    () => treatments.filter((treatment) => treatmentMatches(treatment, query, categoryCode)),
    [categoryCode, query, treatments],
  );
  const offeringsByTreatment = useMemo(
    () => new Map(offerings.map((offering) => [offering.catalogTreatmentId, offering])),
    [offerings],
  );
  const activeOfferings = offerings.filter((offering) => offering.isActive);

  function startEditing(offering: TreatmentOffering) {
    setEditor({
      offeringId: offering.id,
      price: formatCents(offering.priceCents).replace(' €', ''),
      duration: String(offering.durationMinutes),
      points: String(offering.points),
    });
    setError(null);
    setNotice(null);
  }

  async function addOffering(treatment: CatalogTreatment) {
    if (!canCreate || busyId) return;
    setBusyId(treatment.id);
    setError(null);
    setNotice(null);
    try {
      const payload = createTreatmentOfferingRequestSchema.parse({ catalogTreatmentId: treatment.id });
      const response = await fetch('/api/backend/catalog/offerings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(catalogErrorMessage(errorCode(envelope)));
      setNotice(`${treatment.name} è stato aggiunto al tuo listino.`);
      await load();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Non è stato possibile aggiungere il trattamento.');
    } finally {
      setBusyId(null);
    }
  }

  async function saveOffering(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !canUpdate || busyId) return;
    const priceCents = parseEuroCents(editor.price);
    const durationMinutes = parseInteger(editor.duration, false);
    const points = parseInteger(editor.points);
    if (priceCents === null || durationMinutes === null || points === null) {
      setError('Inserisci un prezzo in euro valido, una durata positiva e punti interi non negativi.');
      return;
    }
    setBusyId(editor.offeringId);
    setError(null);
    setNotice(null);
    try {
      const payload = updateTreatmentOfferingRequestSchema.parse({ priceCents, durationMinutes, points });
      const response = await fetch(`/api/backend/catalog/offerings/${encodeURIComponent(editor.offeringId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(catalogErrorMessage(errorCode(envelope)));
      setEditor(null);
      setNotice('Il listino è stato aggiornato.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Non è stato possibile aggiornare il listino.');
    } finally {
      setBusyId(null);
    }
  }

  async function setOfferingActive(offering: TreatmentOffering, isActive: boolean) {
    if ((isActive ? !canUpdate : !canRemove) || busyId) return;
    if (!isActive && !window.confirm(`Disabilitare ${offering.name} dal tuo listino?`)) return;
    setBusyId(offering.id);
    setError(null);
    setNotice(null);
    try {
      const response = isActive
        ? await fetch(`/api/backend/catalog/offerings/${encodeURIComponent(offering.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ isActive: true }),
        })
        : await fetch(`/api/backend/catalog/offerings/${encodeURIComponent(offering.id)}`, { method: 'DELETE' });
      const envelope = await readEnvelope(response);
      if (!response.ok || !envelope.success) throw new Error(catalogErrorMessage(errorCode(envelope)));
      setNotice(isActive ? 'Il trattamento è stato riattivato.' : 'Il trattamento è stato disabilitato dal listino.');
      await load();
    } catch (activeError) {
      setError(activeError instanceof Error ? activeError.message : 'Non è stato possibile modificare lo stato del listino.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <OrganizationPageShell>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Gestione servizi</p>
        <h1>Catalogo BBW</h1>
        <p>Consulta i trattamenti standard BBW e costruisci il listino dello spazio operativo attivo.</p>
      </header>

      <section className={styles.catalogSection} aria-labelledby="catalog-master-title">
        <OrganizationSectionHeader id="catalog-master-title" title="Catalogo BBW" count={visibleTreatments.length} />
        <div className={styles.toolbar}>
          <label className={styles.searchField} htmlFor="catalog-search">
            <span className={styles.srOnly}>Cerca nel catalogo BBW</span>
            <input id="catalog-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca trattamento, categoria o zona" type="search" />
          </label>
          <label className={styles.categoryField} htmlFor="catalog-category">
            <span className={styles.srOnly}>Filtra per categoria</span>
            <select id="catalog-category" value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)}>
              <option value="">Tutte le categorie</option>
              {categories.map((category) => <option key={category.id} value={category.code}>{category.displayName}</option>)}
            </select>
          </label>
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        {loading ? <OrganizationLoadingState label="Caricamento catalogo BBW…" /> : null}
        {!loading && visibleTreatments.length === 0 ? <OrganizationEmptyState icon="search" title="Nessun trattamento trovato." description="Prova a cambiare ricerca o categoria." /> : null}
        {!loading && visibleTreatments.length > 0 ? (
          <ul className={styles.treatmentList} aria-label="Trattamenti del catalogo BBW">
            {visibleTreatments.map((treatment) => {
              const offering = offeringsByTreatment.get(treatment.id);
              const isBusy = busyId === treatment.id || busyId === offering?.id;
              const editingOffering = editor?.offeringId === offering?.id ? editor : null;
              return (
                <li className={styles.treatmentRow} key={treatment.id}>
                  <div className={styles.treatmentInfo}>
                    <div className={styles.treatmentTitle}>
                      <strong>{treatment.name}</strong>
                      <span>{treatment.categoryDisplayName}</span>
                    </div>
                    <p>{treatment.bodyArea} · {treatment.durationLabel} · {formatCents(treatment.defaultPriceCents)}</p>
                    <small>{treatment.description}</small>
                  </div>
                  <div className={styles.rowMeta}>
                    {offering?.isActive ? <StatusBadge label="Nel tuo listino" tone="success" /> : offering ? <StatusBadge label="Disabilitato" tone="warning" /> : <StatusBadge label="Catalogo BBW" tone="neutral" />}
                    {offering?.isActive ? <span className={styles.effectiveValue}>{formatCents(offering.priceCents)} · {offering.durationMinutes} min</span> : null}
                  </div>
                  <div className={styles.actions}>
                    {!offering && canCreate ? <button className={styles.primaryButton} disabled={isBusy} onClick={() => void addOffering(treatment)} type="button">{isBusy ? 'Aggiunta…' : 'Aggiungi'}</button> : null}
                    {offering?.isActive && canUpdate ? <button className={styles.secondaryButton} disabled={isBusy} onClick={() => startEditing(offering)} type="button">Modifica</button> : null}
                    {offering?.isActive && canRemove ? <button className={styles.removeButton} disabled={isBusy} onClick={() => void setOfferingActive(offering, false)} type="button">Disabilita</button> : null}
                    {offering && !offering.isActive && canUpdate ? <button className={styles.secondaryButton} disabled={isBusy} onClick={() => void setOfferingActive(offering, true)} type="button">Riattiva</button> : null}
                  </div>
                  {editingOffering ? (
                    <form className={styles.editor} onSubmit={(event) => void saveOffering(event)}>
                      <label>Prezzo (€)<input inputMode="decimal" value={editingOffering.price} onChange={(event) => setEditor({ ...editingOffering, price: event.target.value })} /></label>
                      <label>Durata (min)<input inputMode="numeric" value={editingOffering.duration} onChange={(event) => setEditor({ ...editingOffering, duration: event.target.value })} /></label>
                      <label>Punti<input inputMode="numeric" value={editingOffering.points} onChange={(event) => setEditor({ ...editingOffering, points: event.target.value })} /></label>
                      <button className={styles.primaryButton} disabled={isBusy} type="submit">{isBusy ? 'Salvataggio…' : 'Salva'}</button>
                      <button className={styles.secondaryButton} disabled={isBusy} onClick={() => setEditor(null)} type="button">Annulla</button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section className={styles.listinoSection} aria-labelledby="your-list-title">
        <OrganizationSectionHeader id="your-list-title" title="Il tuo listino" count={activeOfferings.length} />
        <p className={styles.sectionDescription}>Le offerte attive del contesto operativo selezionato, con i tuoi valori di prezzo, durata e punti.</p>
        {activeOfferings.length === 0 ? <OrganizationEmptyState icon="catalog" title="Il listino è ancora vuoto." description="Aggiungi un trattamento dal Catalogo BBW per iniziare." /> : (
          <ul className={styles.listinoList} aria-label="Il tuo listino">
            {activeOfferings.map((offering) => (
              <li className={styles.listinoRow} key={offering.id}>
                <div>
                  <strong>{offering.name}</strong>
                  <span>{offering.categoryDisplayName} · {offering.bodyArea ?? 'Zona non specificata'}</span>
                </div>
                <span className={styles.listinoValue}>{formatCents(offering.priceCents)} · {offering.durationMinutes} min · {offering.points} pt</span>
                <StatusBadge label="Attivo" tone="success" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </OrganizationPageShell>
  );
}
