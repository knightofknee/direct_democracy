import React from 'react';

import { Chip } from '@/components/ui';
import { useT } from '@/lib/i18n';

/**
 * Marks a school board nominee on the Chicago Teachers Union's endorsement
 * slate. For many voters it is the deciding fact, so it shows on the race
 * list, not only on the nominee's own card.
 */
export function CtuChip() {
  const t = useT();
  return <Chip label={t('CTU endorsed')} icon="ribbon-outline" tone="success" />;
}
