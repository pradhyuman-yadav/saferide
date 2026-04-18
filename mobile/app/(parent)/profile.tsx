/**
 * Parent profile screen.
 *
 * Shows the parent's identity, child assignment (bus, stop, class),
 * notification preferences, and language. Sign-out has a confirmation
 * alert and uses the brand-standard gold destructive style.
 */

import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, User, Mail, Phone, Globe, Bus, MapPin, FileText, Shield, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { SUPPORTED_LANGUAGES, setStoredLanguage } from '../../src/i18n';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, signOut } = useAuthStore();

  // ── Notification preferences (local state; backend persistence in Phase 2) ─
  const [notifDeparted,    setDeparted]    = useState(true);
  const [notif10Min,       set10Min]       = useState(true);
  const [notif5Min,        set5Min]        = useState(true);
  const [notifStop,        setStop]        = useState(true);
  const [notifSchool,      setSchool]      = useState(true);
  const [notifDelay,       setDelay]       = useState(true);
  const [notifSms,         setSms]         = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const initials = (profile?.name ?? 'P')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // ── Sign out ────────────────────────────────────────────────────────────────
  function handleSignOut() {
    Alert.alert(
      t('profile.signOut'),
      t('profile.signOutMessage'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        {
          text: t('profile.signOut'),
          style: 'destructive',
          onPress: () => {
            void signOut().then(() => router.replace('/(auth)/welcome'));
          },
        },
      ],
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      t('profile.deleteAccountConfirmTitle'),
      t('profile.deleteAccountConfirmMessage'),
      [
        { text: t('profile.deleteAccountConfirmCancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccountConfirmProceed'),
          style: 'destructive',
          onPress: () => {
            const email    = profile?.email ?? '';
            const subject  = encodeURIComponent('Account Deletion Request');
            const body     = encodeURIComponent(
              `Hi SafeRide,\n\nPlease delete my account and all associated personal data.\n\nAccount email: ${email}\n\nI understand this cannot be undone.`,
            );
            void Linking.openURL(`mailto:support@saferide.co.in?subject=${subject}&body=${body}`);
          },
        },
      ],
    );
  }

  function handleSelectLanguage() {
    Alert.alert(
      t('profile.selectLanguage'),
      undefined,
      SUPPORTED_LANGUAGES.map(l => ({
        text: l.label,
        onPress: () => void setStoredLanguage(l.code),
      })),
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <SRText variant="heading" color={colors.white}>
              {initials}
            </SRText>
          </View>
          <SRText variant="heading" style={{ marginTop: spacing[4] }}>
            {profile?.name ?? '—'}
          </SRText>
          <View style={{ marginTop: spacing[2] }}>
            <SRBadge label={t('profile.role')} variant="active" />
          </View>
        </View>

        {/* ── Child ───────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            {t('profile.yourChild')}
          </SRText>
          <InfoRow
            icon={<User size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label={t('profile.childName')}
            value={profile?.childName ?? '—'}
          />
          <InfoRow
            icon={<User size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label={t('profile.childClass')}
            value={profile?.childClass ?? '—'}
          />
          <InfoRow
            icon={<Bus size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label={t('profile.childBus')}
            value={profile?.busId ? `Bus ${profile.busId}` : '—'}
          />
          <InfoRow
            icon={<MapPin size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label={t('profile.childStop')}
            value={profile?.stopId ?? '—'}
            last
          />
        </View>

        {/* ── Account ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            {t('profile.account')}
          </SRText>
          <InfoRow
            icon={<User size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label={t('profile.accountName')}
            value={profile?.name ?? '—'}
          />
          {profile?.email && (
            <InfoRow
              icon={<Mail size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
              label={t('profile.accountEmail')}
              value={profile.email}
            />
          )}
          {profile?.phone && (
            <InfoRow
              icon={<Phone size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
              label={t('profile.accountPhone')}
              value={profile.phone}
            />
          )}
          <InfoRow
            icon={<Globe size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label={t('profile.accountLanguage')}
            value={profile?.preferredLanguage ?? 'English'}
            last
            onPress={handleSelectLanguage}
          />
        </View>

        {/* ── Notifications ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            {t('profile.notifications')}
          </SRText>
          <SwitchRow label={t('profile.notifDeparted')} value={notifDeparted} onChange={setDeparted} />
          <SwitchRow label={t('profile.notif10min')}    value={notif10Min}    onChange={set10Min}    />
          <SwitchRow label={t('profile.notif5min')}     value={notif5Min}     onChange={set5Min}     />
          <SwitchRow label={t('profile.notifStop')}     value={notifStop}     onChange={setStop}     />
          <SwitchRow label={t('profile.notifSchool')}   value={notifSchool}   onChange={setSchool}   />
          <SwitchRow label={t('profile.notifDelay')}    value={notifDelay}    onChange={setDelay}    />
          <SwitchRow label={t('profile.notifSms')}      value={notifSms}      onChange={setSms}      last />
        </View>

        {/* ── Legal ────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            {t('profile.legal')}
          </SRText>
          <ActionRow
            icon={<Shield size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label={t('profile.privacyPolicy')}
            color={colors.ink}
            onPress={() => { void Linking.openURL('https://saferide.co.in/privacy'); }}
          />
          <ActionRow
            icon={<FileText size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label={t('profile.termsOfService')}
            color={colors.ink}
            onPress={() => { void Linking.openURL('https://saferide.co.in/terms'); }}
          />
          <ActionRow
            icon={<Trash2 size={iconSize.sm} color={colors.gold} strokeWidth={2} />}
            label={t('profile.deleteAccount')}
            color={colors.gold}
            last
            onPress={handleDeleteAccount}
          />
        </View>

        {/* ── Sign out ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <LogOut size={iconSize.sm} color={colors.gold} strokeWidth={2} />
          <SRText variant="body" color={colors.gold} style={{ fontWeight: '500' }}>
            {t('profile.signOut')}
          </SRText>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

interface InfoRowProps {
  icon:     React.ReactNode;
  label:    string;
  value:    string;
  last?:    boolean;
  onPress?: () => void;
}

function InfoRow({ icon, label, value, last = false, onPress }: InfoRowProps) {
  return (
    <TouchableOpacity
      style={[styles.infoRow, last && styles.infoRowLast]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <SRText variant="caption" color={colors.slate} style={{ marginBottom: 1 }}>
          {label}
        </SRText>
        <SRText variant="body" style={{ fontWeight: '500' }}>
          {value}
        </SRText>
      </View>
    </TouchableOpacity>
  );
}

// ── ActionRow — for destructive / single-label tappable rows ─────────────────

interface ActionRowProps {
  icon:    React.ReactNode;
  label:   string;
  color:   string;
  last?:   boolean;
  onPress: () => void;
}

function ActionRow({ icon, label, color, last = false, onPress }: ActionRowProps) {
  return (
    <TouchableOpacity
      style={[styles.infoRow, last && styles.infoRowLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.infoIcon}>{icon}</View>
      <SRText variant="body" color={color} style={{ fontWeight: '500', flex: 1 }}>
        {label}
      </SRText>
    </TouchableOpacity>
  );
}

// ── SwitchRow ─────────────────────────────────────────────────────────────────

interface SwitchRowProps {
  label:    string;
  value:    boolean;
  onChange: (v: boolean) => void;
  last?:    boolean;
}

function SwitchRow({ label, value, onChange, last = false }: SwitchRowProps) {
  return (
    <View style={[styles.switchRow, last && styles.infoRowLast]}>
      <SRText variant="body" style={{ flex: 1 }}>
        {label}
      </SRText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.sage, false: colors.stone }}
        thumbColor={colors.white}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing[6], gap: spacing[6] },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    alignItems:      'center',
    paddingVertical: spacing[6],
    gap:             spacing[1],
  },
  avatar: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: colors.slate,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Section ─────────────────────────────────────────────────────────────────
  section: {
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    borderWidth:     0.5,
    borderColor:     colors.stone,
    overflow:        'hidden',
  },
  sectionTitle: {
    paddingHorizontal: spacing[4],
    paddingTop:        spacing[4],
    paddingBottom:     spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },

  // ── Info row ────────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoIcon: {
    marginTop: 2,
    width:     iconSize.sm,
  },

  // ── Switch row ──────────────────────────────────────────────────────────────
  switchRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3] + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stone,
  },

  // ── Sign out ─────────────────────────────────────────────────────────────────
  signOutBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing[2],
    padding:         spacing[4],
    backgroundColor: colors.goldAlpha20,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.gold,
  },
});
