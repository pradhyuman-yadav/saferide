/**
 * ErrorBoundary — catches unhandled render errors in the component tree.
 *
 * Wraps critical subtrees (root layout, map screen) so a crash in one
 * component doesn't blank the entire app. Shows a calm recovery screen
 * matching the SafeRide brand instead of a white crash screen.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SRText } from '@/components/ui/SRText';
import { colors, spacing, radius } from '@/theme';

interface Props {
  children: ReactNode;
  /** Rendered when an error is caught. If omitted, a default recovery UI is shown. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message:  string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this would ship to a crash reporting service (Sentry etc.)
    if (__DEV__) {
      console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <SRText variant="heading" color={colors.forest} style={styles.heading}>
              Something went wrong
            </SRText>
            <SRText variant="body" color={colors.slate} style={styles.body}>
              The app hit an unexpected error. Your data is safe — tap below to try again.
            </SRText>
            <TouchableOpacity
              style={styles.btn}
              onPress={this.handleRetry}
              activeOpacity={0.82}
            >
              <SRText variant="body" color={colors.white} style={{ fontWeight: '500' }}>
                Try again
              </SRText>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         spacing[6],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    padding:         spacing[6],
    gap:             spacing[4],
    maxWidth:        360,
    width:           '100%',
    borderWidth:     0.5,
    borderColor:     colors.stone,
  },
  heading: {
    textAlign: 'center',
  },
  body: {
    textAlign:  'center',
    lineHeight: 22,
  },
  btn: {
    backgroundColor: colors.forest,
    borderRadius:    radius.sm,
    paddingVertical:   spacing[3],
    paddingHorizontal: spacing[6],
    alignItems:      'center',
    marginTop:       spacing[2],
  },
});
