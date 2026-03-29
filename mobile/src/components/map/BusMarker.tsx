import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { SRText } from '@/components/ui/SRText';
import { colors, radius, spacing } from '@/theme';
import type { Coordinates } from '@/types/bus';

interface BusMarkerProps {
  coords: Coordinates;
  busNumber: string;
  isActive?: boolean;
}

export function BusMarker({ coords, busNumber, isActive = true }: BusMarkerProps) {
  return (
    <Marker coordinate={coords} anchor={{ x: 0.5, y: 0.5 }}>
      <View style={[styles.marker, isActive ? styles.active : styles.inactive]}>
        <SRText
          variant="label"
          color={colors.white}
          style={{ fontSize: 11 }}
        >
          {busNumber}
        </SRText>
      </View>
      {/* Pulse ring */}
      {isActive && <View style={styles.ring} />}
    </Marker>
  );
}

const MARKER_SIZE = 36;

const styles = StyleSheet.create({
  marker: {
    width:          MARKER_SIZE,
    height:         MARKER_SIZE,
    borderRadius:   radius.full,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex: 2,
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
    position:        'absolute',
    top:             -6,
    left:            -6,
    width:           MARKER_SIZE + 12,
    height:          MARKER_SIZE + 12,
    borderRadius:    radius.full,
    borderWidth:     1.5,
    borderColor:     colors.sageAlpha25,
    zIndex:          1,
  },
});
