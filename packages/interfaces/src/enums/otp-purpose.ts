export const OTP_PURPOSES = ['registration', 'consent'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];
