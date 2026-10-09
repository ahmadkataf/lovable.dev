import type { DroneModel } from './types'

// Every DJI drone line, newest first inside each series.
export const DJI_SERIES = ['Mini', 'Air', 'Mavic', 'Flip & Neo', 'Avata & FPV', 'Inspire', 'Phantom', 'Enterprise', 'Agras', 'Spark & Legacy']

export const DJI_DRONES: DroneModel[] = [
  // Mini
  { id: 'mini-5-pro', name: 'DJI Mini 5 Pro', series: 'Mini', year: 2025, type: 'consumer' },
  { id: 'mini-4-pro', name: 'DJI Mini 4 Pro', series: 'Mini', year: 2023, type: 'consumer' },
  { id: 'mini-4k', name: 'DJI Mini 4K', series: 'Mini', year: 2024, type: 'consumer' },
  { id: 'mini-3-pro', name: 'DJI Mini 3 Pro', series: 'Mini', year: 2022, type: 'consumer' },
  { id: 'mini-3', name: 'DJI Mini 3', series: 'Mini', year: 2022, type: 'consumer' },
  { id: 'mini-2-se', name: 'DJI Mini 2 SE', series: 'Mini', year: 2023, type: 'consumer' },
  { id: 'mini-2', name: 'DJI Mini 2', series: 'Mini', year: 2020, type: 'consumer' },
  { id: 'mini-se', name: 'DJI Mini SE', series: 'Mini', year: 2021, type: 'consumer' },
  { id: 'mavic-mini', name: 'DJI Mavic Mini', series: 'Mini', year: 2019, type: 'consumer' },
  // Air
  { id: 'air-3s', name: 'DJI Air 3S', series: 'Air', year: 2024, type: 'consumer' },
  { id: 'air-3', name: 'DJI Air 3', series: 'Air', year: 2023, type: 'consumer' },
  { id: 'air-2s', name: 'DJI Air 2S', series: 'Air', year: 2021, type: 'consumer' },
  { id: 'mavic-air-2', name: 'DJI Mavic Air 2', series: 'Air', year: 2020, type: 'consumer' },
  { id: 'mavic-air', name: 'DJI Mavic Air', series: 'Air', year: 2018, type: 'consumer' },
  // Mavic
  { id: 'mavic-4-pro', name: 'DJI Mavic 4 Pro', series: 'Mavic', year: 2025, type: 'pro' },
  { id: 'mavic-3-pro', name: 'DJI Mavic 3 Pro', series: 'Mavic', year: 2023, type: 'pro' },
  { id: 'mavic-3-classic', name: 'DJI Mavic 3 Classic', series: 'Mavic', year: 2022, type: 'pro' },
  { id: 'mavic-3', name: 'DJI Mavic 3 / Mavic 3 Cine', series: 'Mavic', year: 2021, type: 'pro' },
  { id: 'mavic-2-pro', name: 'DJI Mavic 2 Pro / Zoom', series: 'Mavic', year: 2018, type: 'pro' },
  { id: 'mavic-pro', name: 'DJI Mavic Pro / Platinum', series: 'Mavic', year: 2016, type: 'consumer' },
  // Flip & Neo
  { id: 'flip', name: 'DJI Flip', series: 'Flip & Neo', year: 2025, type: 'consumer' },
  { id: 'neo', name: 'DJI Neo', series: 'Flip & Neo', year: 2024, type: 'consumer' },
  // Avata & FPV
  { id: 'avata-2', name: 'DJI Avata 2', series: 'Avata & FPV', year: 2024, type: 'fpv' },
  { id: 'avata', name: 'DJI Avata', series: 'Avata & FPV', year: 2022, type: 'fpv' },
  { id: 'fpv', name: 'DJI FPV', series: 'Avata & FPV', year: 2021, type: 'fpv' },
  // Inspire
  { id: 'inspire-3', name: 'DJI Inspire 3', series: 'Inspire', year: 2023, type: 'pro' },
  { id: 'inspire-2', name: 'DJI Inspire 2', series: 'Inspire', year: 2016, type: 'pro' },
  // Phantom
  { id: 'phantom-4-pro-v2', name: 'DJI Phantom 4 Pro V2.0', series: 'Phantom', year: 2018, type: 'pro' },
  { id: 'phantom-4-rtk', name: 'DJI Phantom 4 RTK', series: 'Phantom', year: 2018, type: 'enterprise' },
  { id: 'phantom-4', name: 'DJI Phantom 4 / Advanced', series: 'Phantom', year: 2016, type: 'pro' },
  { id: 'phantom-3', name: 'DJI Phantom 3', series: 'Phantom', year: 2015, type: 'consumer' },
  // Enterprise
  { id: 'matrice-4', name: 'DJI Matrice 4E / 4T', series: 'Enterprise', year: 2025, type: 'enterprise' },
  { id: 'matrice-350-rtk', name: 'DJI Matrice 350 RTK', series: 'Enterprise', year: 2023, type: 'enterprise' },
  { id: 'matrice-300-rtk', name: 'DJI Matrice 300 RTK', series: 'Enterprise', year: 2020, type: 'enterprise' },
  { id: 'matrice-30', name: 'DJI Matrice 30 / 30T', series: 'Enterprise', year: 2022, type: 'enterprise' },
  { id: 'mavic-3-enterprise', name: 'DJI Mavic 3 Enterprise / Thermal', series: 'Enterprise', year: 2022, type: 'enterprise' },
  { id: 'mavic-3-multispectral', name: 'DJI Mavic 3 Multispectral', series: 'Enterprise', year: 2022, type: 'enterprise' },
  { id: 'dock-3', name: 'DJI Dock 3', series: 'Enterprise', year: 2025, type: 'enterprise' },
  // Agras
  { id: 'agras-t100', name: 'DJI Agras T100', series: 'Agras', year: 2025, type: 'agri' },
  { id: 'agras-t70p', name: 'DJI Agras T70P', series: 'Agras', year: 2025, type: 'agri' },
  { id: 'agras-t50', name: 'DJI Agras T50', series: 'Agras', year: 2024, type: 'agri' },
  { id: 'agras-t40', name: 'DJI Agras T40', series: 'Agras', year: 2022, type: 'agri' },
  { id: 'agras-t30', name: 'DJI Agras T30', series: 'Agras', year: 2021, type: 'agri' },
  { id: 'agras-t25', name: 'DJI Agras T25', series: 'Agras', year: 2024, type: 'agri' },
  { id: 'agras-t20p', name: 'DJI Agras T20P', series: 'Agras', year: 2022, type: 'agri' },
  // Legacy
  { id: 'spark', name: 'DJI Spark', series: 'Spark & Legacy', year: 2017, type: 'consumer' },
  { id: 'tello', name: 'Ryze Tello (DJI)', series: 'Spark & Legacy', year: 2018, type: 'consumer' },
]

export const DJI_BY_ID = Object.fromEntries(DJI_DRONES.map(d => [d.id, d])) as Record<string, DroneModel>

export const DRONE_TYPE_LABEL: Record<DroneModel['type'], string> = {
  consumer: 'استهلاكي',
  fpv: 'FPV',
  pro: 'احترافي',
  enterprise: 'مؤسسات',
  agri: 'زراعي',
}

export const PART_TYPES = [
  'بطاريات', 'مراوح', 'موتورات', 'جيمبال وكاميرا', 'أذرع وهيكل', 'ريموت كونترول', 'شواحن', 'فلاتر ND', 'كابلات', 'حقائب وحماية', 'لوحات إلكترونية', 'حسّاسات',
]
