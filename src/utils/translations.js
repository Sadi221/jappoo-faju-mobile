export const MEDICAL_NEED_LABELS = {
  SURGERY: 'Chirurgie',
  MEDICATION: 'Médicaments',
  EXAM: 'Examens médicaux',
  KIT: 'Kit médical',
};

export const URGENCY_LABELS = {
  CRITICAL: 'Critique',
  HIGH: 'Élevé',
  MEDIUM: 'Moyen',
  LOW: 'Faible',
};

export const REQUEST_STATUS_LABELS = {
  PENDING: 'En attente',
  ACTIVE: 'Active',
  COMPLETED: 'Complétée',
  REJECTED: 'Rejetée',
  EXPIRED: 'Expirée',
};

export const URGENCY_COLORS = {
  CRITICAL: '#EF4444',
  HIGH:     '#F97316',
  MEDIUM:   '#EAB308',
  LOW:      '#3B82F6',
};

export const t = (dict, key) => dict[key] || key;
