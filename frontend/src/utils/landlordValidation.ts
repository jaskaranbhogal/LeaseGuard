export function bedroomCountError(value: string): string | undefined {
  return /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value))
    ? undefined
    : 'Enter a nonnegative whole number of bedrooms.';
}

export function bathroomCountError(value: string): string | undefined {
  return /^\d+(\.0|\.5)?$/.test(value.trim()) &&
    Number.isSafeInteger(Number(value) * 2)
    ? undefined
    : 'Enter bathrooms in half increments, such as 0, 1, or 1.5.';
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

export function inspectionDateError(
  value: string,
  today = new Date(),
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    return 'Use YYYY-MM-DD for the due date.';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    year < 1000 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return 'Enter a valid calendar date.';
  }
  const midnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return date < midnight ? 'Choose today or a future date.' : undefined;
}
