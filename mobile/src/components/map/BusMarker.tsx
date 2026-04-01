import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Navigation } from 'lucide-react-native';
import { SRText } from '@/components/ui/SRText';
import { colors, radius } from '@/theme';
import type { Coordinates } from '@/types/bus';

interface BusMarkerProps {
  coords:    Coordinates;
  busNumber: string;
  isActive?: boolean;
  /** Compass heading in degrees (0 = North, 90 = East).
   *  When provided the arrow rotates to show direction of travel.
   *  Pass undefined when heading is unavailable (offline / stationary). */
  heading?:  number;
}

export function BusMarker({
  coords,
  busNumber,
  isActive = true,
  heading,
}: BusMarkerProps) {
  const hasHeading = heading !== undefined && heading >= 0;

  return (
    <Marker
      coordinate={coords}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      // react-native-maps rotates the entire marker view clockwise by this many degrees
      rotation={hasHeading ? heading : 0}
    >
      <View style={styles.wrapper}>
        {/* Pulse ring — active buses only */}
        {isActive && <View style={styles.ring} />}

        {/* Marker body */}
        <View style={[styles.marker, isActive ? styles.active : styles.inactive]}>
          {hasHeading ? (
            // Arrow points in direction of travel; rotates with the marker
            <Navigation
              size={16}
              color={isActive ? colors.white : colors.forest}
              strokeWidth={2.5}
              fill={isActive ? colors.sage : 'transparent'}
            />
          ) : (
            // No heading → show bus number (offline or stationary)
            <SRText variant="label" color={colors.white} style={styles.label}>
              {busNumber}
            </SRText>
          )}
        </View>
      </View>
    </Marker>
  );
}

const MARKER_SIZE = 36;

const styles = StyleSheet.create({
  wrapper: {
    alignItems:     'center',
    justifyContent: 'center',
    width:          MARKER_SIZE + 12,
    height:         MARKER_SIZE + 12,
  },
  marker: {
    width:           MARKER_SIZE,
    height:          MARKER_SIZE,
    borderRadius:    radius.full,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          2,
  },
  active: {
    backgroundColor: colors.forest,
    borderWidth:     2,
    borderColor:     colors.mist,
  },
  inactive: {
    backgroundColor: colors.slate,
    borderWidth:     2,
    borderColor:     colors.stone,
  },
  ring: {
    position:     'absolute',
    top:          0,
    left:         0,
    width:        MARKER_SIZE + 12,
    height:       MARKER_SIZE + 12,
    borderRadius: radius.full,
    borderWidth:  1.5,
    borderColor:  colors.sageAlpha25,
    zIndex:       1,
  },
  label: {
    fontSize:   11,
    lineHeight: 13,
  },
});
