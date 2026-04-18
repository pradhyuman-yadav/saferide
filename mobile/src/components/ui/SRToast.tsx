/**
 * SRToast — in-app activity banner system.
 *
 * Renders at most one toast at a time (FIFO queue). Each toast slides in from
 * the top, auto-dismisses after `duration` ms, and can be swiped/tapped away.
 *
 * Mount <SRToastProvider /> once at the root layout — it positions itself
 * absolutely above everything else via zIndex.
 *
 * Trigger a toast from any screen:
 *   const show = useToastStore((s) => s.show);
 *   show({ title: 'Bus departed', body: '7:42 AM', type: 'info' });
 */

import { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  TouchableOpacity,
  StyleSheet,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, Info, AlertTriangle, X } from 'lucide-react-native';
import { useToastStore, type Toast, type ToastType } from '@/store/toast.store';
import { SRText } from './SRText';
import { colors, spacing, radius, iconSize } from '@/theme';

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * Mount once inside your root layout (sibling to <Stack />).
 * Renders nothing when there are no pending toasts.
 */
export function SRToastProvider() {
  const queue  = useToastStore((s) => s.queue);
  const insets = useSafeAreaInsets();

  // Only show the oldest pending toast — once it's dismissed the next one appears
  const current = queue[0];
  if (!current) return null;

  return (
    <View
      style={[styles.overlay, { top: insets.top + spacing[2] }]}
      pointerEvents="box-none"
    >
      <ToastCard key={current.id} toast={current} />
    </View>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss  = useToastStore((s) => s.dismiss);
  const slideY   = useRef(new Animated.Value(-100)).current;
  const opacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in — 200 ms ease-out (brand micro-interaction spec)
    Animated.parallel([
      Animated.timing(slideY, {
        toValue:         0,
        duration:        200,
        easing:          Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue:         1,
        duration:        150,
        easing:          Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss
    const timer = setTimeout(() => slideOut(), toast.duration);
    return () => clearTimeout(timer);
  }, []);

  function slideOut() {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue:         -100,
        duration:        250,
        easing:          Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue:         0,
        duration:        200,
        easing:          Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => dismiss(toast.id));
  }

  const visual = TOAST_VISUAL[toast.type];

  return (
    <Animated.View
      style={[
        styles.card,
        { transform: [{ translateY: slideY }], opacity },
      ]}
    >
      {/* Left colour strip */}
      <View style={[styles.strip, { backgroundColor: visual.strip }]} />

      {/* Content */}
      <View style={styles.body}>
        <View style={styles.iconWrap}>{visual.icon}</View>
        <View style={styles.text}>
          <SRText variant="body" style={styles.title}>{toast.title}</SRText>
          {toast.body ? (
            <SRText variant="caption" color={colors.slate}>{toast.body}</SRText>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={slideOut}
          hitSlop={12}
          activeOpacity={0.7}
        >
          <X size={iconSize.sm} color={colors.slate} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ── Visuals ───────────────────────────────────────────────────────────────────

interface ToastVisual {
  strip: string;
  icon:  React.ReactNode;
}

const TOAST_VISUAL: Record<ToastType, ToastVisual> = {
  success: {
    strip: colors.sage,
    icon:  <CheckCircle  size={iconSize.sm} color={colors.sage}  strokeWidth={2} />,
  },
  info: {
    strip: colors.slate,
    icon:  <Info         size={iconSize.sm} color={colors.slate} strokeWidth={2} />,
  },
  warning: {
    strip: colors.gold,
    icon:  <AlertTriangle size={iconSize.sm} color={colors.gold} strokeWidth={2} />,
  },
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left:     spacing[4],
    right:    spacing[4],
    zIndex:   9999,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    borderWidth:     0.5,
    borderColor:     colors.stone,
    flexDirection:   'row',
    overflow:        'hidden',
    // Brand: no shadows — border defines elevation
  },
  strip: {
    width: 4,
  },
  body: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[3],
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[4],
  },
  iconWrap: {
    width:  iconSize.sm,
    height: iconSize.sm,
  },
  text: {
    flex: 1,
    gap:  2,
  },
  title: {
    fontWeight: '500',
  },
});
