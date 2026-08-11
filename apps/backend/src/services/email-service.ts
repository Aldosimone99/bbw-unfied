import Mailjet from 'node-mailjet';

export interface InviteEmailData {
  to: string;
  nome?: string | null;
  role: string;
  acceptLink: string;
}

export interface CompanyInviteEmailData {
  to: string;
  nome?: string | null;
  clinicName: string;
  role: string;
  acceptLink: string;
}

export interface PPLInviteEmailData {
  to: string;
  nome?: string | null;
  professionalName: string;
  clinicName?: string | null;
  acceptLink: string;
}

export interface ConsentOTPEmailData {
  to: string;
  code: string;
  patientName?: string | null;
}

export interface ConsentShareEmailData {
  to: string;
  patientName?: string | null;
  professionalName: string;
  shareLink: string;
}

export interface EmailService {
  sendInviteEmail(data: InviteEmailData): Promise<void>;
  sendCompanyInviteEmail(data: CompanyInviteEmailData): Promise<void>;
  sendPPLInviteEmail(data: PPLInviteEmailData): Promise<void>;
  sendConsentOTPEmail(data: ConsentOTPEmailData): Promise<void>;
  sendConsentShareEmail(data: ConsentShareEmailData): Promise<void>;
}

function inviteText(data: InviteEmailData): string {
  const greeting = data.nome ? `Ciao ${data.nome},` : 'Ciao,';
  return [
    greeting,
    '',
    `Sei stato invitato su Beauty Broker World come ${data.role}.`,
    `Apri questo link per completare la registrazione: ${data.acceptLink}`,
    '',
    'Beauty Broker World',
  ].join('\n');
}

function companyInviteText(data: CompanyInviteEmailData): string {
  const greeting = data.nome ? `Ciao ${data.nome},` : 'Ciao,';
  return [
    greeting,
    '',
    `Sei stato invitato a unirti a ${data.clinicName} su Beauty Broker World come ${data.role}.`,
    `Apri questo link per accettare l'invito: ${data.acceptLink}`,
    '',
    'Beauty Broker World',
  ].join('\n');
}

function companyInviteHtml(data: CompanyInviteEmailData): string {
  const greeting = data.nome ? `Ciao ${data.nome},` : 'Ciao,';
  return [
    `<p>${greeting}</p>`,
    `<p>Sei stato invitato a unirti a <strong>${data.clinicName}</strong> su Beauty Broker World come <strong>${data.role}</strong>.</p>`,
    `<p><a href="${data.acceptLink}">Accetta l'invito</a></p>`,
    '<p>Beauty Broker World</p>',
  ].join('');
}

function inviteHtml(data: InviteEmailData): string {
  const greeting = data.nome ? `Ciao ${data.nome},` : 'Ciao,';
  return [
    `<p>${greeting}</p>`,
    `<p>Sei stato invitato su Beauty Broker World come <strong>${data.role}</strong>.</p>`,
    `<p><a href="${data.acceptLink}">Completa la registrazione</a></p>`,
    '<p>Beauty Broker World</p>',
  ].join('');
}

export function createEmailService(): EmailService {
  return {
    async sendInviteEmail(data) {
      if (!process.env.MAILJET_API_KEY || process.env.NODE_ENV === 'test') {
        console.log(`[invite-email] ${data.to} ${data.acceptLink}`);
        return;
      }

      const client = Mailjet.apiConnect(
        process.env.MAILJET_API_KEY,
        process.env.MAILJET_API_SECRET ?? '',
      );

      await client.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: {
            Email: process.env.MAILJET_FROM_EMAIL ?? 'no-reply@beautybrokerworld.it',
            Name: process.env.MAILJET_FROM_NAME ?? 'Beauty Broker World',
          },
          To: [{ Email: data.to, Name: [data.nome].filter(Boolean).join(' ') || data.to }],
          Subject: 'Sei stato invitato su Beauty Broker World',
          TextPart: inviteText(data),
          HTMLPart: inviteHtml(data),
        }],
      });
    },

    async sendCompanyInviteEmail(data) {
      if (!process.env.MAILJET_API_KEY || process.env.NODE_ENV === 'test') {
        console.log(`[company-invite-email] ${data.to} ${data.acceptLink}`);
        return;
      }

      const client = Mailjet.apiConnect(
        process.env.MAILJET_API_KEY,
        process.env.MAILJET_API_SECRET ?? '',
      );

      await client.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: {
            Email: process.env.MAILJET_FROM_EMAIL ?? 'no-reply@beautybrokerworld.it',
            Name: process.env.MAILJET_FROM_NAME ?? 'Beauty Broker World',
          },
          To: [{ Email: data.to, Name: [data.nome].filter(Boolean).join(' ') || data.to }],
          Subject: `Sei stato invitato a unirti a ${data.clinicName} su Beauty Broker World`,
          TextPart: companyInviteText(data),
          HTMLPart: companyInviteHtml(data),
        }],
      });
    },

    async sendPPLInviteEmail(data) {
      if (!process.env.MAILJET_API_KEY || process.env.NODE_ENV === 'test') {
        console.log(`[ppl-invite-email] ${data.to} ${data.acceptLink}`);
        return;
      }

      const client = Mailjet.apiConnect(
        process.env.MAILJET_API_KEY,
        process.env.MAILJET_API_SECRET ?? '',
      );

      await client.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: {
            Email: process.env.MAILJET_FROM_EMAIL ?? 'no-reply@beautybrokerworld.it',
            Name: process.env.MAILJET_FROM_NAME ?? 'Beauty Broker World',
          },
          To: [{ Email: data.to, Name: [data.nome].filter(Boolean).join(' ') || data.to }],
          Subject: `${data.professionalName} ti ha invitato su Beauty Broker World`,
          TextPart: `${data.nome ?? 'Ciao'}, ${data.professionalName} ti ha invitato come suo paziente${data.clinicName ? ` presso ${data.clinicName}` : ''}. Accetta qui: ${data.acceptLink}`,
          HTMLPart: `<p>${data.nome ?? 'Ciao'},</p><p>${data.professionalName} ti ha invitato come suo paziente${data.clinicName ? ` presso <strong>${data.clinicName}</strong>` : ''}.</p><p><a href="${data.acceptLink}">Accetta l'invito</a></p>`,
        }],
      });
    },

    async sendConsentOTPEmail(data) {
      if (!process.env.MAILJET_API_KEY || process.env.NODE_ENV === 'test') {
        console.log(`[consent-otp-email] ${data.to} ${data.code}`);
        return;
      }
      const client = Mailjet.apiConnect(process.env.MAILJET_API_KEY, process.env.MAILJET_API_SECRET ?? '');
      await client.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: {
            Email: process.env.MAILJET_FROM_EMAIL ?? 'no-reply@beautybrokerworld.it',
            Name: process.env.MAILJET_FROM_NAME ?? 'Beauty Broker World',
          },
          To: [{ Email: data.to, Name: data.patientName ?? data.to }],
          Subject: 'Codice OTP per firmare il consenso',
          TextPart: `Il tuo codice OTP per firmare il consenso è ${data.code}. Scade tra 10 minuti.`,
          HTMLPart: `<p>Il tuo codice OTP per firmare il consenso è <strong>${data.code}</strong>.</p><p>Scade tra 10 minuti.</p>`,
        }],
      });
    },

    async sendConsentShareEmail(data) {
      if (!process.env.MAILJET_API_KEY || process.env.NODE_ENV === 'test') {
        console.log(`[consent-share-email] ${data.to} ${data.shareLink}`);
        return;
      }
      const client = Mailjet.apiConnect(process.env.MAILJET_API_KEY, process.env.MAILJET_API_SECRET ?? '');
      await client.post('send', { version: 'v3.1' }).request({
        Messages: [{
          From: {
            Email: process.env.MAILJET_FROM_EMAIL ?? 'no-reply@beautybrokerworld.it',
            Name: process.env.MAILJET_FROM_NAME ?? 'Beauty Broker World',
          },
          To: [{ Email: data.to, Name: data.patientName ?? data.to }],
          Subject: 'Firma il consenso informato',
          TextPart: `${data.professionalName} ti ha inviato un consenso informato da firmare: ${data.shareLink}`,
          HTMLPart: `<p>${data.professionalName} ti ha inviato un consenso informato da firmare.</p><p><a href="${data.shareLink}">Apri documento</a></p>`,
        }],
      });
    },
  };
}

export const defaultEmailService = createEmailService();
