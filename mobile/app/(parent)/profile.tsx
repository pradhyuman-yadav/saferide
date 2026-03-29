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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, User, Mail, Phone, Globe, Bus, MapPin } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth.store';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
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
      'Sign out',
      'You will be signed out of SafeRide.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => void signOut(),
        },
      ],
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
            <SRBadge label="Parent" variant="active" />
          </View>
        </View>

        {/* ── Child ───────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            Your child
          </SRText>
          <InfoRow
            icon={<User size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label="Name"
            value={profile?.childName ?? '—'}
          />
          <InfoRow
            icon={<User size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label="Class"
            value={profile?.childClass ?? '—'}
          />
          <InfoRow
            icon={<Bus size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label="Bus"
            value={profile?.busId ? `Bus ${profile.busId}` : '—'}
          />
          <InfoRow
            icon={<MapPin size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label="Stop"
            value={profile?.stopId ?? '—'}
            last
          />
        </View>

        {/* ── Account ─────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            Account
          </SRText>
          <InfoRow
            icon={<User size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label="Name"
            value={profile?.name ?? '—'}
          />
          {profile?.email && (
            <InfoRow
              icon={<Mail size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
              label="Email"
              value={profile.email}
            />
          )}
          {profile?.phone && (
            <InfoRow
              icon={<Phone size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
              label="Phone"
              value={profile.phone}
            />
          )}
          <InfoRow
            icon={<Globe size={iconSize.sm} color={colors.slate} strokeWidth={2} />}
            label="Language"
            value={profile?.preferredLanguage ?? 'English'}
            last
          />
        </View>

        {/* ── Notifications ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SRText variant="label" color={colors.slate} style={styles.sectionTitle}>
            Notifications
          </SRText>
          <SwitchRow label="Bus departed"       value={notifDeparted} onChange={setDeparted} />
          <SwitchRow label="10 minutes away"    value={notif10Min}    onChange={set10Min}    />
          <SwitchRow label="5 minutes away"     value={notif5Min}     onChange={set5Min}     />
          <SwitchRow label="Arrived at stop"    value={notifStop}     onChange={setStop}     />
          <SwitchRow label="Arrived at school"  value={notifSchool}   onChange={setSchool}   />
          <SwitchRow label="Delay alerts"       value={notifDelay}    onChange={setDelay}    />
          <SwitchRow label="SMS fallback"       value={notifSms}      onChange={setSms}      last />
        </View>

        {/* ── Sign out ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <LogOut size={iconSize.sm} color={colors.gold} strokeWidth={2} />
          <SRText variant="body" color={colors.gold} style={{ fontWeight: '500' }}>
            Sign out
          </SRText>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────────

interface InfoRowProps {
  icon:  React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}

function InfoRow({ icon, label, value, last = false }: InfoRowProps) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <SRText variant="caption" color={colors.slate} style={{ marginBottom: 1 }}>
          {label}
        </SRText>
        <SRText variant="body" style={{ fontWeight: '500' }}>
          {value}
        </SRText>
      </View>
    </View>
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
