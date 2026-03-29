import { View, StyleSheet, type ViewStyle } from 'react-native';
import { SRText } from './SRText';
import { colors, radius, spacing } from '@/theme';

type BadgeVariant = 'active' | 'alert' | 'muted';

interface SRBadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  testID?: string;
}

export function SRBadge({ label, variant = 'muted', style, testID }: SRBadgeProps) {
  const s = badgeStyles[variant];
  return (
    <View testID={testID} style={[styles.badge, s.bg, style]}>
      <SRText variant="label" color={s.fg}>{label.toUpperCase()}</SRText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical:   spacing[1] - 1,
    paddingHorizontal: spacing[2] + 2,
    borderRadius:      radius.full,
    alignSelf:         'flex-start',
  },
});

const badgeStyles: Record<BadgeVariant, { bg: ViewStyle; fg: string }> = {
  active: {
    bg: { backgroundColor: colors.badgeActiveBg },
    fg: colors.badgeActiveFg,
  },
  alert: {
    bg: { backgroundColor: colors.badgeAlertBg },
    fg: colors.badgeAlertFg,
  },
  muted: {
    bg: { backgroundColor: colors.badgeMutedBg },
    fg: colors.badgeMutedFg,
  },
};
