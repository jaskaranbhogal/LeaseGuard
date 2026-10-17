import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

export default function DemoNotice() {
  return (
    <Text style={styles.notice}>
      Demo · Sample records and dates. No property is assigned to this account.
      Nothing is captured, analyzed, or sent.
    </Text>
  );
}
const styles = StyleSheet.create({
  notice: {
    color: colors.label,
    fontSize: 13,
    lineHeight: 19,
    marginVertical: 12,
  },
});
