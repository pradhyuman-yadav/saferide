import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type TouchableOpacityProps,
  type ViewStyle,
} from 'react-native';
import { SRText } from './SRText';
import { colors, spacing, radius, typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface SRButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  style?: ViewStyle;
}

export function SRButton({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  style,
  disabled,
  ...rest
}: SRButtonProps) {
  const s = styles[variant];
  const p = paddingForSize[size];

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      disabled={disabled || loading}
      style={[
        baseStyle.btn,
        s.btn,
        p,
        disabled && baseStyle.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={s.labelColor} size="small" />
      ) : (
        <SRText
          variant="body"
          color={s.labelColor}
          style={{ fontFamily: typography.body.fontFamily, fontWeight: '500', letterSpacing: 0.42 }}
        >
          {label}
        </SRText>
      )}
    </TouchableOpacity>
  );
}

const baseStyle = StyleSheet.create({
  btn: {
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  disabled: { opacity: 0.45 },
});

const paddingForSize: Record<Size, ViewStyle> = {
  sm: { paddingVertical: spacing[1],  paddingHorizontal: spacing[3] },
  md: { paddingVertical: spacing[2],  paddingHorizontal: spacing[5] },
  lg: { paddingVertical: spacing[3],  paddingHorizontal: spacing[6] },
};

const styles: Record<Variant, { btn: ViewStyle; labelColor: string }> = {
  primary: {
    btn: { backgroundColor: colors.forest },
    labelColor: colors.mist,
  },
  secondary: {
    btn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.sage },
    labelColor: colors.forest,
  },
  ghost: {
    btn: { backgroundColor: colors.goldAlpha20 },
    labelColor: colors.forest,
  },
  danger: {
    btn: { backgroundColor: colors.goldAlpha20, borderWidth: 1, borderColor: colors.gold },
    labelColor: '#7A5C1E',
  },
};
