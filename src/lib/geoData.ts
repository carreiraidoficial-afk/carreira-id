/** Base do bucket carreira-assets/geo-data no Supabase Storage -- espelho
 * próprio dos arquivos de país/estado/cidade da lib react-country-state-city,
 * pra não depender do host deles (venkatvidyut.github.io) nem baixar o
 * cities.json inteiro (41MB) de uma vez só. countries/states continuam
 * arquivos únicos (pequenos, ~116KB e ~625KB); cities foi fatiado por país
 * (mediana ~10KB, maior caso -- EUA -- ~2MB) em geo-data/cities/{countryId}.json,
 * usando o mesmo id numérico que a lib usa pra countryid/stateid. */
export const GEO_DATA_BASE_URL =
  'https://fppsotlycinwqsjpoybg.supabase.co/storage/v1/object/public/carreira-assets/geo-data';
