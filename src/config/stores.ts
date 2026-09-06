// Reprezentativna poslovnica za MVP - Slavonski Brod, za oba lanca.
// Promijeni ove konstante da promijeniš poslovnicu za cijelu aplikaciju.

export const LIDL_STORE_MATCH = "Slavonski Brod";

export const KAUFLAND_STORE = {
  type: "Hipermarket",
  slug: "Naselje_Slavonija_2_kc_br_5_Slavonski_Brod",
  code: "2830",
};

export function buildKauflandCsvUrl(date: Date): string {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();

  const filename = `${KAUFLAND_STORE.type}_${KAUFLAND_STORE.slug}_${KAUFLAND_STORE.code}_${dd}${mm}${yyyy}_7-30.csv`;

  return `https://www.kaufland.hr/content/dam/kaufland/global/article/hr_HR/download/document/mpc_15_5/${month}/${day}/${filename}`;
}
