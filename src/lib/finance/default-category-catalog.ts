import type { CategoryIconKey } from '@/lib/category-icons';

export type DefaultCategoryChild = {
  name: string;
  icon: CategoryIconKey;
};

export type DefaultCategoryRoot = {
  name: string;
  icon: CategoryIconKey;
  children: readonly DefaultCategoryChild[];
};

/**
 * Canonical default expense category tree (one level: root → children).
 * Cloned per user/house on create; not a shared DB catalog.
 */
export const DEFAULT_CATEGORY_CATALOG: readonly DefaultCategoryRoot[] = [
  {
    name: 'Comida',
    icon: 'UTENSILS',
    children: [
      { name: 'Supermercado', icon: 'SHOPPING_CART' },
      { name: 'Restaurantes', icon: 'UTENSILS' },
      { name: 'Café', icon: 'COFFEE' },
    ],
  },
  {
    name: 'Transporte',
    icon: 'CAR',
    children: [
      { name: 'Gasolina', icon: 'CAR' },
      { name: 'Uber', icon: 'CAR' },
      { name: 'Estacionamiento', icon: 'CAR' },
      { name: 'Mantenimiento del auto', icon: 'CAR' },
    ],
  },
  {
    name: 'Vivienda',
    icon: 'HOME',
    children: [
      { name: 'Renta', icon: 'BUILDING' },
      { name: 'Mantenimiento del hogar', icon: 'HOME' },
      { name: 'Servicios del hogar', icon: 'ZAP' },
      { name: 'Mascotas', icon: 'DOG' },
    ],
  },
  {
    name: 'Compras',
    icon: 'SHOPPING_BAG',
    children: [
      { name: 'Ropa', icon: 'SHOPPING_BAG' },
      { name: 'Electrónicos', icon: 'GAMEPAD2' },
      { name: 'Hogar', icon: 'HOME' },
      { name: 'Compras en línea', icon: 'SHOPPING_CART' },
    ],
  },
  {
    name: 'Salud',
    icon: 'HEART_PULSE',
    children: [
      { name: 'Doctor', icon: 'HEART_PULSE' },
      { name: 'Farmacia', icon: 'PILL' },
      { name: 'Gimnasio', icon: 'HEART_PULSE' },
    ],
  },
  {
    name: 'Servicios y suscripciones',
    icon: 'REPEAT',
    children: [
      { name: 'Teléfono', icon: 'RECEIPT' },
      { name: 'Internet y TV', icon: 'TV' },
      { name: 'Netflix', icon: 'TV' },
      { name: 'Spotify', icon: 'TV' },
      { name: 'Amazon Prime', icon: 'TV' },
      { name: 'Disney+', icon: 'TV' },
      { name: 'YouTube Premium', icon: 'TV' },
      { name: 'Otras suscripciones', icon: 'REPEAT' },
    ],
  },
  {
    name: 'Entretenimiento',
    icon: 'FILM',
    children: [
      { name: 'Cine y salidas', icon: 'FILM' },
      { name: 'Social', icon: 'USERS' },
      { name: 'Juegos', icon: 'GAMEPAD2' },
    ],
  },
  {
    name: 'Viajes',
    icon: 'PLANE',
    children: [],
  },
  {
    name: 'Educación',
    icon: 'GRADUATION_CAP',
    children: [{ name: 'Libros', icon: 'GRADUATION_CAP' }],
  },
  {
    name: 'Familia',
    icon: 'USERS',
    children: [{ name: 'Apoyos familiares', icon: 'HAND_HEART' }],
  },
  {
    name: 'Regalos y donaciones',
    icon: 'GIFT',
    children: [],
  },
  {
    name: 'Inversiones',
    icon: 'TRENDING_UP',
    children: [{ name: 'Seguros', icon: 'LANDMARK' }],
  },
  {
    name: 'Tarjeta de crédito',
    icon: 'CREDIT_CARD',
    children: [],
  },
  {
    name: 'Tarjeta departamental',
    icon: 'CREDIT_CARD',
    children: [],
  },
  {
    name: 'Préstamos',
    icon: 'LANDMARK',
    children: [],
  },
  {
    name: 'Otros',
    icon: 'MORE_HORIZONTAL',
    children: [],
  },
] as const;

export const countDefaultCatalogCategories = (): number =>
  DEFAULT_CATEGORY_CATALOG.reduce(
    (sum, root) => sum + 1 + root.children.length,
    0,
  );
