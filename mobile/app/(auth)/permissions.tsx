/**
 * PermissionsScreen — shown once after first login, before routing to the
 * role-based home screen.
 *
 * Why up-front permissions?
 * -------------------------
 * Asking for permissions inline (e.g. when the driver taps "Start trip" or
 * when a parent opens the map) creates friction at exactly the wrong moment.
 * Showing them here:
 *  • Gives context for WHY each permission is needed
 *  • Avoids interrupting core flows
 *  • Lets users understand the app's intent before they interact
 *
 * Flow:
 *   login → index.tsx checks SecureStore → no key → this screen
 *   this screen → requests permissions → writes key → navigates to role screen
 *
 * Key stored: `saferide_permissions_shown_{uid}` — per-user so a second
 * account on the same device gets its own permission prompt.
 */

import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, MapPin, CheckCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/auth.store';
import { AppLogo } from '@/components/ui/AppLogo';
import { SRText } from '@/components/ui/SRText';
import { SRButton } from '@/components/ui/SRButton';
import { SRBadge } from '@/components/ui/SRBadge';
import { registerForPushNotifications } from '@/notifications/push';
import { colors, spacing, radius, iconSize } from '@/theme';

// ── Constants ─────────────────────────────────────────────────────────────────

export const permissionsShownKey = (uid: string) =>
  `saferide_permissions_shown_${uid}`;

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PermissionsScreen() {
  const router  = useRouter();
  const { t }   = useTranslation();
  const { user, role } = useAuthStore();

  const [loading,  setLoading]  = useState(false);
  const [notifOk,  setNotifOk]  = useState<boolean | null>(null);
  const [locFgOk,  setLocFgOk]  = useState<boolean | null>(null);
  const [locBgOk,  setLocBgOk]  = useState<boolean | null>(null);

  const isDriver = role === 'driver';

  // ── Request all permissions in sequence ───────────────────────────────────────
  async function handleGrant() {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Push notifications (all roles)
      const pushToken = await registerForPushNotifications(user.uid);
      setNotifOk(pushToken !== null);

      // 2. Location — drivers only
      if (isDriver) {
        const { status: fg } = await Location.requestForegroundPermissionsAsync();
        setLocFgOk(fg === 'granted');

        if (fg === 'granted') {
          const { status: bg } = await Location.requestBackgroundPermissionsAsync();
          setLocBgOk(bg === 'granted');
        } else {
          setLocBgOk(false);
        }
      }

      // Mark as shown regardless of grant outcome — we don't re-ask on every launch
      await SecureStore.setItemAsync(permissionsShownKey(user.uid), '1');
    } catch {
      // Non-fatal — permissions can be granted later in device settings
    } finally {
      setLoading(false);
      navigateToHome();
    }
  }

  // ── Skip — mark shown without requesting ─────────────────────────────────────
  async function handleSkip() {
    if (!user) return;
    await SecureStore.setItemAsync(permissionsShownKey(user.uid), '1').catch(() => {});
    navigateToHome();
  }

  function navigateToHome() {
    switch (role) {
      case 'parent':       router.replace('/(parent)/');  break;
      case 'driver':       router.replace('/(driver)/');  break;
      case 'manager':      router.replace('/(manager)/'); break;
      case 'school_admin': router.replace('/(admin)/');   break;
      default:             router.replace('/(auth)/login'); break;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Brand mark ──────────────────────────────────────────────────── */}
        <View style={styles.logoRow}>
          <AppLogo size={36} color={colors.forest} />
        </View>

        {/* ── Heading ─────────────────────────────────────────────────────── */}
        <View style={styles.heading}>
          <SRText variant="heading" style={styles.title}>
            {t('permissions.title')}
          </SRText>
          <SRText variant="body" color={colors.slate} style={styles.subtitle}>
            {t('permissions.subtitle')}
          </SRText>
        </View>

        {/* ── Permission cards ─────────────────────────────────────────────── */}
        <View style={styles.cards}>

          {/* Push notifications — all roles */}
          <PermissionCard
            icon={<Bell size={iconSize.md} color={colors.forest} strokeWidth={2} />}
            title={t('permissions.notificationsTitle')}
            description={
              isDriver
                ? t('permissions.notificationsDescDriver')
                : t('permissions.notificationsDescParent')
            }
            badge={t('permissions.required')}
            badgeVariant="active"
            granted={notifOk}
          />

          {/* Location — drivers only */}
          {isDriver && (
            <PermissionCard
              icon={<MapPin size={iconSize.md} color={colors.forest} strokeWidth={2} />}
              title={t('permissions.locationTitle')}
              description={t('permissions.locationDesc')}
              badge={t('permissions.required')}
              badgeVariant="active"
              granted={locFgOk !== null ? (locFgOk && (locBgOk ?? false)) : null}
            />
          )}

        </View>

        {/* ── Fine print ───────────────────────────────────────────────────── */}
        <SRText variant="caption" color={colors.slate} style={styles.finePrint}>
          {t('permissions.finePrint')}
        </SRText>

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <View style={styles.actions}>
          <SRButton
            label={loading ? t('permissions.grantingButton') : t('permissions.grantButton')}
            size="lg"
            loading={loading}
            onPress={() => { void handleGrant(); }}
          />
          <TouchableOpacity
            onPress={() => { void handleSkip(); }}
            activeOpacity={0.7}
            disabled={loading}
            style={styles.skipBtn}
          >
            <SRText variant="caption" color={colors.slate}>
              {t('permissions.skipButton')}
            </SRText>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── PermissionCard ────────────────────────────────────────────────────────────

interface PermissionCardProps {
  icon:         React.ReactNode;
  title:        string;
  description:  string;
  badge:        string;
  badgeVariant: 'active' | 'muted';
  granted:      boolean | null; // null = not yet requested
}

function PermissionCard({ icon, title, description, badge, badgeVariant, granted }: PermissionCardProps) {
  return (
    <View style={card.container}>
      <View style={card.iconWrap}>{icon}</View>
      <View style={card.content}>
        <View style={card.titleRow}>
          <SRText variant="body" style={card.titleText}>{title}</SRText>
          <SRBadge
            label={badge}
            variant={badgeVariant}
          />
          {granted === true && (
            <CheckCircle size={14} color={colors.sage} strokeWidth={2} />
          )}
        </View>
        <SRText variant="caption" color={colors.slate} style={card.desc}>
          {description}
        </SRText>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow:          1,
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[8],
    gap:               spacing[6],
  },
  logoRow: {
    alignItems: 'center',
  },
  heading: {
    gap: spacing[3],
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign:  'center',
    lineHeight: 22,
  },
  cards: {
    gap: spacing[3],
  },
  finePrint: {
    textAlign:  'center',
    lineHeight: 18,
  },
  actions: {
    gap:       spacing[4],
    marginTop: spacing[2],
  },
  skipBtn: {
    alignItems: 'center',
    padding:    spacing[2],
  },
});

const card = StyleSheet.create({
  container: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing[4],
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    borderWidth:     0.5,
    borderColor:     colors.stone,
    padding:         spacing[5],
  },
  iconWrap: {
    width:           44,
    height:          44,
    borderRadius:    radius.lg,
    backgroundColor: colors.sageAlpha18,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  content: {
    flex: 1,
    gap:  spacing[2],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing[2],
    flexWrap:      'wrap',
  },
  titleText: {
    fontWeight: '500',
  },
  desc: {
    lineHeight: 18,
  },
});
