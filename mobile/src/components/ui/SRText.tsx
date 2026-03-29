import { Text, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { typography, colors } from '@/theme';

type Variant = 'display' | 'heading' | 'cardTitle' | 'subheading' | 'body' | 'caption' | 'label' | 'data' | 'statNum';

interface SRTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  style?: TextStyle | TextStyle[];
}

export function SRText({ variant = 'body', color, style, children, ...rest }: SRTextProps) {
  return (
    <Text
      style={[
        typography[variant],
        { color: color ?? defaultColor(variant) },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

function defaultColor(variant: Variant): string {
  switch (variant) {
    case 'display':
    case 'heading':
    case 'cardTitle':
    case 'statNum':
      return colors.forest;
    case 'subheading':
    case 'label':
      return colors.slate;
    case 'caption':
      return colors.textMuted;
    case 'data':
      return colors.sage;
    default:
      return colors.ink;
  }
}
