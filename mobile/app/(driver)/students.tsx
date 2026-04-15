/**
 * Driver — Students tab
 *
 * Shows all active students assigned to the driver's bus, grouped by stop.
 * Driver taps a student row to toggle their boarding status (board / deboard).
 * Boarding status is read from RTDB via useBoardingStatus so the UI stays
 * in sync with any other device that records an event for the same bus.
 *
 * Requires an active trip — if the bus has no active trip, a prompt is shown.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, Circle, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { SRText } from '@/components/ui/SRText';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors, spacing, radius, iconSize } from '@/theme';
import { tripClient } from '@/api/trip.client';
import type { Trip } from '@/api/trip.client';
import { routeClient } from '@/api/route.client';
import type { Student, Stop } from '@/api/route.client';
import { useBoardingStatus } from '@/hooks/useBoardingStatus';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StopGroup {
  stop:     Stop;
  students: Student[];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function StudentsScreen() {
  const insets  = useSafeAreaInsets();
  const { t }   = useTranslation();
  const profile = useAuthStore((s) => s.profile);

  const [activeTrip,  setActiveTrip]  = useState<Trip | null>(null);
  const [stopGroups,  setStopGroups]  = useState<StopGroup[]>([]);
  const [unassigned,  setUnassigned]  = useState<Student[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [toggling,    setToggling]    = useState<Set<string>>(new Set());

  const busId          = profile?.busId ?? '';
  const boardingStatus = useBoardingStatus(busId);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!busId) {
      setLoading(false);
      return;
    }

    try {
      const [trip, students] = await Promise.all([
        tripClient.getActive(),
        routeClient.listStudentsByBus(busId),
      ]);

      setActiveTrip(trip);

      if (!trip?.routeId || students.length === 0) {
        setStopGroups([]);
        setUnassigned(students);
        return;
      }

      // Fetch stops for the active route so we can group students
      const stops = await routeClient.listStops(trip.routeId);

      // Build stop → students map
      const byStopId = new Map<string, Student[]>();
      const noStop:  Student[] = [];

      for (const student of students) {
        if (student.stopId) {
          const bucket = byStopId.get(student.stopId) ?? [];
          bucket.push(student);
          byStopId.set(student.stopId, bucket);
        } else {
          noStop.push(student);
        }
      }

      // Only include stops that have at least one student
      const groups: StopGroup[] = stops
        .filter((s) => byStopId.has(s.id))
        .map((s)   => ({ stop: s, students: byStopId.get(s.id)! }));

      setStopGroups(groups);
      setUnassigned(noStop);
    } catch {
      // Keep previous data visible on transient errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [busId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  // ── Boarding toggle ───────────────────────────────────────────────────────

  const handleToggle = useCallback(async (student: Student) => {
    if (!activeTrip) return;
    if (toggling.has(student.id)) return;

    const currentStatus = boardingStatus[student.id];
    const isBoarded     = currentStatus?.status === 'boarded';
    const eventType     = isBoarded ? 'deboarded' : 'boarded';

    setToggling((prev) => new Set(prev).add(student.id));
    try {
      await tripClient.recordBoarding(activeTrip.id, {
        studentId:  student.id,
        stopId:     student.stopId ?? null,
        eventType,
        method:     'manual',
        recordedAt: Date.now(),
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'ALREADY_BOARDED') {
        Alert.alert('', t('boarding.alreadyBoarded'));
      } else {
        Alert.alert('', t('boarding.errorBoarding'));
      }
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
    }
  }, [activeTrip, boardingStatus, toggling, t]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.sage} />
      </View>
    );
  }

  if (!activeTrip) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Users size={iconSize.xl} color={colors.slate} strokeWidth={2} />
        <SRText variant="cardTitle" color={colors.slate} style={styles.emptyTitle}>
          {t('driver.noAssignment')}
        </SRText>
      </View>
    );
  }

  const allStudentsCount = stopGroups.reduce((n, g) => n + g.students.length, 0) + unassigned.length;

  if (allStudentsCount === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Users size={iconSize.xl} color={colors.slate} strokeWidth={2} />
        <SRText variant="cardTitle" color={colors.slate} style={styles.emptyTitle}>
          {t('boarding.noStudents')}
        </SRText>
      </View>
    );
  }

  // Build the flat list items: stop-header rows + student rows
  type ListItem =
    | { kind: 'header'; stop: Stop }
    | { kind: 'student'; student: Student }
    | { kind: 'unassigned-header' };

  const items: ListItem[] = [];
  for (const group of stopGroups) {
    items.push({ kind: 'header',  stop: group.stop });
    for (const student of group.students) {
      items.push({ kind: 'student', student });
    }
  }
  if (unassigned.length > 0) {
    items.push({ kind: 'unassigned-header' });
    for (const student of unassigned) {
      items.push({ kind: 'student', student });
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <SRText variant="heading">{t('boarding.tab')}</SRText>
        <SRText variant="caption" color={colors.slate}>
          {allStudentsCount} student{allStudentsCount !== 1 ? 's' : ''}
        </SRText>
      </View>

      <FlatList<ListItem>
        data={items}
        keyExtractor={(item, idx) =>
          item.kind === 'header'            ? `stop-${item.stop.id}`
          : item.kind === 'unassigned-header' ? 'unassigned-header'
          : `student-${item.student.id}-${idx}`
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.sage}
          />
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
              <View style={styles.stopHeader}>
                <SRText variant="label" color={colors.slate}>
                  Stop {item.stop.sequence}
                </SRText>
                <SRText variant="subheading" color={colors.forest}>
                  {item.stop.name}
                </SRText>
              </View>
            );
          }

          if (item.kind === 'unassigned-header') {
            return (
              <View style={styles.stopHeader}>
                <SRText variant="subheading" color={colors.slate}>
                  No stop assigned
                </SRText>
              </View>
            );
          }

          // Student row
          const { student } = item;
          const status      = boardingStatus[student.id];
          const isBoarded   = status?.status === 'boarded';
          const isBusy      = toggling.has(student.id);

          return (
            <TouchableOpacity
              style={styles.studentRow}
              onPress={() => void handleToggle(student)}
              activeOpacity={0.75}
              disabled={isBusy}
            >
              {/* Boarding icon */}
              <View style={styles.iconWrap}>
                {isBusy ? (
                  <ActivityIndicator size="small" color={colors.sage} />
                ) : isBoarded ? (
                  <CheckCircle
                    size={iconSize.lg}
                    color={colors.sage}
                    strokeWidth={2}
                  />
                ) : (
                  <Circle
                    size={iconSize.lg}
                    color={colors.stone}
                    strokeWidth={2}
                  />
                )}
              </View>

              {/* Student info */}
              <View style={styles.studentInfo}>
                <SRText variant="body" color={colors.forest}>
                  {student.name}
                </SRText>
                <SRText variant="caption" color={colors.slate}>
                  {student.parentName}
                </SRText>
              </View>

              {/* Badge */}
              <SRBadge
                label={isBoarded ? t('boarding.onBoard') : t('boarding.notBoarded')}
                variant={isBoarded ? 'active' : 'muted'}
              />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.background,
  },
  center: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.background,
    gap:             spacing[3],
    paddingHorizontal: spacing[6],
  },
  emptyTitle: {
    textAlign: 'center',
    marginTop: spacing[2],
  },

  header: {
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[5],
    paddingBottom:     spacing[3],
    gap:               spacing[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stone,
  },

  list: {
    paddingBottom: spacing[8],
  },

  stopHeader: {
    paddingHorizontal: spacing[5],
    paddingTop:        spacing[5],
    paddingBottom:     spacing[2],
    gap:               spacing[1],
    backgroundColor:   colors.background,
  },

  studentRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical:   spacing[4],
    backgroundColor:   colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stone,
  },
  iconWrap: {
    width:           iconSize.lg,
    alignItems:      'center',
    justifyContent:  'center',
  },
  studentInfo: {
    flex: 1,
    gap:  spacing[1],
  },
});
