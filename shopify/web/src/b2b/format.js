// Money formatting shared by B2B screens (mirrors the god file's money()).

// Whole numbers show no decimals ("$81"); fractional show 2dp ("$81.50").
export function money(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

// Always 2dp with a leading "$".
export function money2(value) {
  return (
    '$' +
    Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
