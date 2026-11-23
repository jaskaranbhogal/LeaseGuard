import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import { firstName, useLandlordDemo } from '../../context/LandlordDemoContext';
import type { LandlordStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<LandlordStackParamList, 'MoveInTour'>;

export default function MoveInTourScreen({ navigation, route }: Props) {
  const { propertyId, unitId } = route.params;
  const { findUnit } = useLandlordDemo();
  const found = findUnit(propertyId, unitId);
  if (!found)
    return (
      <ScreenContainer style={styles.content}>
        <ScreenTitle
          title="Move-in baseline"
          onBack={() => navigation.goBack()}
        />
        <Text>
          This unit is unavailable. Refresh the dashboard before continuing.
        </Text>
      </ScreenContainer>
    );
  const { unit } = found;
  const who = unit.tenant ? firstName(unit.tenant) : 'your tenant';
  function start() {
    navigation.navigate('MoveInBaseline', { unitId });
  }

  return (
    <ScreenContainer style={styles.content}>
      <ScreenTitle
        title="Move-in baseline"
        onBack={() => navigation.goBack()}
      />
      <Text style={styles.intro}>
        {`Record how Unit ${unit.name} looks before ${who} moves in. Approved baseline versions can be compared with compatible future inspections.`}
      </Text>
      <View style={styles.guide}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>GUIDED</Text>
        </View>
        <Text style={styles.guideText}>
          Review the configured areas below, then select a saved layout or
          resume a draft. Existing drafts keep their original areas. Get the
          whole area in frame.
        </Text>
      </View>
      <View style={styles.card}>
        {unit.areas.map((area, index) => (
          <View
            key={area}
            style={[
              styles.row,
              index < unit.areas.length - 1 && styles.divider,
            ]}
          >
            <View style={styles.number}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>
            <Text style={styles.area}>{area}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.meta}>
        {`${unit.areas.length} areas • about ${Math.max(
          5,
          unit.areas.length * 2.5,
        )} minutes • you can pause and come back`}
      </Text>
      <ActionButton title="Start or resume baseline" onPress={start} />
      <ActionButton
        title="Do this later"
        variant="secondary"
        onPress={() => navigation.goBack()}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
  },
  intro: { fontSize: 14, lineHeight: 20, color: colors.muted },
  guide: {
    gap: 8,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.brandTint,
  },
  tagText: {
    fontSize: 11,
    fontWeight: typography.bold,
    letterSpacing: 0.3,
    color: colors.brand,
  },
  guideText: { fontSize: 14, lineHeight: 20, color: colors.ink },
  card: {
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 13,
    fontWeight: typography.bold,
    color: colors.brand,
  },
  area: { flex: 1, fontSize: 15, color: colors.ink },
  done: {
    fontSize: 12,
    fontWeight: typography.semibold,
    color: colors.successText,
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.muted,
  },
});
