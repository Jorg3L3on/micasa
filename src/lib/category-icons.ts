import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Car,
  CircleEllipsis,
  Coffee,
  CreditCard,
  Dog,
  Film,
  Gamepad2,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Home,
  Landmark,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Tv,
  UtensilsCrossed,
  Users,
  Zap,
} from 'lucide-react';

export const CATEGORY_ICON_KEYS = [
  'UTENSILS',
  'CAR',
  'HOME',
  'SHOPPING_CART',
  'COFFEE',
  'HEART_PULSE',
  'REPEAT',
  'ZAP',
  'TV',
  'GRADUATION_CAP',
  'TRENDING_UP',
  'PIGGY_BANK',
  'LANDMARK',
  'CREDIT_CARD',
  'GIFT',
  'DOG',
  'PLANE',
  'SHOPPING_BAG',
  'BUILDING',
  'RECEIPT',
  'MORE_HORIZONTAL',
  'GAMEPAD2',
  'PILL',
  'HAND_HEART',
  'USERS',
  'FILM',
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

/** System rows that are not stored on Category records. */
export const SYSTEM_CATEGORY_ICON_KEYS = {
  CARD_PAYMENT: 'CREDIT_CARD',
  LOAN_PAYMENT: 'LANDMARK',
} as const satisfies Record<string, CategoryIconKey>;

const CATEGORY_ICON_KEY_SET = new Set<string>(CATEGORY_ICON_KEYS);

export type CategoryIconOption = {
  key: CategoryIconKey;
  label: string;
  keywords: string[];
  Icon: LucideIcon;
};

const CATEGORY_ICON_OPTIONS: readonly CategoryIconOption[] = [
  { key: 'UTENSILS', label: 'Comida', keywords: ['comida', 'restaurante', 'cocina'], Icon: UtensilsCrossed },
  { key: 'CAR', label: 'Transporte', keywords: ['auto', 'uber', 'gasolina'], Icon: Car },
  { key: 'HOME', label: 'Vivienda', keywords: ['casa', 'renta', 'hogar'], Icon: Home },
  { key: 'SHOPPING_CART', label: 'Despensa', keywords: ['super', 'abarrotes', 'groceries'], Icon: ShoppingCart },
  { key: 'COFFEE', label: 'Café', keywords: ['cafeteria', 'bebidas'], Icon: Coffee },
  { key: 'HEART_PULSE', label: 'Salud', keywords: ['medico', 'doctor', 'farmacia'], Icon: HeartPulse },
  { key: 'REPEAT', label: 'Suscripciones', keywords: ['netflix', 'spotify', 'mensual'], Icon: Repeat },
  { key: 'ZAP', label: 'Servicios', keywords: ['luz', 'agua', 'internet'], Icon: Zap },
  { key: 'TV', label: 'Entretenimiento', keywords: ['streaming', 'cine'], Icon: Tv },
  { key: 'GRADUATION_CAP', label: 'Educación', keywords: ['escuela', 'cursos'], Icon: GraduationCap },
  { key: 'TRENDING_UP', label: 'Inversiones', keywords: ['ahorro', 'bolsa'], Icon: TrendingUp },
  { key: 'PIGGY_BANK', label: 'Ahorro', keywords: ['meta', 'fondo'], Icon: PiggyBank },
  { key: 'LANDMARK', label: 'Banco / deuda', keywords: ['prestamo', 'credito'], Icon: Landmark },
  { key: 'CREDIT_CARD', label: 'Tarjeta', keywords: ['pago tarjeta', 'credito'], Icon: CreditCard },
  { key: 'GIFT', label: 'Regalos', keywords: ['cumpleanos'], Icon: Gift },
  { key: 'DOG', label: 'Mascotas', keywords: ['perro', 'gato', 'veterinario'], Icon: Dog },
  { key: 'PLANE', label: 'Viajes', keywords: ['vuelo', 'hotel'], Icon: Plane },
  { key: 'SHOPPING_BAG', label: 'Compras', keywords: ['ropa', 'tienda'], Icon: ShoppingBag },
  { key: 'BUILDING', label: 'Renta', keywords: ['departamento', 'alquiler'], Icon: Building2 },
  { key: 'RECEIPT', label: 'Impuestos', keywords: ['sat', 'factura'], Icon: Receipt },
  { key: 'MORE_HORIZONTAL', label: 'Otros', keywords: ['varios', 'misc'], Icon: CircleEllipsis },
  { key: 'GAMEPAD2', label: 'Juegos', keywords: ['videojuegos'], Icon: Gamepad2 },
  { key: 'PILL', label: 'Medicamentos', keywords: ['farmacia', 'medicina'], Icon: Pill },
  { key: 'HAND_HEART', label: 'Apoyo', keywords: ['familia', 'donacion'], Icon: HandHeart },
  { key: 'USERS', label: 'Hogar', keywords: ['casa', 'familia'], Icon: Users },
  { key: 'FILM', label: 'Salidas', keywords: ['cine', 'eventos'], Icon: Film },
];

const CATEGORY_ICON_MAP = new Map<CategoryIconKey, CategoryIconOption>(
  CATEGORY_ICON_OPTIONS.map((option) => [option.key, option]),
);

export const getCategoryIconOption = (
  key: string | null | undefined,
): CategoryIconOption | null => {
  if (key == null || !CATEGORY_ICON_KEY_SET.has(key)) return null;
  return CATEGORY_ICON_MAP.get(key as CategoryIconKey) ?? null;
};

export const isCategoryIconKey = (value: string): value is CategoryIconKey =>
  CATEGORY_ICON_KEY_SET.has(value);

export const isLegacyCategoryIcon = (
  value: string | null | undefined,
): boolean => {
  if (value == null || value.trim() === '') return false;
  return !isCategoryIconKey(value);
};

export const listCategoryIconOptions = (): readonly CategoryIconOption[] =>
  CATEGORY_ICON_OPTIONS;

export const DEFAULT_ONBOARDING_CATEGORY_ICONS: Readonly<
  Record<string, CategoryIconKey>
> = {
  Comida: 'UTENSILS',
  Transporte: 'CAR',
  Vivienda: 'HOME',
};

export const resolveOnboardingCategoryIcon = (
  name: string,
  explicitIcon?: string | null,
): CategoryIconKey | null => {
  if (explicitIcon && isCategoryIconKey(explicitIcon)) return explicitIcon;
  const trimmed = name.trim();
  return DEFAULT_ONBOARDING_CATEGORY_ICONS[trimmed] ?? null;
};

export type CategoryIconValidationResult =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

export const validateCategoryIconInput = (
  icon: string | null | undefined,
  existingIcon: string | null,
): CategoryIconValidationResult => {
  if (icon === undefined) {
    return { ok: true, value: existingIcon };
  }

  const trimmed = typeof icon === 'string' ? icon.trim() : '';
  if (!trimmed) {
    return { ok: true, value: null };
  }

  if (isCategoryIconKey(trimmed)) {
    return { ok: true, value: trimmed };
  }

  if (existingIcon && trimmed === existingIcon) {
    return { ok: true, value: trimmed };
  }

  return {
    ok: false,
    message: 'Selecciona un ícono de la lista o deja el campo vacío',
  };
};
