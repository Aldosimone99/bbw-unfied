export const onboardingIntentOptions = [
  {
    code: "personal",
    label: "Cliente",
    description: "Gestisci il tuo profilo, appuntamenti e consensi."
  },
  {
    code: "healthcare_professional",
    label: "Medico",
    description: "Gestisci catalogo, agenda, clienti e consensi."
  },
  {
    code: "beauty_professional",
    label: "Estetista",
    description: "Organizza servizi, agenda e relazioni con i clienti."
  },
  {
    code: "organization",
    label: "Clinica",
    description: "Gestisci struttura, membri, staff e attività cliniche."
  },
  {
    code: "commercial",
    label: "Commerciale",
    description: "Gestisci inviti, clienti e collaborazione commerciale."
  }
] as const;
