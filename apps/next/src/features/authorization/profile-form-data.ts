export function nullableFormValue(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return value;
}

export function getAddressInput(formData: FormData) {
  const address = {
    street: nullableFormValue(formData, 'address_street'),
    city: nullableFormValue(formData, 'address_city'),
    postal_code: nullableFormValue(formData, 'address_postal_code'),
    country_code: nullableFormValue(formData, 'address_country_code'),
    province: nullableFormValue(formData, 'address_province'),
    locality: nullableFormValue(formData, 'address_locality'),
  };

  return Object.values(address).some((value) => value !== null) ? address : null;
}
